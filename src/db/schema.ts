import { sql, type SQL } from "drizzle-orm";
import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  unique,
  foreignKey,
  check,
  customType,
} from "drizzle-orm/pg-core";
import type { Theme, DecorationSpec } from "../lib/theme-types";
import { PERSONA_AVATAR_FRAMES } from "../lib/theme-types";

// All instants are timestamptz so scheduling and feed ordering are timezone-safe.
const tstz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

// drizzle-orm 0.45 has no first-class tsvector type, so spell it out. The column
// is never read in app code (we only match/rank against it), so the mapped data
// type is just string for typing purposes.
const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

// ---------------------------------------------------------------------------
// users — one global login per real person.
// ---------------------------------------------------------------------------
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    // lower-cased copy so "@Bard" and "@bard" collide on login/registration
    usernameLower: text("username_lower").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_username_lower_idx").on(t.usernameLower)],
);

// ---------------------------------------------------------------------------
// campaigns — each is its own themed instance with members, personas, feed.
// ---------------------------------------------------------------------------
export const campaigns = pgTable(
  "campaigns",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    // display name / wordmark, e.g. "STR/X"
    name: text("name").notNull(),
    description: text("description"),
    theme: jsonb("theme").$type<Theme>().notNull(),
    inviteCode: text("invite_code").notNull(),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("campaigns_slug_idx").on(t.slug),
    uniqueIndex("campaigns_invite_code_idx").on(t.inviteCode),
  ],
);

// ---------------------------------------------------------------------------
// memberships — links a user to a campaign with a role. Holds the server-side
// "acting persona" so it can never be forged from a client cookie.
// ---------------------------------------------------------------------------
export const memberships = pgTable(
  "memberships",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["dm", "player"] })
      .notNull()
      .default("player"),
    // currently selected persona to act as (nullable -> default to own persona)
    actingPersonaId: integer("acting_persona_id").references(
      (): typeof personas.id => personas.id,
      { onDelete: "set null" },
    ),
    // this member's chosen personal decoration in this campaign (nullable ->
    // null means "use the campaign/world default"). Set to null if that
    // decoration is deleted, so the member silently falls back to the default.
    selectedDecorationId: integer("selected_decoration_id").references(
      (): typeof decorations.id => decorations.id,
      { onDelete: "set null" },
    ),
    joinedAt: tstz("joined_at").notNull().defaultNow(),
  },
  (t) => [
    unique("memberships_user_campaign_unique").on(t.userId, t.campaignId),
  ],
);

// ---------------------------------------------------------------------------
// personas — the tweet-able identities. A player owns one (their character);
// the DM owns many (NPCs). Posts/follows/likes all attach to a persona.
// ---------------------------------------------------------------------------
export const personas = pgTable(
  "personas",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    handleLower: text("handle_lower").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    // a wide header image shown on the profile (nullable; falls back to a theme
    // gradient when unset)
    bannerUrl: text("banner_url"),
    bio: text("bio"),
    isNpc: boolean("is_npc").notNull().default(false),
    // the persona's chosen avatar frame; "default" inherits the campaign theme's
    // frame, any other value overrides it for this persona's avatar.
    avatarFrame: text("avatar_frame", { enum: PERSONA_AVATAR_FRAMES })
      .notNull()
      .default("default"),
    // a published post this persona pins to the top of its profile (nullable;
    // plain column, visibility re-checked on read since posts are soft-deleted)
    pinnedPostId: integer("pinned_post_id"),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    // handles are unique within a campaign, case-insensitively
    uniqueIndex("personas_campaign_handle_idx").on(t.campaignId, t.handleLower),
    // a player normally has one character, but the DM can create and assign
    // extra characters to them, so multiple non-NPC personas per user are allowed
    // lets follows/likes composite-FK back to enforce same-campaign integrity
    unique("personas_id_campaign_unique").on(t.id, t.campaignId),
    index("personas_owner_idx").on(t.ownerUserId, t.campaignId),
  ],
);

// ---------------------------------------------------------------------------
// decorations — player-authored decoration "mods". A member creates one in a
// campaign (an uploaded backdrop image + a declarative spec) and may select it
// for themselves via memberships.selectedDecorationId; everyone else keeps the
// campaign default. Scoped to (campaign, owner): a decoration lives in the one
// campaign it was made for, and is owned by its author.
// ---------------------------------------------------------------------------
export const decorations = pgTable(
  "decorations",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // the declarative decoration spec (see DecorationSpec). Never executed; the
    // render layer maps it onto the existing decoration CSS machinery.
    spec: jsonb("spec").$type<DecorationSpec>().notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [index("decorations_owner_idx").on(t.ownerUserId, t.campaignId)],
);

