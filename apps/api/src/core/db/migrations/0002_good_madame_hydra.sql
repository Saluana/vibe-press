CREATE TABLE "wp_options" (
	"option_id" bigserial PRIMARY KEY NOT NULL,
	"option_name" varchar(191) NOT NULL,
	"option_value" text NOT NULL,
	"autoload" varchar(20) DEFAULT 'yes' NOT NULL,
	CONSTRAINT "wp_options_option_name_unique" UNIQUE("option_name")
);
--> statement-breakpoint
ALTER TABLE "wp_users" ADD CONSTRAINT "wp_users_user_login_unique" UNIQUE("user_login");