import { asc, eq, getTableColumns } from "drizzle-orm";
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
  users,
} from "@/db/schema";

// Every post column except the generated full-text search_vector, which is
// derived from content (and is a tsvector, not portable JSON), so it has no
// place in an export. An importer rebuilds it from content on insert. Stripping
// the one key (rather than listing every column) keeps new columns in exports
// automatically. The pulled-out searchVector is intentionally unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { searchVector, ...postExportCols } = getTableColumns(posts);

// Bump when the shape changes so an importer can branch on it.
export const EXPORT_VERSION = 1;

// A complete, portable dump of one campaign's data: its theme, members,
// personas, every post (drafts and soft-deleted included), the social graph,
// and polls. Row `id`s are the source DB's own, kept so the in-export
// relationships (replies, reposts, pins, follows, likes, votes) stay internally
// consistent; an importer would remap them onto a fresh deployment.
//
// Deliberately excluded: password hashes, sessions, and notifications (derived
// and regenerable). Member rows carry only username + role, no credentials.
export async function exportCampaign(campaignId: number) {
  const campaign = (
    await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1)
  )[0];
  if (!campaign) throw new Error("Campaign not found.");

  const [
    members,
    personaRows,
    postRows,
    followRows,
    likeRows,
    bookmarkRows,
    pollRows,
    voteRows,
  ] = await Promise.all([
    db
      .select({
        userId: memberships.userId,
        username: users.username,
        role: memberships.role,
        actingPersonaId: memberships.actingPersonaId,
        joinedAt: memberships.joinedAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.campaignId, campaignId))
      .orderBy(asc(memberships.userId)),
    db.select().from(personas).where(eq(personas.campaignId, campaignId)).orderBy(asc(personas.id)),
    db.select(postExportCols).from(posts).where(eq(posts.campaignId, campaignId)).orderBy(asc(posts.id)),
    db.select().from(follows).where(eq(follows.campaignId, campaignId)).orderBy(asc(follows.id)),
    db.select().from(likes).where(eq(likes.campaignId, campaignId)).orderBy(asc(likes.id)),
    db.select().from(bookmarks).where(eq(bookmarks.campaignId, campaignId)).orderBy(asc(bookmarks.id)),
    db.select().from(polls).where(eq(polls.campaignId, campaignId)).orderBy(asc(polls.id)),
    db.select().from(pollVotes).where(eq(pollVotes.campaignId, campaignId)).orderBy(asc(pollVotes.id)),
  ]);

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    campaign: {
      slug: campaign.slug,
      name: campaign.name,
      description: campaign.description,
      theme: campaign.theme,
      inviteCode: campaign.inviteCode,
      // lets an importer find the creator's persona to keep as a player character
      createdByUserId: campaign.createdByUserId,
      createdAt: campaign.createdAt,
    },
    members,
    personas: personaRows,
    posts: postRows,
    follows: followRows,
    likes: likeRows,
    bookmarks: bookmarkRows,
    polls: pollRows,
    pollVotes: voteRows,
  };
}
