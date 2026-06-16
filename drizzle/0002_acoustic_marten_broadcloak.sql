CREATE TABLE "bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"persona_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "avatar_frame" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "pinned_post_id" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_persona_fk" FOREIGN KEY ("persona_id","campaign_id") REFERENCES "public"."personas"("id","campaign_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_post_fk" FOREIGN KEY ("post_id","campaign_id") REFERENCES "public"."posts"("id","campaign_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_pair_idx" ON "bookmarks" USING btree ("persona_id","post_id");--> statement-breakpoint
CREATE INDEX "bookmarks_post_idx" ON "bookmarks" USING btree ("post_id");