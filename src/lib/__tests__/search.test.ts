import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do supabaseAdmin: cadeia thenable do harness compartilhado — cada
// consulta fica registada e o resolver do teste devolve as linhas.
vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

import {
  SEARCH_MIN_CHARS,
  buildPatterns,
  datePatterns,
  orIlike,
  sanitizeQuery,
} from "@/lib/search";
import { globalSearch } from "@/lib/services/search";
import { fakeSupabase } from "./helpers/supabase-fake";

const CLINIC_ID = 7;

beforeEach(() => {
  fakeSupabase.reset();
});

describe("sanitizeQuery", () => {
  it("remove aspas, vírgulas, parênteses e barra invertida (gramática do or())", () => {
    expect(sanitizeQuery('ana" , (jr) \\ 100%')).toBe("ana jr 100%");
  });

  it("colapsa espaços, aparfa e limita o tamanho", () => {
    expect(sanitizeQuery("   maria   sousa  ")).toBe("maria sousa");
    expect(sanitizeQuery("x".repeat(200))).toHaveLength(80);
  });
});

describe("buildPatterns", () => {
  it("mantém o termo quando não tem dígitos", () => {
    expect(buildPatterns("maria")).toEqual(["maria"]);
  });

  it("acrescenta a variante só com dígitos para telefone/documento", () => {
    expect(buildPatterns("84 99999-9999")).toEqual(["84 99999-9999", "84999999999"]);
  });

  it("ignora variante de dígitos curta demais", () => {
    expect(buildPatterns("12")).toEqual(["12"]);
  });
});

describe("datePatterns", () => {
  it("dd/mm/aaaa vira data ISO + subcadeia mm-dd", () => {
    expect(datePatterns("16/10/2026")).toEqual(["2026-10-16", "10-16"]);
  });

  it("dd/mm sem ano vira subcadeia mm-dd (aparece dentro de 2026-10-16)", () => {
    expect(datePatterns("16/10")).toEqual(["10-16"]);
  });

  it("devolve vazio quando o termo não é data", () => {
    expect(datePatterns("maria")).toEqual([]);
  });
});

describe("orIlike", () => {
  it("cruza colunas com padrões e protege o valor entre aspas", () => {
    expect(orIlike(["name", "phone"], ["ana", "1111"])).toBe(
      'name.ilike."ana",name.ilike."1111",phone.ilike."ana",phone.ilike."1111"'
    );
  });

  it("devolve null sem colunas", () => {
    expect(orIlike([], ["ana"])).toBeNull();
  });
});

describe("globalSearch", () => {
  it("não consulta nada com termo curto", async () => {
    await expect(globalSearch(CLINIC_ID, "a")).resolves.toEqual([]);
    expect(fakeSupabase.queries).toHaveLength(0);
  });

  it("consulta as 4 tabelas com clinic_id e devolve os hits na ordem das categorias", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "patients") {
        return {
          data: [
            {
              id: "p-1",
              name: "Ana Silva",
              phone: "(84) 99999-9999",
              email: "",
              cpf: "",
            },
          ],
        };
      }
      if (q.table === "professionals") {
        return {
          data: [
            {
              id: "d-1",
              name: "Dr. João",
              specialty_name: "",
              phone: "",
              email: "",
              specialties: { name: "Cardiologia" },
            },
          ],
        };
      }
      if (q.table === "appointments") {
        return {
          data: [
            {
              id: 12,
              patient_name: "Ana Silva",
              starts_at: "2026-10-16 09:30",
              status: "scheduled",
              professionals: { name: "Dr. João" },
            },
          ],
        };
      }
      return { data: [{ id: 3, name: "Cardiologia", description: "Coração" }] };
    });

    const hits = await globalSearch(CLINIC_ID, "ana");

    expect(hits.map((hit) => hit.kind)).toEqual([
      "paciente",
      "medico",
      "consulta",
      "especialidade",
    ]);
    expect(hits[0]).toMatchObject({
      id: "p-1",
      title: "Ana Silva",
      description: "Paciente • (84) 99999-9999",
      href: "/pacientes?id=p-1",
    });
    expect(hits[1].description).toBe("Profissional • Cardiologia");
    expect(hits[2].href).toBe("/consultas?id=12#consulta-12");
    expect(hits[3].href).toBe("/especialidades?id=3");
  });

  it("isola o escopo por clinic_id e limita cada categoria", async () => {
    fakeSupabase.setResolver(() => ({ data: [] }));

    await globalSearch(CLINIC_ID, "ana");

    expect(fakeSupabase.queries).toHaveLength(4);
    for (const table of ["patients", "professionals", "appointments", "specialties"]) {
      const query = fakeSupabase.last(table);
      expect(query).toBeDefined();
      expect(query?.filters).toContain(`clinic_id=${CLINIC_ID}`);
      expect(query?.filters).toContain("limit:5");
      expect(query?.filters.some((f) => f.startsWith("or("))).toBe(true);
    }
  });

  it("sanitiza o termo antes de montar o or() (sem aspas nem vírgulas)", async () => {
    fakeSupabase.setResolver(() => ({ data: [] }));

    await globalSearch(CLINIC_ID, 'ana", jr');

    const orFilter = fakeSupabase
      .last("patients")
      ?.filters.find((f) => f.startsWith("or("));
    expect(orFilter).toBe(
      'or(name.ilike."ana jr",phone.ilike."ana jr",cpf.ilike."ana jr",email.ilike."ana jr")'
    );
  });

  it("devolve só as categorias que responderam quando uma tabela falha", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "patients") return { error: { message: "boom" } };
      if (q.table === "professionals") return { data: [] };
      if (q.table === "appointments") return { data: [] };
      return { data: [{ id: 1, name: "Ortopedia", description: "" }] };
    });

    const hits = await globalSearch(CLINIC_ID, "orto");

    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("especialidade");
    expect(hits[0].description).toBe("Especialidade • sem descrição");
  });

  it("usa a variante de data brasileira para starts_at", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "appointments") {
        return {
          data: [
            {
              id: 44,
              patient_name: "Carlos",
              starts_at: "2026-10-16 14:00",
              status: "scheduled",
              professionals: null,
            },
          ],
        };
      }
      return { data: [] };
    });

    const hits = await globalSearch(CLINIC_ID, "16/10/2026");

    const orFilter = fakeSupabase.last("appointments")?.filters.find((f) => f.startsWith("or("));
    expect(orFilter).toContain('starts_at.ilike."2026-10-16"');
    expect(hits.map((hit) => hit.kind)).toContain("consulta");
    expect(hits[0].description.startsWith("Consulta • ")).toBe(true);
  });
});

describe("limite de caracteres", () => {
  it("respeita o mínimo de caracteres definido no contrato", () => {
    expect(SEARCH_MIN_CHARS).toBe(2);
  });
});
