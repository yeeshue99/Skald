import { sql } from "drizzle-orm";
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
} from "drizzle-orm/pg-core";
import type { Theme } from "../lib/theme-types";

// All instants are timestamptz so scheduling and feed ordering are timezone-safe.
const tstz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

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
    bio: text("bio"),
    isNpc: boolean("is_npc").notNull().default(false),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    // handles are unique within a campaign, case-insensitively
    uniqueIndex("personas_campaign_handle_idx").on(t.campaignId, t.handleLower),
    // exactly one player character (non-NPC persona) per user per campaign
    uniqueIndex("personas_one_pc_per_user_idx")
      .on(t.campaignId, t.ownerUserId)
      .where(sql`is_npc = false`),
    // lets follows/likes composite-FK back to enforce same-campaign integrity
    unique("personas_id_campaign_unique").on(t.id, t.campaignId),
    index("personas_owner_idx").on(t.ownerUserId, t.campaignId),
  ],
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
      enum: ["like", "reply", "follow", "mention"],
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
// Inferred row types.
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Persona = typeof personas.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NotificationType = Notification["type"];
export type Session = typeof sessions.$inferSelect;

export type Role = Membership["role"];
export type PostStatus = Post["status"];
