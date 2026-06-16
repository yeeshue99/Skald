import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bookmarks,
  campaigns,
  follows,
  likes,
  memberships,
  personas,
  pollVotes,
  polls,
  posts,
} from "@/db/schema";
import { generateInviteCode, randomSlugSuffix } from "@/lib/ids";
import { slugify } from "@/lib/validation";
import { DEFAULT_THEME, normalizeTheme, type Theme } from "@/lib/themes";
import { PERSONA_AVATAR_FRAMES } from "@/lib/theme-types";
import { isUniqueViolation } from "@/lib/form";

// JSON dates arrive as ISO strings; coerce them, but let an explicit null stay
// null (z.coerce.date() would otherwise turn null into the epoch).
const nullableDate = z.coerce.date().nullable();
const rowId = z.number().int();

const personaIn = z.object({
  id: rowId,
  handle: z.string().min(1),
  handleLower: z.string().optional(),
  displayName: z.string().min(1),
  avatarUrl: z.string().nullish(),
  bannerUrl: z.string().nullish(),
  bio: z.string().nullish(),
  isNpc: z.boolean().optional(),
  avatarFrame: z.enum(PERSONA_AVATAR_FRAMES).catch("default"),
  pinnedPostId: z.number().int().nullish(),
  createdAt: z.coerce.date().optional(),
});

const postIn = z.object({
  id: rowId,
  personaId: rowId,
  content: z.string().default(""),
  imageUrl: z.string().nullish(),
  status: z.enum(["draft", "scheduled", "published"]),
  replyToPostId: z.number().int().nullish(),
  repostOfPostId: z.number().int().nullish(),
  publishedAt: nullableDate.optional(),
  editedAt: nullableDate.optional(),
  deletedAt: nullableDate.optional(),
  createdAt: z.coerce.date().optional(),
});

const followIn = z.object({
  followerPersonaId: rowId,
  followingPersonaId: rowId,
  createdAt: z.coerce.date().optional(),
});
const edgeIn = z.object({
  personaId: rowId,
  postId: rowId,
  createdAt: z.coerce.date().optional(),
});
const pollIn = z.object({
  id: rowId,
  postId: rowId,
  options: z.array(z.string()).min(1),
  closesAt: z.coerce.date(),
  createdAt: z.coerce.date().optional(),
});
const voteIn = z.object({
  pollId: rowId,
  personaId: rowId,
  optionIdx: z.number().int().min(0),
  createdAt: z.coerce.date().optional(),
});

