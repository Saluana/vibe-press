CREATE TABLE "wp_usermeta" (
	"umeta_id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"meta_key" varchar(255),
	"meta_value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wp_users" (
	"ID" bigserial PRIMARY KEY NOT NULL,
	"user_login" varchar(60) DEFAULT '' NOT NULL,
	"user_pass" varchar(255) DEFAULT '' NOT NULL,
	"user_nicename" varchar(50) DEFAULT '' NOT NULL,
	"user_email" varchar(100) DEFAULT '' NOT NULL,
	"user_url" varchar(100) DEFAULT '' NOT NULL,
	"user_registered" timestamp DEFAULT now() NOT NULL,
	"user_activation_key" varchar(255) DEFAULT '' NOT NULL,
	"user_status" integer DEFAULT 0 NOT NULL,
	"display_name" varchar(250) DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wp_term_relationships" (
	"object_id" integer DEFAULT 0 NOT NULL,
	"term_taxonomy_id" integer NOT NULL,
	"term_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wp_term_taxonomy" (
	"term_taxonomy_id" bigserial PRIMARY KEY NOT NULL,
	"term_id" integer NOT NULL,
	"taxonomy" varchar(32) DEFAULT '' NOT NULL,
	"description" text NOT NULL,
	"parent" integer DEFAULT 0 NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wp_termmeta" (
	"meta_id" bigserial PRIMARY KEY NOT NULL,
	"term_id" integer NOT NULL,
	"meta_key" varchar(255),
	"meta_value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wp_terms" (
	"term_id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(200) DEFAULT '' NOT NULL,
	"slug" varchar(200) DEFAULT '' NOT NULL,
	"term_group" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wp_usermeta" ADD CONSTRAINT "wp_usermeta_user_id_wp_users_ID_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wp_users"("ID") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wp_term_relationships" ADD CONSTRAINT "wp_term_relationships_term_taxonomy_id_wp_term_taxonomy_term_taxonomy_id_fk" FOREIGN KEY ("term_taxonomy_id") REFERENCES "public"."wp_term_taxonomy"("term_taxonomy_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wp_term_taxonomy" ADD CONSTRAINT "wp_term_taxonomy_term_id_wp_terms_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."wp_terms"("term_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wp_termmeta" ADD CONSTRAINT "wp_termmeta_term_id_wp_terms_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."wp_terms"("term_id") ON DELETE no action ON UPDATE no action;