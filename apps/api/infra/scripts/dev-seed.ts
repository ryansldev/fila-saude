import database, { pool } from "infra/database";
import { criarBancoSeNaoExiste } from "infra/database/criar-banco";
import { migrarBanco } from "infra/database/migrar";
import env from "infra/env";
import { podeSemear } from "infra/exemplo/pode-semear";
import { semearExemplo } from "infra/exemplo/semear";

// PD-40: `npm run dev:seed` apaga e recria o município `exemplo` com dados de exemplo.
async function main() {
  if (!podeSemear(env)) {
    console.error("dev:seed só roda com NODE_ENV=development e TENANT_MODE=multi");
    return 1;
  }
  try {
    await criarBancoSeNaoExiste(env.DATABASE_URL, new URL(env.DATABASE_URL).pathname.slice(1));
    await migrarBanco(env.DATABASE_URL, "central");
    const r = await semearExemplo({ central: database, template: env.TENANT_DATABASE_URL_TEMPLATE, agora: Date.now() });
    console.log(`\nPainel: ${r.painel}\n`);
    console.log("Usuários do painel:");
    for (const u of r.usuarios) console.log(`  login ${u.login.padEnd(11)} senha ${u.senha}  ${u.papel}`);
    console.log("\nPacientes (app, login pelo CPF):");
    for (const p of r.pacientes) console.log(`  ${p.nome.padEnd(12)} CPF ${p.cpf}  senha ${p.senha}`);
    console.log("\nSessões (hora local):");
    for (const s of r.sessoes) console.log(`  ${s.servico} · ${s.visibilidade} · ${s.inicioLocal.replace("T", " ")}`);
    return 0;
  } finally {
    await pool.end();
  }
}

process.exitCode = await main();
