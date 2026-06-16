CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"recipient_persona_id" integer NOT NULL,
	"actor_persona_id" integer NOT NULL,
	"type" text NOT NULL,
	"post_id" integer,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_not_self_chk" CHECK (recipient_persona_id <> actor_persona_id)
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_fk" FOREIGN KEY ("recipient_persona_id","campaign_id") REFERENCES "public"."personas"("id","campaign_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_fk" FOREIGN KEY ("actor_persona_id","campaign_id") REFERENCES "public"."personas"("id","campaign_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_persona_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_like_unique" ON "notifications" USING btree ("actor_persona_id","post_id") WHERE type = 'like';--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_follow_unique" ON "notifications" USING btree ("actor_persona_id","recipient_persona_id") WHERE type = 'follow';