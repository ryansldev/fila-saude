import { parseArgs } from "node:util";
import database, { pool } from "infra/database";
import env from "infra/env";
import { ErroApi } from "infra/erros";
import { criarTenant } from "infra/tenant/criar";

// T1.7 / PD-14: `npm run tenant:create -- --slug pref-a --nome "Prefeitura A" --uf SP [--fuso America/Recife]`.
// Pode ser rodado de novo com o mesmo slug: uma criação interrompida é retomada.
const { values } = parseArgs({
  options: {
    slug: { type: "string" },
    nome: { type: "string" },
    uf: { type: "string" },
    fuso: { type: "string" },
  },
});

async function main() {
  const { slug, nome, uf, fuso } = values;
  if (!slug || !nome || !uf) {
    console.error('uso: npm run tenant:create -- --slug <slug> --nome "<nome>" --uf <UF> [--fuso <fuso>]');
    return 2;
  }

  try {
    const { municipioId } = await criarTenant(
      { slug, nome, uf, ...(fuso ? { fuso } : {}) },
      { central: database, template: env.TENANT_DATABASE_URL_TEMPLATE },
    );
    console.log(`município ${slug} ativo (id ${municipioId})`);
    return 0;
  } catch (erro) {
    if (erro instanceof ErroApi) {
      console.error(`erro: ${erro.codigo}`);
      return 1;
    }
    throw erro;
  } finally {
    await pool.end();
  }
}

process.exitCode = await main();
