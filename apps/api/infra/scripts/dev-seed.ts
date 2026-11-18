import database, { pool } from "infra/database";
import { createDatabaseIfMissing } from "infra/database/create-database";
import { migrateDatabase } from "infra/database/migrate";
import env from "infra/env";
import { canSeed } from "infra/example/can-seed";
import { seedExample } from "infra/example/seed";

// PD-40: `npm run dev:seed` apaga e recria o município `exemplo` com dados de exemplo.
async function main() {
  if (!canSeed(env)) {
    console.error("dev:seed só roda com NODE_ENV=development e TENANT_MODE=multi");
    return 1;
  }
  try {
    await createDatabaseIfMissing(env.DATABASE_URL, new URL(env.DATABASE_URL).pathname.slice(1));
    await migrateDatabase(env.DATABASE_URL, "central");
    const r = await seedExample({ central: database, template: env.TENANT_DATABASE_URL_TEMPLATE, now: Date.now() });
    console.log(`\nPainel: ${r.panel}\n`);
    console.log("Usuários do painel:");
    for (const u of r.users) console.log(`  login ${u.login.padEnd(11)} senha ${u.password}  ${u.role}`);
    console.log("\nPacientes (app, login pelo CPF):");
    for (const p of r.patients) console.log(`  ${p.name.padEnd(12)} CPF ${p.cpf}  senha ${p.password}`);
    console.log("\nSessões (hora local):");
    for (const s of r.sessions) console.log(`  ${s.service} · ${s.visibility} · ${s.localStart.replace("T", " ")}`);
    return 0;
  } finally {
    await pool.end();
  }
}

process.exitCode = await main();
