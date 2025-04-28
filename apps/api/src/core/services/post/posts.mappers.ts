import { wp_posts } from '@vp/core/db/schema/posts';
export const basicPostColumns = {
  ID            : wp_posts.ID,
  post_author   : wp_posts.post_author,
  post_date     : wp_posts.post_date,
  post_date_gmt : wp_posts.post_date_gmt,
  post_title    : wp_posts.post_title,
  post_excerpt  : wp_posts.post_excerpt,
  post_status   : wp_posts.post_status,
  post_name     : wp_posts.post_name,
  post_modified : wp_posts.post_modified,
  post_modified_gmt: wp_posts.post_modified_gmt,
  post_parent   : wp_posts.post_parent,
  guid          : wp_posts.guid,
  menu_order    : wp_posts.menu_order,
  post_type     : wp_posts.post_type,
  comment_count : wp_posts.comment_count,
} as const;
export type PostBasicInfo = { [K in keyof typeof basicPostColumns]: typeof basicPostColumns[K] };