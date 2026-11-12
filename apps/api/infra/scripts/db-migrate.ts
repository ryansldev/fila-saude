import database, { pool } from "infra/database";
import { criarBancoSeNaoExiste } from "infra/database/criar-banco";
import { migrarTodos } from "infra/database/migrar";
import env from "infra/env";

// T1.7 / PD-16: `npm run db:migrate` cria o banco central se faltar, migra o central e depois cada
// município `ativo` ou `criando`. Sai com 1 se algum tenant falhar; rodar de novo retoma os que falharam.
async function main() {
  try {
    // O pool do central só conecta na primeira consulta, então criar o banco antes basta.
    await criarBancoSeNaoExiste(env.DATABASE_URL, new URL(env.DATABASE_URL).pathname.slice(1));

    const { central, tenants } = await migrarTodos({
      central: database,
      urlCentral: env.DATABASE_URL,
      template: env.TENANT_DATABASE_URL_TEMPLATE,
    });

    console.log(`central: ${central}`);
    for (const t of tenants) {
      if (t.ok) console.log(`${t.slug}: ${t.versao}`);
      else console.error(`${t.slug}: erro: ${t.erro}`);
    }
    return tenants.some((t) => !t.ok) ? 1 : 0;
  } finally {
    await pool.end();
  }
}

process.exitCode = await main();