// ---------------------------------------------------------------------------
// posts — tweets. Scheduling is encoded by publishedAt (the go-live instant):
//   draft     -> status 'draft',     publishedAt NULL
//   scheduled -> status 'scheduled', publishedAt in the future
//   published -> status 'published', publishedAt <= now()
// Visibility is purely time-based (publishedAt <= now()), so no worker is
// needed: a scheduled post simply becomes visible once its time passes.
// ---------------------------------------------------------------------------
export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    personaId: integer("persona_id")
      .notNull()
      .references(() => personas.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    imageUrl: text("image_url"),
    status: text("status", { enum: ["draft", "scheduled", "published"] })
      .notNull()
      .default("published"),
    // thread parent and quote/boost target; SET NULL so threads survive deletes
    replyToPostId: integer("reply_to_post_id"),
    repostOfPostId: integer("repost_of_post_id"),
    publishedAt: tstz("published_at"),
    createdAt: tstz("created_at").notNull().defaultNow(),
    deletedAt: tstz("deleted_at"),
    // set when the author edits the post, to show an "edited" marker
    editedAt: tstz("edited_at"),
    // STORED full-text index of the content, kept in sync by Postgres. The
    // config is pinned to the literal 'english' so the expression is immutable
    // (a requirement for a STORED generated column) and so push/migrate agree.
    // Never written by app code; searchPosts matches and ranks against it.
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', ${posts.content})`,
    ),
  },
  (t) => [
    foreignKey({
      columns: [t.replyToPostId],
      foreignColumns: [t.id],
      name: "posts_reply_to_fk",
    }).onDelete("set null"),
    foreignKey({
      columns: [t.repostOfPostId],
      foreignColumns: [t.id],
      name: "posts_repost_of_fk",
    }).onDelete("set null"),
    // draft <=> no publish time; everything else must have one
    check(
      "posts_draft_publishedat_chk",
      sql`(status = 'draft') = (published_at is null)`,
    ),
    // a post can be a reply or a quote, never both, and never of itself
    check(
      "posts_reply_xor_repost_chk",
      sql`(reply_to_post_id is null) or (repost_of_post_id is null)`,
    ),
    check(
      "posts_no_self_ref_chk",
      sql`(id <> reply_to_post_id) is not false and (id <> repost_of_post_id) is not false`,
    ),
    unique("posts_id_campaign_unique").on(t.id, t.campaignId),
    // one plain boost of a given post per persona
    uniqueIndex("posts_unique_repost_idx")
      .on(t.personaId, t.repostOfPostId)
      .where(sql`repost_of_post_id is not null and content = ''`),
    // feed keyset pagination: newest-first within a campaign, id as tiebreaker
    index("posts_feed_idx").on(t.campaignId, t.publishedAt, t.id),
    index("posts_persona_idx").on(t.personaId),
    index("posts_reply_to_idx").on(t.replyToPostId),
    // full-text search: a GIN index over the STORED search_vector turns the
    // content match into an index lookup (searchPosts text branch).
    index("posts_search_vector_idx").using("gin", t.searchVector),
  ],
);

// ---------------------------------------------------------------------------
// follows — persona follows persona, within a single campaign (composite FKs
// to personas(id, campaign_id) make cross-campaign follows impossible).
// ---------------------------------------------------------------------------
export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    followerPersonaId: integer("follower_persona_id").notNull(),
    followingPersonaId: integer("following_persona_id").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.followerPersonaId, t.campaignId],
      foreignColumns: [personas.id, personas.campaignId],
      name: "follows_follower_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.followingPersonaId, t.campaignId],
      foreignColumns: [personas.id, personas.campaignId],
      name: "follows_following_fk",
    }).onDelete("cascade"),
    check(
      "follows_no_self_chk",
      sql`follower_persona_id <> following_persona_id`,
    ),
    uniqueIndex("follows_pair_idx").on(
      t.followerPersonaId,
      t.followingPersonaId,
    ),
    index("follows_following_idx").on(t.followingPersonaId),
  ],
);

// ---------------------------------------------------------------------------
// likes — a persona likes a post; composite FKs force them to share a campaign.
// ---------------------------------------------------------------------------
export const likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    personaId: integer("persona_id").notNull(),
    postId: integer("post_id").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.personaId, t.campaignId],
      foreignColumns: [personas.id, personas.campaignId],
      name: "likes_persona_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.postId, t.campaignId],
      foreignColumns: [posts.id, posts.campaignId],
      name: "likes_post_fk",
    }).onDelete("cascade"),
    uniqueIndex("likes_pair_idx").on(t.personaId, t.postId),
    index("likes_post_idx").on(t.postId),
  ],
);

// ---------------------------------------------------------------------------
// bookmarks — a persona privately saves a post; composite FKs keep them in one
// campaign. Mirrors likes, but it has no public count and never notifies.
// ---------------------------------------------------------------------------
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    personaId: integer("persona_id").notNull(),
    postId: integer("post_id").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.personaId, t.campaignId],
      foreignColumns: [personas.id, personas.campaignId],
      name: "bookmarks_persona_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.postId, t.campaignId],
      foreignColumns: [posts.id, posts.campaignId],
      name: "bookmarks_post_fk",
    }).onDelete("cascade"),
    uniqueIndex("bookmarks_pair_idx").on(t.personaId, t.postId),
    index("bookmarks_post_idx").on(t.postId),
  ],
);

