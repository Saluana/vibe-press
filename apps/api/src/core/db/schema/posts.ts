// apps/api/src/core/db/schema/posts.ts
import { relations, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  index,
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';
import { wp_users } from './users';

// Define Enums based on WordPress defaults
export const post_status_enum = ['publish', 'future', 'draft', 'pending', 'private', 'trash', 'auto-draft', 'inherit'];
export const comment_status_enum = ['open', 'closed'];
export const ping_status_enum = ['open', 'closed'];
export const post_type_enum = ['post', 'page', 'attachment', 'revision', 'nav_menu_item', 'custom_css', 'customize_changeset', 'oembed_cache', 'user_request', 'wp_block'];

// wp_posts schema
export const wp_posts = pgTable(
  'wp_posts',
  {
    ID: bigserial('ID', { mode: 'number' }).primaryKey(),
    post_author: bigint('post_author', { mode: 'number' })
      .default(0)
      .notNull()
      .references(() => wp_users.ID),
    post_date: timestamp('post_date', { withTimezone: true })
      .defaultNow()
      .notNull(),
    post_date_gmt: timestamp('post_date_gmt', { withTimezone: true })
      .defaultNow()
      .notNull(),
    post_content: text('post_content').notNull(),
    post_title: text('post_title').notNull(),
    post_excerpt: text('post_excerpt').notNull(),
    post_status: varchar('post_status', { length: 20 })
      .default('publish')
      .notNull(),
    comment_status: varchar('comment_status', { length: 20 })
      .default('open')
      .notNull(),
    ping_status: varchar('ping_status', { length: 20 }).default('open').notNull(),
    post_password: varchar('post_password', { length: 255 }).default('').notNull(),
    post_name: varchar('post_name', { length: 200 }).default('').notNull(),
    to_ping: text('to_ping').notNull(),
    pinged: text('pinged').notNull(),
    post_modified: timestamp('post_modified', { withTimezone: true })
      .defaultNow()
      .notNull(),
    post_modified_gmt: timestamp('post_modified_gmt', { withTimezone: true })
      .defaultNow()
      .notNull(),
    post_content_filtered: text('post_content_filtered').notNull(),
    post_parent: bigint('post_parent', { mode: 'number' }).default(0).notNull(),
    guid: varchar('guid', { length: 255 }).default('').notNull(),
    menu_order: integer('menu_order').default(0).notNull(),
    post_type: varchar('post_type', { length: 20 }).default('post').notNull(),
    post_mime_type: varchar('post_mime_type', { length: 100 }).default('').notNull(),
    comment_count: bigint('comment_count', { mode: 'number' })
      .default(0)
      .notNull(),
  },
  (table) => [
    index('post_name_idx').on(table.post_name),
    index('type_status_date_idx').on(
      table.post_type,
      table.post_status,
      table.post_date,
      table.ID,
    ),
    index('post_parent_idx').on(table.post_parent),
    index('post_author_idx').on(table.post_author),
  ],
);

// wp_postmeta schema
export const wp_postmeta = pgTable(
  'wp_postmeta',
  {
    meta_id: bigserial('meta_id', { mode: 'number' }).primaryKey(),
    post_id: bigint('post_id', { mode: 'number' })
      .notNull()
      .references(() => wp_posts.ID, { onDelete: 'cascade' }),
    meta_key: varchar('meta_key', { length: 255 }).notNull(),
    meta_value: jsonb('meta_value'),
  },
  (table) => [
    index('post_id_idx').on(table.post_id),
    index('postmeta_meta_key_idx').on(table.meta_key),
  ],
);

// Relations
export const wpPostsRelations = relations(wp_posts, ({ one, many }) => ({
  author: one(wp_users, {
    fields: [wp_posts.post_author],
    references: [wp_users.ID],
  }),
  meta: many(wp_postmeta),
  parent: one(wp_posts, {
    fields: [wp_posts.post_parent],
    references: [wp_posts.ID],
    relationName: 'parentPost',
  }),
  children: many(wp_posts, {
    relationName: 'parentPost',
  }),
}));

export const wpPostmetaRelations = relations(wp_postmeta, ({ one }) => ({
  post: one(wp_posts, {
    fields: [wp_postmeta.post_id],
    references: [wp_posts.ID],
  }),
}));

// Types
export type WpPost = InferSelectModel<typeof wp_posts>;
export type NewWpPost = InferInsertModel<typeof wp_posts>;
export type WpPostmeta = InferSelectModel<typeof wp_postmeta>;
export type NewWpPostmeta = InferInsertModel<typeof wp_postmeta>;