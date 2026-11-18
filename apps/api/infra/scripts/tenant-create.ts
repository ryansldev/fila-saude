import { parseArgs } from "node:util";
import database, { pool } from "infra/database";
import env from "infra/env";
import { ApiError } from "infra/errors";
import { createTenant } from "infra/tenant/create";

// T1.7 / PD-14: `npm run tenant:create -- --slug pref-a --name "Prefeitura A" --uf SP [--timeZone America/Recife]`.
// Pode ser rodado de novo com o mesmo slug: uma criação interrompida é retomada.
const { values } = parseArgs({
  options: {
    slug: { type: "string" },
    name: { type: "string" },
    uf: { type: "string" },
    timeZone: { type: "string" },
  },
});

async function main() {
  const { slug, name, uf, timeZone } = values;
  if (!slug || !name || !uf) {
    console.error('uso: npm run tenant:create -- --slug <slug> --name "<nome>" --uf <UF> [--timeZone <fuso>]');
    return 2;
  }

  try {
    const { municipalityId } = await createTenant(
      { slug, name, uf, ...(timeZone ? { timeZone } : {}) },
      { central: database, template: env.TENANT_DATABASE_URL_TEMPLATE },
    );
    console.log(`município ${slug} ativo (id ${municipalityId})`);
    return 0;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`erro: ${error.code}`);
      return 1;
    }
    throw error;
  } finally {
    await pool.end();
  }
}

process.exitCode = await main();
