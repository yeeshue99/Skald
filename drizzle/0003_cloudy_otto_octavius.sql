CREATE TABLE "poll_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"poll_id" integer NOT NULL,
	"persona_id" integer NOT NULL,
	"option_idx" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"options" jsonb NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_persona_fk" FOREIGN KEY ("persona_id","campaign_id") REFERENCES "public"."personas"("id","campaign_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_post_fk" FOREIGN KEY ("post_id","campaign_id") REFERENCES "public"."posts"("id","campaign_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "poll_votes_pair_idx" ON "poll_votes" USING btree ("poll_id","persona_id");--> statement-breakpoint
CREATE INDEX "poll_votes_poll_idx" ON "poll_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX "polls_post_idx" ON "polls" USING btree ("post_id");