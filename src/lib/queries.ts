import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  follows,
  likes,
  personas,
  posts,
  memberships,
  users,
  type PostStatus,
} from "@/db/schema";

export const PAGE_SIZE = 25;

export type PersonaSummary = {
  id: number;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  isNpc: boolean;
};

export type PostView = {
  id: number;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  status: PostStatus;
  author: PersonaSummary;
  replyToPostId: number | null;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  likedByMe: boolean;
  repostedByMe: boolean;
  /** whether the viewing (acting) persona already follows this post's author */
  authorFollowedByMe: boolean;
  /** when this row is a plain boost, the original post it boosts (if still visible) */
  repostOf: PostView | null;
  isBoost: boolean;
};

export type Cursor = { publishedAt: Date; id: number };

export function encodeCursor(c: Cursor): string {
  return `${c.publishedAt.toISOString()}_${c.id}`;
}
export function decodeCursor(raw: string | undefined | null): Cursor | null {
  if (!raw) return null;
  const idx = raw.lastIndexOf("_");
  if (idx < 0) return null;
  const publishedAt = new Date(raw.slice(0, idx));
  const id = Number(raw.slice(idx + 1));
  if (Number.isNaN(publishedAt.getTime())) return null;
  if (!Number.isInteger(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER)
    return null;
  return { publishedAt, id };
}

const personaCols = {
  id: personas.id,
  handle: personas.handle,
  displayName: personas.displayName,
  avatarUrl: personas.avatarUrl,
  isNpc: personas.isNpc,
};

// A post is visible once it is published (publishedAt <= now), using the DB
// clock, and not soft-deleted.
function visibleCondition() {
  return and(
    isNull(posts.deletedAt),
    isNotNull(posts.publishedAt),
    lte(posts.publishedAt, sql`now()`),
  );
}

function keysetBefore(cursor: Cursor | null) {
  if (!cursor) return undefined;
  return or(
    lt(posts.publishedAt, cursor.publishedAt),
    and(eq(posts.publishedAt, cursor.publishedAt), lt(posts.id, cursor.id)),
  );
}

type RawPost = typeof posts.$inferSelect;

async function loadPersonas(ids: number[]): Promise<Map<number, PersonaSummary>> {
  const map = new Map<number, PersonaSummary>();
  if (ids.length === 0) return map;
  const rows = await db
    .select(personaCols)
    .from(personas)
    .where(inArray(personas.id, ids));
  for (const r of rows) map.set(r.id, r);
  return map;
}

type Counts = { like: number; reply: number; repost: number };

async function loadCounts(ids: number[]): Promise<Map<number, Counts>> {
  const map = new Map<number, Counts>();
  if (ids.length === 0) return map;
  for (const id of ids) map.set(id, { like: 0, reply: 0, repost: 0 });

  const [likeRows, replyRows, repostRows] = await Promise.all([
    db
      .select({ id: likes.postId, c: count() })
      .from(likes)
      .where(inArray(likes.postId, ids))
      .groupBy(likes.postId),
    db
      .select({ id: posts.replyToPostId, c: count() })
      .from(posts)
      .where(and(inArray(posts.replyToPostId, ids), visibleCondition()))
      .groupBy(posts.replyToPostId),
    db
      .select({ id: posts.repostOfPostId, c: count() })
      .from(posts)
      .where(and(inArray(posts.repostOfPostId, ids), visibleCondition()))
      .groupBy(posts.repostOfPostId),
  ]);

  for (const r of likeRows) map.get(r.id)!.like = Number(r.c);
  for (const r of replyRows) if (r.id != null) map.get(r.id)!.reply = Number(r.c);
  for (const r of repostRows) if (r.id != null) map.get(r.id)!.repost = Number(r.c);
  return map;
}

async function loadViewerState(
  viewerPersonaId: number,
  ids: number[],
): Promise<{ liked: Set<number>; reposted: Set<number> }> {
  const liked = new Set<number>();
  const reposted = new Set<number>();
  if (ids.length === 0) return { liked, reposted };

  const [likeRows, repostRows] = await Promise.all([
    db
      .select({ id: likes.postId })
      .from(likes)
      .where(and(eq(likes.personaId, viewerPersonaId), inArray(likes.postId, ids))),
    db
      .select({ id: posts.repostOfPostId })
      .from(posts)
      .where(
        and(
          eq(posts.personaId, viewerPersonaId),
          inArray(posts.repostOfPostId, ids),
          eq(posts.content, ""),
          isNull(posts.deletedAt),
        ),
      ),
  ]);

  for (const r of likeRows) liked.add(r.id);
  for (const r of repostRows) if (r.id != null) reposted.add(r.id);
  return { liked, reposted };
}

// Which of these author personas the viewer already follows (for inline Follow
// buttons in the feed).
async function loadViewerFollows(
  viewerPersonaId: number,
  authorIds: number[],
): Promise<Set<number>> {
  const set = new Set<number>();
  if (authorIds.length === 0) return set;
  const rows = await db
    .select({ id: follows.followingPersonaId })
    .from(follows)
    .where(
      and(
        eq(follows.followerPersonaId, viewerPersonaId),
        inArray(follows.followingPersonaId, authorIds),
      ),
    );
  for (const r of rows) set.add(r.id);
  return set;
}

/**
 * Turn raw post rows into PostViews: resolves authors, counts, the viewer's
 * like/boost state, and (one level deep) the original post behind a boost,
 * re-applying the visibility predicate to that original.
 */
async function hydrate(
  rows: RawPost[],
  viewerPersonaId: number,
  campaignId: number,
): Promise<PostView[]> {
  if (rows.length === 0) return [];

  const boostTargetIds = rows
    .map((r) => r.repostOfPostId)
    .filter((x): x is number => x != null && rows.every((p) => p.id !== x));

  let targetRows: RawPost[] = [];
  if (boostTargetIds.length) {
    targetRows = await db
      .select()
      .from(posts)
      .where(
        and(
          inArray(posts.id, boostTargetIds),
          eq(posts.campaignId, campaignId),
          visibleCondition(),
        ),
      );
  }

  const allRows = [...rows, ...targetRows];
  const authorIds = [...new Set(allRows.map((r) => r.personaId))];
  const countIds = [...new Set(allRows.map((r) => r.id))];

  const [personaMap, countMap, viewer, followedAuthors] = await Promise.all([
    loadPersonas(authorIds),
    loadCounts(countIds),
    loadViewerState(viewerPersonaId, countIds),
    loadViewerFollows(viewerPersonaId, authorIds),
  ]);

  const build = (r: RawPost): PostView => {
    const c = countMap.get(r.id) ?? { like: 0, reply: 0, repost: 0 };
    return {
      id: r.id,
      content: r.content,
      imageUrl: r.imageUrl,
      createdAt: r.createdAt,
      publishedAt: r.publishedAt,
      status: r.status,
      author:
        personaMap.get(r.personaId) ?? {
          id: r.personaId,
          handle: "unknown",
          displayName: "Unknown",
          avatarUrl: null,
          isNpc: false,
        },
      replyToPostId: r.replyToPostId,
      likeCount: c.like,
      replyCount: c.reply,
      repostCount: c.repost,
      likedByMe: viewer.liked.has(r.id),
      repostedByMe: viewer.reposted.has(r.id),
      authorFollowedByMe: followedAuthors.has(r.personaId),
      repostOf: null,
      isBoost: false,
    };
  };

  const targetViews = new Map<number, PostView>();
  for (const t of targetRows) targetViews.set(t.id, build(t));

  return rows.map((r) => {
    const view = build(r);
    const isPlainBoost = r.repostOfPostId != null && r.content === "";
    if (r.repostOfPostId != null) {
      view.repostOf =
        targetViews.get(r.repostOfPostId) ??
        rows
          .filter((p) => p.id === r.repostOfPostId)
          .map(build)[0] ??
        null;
      view.isBoost = isPlainBoost;
    }
    return view;
  });
}

// ---------------------------------------------------------------------------
// Feeds
// ---------------------------------------------------------------------------
export async function getFollowingIds(personaId: number): Promise<number[]> {
  const rows = await db
    .select({ id: follows.followingPersonaId })
    .from(follows)
    .where(eq(follows.followerPersonaId, personaId));
  return rows.map((r) => r.id);
}

export type Feed = { posts: PostView[]; nextCursor: string | null };

async function pageFeed(
  campaignId: number,
  whereExtra: ReturnType<typeof and>,
  viewerPersonaId: number,
  cursor: Cursor | null,
): Promise<Feed> {
  const rows = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.campaignId, campaignId),
        visibleCondition(),
        isNull(posts.replyToPostId),
        whereExtra,
        keysetBefore(cursor),
      ),
    )
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const views = await hydrate(pageRows, viewerPersonaId, campaignId);
  const last = pageRows[pageRows.length - 1];
  return {
    posts: views,
    nextCursor:
      hasMore && last?.publishedAt
        ? encodeCursor({ publishedAt: last.publishedAt, id: last.id })
        : null,
  };
}

