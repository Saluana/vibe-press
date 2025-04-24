ALTER TABLE "wp_options" ALTER COLUMN "option_value" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "wp_options" ALTER COLUMN "option_value" SET DEFAULT '[]';