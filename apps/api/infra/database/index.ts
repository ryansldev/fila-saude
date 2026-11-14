import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import env from "../env";
import * as auth from "./central/schema/auth";
import * as municipio from "./central/schema/municipio";
import * as push from "./central/schema/push";

// Banco central (`fila_central`, PD-14/PD-16). Os bancos dos municípios ficam em outro módulo.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const schemaCentral = { ...auth, ...municipio, ...push };

const database = drizzle(pool, { schema: schemaCentral });

export type Db = typeof database;

export default database;