export async function getHomeFeed(
  campaignId: number,
  actingPersonaId: number,
  cursor: Cursor | null,
): Promise<Feed> {
  const followingIds = await getFollowingIds(actingPersonaId);
  const authorIds = [...new Set([...followingIds, actingPersonaId])];
  return pageFeed(
    campaignId,
    and(inArray(posts.personaId, authorIds)),
    actingPersonaId,
    cursor,
  );
}

export async function getExploreFeed(
  campaignId: number,
  viewerPersonaId: number,
  cursor: Cursor | null,
): Promise<Feed> {
  return pageFeed(campaignId, undefined, viewerPersonaId, cursor);
}

// ---------------------------------------------------------------------------
// Search — posts by content and people by handle / display name / bio, scoped
// to the campaign. The query is parsed so a leading # or @ is treated as a
// hashtag / mention TOKEN (matched on word boundaries) instead of a loose
// substring. Results are ranked by relevance (token / whole-word / prefix
// matches first), then recency. LIKE wildcards are escaped so they match
// literally; regex metacharacters are escaped before a POSIX `~*` match.
// Post results use OFFSET paging (small, point-in-time result sets) since the
// relevance order isn't a stable keyset. (At larger scale a pg_trgm GIN index
// on posts.content would turn the content scan into an index lookup.)
// ---------------------------------------------------------------------------
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// POSIX regex matching `token` as a standalone run. The boundaries use
// [^[:alnum:]_] so they also work around a leading # / @ (not word characters).
function tokenRegex(token: string): string {
  return `(^|[^[:alnum:]_])${escapeRegex(token)}([^[:alnum:]_]|$)`;
}

