import { z } from "zod";

const envSchema = z.object({
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),
  POSTGRES_PORT: z.string(),
  POSTGRES_HOST: z.string(),
  DATABASE_URL: z.string(),
});

const env = envSchema.parse(process.env);

export default env;