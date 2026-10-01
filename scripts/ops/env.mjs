// Carregamento de .env a partir da raiz do repositorio.
// Uso: import { loadRootEnv } from "./env.mjs";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function loadRootEnv(extraFiles = [".env", ".env.local"]) {
  const out = {};
  for (const file of extraFiles) {
    const full = path.join(ROOT, file);
    if (!existsSync(full)) continue;
    for (const rawLine of readFileSync(full, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let value = m[2];
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
      ) {
        value = value.slice(1, -1);
      }
      out[m[1]] = value;
    }
  }
  return { ...out, ...process.env };
}

export { ROOT };