type ParsedQuery =
  | { kind: "hashtag"; token: string; bare: string }
  | { kind: "mention"; token: string; bare: string }
  | { kind: "text"; bare: string };

function parseQuery(query: string): ParsedQuery {
  const q = query.trim();
  if (/^#[a-zA-Z0-9_]+$/.test(q)) return { kind: "hashtag", token: q, bare: q.slice(1) };
  if (/^@[a-zA-Z0-9_]+$/.test(q)) return { kind: "mention", token: q, bare: q.slice(1) };
  return { kind: "text", bare: q };
}

// `where` = which posts match; `score` = how well (drives the relevance order).
function buildPostMatch(parsed: ParsedQuery): { where: SQL; score: SQL<number> } {
  if (parsed.kind === "text") {
    const like = `%${escapeLike(parsed.bare)}%`;
    const prefix = `${escapeLike(parsed.bare)}%`;
    const wordRe = tokenRegex(parsed.bare);
    return {
      where: ilike(posts.content, like),
      // whole-word = 3, starts-with = 2, loose substring = 1
      score: sql<number>`(case when ${posts.content} ~* ${wordRe} then 3 when ${posts.content} ilike ${prefix} then 2 else 1 end)`,
    };
  }
  // hashtag / mention: the token must be present, word-bounded
  return {
    where: sql`${posts.content} ~* ${tokenRegex(parsed.token)}`,
    score: sql<number>`3`,
  };
}

// Posts whose content matches the query. Unlike the feeds this keeps replies
// (any matching post is findable); plain boosts have empty content so they
// never match a non-empty query.
export async function searchPosts(
  campaignId: number,
  viewerPersonaId: number,
  query: string,
  offset = 0,
): Promise<Feed> {
  const { where, score } = buildPostMatch(parseQuery(query));
  const rows = await db
    .select({ ...getTableColumns(posts), _score: score })
    .from(posts)
    .where(and(eq(posts.campaignId, campaignId), visibleCondition(), where))
    .orderBy(desc(score), desc(posts.publishedAt), desc(posts.id))
    .limit(PAGE_SIZE + 1)
    .offset(offset);

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const views = await hydrate(pageRows, viewerPersonaId, campaignId);
  return {
    posts: views,
    nextCursor: hasMore ? String(offset + PAGE_SIZE) : null,
  };
}

export type PersonaSearchResult = PersonaSummary & {
  bio: string | null;
  followedByMe: boolean;
};

export async function searchPersonas(
  campaignId: number,
  viewerPersonaId: number,
  query: string,
  limit = 8,
): Promise<PersonaSearchResult[]> {
  // a #tag / @handle query matches people on the bare word (so @tasha surfaces
  // the persona "tasha", and #fractals can surface a bio that mentions it)
  const bare = parseQuery(query).bare;
  const like = `%${escapeLike(bare)}%`;
  const prefix = `${escapeLike(bare)}%`;
  const exact = bare.toLowerCase();
  // exact handle / name = 3, prefix = 2, loose substring (incl. bio) = 1
  const score = sql<number>`(case when ${personas.handleLower} = ${exact} or lower(${personas.displayName}) = ${exact} then 3 when ${personas.handle} ilike ${prefix} or ${personas.displayName} ilike ${prefix} then 2 else 1 end)`;
  const rows = await db
    .select({ ...personaCols, bio: personas.bio, _score: score })
    .from(personas)
    .where(
      and(
        eq(personas.campaignId, campaignId),
        or(
          ilike(personas.handle, like),
          ilike(personas.displayName, like),
          ilike(personas.bio, like),
        ),
      ),
    )
    .orderBy(desc(score), desc(personas.isNpc), asc(personas.id))
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const followed = new Set<number>();
  if (ids.length) {
    const followRows = await db
      .select({ id: follows.followingPersonaId })
      .from(follows)
      .where(
        and(
          eq(follows.followerPersonaId, viewerPersonaId),
          inArray(follows.followingPersonaId, ids),
        ),
      );
    for (const r of followRows) followed.add(r.id);
  }
  return rows.map((r) => ({ ...r, followedByMe: followed.has(r.id) }));
}

// ---------------------------------------------------------------------------
// "Newer than" — posts that appeared after the cursor (for live updates).
// Returns at most `limit` newest-first; an empty cursor (id 0) means "any".
// ---------------------------------------------------------------------------
async function fetchNewer(
  campaignId: number,
  whereExtra: ReturnType<typeof and>,
  viewerPersonaId: number,
  after: Cursor,
  limit = 40,
): Promise<PostView[]> {
  const rows = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.campaignId, campaignId),
        visibleCondition(),
        isNull(posts.replyToPostId),
        whereExtra,
        or(
          gt(posts.publishedAt, after.publishedAt),
          and(eq(posts.publishedAt, after.publishedAt), gt(posts.id, after.id)),
        ),
      ),
    )
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(limit);
  return hydrate(rows, viewerPersonaId, campaignId);
}

