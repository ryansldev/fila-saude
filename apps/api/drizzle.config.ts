import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import env from './infra/env';

export default defineConfig({
  out: './drizzle',
  schema: './infra/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