// A Skald export. We validate the parts we re-create and ignore the rest (e.g.
// `members`, which can't be restored without credentials). Counts are capped so
// a hostile file can't ask for an unbounded number of inserts.
export const campaignImportSchema = z.object({
  version: z.number().optional(),
  campaign: z.object({
    name: z.string().min(1),
    description: z.string().nullish(),
    theme: z.record(z.string(), z.unknown()).optional(),
  }),
  personas: z.array(personaIn).max(10_000).default([]),
  posts: z.array(postIn).max(200_000).default([]),
  follows: z.array(followIn).max(200_000).default([]),
  likes: z.array(edgeIn).max(500_000).default([]),
  bookmarks: z.array(edgeIn).max(500_000).default([]),
  polls: z.array(pollIn).max(50_000).default([]),
  pollVotes: z.array(voteIn).max(500_000).default([]),
});
export type CampaignImport = z.infer<typeof campaignImportSchema>;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Recreate a campaign from an export, owned by `userId` (who becomes its DM).
// Original row ids are remapped onto fresh ones; the in-export relationships
// (replies, reposts, pins, follows, likes, bookmarks, poll votes) are rebuilt
// against the new ids. Every imported persona becomes one of the importer's NPCs
// (one owner can hold only a single player character, so player characters can't
// be restored faithfully). Returns the new campaign's slug.
export async function importCampaign(
  userId: number,
  data: CampaignImport,
): Promise<string> {
  const name = data.campaign.name.trim().slice(0, 60) || "Imported campaign";

  // Use the exported theme when it looks complete, else fall back to the default
  // (filling any missing top-level keys from it either way).
  const t = data.campaign.theme as Partial<Theme> | undefined;
  const theme: Theme =
    t && t.colors && t.fonts && t.mode
      ? normalizeTheme({ ...DEFAULT_THEME, ...(t as Theme) })
      : { ...DEFAULT_THEME, appName: name };

  // pick an unused slug before opening the transaction
  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 6; i++) {
    const exists = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.slug, slug))
      .limit(1);
    if (exists.length === 0) break;
    slug = `${base}-${randomSlugSuffix()}`;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const inviteCode = generateInviteCode();
    try {
      return await db.transaction(async (tx) => {
        const [c] = await tx
          .insert(campaigns)
          .values({
            slug,
            name,
            description: data.campaign.description ?? null,
            theme,
            inviteCode,
            createdByUserId: userId,
          })
          .returning({ id: campaigns.id, slug: campaigns.slug });
        const campaignId = c.id;

        await tx
          .insert(memberships)
          .values({ userId, campaignId, role: "dm" });

        // personas (all as the importer's NPCs; pinnedPostId set after posts)
        const personaIdMap = new Map<number, number>();
        for (const group of chunk(data.personas, 500)) {
          const rows = await tx
            .insert(personas)
            .values(
              group.map((p) => ({
                campaignId,
                ownerUserId: userId,
                handle: p.handle,
                handleLower: (p.handleLower ?? p.handle).toLowerCase(),
                displayName: p.displayName,
                avatarUrl: p.avatarUrl ?? null,
                bannerUrl: p.bannerUrl ?? null,
                bio: p.bio ?? null,
                avatarFrame: p.avatarFrame,
                isNpc: true,
                ...(p.createdAt ? { createdAt: p.createdAt } : {}),
              })),
            )
            .returning({ id: personas.id });
          group.forEach((p, i) => personaIdMap.set(p.id, rows[i].id));
        }

        // posts, reply/repost refs nulled (filled in a second pass once every
        // post has a new id, so a forward reference can't dangle)
        const postIdMap = new Map<number, number>();
        for (const group of chunk(data.posts, 500)) {
          const usable = group.filter((p) => personaIdMap.has(p.personaId));
          if (usable.length === 0) continue;
          const rows = await tx
            .insert(posts)
            .values(
              usable.map((p) => ({
                campaignId,
                personaId: personaIdMap.get(p.personaId)!,
                content: p.content,
                imageUrl: p.imageUrl ?? null,
                status: p.status,
                replyToPostId: null,
                repostOfPostId: null,
                publishedAt: p.publishedAt ?? null,
                editedAt: p.editedAt ?? null,
                deletedAt: p.deletedAt ?? null,
                ...(p.createdAt ? { createdAt: p.createdAt } : {}),
              })),
            )
            .returning({ id: posts.id });
          usable.forEach((p, i) => postIdMap.set(p.id, rows[i].id));
        }

        // second pass: remap reply/repost links
        for (const p of data.posts) {
          const newId = postIdMap.get(p.id);
          if (!newId) continue;
          const reply =
            p.replyToPostId != null ? postIdMap.get(p.replyToPostId) ?? null : null;
          const repost =
            p.repostOfPostId != null
              ? postIdMap.get(p.repostOfPostId) ?? null
              : null;
          if (reply == null && repost == null) continue;
          await tx
            .update(posts)
            .set({ replyToPostId: reply, repostOfPostId: repost })
            .where(eq(posts.id, newId));
        }

        // pinned posts
        for (const p of data.personas) {
          const newPersona = personaIdMap.get(p.id);
          if (!newPersona || p.pinnedPostId == null) continue;
          const newPost = postIdMap.get(p.pinnedPostId);
          if (!newPost) continue;
          await tx
            .update(personas)
            .set({ pinnedPostId: newPost })
            .where(eq(personas.id, newPersona));
        }

        // social graph
        const followRows = data.follows
          .filter(
            (f) =>
              personaIdMap.has(f.followerPersonaId) &&
              personaIdMap.has(f.followingPersonaId) &&
              f.followerPersonaId !== f.followingPersonaId,
          )
          .map((f) => ({
            campaignId,
            followerPersonaId: personaIdMap.get(f.followerPersonaId)!,
            followingPersonaId: personaIdMap.get(f.followingPersonaId)!,
            ...(f.createdAt ? { createdAt: f.createdAt } : {}),
          }));
        for (const g of chunk(followRows, 1000))
          if (g.length) await tx.insert(follows).values(g).onConflictDoNothing();

        const mapEdges = (rows: typeof data.likes) =>
          rows
            .filter((l) => personaIdMap.has(l.personaId) && postIdMap.has(l.postId))
            .map((l) => ({
              campaignId,
              personaId: personaIdMap.get(l.personaId)!,
              postId: postIdMap.get(l.postId)!,
              ...(l.createdAt ? { createdAt: l.createdAt } : {}),
            }));
        for (const g of chunk(mapEdges(data.likes), 1000))
          if (g.length) await tx.insert(likes).values(g).onConflictDoNothing();
        for (const g of chunk(mapEdges(data.bookmarks), 1000))
          if (g.length) await tx.insert(bookmarks).values(g).onConflictDoNothing();

        // polls + votes
        const pollIdMap = new Map<number, number>();
        const pollRows = data.polls.filter((pl) => postIdMap.has(pl.postId));
        for (const group of chunk(pollRows, 500)) {
          if (!group.length) continue;
          const rows = await tx
            .insert(polls)
            .values(
              group.map((pl) => ({
                campaignId,
                postId: postIdMap.get(pl.postId)!,
                options: pl.options,
                closesAt: pl.closesAt,
                ...(pl.createdAt ? { createdAt: pl.createdAt } : {}),
              })),
            )
            .returning({ id: polls.id });
          group.forEach((pl, i) => pollIdMap.set(pl.id, rows[i].id));
        }
        const voteRows = data.pollVotes
          .filter((v) => pollIdMap.has(v.pollId) && personaIdMap.has(v.personaId))
          .map((v) => ({
            campaignId,
            pollId: pollIdMap.get(v.pollId)!,
            personaId: personaIdMap.get(v.personaId)!,
            optionIdx: v.optionIdx,
            ...(v.createdAt ? { createdAt: v.createdAt } : {}),
          }));
        for (const g of chunk(voteRows, 1000))
          if (g.length) await tx.insert(pollVotes).values(g).onConflictDoNothing();

        // the importer acts as the first imported persona, or a fresh default if
        // the export had none
        let actingId =
          personaIdMap.size > 0 ? personaIdMap.values().next().value! : null;
        if (actingId == null) {
          const [p] = await tx
            .insert(personas)
            .values({
              campaignId,
              ownerUserId: userId,
              handle: "dm",
              handleLower: "dm",
              displayName: "The DM",
              isNpc: false,
            })
            .returning({ id: personas.id });
          actingId = p.id;
        }
        await tx
          .update(memberships)
          .set({ actingPersonaId: actingId })
          .where(
            and(eq(memberships.userId, userId), eq(memberships.campaignId, campaignId)),
          );

        return c.slug;
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        slug = `${base}-${randomSlugSuffix()}`;
        continue;
      }
      throw e;
    }
  }
  throw new Error("Couldn't import the campaign. Try again.");
}