export async function getNewerHomeFeed(
  campaignId: number,
  actingPersonaId: number,
  after: Cursor,
): Promise<PostView[]> {
  const followingIds = await getFollowingIds(actingPersonaId);
  const authorIds = [...new Set([...followingIds, actingPersonaId])];
  return fetchNewer(
    campaignId,
    and(inArray(posts.personaId, authorIds)),
    actingPersonaId,
    after,
  );
}

export async function getNewerExploreFeed(
  campaignId: number,
  viewerPersonaId: number,
  after: Cursor,
): Promise<PostView[]> {
  return fetchNewer(campaignId, undefined, viewerPersonaId, after);
}

export async function getNewerPersonaPosts(
  campaignId: number,
  personaId: number,
  viewerPersonaId: number,
  after: Cursor,
): Promise<PostView[]> {
  return fetchNewer(
    campaignId,
    and(eq(posts.personaId, personaId)),
    viewerPersonaId,
    after,
  );
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export type ProfileData = {
  persona: typeof personas.$inferSelect;
  ownerUsername: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  followedByMe: boolean;
  isMe: boolean;
};

export async function getPersonaByHandle(campaignId: number, handleLower: string) {
  const rows = await db
    .select()
    .from(personas)
    .where(
      and(eq(personas.campaignId, campaignId), eq(personas.handleLower, handleLower)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getProfile(
  campaignId: number,
  handleLower: string,
  viewerPersonaId: number,
): Promise<ProfileData | null> {
  const persona = await getPersonaByHandle(campaignId, handleLower);
  if (!persona) return null;

  const [followerRows, followingRows, postRows, ownerRows, followRows] =
    await Promise.all([
      db
        .select({ c: count() })
        .from(follows)
        .where(eq(follows.followingPersonaId, persona.id)),
      db
        .select({ c: count() })
        .from(follows)
        .where(eq(follows.followerPersonaId, persona.id)),
      db
        .select({ c: count() })
        .from(posts)
        .where(and(eq(posts.personaId, persona.id), visibleCondition())),
      db.select({ username: users.username }).from(users).where(eq(users.id, persona.ownerUserId)).limit(1),
      db
        .select({ id: follows.id })
        .from(follows)
        .where(
          and(
            eq(follows.followerPersonaId, viewerPersonaId),
            eq(follows.followingPersonaId, persona.id),
          ),
        )
        .limit(1),
    ]);

  return {
    persona,
    ownerUsername: ownerRows[0]?.username ?? "",
    followerCount: Number(followerRows[0]?.c ?? 0),
    followingCount: Number(followingRows[0]?.c ?? 0),
    postCount: Number(postRows[0]?.c ?? 0),
    followedByMe: followRows.length > 0,
    isMe: persona.id === viewerPersonaId,
  };
}

export async function getPersonaPosts(
  campaignId: number,
  personaId: number,
  viewerPersonaId: number,
  cursor: Cursor | null,
): Promise<Feed> {
  return pageFeed(
    campaignId,
    and(eq(posts.personaId, personaId)),
    viewerPersonaId,
    cursor,
  );
}

// ---------------------------------------------------------------------------
// Thread (a post plus its visible replies)
// ---------------------------------------------------------------------------
export type Thread = {
  root: PostView;
  ancestors: PostView[];
  replies: PostView[];
};

export async function getThread(
  campaignId: number,
  postId: number,
  viewerPersonaId: number,
): Promise<Thread | null> {
  const rootRows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.campaignId, campaignId), visibleCondition()))
    .limit(1);
  const rootRaw = rootRows[0];
  if (!rootRaw) return null;

  // walk up the reply chain (bounded), staying within the campaign
  const ancestorsRaw: RawPost[] = [];
  let parentId = rootRaw.replyToPostId;
  for (let i = 0; i < 20 && parentId != null; i++) {
    const pr = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.id, parentId),
          eq(posts.campaignId, campaignId),
          visibleCondition(),
        ),
      )
      .limit(1);
    if (!pr[0]) break;
    ancestorsRaw.unshift(pr[0]);
    parentId = pr[0].replyToPostId;
  }

  const replyRaw = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.replyToPostId, postId),
        eq(posts.campaignId, campaignId),
        visibleCondition(),
      ),
    )
    .orderBy(asc(posts.publishedAt), asc(posts.id));

  const [rootViews, ancestorViews, replyViews] = await Promise.all([
    hydrate([rootRaw], viewerPersonaId, campaignId),
    hydrate(ancestorsRaw, viewerPersonaId, campaignId),
    hydrate(replyRaw, viewerPersonaId, campaignId),
  ]);

  return { root: rootViews[0], ancestors: ancestorViews, replies: replyViews };
}

