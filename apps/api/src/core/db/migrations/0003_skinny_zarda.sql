ALTER TABLE "wp_usermeta" DROP CONSTRAINT "wp_usermeta_user_id_wp_users_ID_fk";
--> statement-breakpoint
ALTER TABLE "wp_usermeta" ADD CONSTRAINT "wp_usermeta_user_id_wp_users_ID_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wp_users"("ID") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wp_users" ADD CONSTRAINT "wp_users_user_nicename_unique" UNIQUE("user_nicename");