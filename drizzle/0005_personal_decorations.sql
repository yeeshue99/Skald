CREATE TABLE "decorations" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"owner_user_id" integer NOT NULL,
	"name" text NOT NULL,
	"spec" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "selected_decoration_id" integer;--> statement-breakpoint
ALTER TABLE "decorations" ADD CONSTRAINT "decorations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decorations" ADD CONSTRAINT "decorations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_selected_decoration_id_decorations_id_fk" FOREIGN KEY ("selected_decoration_id") REFERENCES "public"."decorations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decorations_owner_idx" ON "decorations" USING btree ("owner_user_id","campaign_id");