// ---------------------------------------------------------------------------
// Queue (the acting user's scheduled + draft posts across personas they own)
// ---------------------------------------------------------------------------
export async function getQueue(
  campaignId: number,
  ownedPersonaIds: number[],
): Promise<{ scheduled: PostView[]; drafts: PostView[] }> {
  if (ownedPersonaIds.length === 0) return { scheduled: [], drafts: [] };

  const rows = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.campaignId, campaignId),
        inArray(posts.personaId, ownedPersonaIds),
        isNull(posts.deletedAt),
        ne(posts.status, "published"),
      ),
    )
    .orderBy(asc(posts.publishedAt), asc(posts.id));

  // hydrate uses the first owned persona as the viewer (state is irrelevant here)
  const views = await hydrate(rows, ownedPersonaIds[0], campaignId);
  return {
    scheduled: views.filter((v) => v.status === "scheduled"),
    drafts: views.filter((v) => v.status === "draft"),
  };
}

// ---------------------------------------------------------------------------
// Discovery + members
// ---------------------------------------------------------------------------
export async function getWhoToFollow(
  campaignId: number,
  actingPersonaId: number,
  limit = 5,
): Promise<PersonaSummary[]> {
  const followingIds = await getFollowingIds(actingPersonaId);
  const excluded = [...followingIds, actingPersonaId];
  const rows = await db
    .select(personaCols)
    .from(personas)
    .where(
      and(
        eq(personas.campaignId, campaignId),
        notInArray(personas.id, excluded),
      ),
    )
    .orderBy(desc(personas.isNpc), asc(personas.id))
    .limit(limit);
  return rows;
}

export type MemberRow = {
  userId: number;
  username: string;
  role: "dm" | "player";
  personas: PersonaSummary[];
};

export async function getCampaignMembers(campaignId: number): Promise<MemberRow[]> {
  const memberRows = await db
    .select({ userId: users.id, username: users.username, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.campaignId, campaignId))
    .orderBy(asc(memberships.role), asc(users.username));

  const personaRows = await db
    .select({ ...personaCols, owner: personas.ownerUserId })
    .from(personas)
    .where(eq(personas.campaignId, campaignId))
    .orderBy(asc(personas.isNpc), asc(personas.id));

  const byOwner = new Map<number, PersonaSummary[]>();
  for (const { owner, ...p } of personaRows) {
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner)!.push(p);
  }

  return memberRows.map((m) => ({
    userId: m.userId,
    username: m.username,
    role: m.role,
    personas: byOwner.get(m.userId) ?? [],
  }));
}
