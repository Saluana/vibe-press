// apps/api/src/core/db/users.ts

import { InferSelectModel, InferInsertModel, relations } from 'drizzle-orm';
import {
    pgTable,
    bigserial,
    varchar,
    jsonb,
    integer,
    timestamp,
    index,
  } from 'drizzle-orm/pg-core';
  
  export const wp_users = pgTable('wp_users', {
    ID:                  bigserial({ mode: 'number' }).primaryKey(),
    user_login:          varchar('user_login',  { length: 60 }).notNull().default('').unique(),
    user_pass:           varchar('user_pass',   { length: 255 }).notNull().default(''),
    user_nicename:       varchar('user_nicename',{ length: 50 }).notNull().default('').unique(),
    user_email:          varchar('user_email',  { length:100 }).notNull().default('').unique(),
    user_url:            varchar('user_url',    { length:100 }).notNull().default(''),
    user_registered:     timestamp('user_registered', { mode: 'string' }).notNull().defaultNow(),
    user_activation_key: varchar('user_activation_key',{ length:255 }).notNull().default(''),
    user_status:         integer('user_status').notNull().default(0),
    display_name:        varchar('display_name',{ length:250 }).notNull().default(''),
  }, (table) => [
    index("user_login_idx").on(table.user_login),
    index("user_nicename_idx").on(table.user_nicename),
    index("user_email_idx").on(table.user_email),
  ]);
  
  export const wp_usermeta = pgTable('wp_usermeta', {
    umeta_id: bigserial('umeta_id', { mode: 'number' }).primaryKey(),
    user_id: integer('user_id').notNull().references(() => wp_users.ID, { onDelete: 'cascade' }),
    meta_key: varchar('meta_key', { length: 255 }).notNull(),
    meta_value: jsonb('meta_value').notNull(),
  }, (table) => [
    index("user_id_idx").on(table.user_id),
    index("usermeta_meta_key_idx").on(table.meta_key),
  ]);

  // Relations
  export const wpUsersRelations = relations(wp_users, ({ many }) => ({
    meta: many(wp_usermeta),
  }));
  
  export const wpUsermetaRelations = relations(wp_usermeta, ({ one }) => ({
    user: one(wp_users, {
      fields: [wp_usermeta.user_id],
      references: [wp_users.ID],
    }),
  }));
  
  // Types
  export type WpUser = InferSelectModel<typeof wp_users>;
  export type NewWpUser = InferInsertModel<typeof wp_users>;
  export type WpUsermeta = InferSelectModel<typeof wp_usermeta>;
  export type NewWpUsermeta = InferInsertModel<typeof wp_usermeta>;
  