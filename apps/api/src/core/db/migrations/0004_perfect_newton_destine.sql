CREATE TABLE "wp_postmeta" (
	"meta_id" bigserial PRIMARY KEY NOT NULL,
	"post_id" bigint NOT NULL,
	"meta_key" varchar(255) NOT NULL,
	"meta_value" jsonb
);
--> statement-breakpoint
CREATE TABLE "wp_posts" (
	"ID" bigserial PRIMARY KEY NOT NULL,
	"post_author" bigint DEFAULT 0 NOT NULL,
	"post_date" timestamp with time zone DEFAULT now() NOT NULL,
	"post_date_gmt" timestamp with time zone DEFAULT now() NOT NULL,
	"post_content" text NOT NULL,
	"post_title" text NOT NULL,
	"post_excerpt" text NOT NULL,
	"post_status" varchar(20) DEFAULT 'publish' NOT NULL,
	"comment_status" varchar(20) DEFAULT 'open' NOT NULL,
	"ping_status" varchar(20) DEFAULT 'open' NOT NULL,
	"post_password" varchar(255) DEFAULT '' NOT NULL,
	"post_name" varchar(200) DEFAULT '' NOT NULL,
	"to_ping" text NOT NULL,
	"pinged" text NOT NULL,
	"post_modified" timestamp with time zone DEFAULT now() NOT NULL,
	"post_modified_gmt" timestamp with time zone DEFAULT now() NOT NULL,
	"post_content_filtered" text NOT NULL,
	"post_parent" bigint DEFAULT 0 NOT NULL,
	"guid" varchar(255) DEFAULT '' NOT NULL,
	"menu_order" integer DEFAULT 0 NOT NULL,
	"post_type" varchar(20) DEFAULT 'post' NOT NULL,
	"post_mime_type" varchar(100) DEFAULT '' NOT NULL,
	"comment_count" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wp_usermeta" ALTER COLUMN "meta_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "wp_postmeta" ADD CONSTRAINT "wp_postmeta_post_id_wp_posts_ID_fk" FOREIGN KEY ("post_id") REFERENCES "public"."wp_posts"("ID") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wp_posts" ADD CONSTRAINT "wp_posts_post_author_wp_users_ID_fk" FOREIGN KEY ("post_author") REFERENCES "public"."wp_users"("ID") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_id_idx" ON "wp_postmeta" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "postmeta_meta_key_idx" ON "wp_postmeta" USING btree ("meta_key");--> statement-breakpoint
CREATE INDEX "post_name_idx" ON "wp_posts" USING btree ("post_name");--> statement-breakpoint
CREATE INDEX "type_status_date_idx" ON "wp_posts" USING btree ("post_type","post_status","post_date","ID");--> statement-breakpoint
CREATE INDEX "post_parent_idx" ON "wp_posts" USING btree ("post_parent");--> statement-breakpoint
CREATE INDEX "post_author_idx" ON "wp_posts" USING btree ("post_author");--> statement-breakpoint
CREATE INDEX "user_id_idx" ON "wp_usermeta" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usermeta_meta_key_idx" ON "wp_usermeta" USING btree ("meta_key");--> statement-breakpoint
CREATE INDEX "user_login_idx" ON "wp_users" USING btree ("user_login");--> statement-breakpoint
CREATE INDEX "user_nicename_idx" ON "wp_users" USING btree ("user_nicename");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "wp_users" USING btree ("user_email");--> statement-breakpoint
ALTER TABLE "wp_usermeta" ADD CONSTRAINT "user_id_meta_key_unique" UNIQUE("user_id","meta_key");