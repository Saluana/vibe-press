import dotenv from 'dotenv';
import { defineConfig } from "drizzle-kit";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('Environment variable DATABASE_URL must be defined');
}

export default defineConfig({
  schema: './src/core/db/schema/schema.ts',
  out: './src/core/db/migrations', 
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
});
