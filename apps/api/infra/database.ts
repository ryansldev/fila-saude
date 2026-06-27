import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import env from "./env";

const database = drizzle(env.DATABASE_URL);

export default database;