// ---------------------------------------------------------------------------
// polls — an optional poll attached to a post (one per post). `options` is a
// small ordered text array; a vote stores the chosen index. closesAt ends
// voting. Composite FK to posts keeps the poll in the post's campaign and
// cascades when the post is hard-deleted.
// ---------------------------------------------------------------------------
export const polls = pgTable(
  "polls",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    postId: integer("post_id").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    closesAt: tstz("closes_at").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.postId, t.campaignId],
      foreignColumns: [posts.id, posts.campaignId],
      name: "polls_post_fk",
    }).onDelete("cascade"),
    uniqueIndex("polls_post_idx").on(t.postId),
  ],
);

// ---------------------------------------------------------------------------
// pollVotes — one vote per persona per poll (unique), recording the chosen
// option index. Composite FK to personas keeps voters in the poll's campaign.
// ---------------------------------------------------------------------------
export const pollVotes = pgTable(
  "poll_votes",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    pollId: integer("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    personaId: integer("persona_id").notNull(),
    optionIdx: integer("option_idx").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.personaId, t.campaignId],
      foreignColumns: [personas.id, personas.campaignId],
      name: "poll_votes_persona_fk",
    }).onDelete("cascade"),
    uniqueIndex("poll_votes_pair_idx").on(t.pollId, t.personaId),
    index("poll_votes_poll_idx").on(t.pollId),
  ],
);

// ---------------------------------------------------------------------------
// notifications — an event aimed at one of a user's personas: someone liked or
// replied to their post, followed them, or @mentioned them. Recipient + actor
// are personas (composite-FK to personas so they stay in one campaign). postId
// points at the relevant post (null for a follow) and is a plain column — posts
// are soft-deleted, so visibility is re-checked at render rather than via FK.
// ---------------------------------------------------------------------------
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    recipientPersonaId: integer("recipient_persona_id").notNull(),
    actorPersonaId: integer("actor_persona_id").notNull(),
    type: text("type", {
      enum: ["like", "reply", "follow", "mention", "quote"],
    }).notNull(),
    postId: integer("post_id"),
    readAt: tstz("read_at"),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.recipientPersonaId, t.campaignId],
      foreignColumns: [personas.id, personas.campaignId],
      name: "notifications_recipient_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.actorPersonaId, t.campaignId],
      foreignColumns: [personas.id, personas.campaignId],
      name: "notifications_actor_fk",
    }).onDelete("cascade"),
    // a notification is always for someone else's action
    check(
      "notifications_not_self_chk",
      sql`recipient_persona_id <> actor_persona_id`,
    ),
    // newest-first per recipient
    index("notifications_recipient_idx").on(t.recipientPersonaId, t.createdAt),
    // dedupe: at most one like per (actor, post) and one follow per (actor,
    // recipient), so toggling like/follow can't pile up notifications
    uniqueIndex("notifications_like_unique")
      .on(t.actorPersonaId, t.postId)
      .where(sql`type = 'like'`),
    uniqueIndex("notifications_follow_unique")
      .on(t.actorPersonaId, t.recipientPersonaId)
      .where(sql`type = 'follow'`),
  ],
);

// ---------------------------------------------------------------------------
// sessions — only a SHA-256 hash of the cookie token is stored, so a DB dump
// never yields usable session tokens. Looked up by hash, filtered by expiry.
// ---------------------------------------------------------------------------
export const sessions = pgTable(
  "sessions",
  {
    // tokenHash = sha256(rawTokenFromCookie)
    tokenHash: text("token_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: tstz("created_at").notNull().defaultNow(),
    expiresAt: tstz("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// campaignApiKeys — bearer tokens a DM mints so an external app can post into
// this campaign over HTTP (write-only). Only the SHA-256 hash is stored; the
// raw token is shown once at creation. `prefix` is a non-secret display hint.
// Revoking sets revokedAt (the row is kept) so a key stops authenticating.
// ---------------------------------------------------------------------------
export const campaignApiKeys = pgTable(
  "campaign_api_keys",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    prefix: text("prefix").notNull(),
    label: text("label").notNull().default(""),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: tstz("created_at").notNull().defaultNow(),
    lastUsedAt: tstz("last_used_at"),
    revokedAt: tstz("revoked_at"),
  },
  (t) => [
    uniqueIndex("campaign_api_keys_hash_idx").on(t.tokenHash),
    index("campaign_api_keys_campaign_idx").on(t.campaignId),
  ],
);

// ---------------------------------------------------------------------------
// Inferred row types.
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Persona = typeof personas.$inferSelect;
export type Decoration = typeof decorations.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Poll = typeof polls.$inferSelect;
export type PollVote = typeof pollVotes.$inferSelect;
export type CampaignApiKey = typeof campaignApiKeys.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NotificationType = Notification["type"];
export type Session = typeof sessions.$inferSelect;

export type Role = Membership["role"];
export type PostStatus = Post["status"];
