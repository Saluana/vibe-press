import dotenv from 'dotenv';
dotenv.config();

export default {
  schema: './src/core/db/schema/schema.ts',
  out: './src/core/db/migrations', 
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
