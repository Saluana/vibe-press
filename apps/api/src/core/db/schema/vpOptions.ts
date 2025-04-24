// apps/api/src/core/db/schema/wp_options.ts

import { bigserial, varchar, jsonb, pgTable } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const wp_options = pgTable('wp_options', {
  option_id:    bigserial('option_id', { mode: 'number' }).primaryKey(),
  option_name:  varchar('option_name', { length: 191 }).notNull().unique(),
  // ← switch this:
  option_value: jsonb('option_value').notNull().default(sql`'[]'::jsonb`),
  autoload:     varchar('autoload', { length: 20 }).notNull().default('yes'),
});