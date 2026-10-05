#!/usr/bin/env node
// ============================================================
// Fase 9.4 - checklist de rotacao das 5 chaves expostas no Git
// ============================================================
// Para cada chave do lembrete de seguranca:
//   * diz ONDE rotacionar (painel/URL)
//   * confere se o valor ATUAL do .env/.env.local ainda aparece no
//     historico do Git (git log --all -S) - se aparece, a chave
//     exposta continua em uso e AINDA NAO foi rotacionada
//   * detecta chave ausente ou placeholder de exemplo
// NUNCA imprime o valor das chaves (apenas tamanho e status).
//
// Fluxo de rotacao:
//   1. rode aqui e ve o que esta pendente
//   2. rotacione no painel indicado (gerar nova, revogar a antiga)
//   3. atualize .env/.env.local E as variaveis da Vercel
//   4. rode de novo - tudo "ok" = historico sem a chave atual
//
// Uso: node scripts/ops/rotation-checklist.mjs
// Exit: 0 = todas ok; 1 = ha pendencias (ou git indisponivel).
// ============================================================

import { execFileSync } from "node:child_process";
import { loadRootEnv, ROOT } from "./env.mjs";

const KEYS = [
  {
    name: "OPENAI_API_KEY",
    where: "OpenAI Platform > API keys (https://platform.openai.com/api-keys) - gerar nova e revogar a antiga",
  },
  {
    name: "KOMUNIKA_API_TOKEN",
    where: "painel Komunika > API/Integracoes - gerar novo token",
  },
  {
    name: "KOMUNIKA_WEBHOOK_SECRET",
    where: "painel Komunika > Webhooks - regenerar o secret de assinatura",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    where: "Supabase Dashboard > Project Settings > API > service_role (https://supabase.com/dashboard/project/iggytvmpkwyfxylgdpkk/settings/api) - Rotate API Keys",
  },
  {
    name: "LOJOU_WEBHOOK_SECRET",
    where: "painel Lojou > Webhooks - regenerar o secret de assinatura",
  },
];

function isPlaceholder(value) {
  return (
    value.length < 16 ||
    /your|placeholder|xxx|troque|exemplo|sua-chave|changeme|dummy|legado/i.test(value)
  );
}

function gitCommitsWith(value) {
  try {
    const out = execFileSync(
      "git",
      ["log", "--all", `-S${value}`, "--format=%h", "--"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return null; // git indisponivel / repositorio invalido
  }
}

const env = loadRootEnv();
console.log("Checklist de rotacao das chaves expostas (Fase 9.4)\n");

let pending = 0;
let gitOk = true;

for (const { name, where } of KEYS) {
  const value = env[name] ?? "";
  console.log(`${name}`);
  console.log(`  onde rotacionar: ${where}`);

  if (!value) {
    console.log("  status: FAIL AUSENTE no .env/.env.local - configurar apos rotacionar\n");
    pending += 1;
    continue;
  }

  const commits = gitCommitsWith(value);
  if (commits === null) {
    gitOk = false;
    console.log(`  status: FAIL NAO VERIFICADO (git indisponivel) - len=${value.length}\n`);
    pending += 1;
    continue;
  }

  if (isPlaceholder(value)) {
    console.log("  status: FAIL PLACEHOLDER de exemplo - trocar pelo valor rotacionado\n");
    pending += 1;
    continue;
  }

  if (commits.length > 0) {
    console.log(
      `  status: FAIL EXPOSTA - o valor atual aparece em ${commits.length} commit(s) do historico ` +
        `(${commits.slice(0, 3).join(", ")}${commits.length > 3 ? ", ..." : ""}) - rotacionar!\n`
    );
    pending += 1;
    continue;
  }

  console.log(`  status: ok   fora do historico do Git (len=${value.length})\n`);
}

console.log("---");
console.log(
  `Resultado: ${KEYS.length - pending}/${KEYS.length} ok. Lembrete: apos rotacionar, ` +
    "atualize .env/.env.local E a Vercel (Settings > Environment Variables) e re-rode este script."
);
if (!gitOk) console.log("Obs.: verificacao de historico falhou - rodar dentro do repositorio Git.");
process.exit(pending === 0 && gitOk ? 0 : 1);
