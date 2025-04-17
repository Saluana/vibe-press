// apps/api/src/core/db/users.ts

import {
    pgTable,
    bigserial,
    varchar,
    text,
    integer,
    timestamp,
  } from 'drizzle-orm/pg-core';
  
  export const wp_users = pgTable('wp_users', {
    ID:                  bigserial({ mode: 'number' }).primaryKey(),
    user_login:          varchar('user_login',  { length: 60 }).notNull().default(''),
    user_pass:           varchar('user_pass',   { length: 255 }).notNull().default(''),
    user_nicename:       varchar('user_nicename',{ length: 50 }).notNull().default(''),
    user_email:          varchar('user_email',  { length:100 }).notNull().default(''),
    user_url:            varchar('user_url',    { length:100 }).notNull().default(''),
    user_registered:     timestamp('user_registered', { mode: 'string' }).notNull().defaultNow(),
    user_activation_key: varchar('user_activation_key',{ length:255 }).notNull().default(''),
    user_status:         integer('user_status').notNull().default(0),
    display_name:        varchar('display_name',{ length:250 }).notNull().default(''),
  });
  
  export const wp_usermeta = pgTable('wp_usermeta', {
    umeta_id:   bigserial({ mode: 'number' }).primaryKey(),
    user_id:    integer('user_id').notNull().references(() => wp_users.ID),
    meta_key:   varchar('meta_key', { length: 255 }),
    meta_value: text('meta_value').notNull(),
  });