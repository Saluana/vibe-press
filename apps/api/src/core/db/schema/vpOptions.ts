import { pgTable } from "drizzle-orm/pg-core";
import { bigserial, text, varchar } from "drizzle-orm/pg-core";

export const wp_options = pgTable('wp_options', {
    option_id: bigserial('option_id', { mode: 'number' }).primaryKey(),
    option_name: varchar('option_name', { length: 191 }).notNull().unique(),
    option_value: text('option_value').notNull(),
    autoload: varchar('autoload', { length: 20 }).notNull().default('yes'),
  });