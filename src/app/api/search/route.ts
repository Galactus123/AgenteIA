import { NextRequest, NextResponse } from "next/server";
import { requireClinic } from "@/lib/api-auth";
import { globalSearch } from "@/lib/services/search";
import { SEARCH_MAX_QUERY } from "@/lib/search";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Busca global do dashboard (Ctrl/Cmd+K). Mesmo gate das rotas CRUD
// (auth + assinatura ativa) e o mesmo escopo de tenant via clinic_id.
export async function GET(request: NextRequest) {
  const session = await requireClinic(request);
  if (session instanceof NextResponse) return session;

  // Tecla a cada 300ms de debounce: 60 pedidos/min por IP já deixa margem
  // folgada para um humano e corta varredura automatizada de CPF/telefone.
  const limit = rateLimit(`search:${clientIp(request)}:${session.clinicId}`, 60, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const raw = request.nextUrl.searchParams.get("q") ?? "";
  const query = raw.slice(0, SEARCH_MAX_QUERY);
  const results = await globalSearch(session.clinicId, query);

  return NextResponse.json({ query, results });
}
