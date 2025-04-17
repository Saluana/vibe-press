// apps/api/src/core/db/taxonomy.ts

import {
    pgTable,
    bigserial,
    varchar,
    text,
    integer,
  } from 'drizzle-orm/pg-core';
  
  export const wp_terms = pgTable('wp_terms', {
    term_id:    bigserial({ mode: 'number' }).primaryKey(),
    name:       varchar('name', { length: 200 }).notNull().default(''),
    slug:       varchar('slug', { length: 200 }).notNull().default(''),
    term_group: integer('term_group').notNull().default(0),
  });
  
  export const wp_term_taxonomy = pgTable('wp_term_taxonomy', {
    term_taxonomy_id: bigserial({ mode: 'number' }).primaryKey(),
    term_id:          integer('term_id').notNull().references(() => wp_terms.term_id),
    taxonomy:         varchar('taxonomy', { length: 32 }).notNull().default(''),
    description:      text('description').notNull(),
    parent:           integer('parent').notNull().default(0),
    count:            integer('count').notNull().default(0),
  });
  
  export const wp_term_relationships = pgTable('wp_term_relationships', {
    object_id:         integer('object_id').notNull().default(0),
    term_taxonomy_id:  integer('term_taxonomy_id').notNull().references(() => wp_term_taxonomy.term_taxonomy_id),
    term_order:        integer('term_order').notNull().default(0),
  });
  
  export const wp_termmeta = pgTable('wp_termmeta', {
    meta_id:    bigserial({ mode: 'number' }).primaryKey(),
    term_id:    integer('term_id').notNull().references(() => wp_terms.term_id),
    meta_key:   varchar('meta_key', { length: 255 }),
    meta_value: text('meta_value').notNull(),
  });
  