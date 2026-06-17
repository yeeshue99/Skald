ALTER TABLE "decorations" ADD COLUMN "scope" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "world_decoration_id" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_world_decoration_id_decorations_id_fk" FOREIGN KEY ("world_decoration_id") REFERENCES "public"."decorations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decorations_campaign_scope_idx" ON "decorations" USING btree ("campaign_id","scope");
