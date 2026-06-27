import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import env from "./env";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

const database = drizzle(pool);

export default database;
