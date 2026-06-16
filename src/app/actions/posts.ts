"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { likes, personas, polls, pollVotes, posts } from "@/db/schema";
import { loadActionContext, ownsPersona, type CampaignContext } from "@/lib/campaign";
import { composeSchema, pollInputSchema } from "@/lib/validation";
import { type FormState } from "@/lib/form";
import { getPoll, type PollView } from "@/lib/queries";
import { notify, notifyMentions, removeLikeNotification } from "@/lib/notify";

type Visible = {
  id: number;
  campaignId: number;
  personaId: number;
  publishedAt: Date | null;
  deletedAt: Date | null;
};

async function loadVisibleTarget(
  ctx: CampaignContext,
  postId: number,
): Promise<Visible | null> {
  const row = (
    await db
      .select({
        id: posts.id,
        campaignId: posts.campaignId,
        personaId: posts.personaId,
        publishedAt: posts.publishedAt,
        deletedAt: posts.deletedAt,
      })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1)
  )[0];
  if (!row) return null;
  if (row.campaignId !== ctx.campaign.id) return null;
  if (row.deletedAt) return null;
  if (!row.publishedAt || row.publishedAt.getTime() > Date.now()) return null;
  return row;
}

function resolveAuthor(ctx: CampaignContext, formData: FormData): number | null {
  const raw = formData.get("authorPersonaId");
  if (raw == null || raw === "") return ctx.actingPersona.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || !ownsPersona(ctx, id)) return null;
  return id;
}

// A single submit can author a self-thread; cap how many posts it may chain.
// Keep in sync with MAX_THREAD_POSTS in components/Composer.tsx.
const MAX_THREAD_POSTS = 25;

// Pull the thread segments out of the form. The composer submits a JSON array of
// { content, imageUrl }; an older client (or a degraded one) may post a single
// content/imageUrl pair, which we treat as a one-segment thread.
function parseThreadSegments(
  formData: FormData,
): { content: string; imageUrl: string }[] {
  const raw = formData.get("segments");
  if (typeof raw === "string" && raw.trim()) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr.map((s) => ({
          content: typeof s?.content === "string" ? s.content : "",
          imageUrl: typeof s?.imageUrl === "string" ? s.imageUrl : "",
        }));
      }
    } catch {
      // fall through to the single-segment reading
    }
  }
  return [
    {
      content: String(formData.get("content") ?? ""),
      imageUrl: String(formData.get("imageUrl") ?? ""),
    },
  ];
}

// ---------------------------------------------------------------------------
// Compose: a new post, reply, draft, or scheduled post.
// ---------------------------------------------------------------------------
export async function createPostAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const ctx = await loadActionContext(slug);

  const authorId = resolveAuthor(ctx, formData);
  if (authorId == null) return { error: "You can't post as that persona." };

  // A post may be a single post or a self-thread: the composer submits one or
  // more segments, each of which becomes a post replying to the one before it.
  const segments = parseThreadSegments(formData);

  // thread-wide fields: schedule, draft, and the external post the FIRST segment
  // answers (later segments reply to their predecessor, forming the chain).
  const shared = composeSchema.safeParse({
    content: "",
    scheduledAt: formData.get("scheduledAt"),
    asDraft: formData.get("asDraft"),
    replyToPostId: formData.get("replyToPostId") || undefined,
  });
  if (!shared.success) {
    return { error: shared.error.issues[0]?.message ?? "Check your post." };
  }
  const { scheduledAt, asDraft, replyToPostId } = shared.data;

  // a quote-post is a new post (with its own content) that embeds another via
  // repostOfPostId. Validated below once the segments and poll are known.
  let repostOfPostId: number | null = null;
  const repostRaw = formData.get("repostOfPostId");
  if (typeof repostRaw === "string" && repostRaw.trim()) {
    const n = Number(repostRaw);
    if (!Number.isInteger(n) || n <= 0) return { error: "Bad quote target." };
    repostOfPostId = n;
  }

  // validate + clean each segment, dropping any that are entirely empty
  const cleaned: { content: string; imageUrl: string }[] = [];
  for (const seg of segments) {
    const p = composeSchema.safeParse({
      content: seg.content,
      imageUrl: seg.imageUrl,
    });
    if (!p.success) {
      return { error: p.error.issues[0]?.message ?? "Check your post." };
    }
    const text = p.data.content.trim();
    if (!text && !p.data.imageUrl) continue;
    cleaned.push({ content: text, imageUrl: p.data.imageUrl });
  }
  if (cleaned.length === 0)
    return { error: "Write something or add an image." };
  if (cleaned.length > MAX_THREAD_POSTS)
    return { error: `A thread can be at most ${MAX_THREAD_POSTS} posts.` };

  // optional poll attached to a single post (mutually exclusive with image,
  // thread, scheduling, and drafts — see the checks once status is known)
  let poll: { options: string[]; days: number } | null = null;
  const pollRaw = formData.get("pollOptions");
  if (typeof pollRaw === "string" && pollRaw.trim()) {
    let arr: unknown = null;
    try {
      arr = JSON.parse(pollRaw);
    } catch {
      arr = null;
    }
    const pp = pollInputSchema.safeParse({
      options: Array.isArray(arr)
        ? arr.map((o) => (typeof o === "string" ? o : ""))
        : [],
      days: formData.get("pollDays") ?? 1,
    });
    if (!pp.success) {
      return { error: pp.error.issues[0]?.message ?? "Check your poll." };
    }
    poll = pp.data;
  }

  // validate the reply target (and remember its author so we can notify them)
  let replyTarget: Visible | null = null;
  if (replyToPostId != null) {
    replyTarget = await loadVisibleTarget(ctx, replyToPostId);
    if (!replyTarget) {
      return { error: "That post is no longer available to reply to." };
    }
  }

  // validate the quote target. A quote is a single post and is never also a
  // reply (the DB enforces reply-XOR-repost) or a poll.
  if (repostOfPostId != null) {
    if (replyToPostId != null)
      return { error: "A post can't be both a reply and a quote." };
    if (cleaned.length > 1) return { error: "A quote is a single post." };
    if (poll) return { error: "A quote can't carry a poll." };
    const quoteTarget = await loadVisibleTarget(ctx, repostOfPostId);
    if (!quoteTarget)
      return { error: "That post is no longer available to quote." };
  }

  // status + publish instant, shared by every segment of the thread. Truncate to
  // milliseconds so the value matches the precision of feed cursors (which
  // round-trip through JS Date / ISO strings), keeping keyset pagination exact.
  let status: "draft" | "scheduled" | "published" = "published";
  let publishedAt: Date | ReturnType<typeof sql> | null = sql`date_trunc('milliseconds', now())`;

  if (asDraft) {
    status = "draft";
    publishedAt = null;
  } else if (scheduledAt) {
    const when = new Date(scheduledAt);
    if (!Number.isNaN(when.getTime())) {
      if (when.getTime() > Date.now()) {
        // genuinely in the future — hold it until then
        status = "scheduled";
        publishedAt = when;
      } else {
        // the chosen time is already past (active time > schedule): post it now
        // but stamped at the chosen instant, so it lands in the timeline in the
        // right order rather than jumping to the top
        status = "published";
        publishedAt = when;
      }
    }
    // an unparseable time falls through to publish-now (the default above)
  }

  if (poll) {
    if (cleaned.length !== 1)
      return { error: "A poll can't be part of a thread." };
    if (cleaned[0].imageUrl)
      return { error: "A post can have a poll or an image, not both." };
    if (asDraft || status === "scheduled")
      return { error: "A poll can't be scheduled or saved as a draft." };
  }

  // insert segments in order, chaining each as a reply to the previous so the
  // run reads as one self-thread. The first answers the external reply target
  // (if any); the rest answer their predecessor.
  let parentId: number | null = replyToPostId ?? null;
  const created: number[] = [];
  for (const seg of cleaned) {
    const [row] = await db
      .insert(posts)
      .values({
        campaignId: ctx.campaign.id,
        personaId: authorId,
        content: seg.content,
        imageUrl: seg.imageUrl || null,
        status,
        publishedAt: publishedAt as Date | null,
        replyToPostId: parentId,
        // only the first (and, for a quote, only) post carries the quote ref
        repostOfPostId,
      })
      .returning({ id: posts.id });
    created.push(row.id);
    parentId = row.id;
  }

  // attach the poll to the (single) created post
  if (poll) {
    await db.insert(polls).values({
      campaignId: ctx.campaign.id,
      postId: created[0],
      options: poll.options,
      closesAt: new Date(Date.now() + poll.days * 86_400_000),
    });
  }

  // notify on reply + @mention, but only once posts are actually live — a
  // scheduled or draft thread shouldn't ping anyone before it's visible. Only
  // the first segment answers someone else; later segments reply to the author's
  // own posts (a self-reply, which notify() skips), so only their mentions ping.
  if (status === "published") {
    const replyRecipient = replyTarget?.personaId ?? null;
    for (let i = 0; i < created.length; i++) {
      if (i === 0 && replyToPostId != null && replyRecipient != null) {
        await notify({
          campaignId: ctx.campaign.id,
          recipientPersonaId: replyRecipient,
          actorPersonaId: authorId,
          type: "reply",
          postId: created[i],
        });
      }
      await notifyMentions({
        campaignId: ctx.campaign.id,
        actorPersonaId: authorId,
        postId: created[i],
        content: cleaned[i].content,
        exclude: i === 0 && replyRecipient != null ? [replyRecipient] : [],
      });
    }
  }

  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/explore`);
  if (replyToPostId != null) revalidatePath(`/c/${slug}/post/${replyToPostId}`);
  if (repostOfPostId != null) revalidatePath(`/c/${slug}/post/${repostOfPostId}`);
  if (status !== "published") revalidatePath(`/c/${slug}/queue`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Poll voting: the acting persona casts one vote (unique per poll); returns the
// fresh poll view so the client can show results immediately.
// ---------------------------------------------------------------------------
export async function votePollAction(
  slug: string,
  pollId: number,
  optionIdx: number,
): Promise<PollView | { error: string }> {
  const ctx = await loadActionContext(slug);
  const poll = (
    await db.select().from(polls).where(eq(polls.id, pollId)).limit(1)
  )[0];
  if (!poll || poll.campaignId !== ctx.campaign.id)
    return { error: "Poll not found." };
  if (poll.closesAt.getTime() <= Date.now())
    return { error: "This poll has closed." };
  if (
    !Number.isInteger(optionIdx) ||
    optionIdx < 0 ||
    optionIdx >= poll.options.length
  )
    return { error: "That option doesn't exist." };

  // one vote per persona: a repeat vote is ignored (unique poll+persona index)
  await db
    .insert(pollVotes)
    .values({
      campaignId: ctx.campaign.id,
      pollId,
      personaId: ctx.actingPersona.id,
      optionIdx,
    })
    .onConflictDoNothing();

  const view = await getPoll(pollId, ctx.actingPersona.id);
  if (!view) return { error: "Poll not found." };
  revalidatePath(`/c/${slug}`);
  return view;
}

// ---------------------------------------------------------------------------
// Queue management: publish now, reschedule, delete.
// ---------------------------------------------------------------------------
async function assertOwnsPost(ctx: CampaignContext, postId: number) {
  const row = (
    await db
      .select({ id: posts.id, personaId: posts.personaId, campaignId: posts.campaignId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1)
  )[0];
  if (!row || row.campaignId !== ctx.campaign.id) throw new Error("Post not found.");
  const isOwner = ownsPersona(ctx, row.personaId);
  if (!isOwner && ctx.role !== "dm") throw new Error("Not your post.");
  return row;
}

export async function publishNowAction(slug: string, postId: number): Promise<void> {
  const ctx = await loadActionContext(slug);
  await assertOwnsPost(ctx, postId);
  await db
    .update(posts)
    .set({
      status: "published",
      publishedAt: sql`date_trunc('milliseconds', now())`,
    })
    .where(eq(posts.id, postId));
  revalidatePath(`/c/${slug}/queue`);
  revalidatePath(`/c/${slug}`);
}

export async function rescheduleAction(
  slug: string,
  postId: number,
  scheduledAtIso: string,
): Promise<void> {
  const ctx = await loadActionContext(slug);
  await assertOwnsPost(ctx, postId);
  // never reschedule something already live
  const row = (
    await db
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1)
  )[0];
  if (row?.status === "published") throw new Error("That post is already live.");

  const when = new Date(scheduledAtIso);
  if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now())
    throw new Error("Pick a time in the future.");

  await db
    .update(posts)
    .set({ status: "scheduled", publishedAt: when })
    .where(eq(posts.id, postId));
  revalidatePath(`/c/${slug}/queue`);
}

export async function deletePostAction(slug: string, postId: number): Promise<void> {
  const ctx = await loadActionContext(slug);
  await assertOwnsPost(ctx, postId);
  // soft delete keeps reply threads intact (and lets the action be undone)
  await db.update(posts).set({ deletedAt: sql`now()` }).where(eq(posts.id, postId));
  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/explore`);
  revalidatePath(`/c/${slug}/queue`);
  revalidatePath(`/c/${slug}/post/${postId}`);
}

// Undo of a soft delete — restore the post if it's still flagged deleted.
export async function restorePostAction(
  slug: string,
  postId: number,
): Promise<void> {
  const ctx = await loadActionContext(slug);
  await assertOwnsPost(ctx, postId);
  await db
    .update(posts)
    .set({ deletedAt: null })
    .where(and(eq(posts.id, postId), isNotNull(posts.deletedAt)));
  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/explore`);
  revalidatePath(`/c/${slug}/queue`);
  revalidatePath(`/c/${slug}/post/${postId}`);
}

// ---------------------------------------------------------------------------
// Edit a post's content/image (author or DM). Status, author and publish time
// are untouched; editedAt stamps the change so the UI can show "edited".
// ---------------------------------------------------------------------------
export async function editPostAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const postId = Number(formData.get("postId"));
  if (!Number.isInteger(postId)) return { error: "Unknown post." };

  const ctx = await loadActionContext(slug);
  try {
    await assertOwnsPost(ctx, postId);
  } catch {
    return { error: "You can't edit that post." };
  }

  const parsed = composeSchema.safeParse({
    content: formData.get("content"),
    imageUrl: formData.get("imageUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your post." };
  }
  const text = parsed.data.content.trim();
  const imageUrl = parsed.data.imageUrl;
  if (!text && !imageUrl) return { error: "Write something or add an image." };

  await db
    .update(posts)
    .set({
      content: text,
      imageUrl: imageUrl || null,
      editedAt: sql`date_trunc('milliseconds', now())`,
    })
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)));

  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/explore`);
  revalidatePath(`/c/${slug}/post/${postId}`);
  redirect(`/c/${slug}/post/${postId}`);
}

// ---------------------------------------------------------------------------
// Pin / unpin a post to the author persona's profile. The post must be a
// published, visible post; the user must own its author persona (or be DM).
// ---------------------------------------------------------------------------
async function loadPinnable(ctx: CampaignContext, postId: number) {
  const row = (
    await db
      .select({
        personaId: posts.personaId,
        campaignId: posts.campaignId,
        publishedAt: posts.publishedAt,
        deletedAt: posts.deletedAt,
        handle: personas.handleLower,
      })
      .from(posts)
      .innerJoin(personas, eq(personas.id, posts.personaId))
      .where(eq(posts.id, postId))
      .limit(1)
  )[0];
  if (!row || row.campaignId !== ctx.campaign.id) throw new Error("Post not found.");
  if (!ownsPersona(ctx, row.personaId) && ctx.role !== "dm") {
    throw new Error("Not your post.");
  }
  return row;
}

export async function pinPostAction(slug: string, postId: number): Promise<void> {
  const ctx = await loadActionContext(slug);
  const post = await loadPinnable(ctx, postId);
  if (post.deletedAt || !post.publishedAt || post.publishedAt.getTime() > Date.now()) {
    throw new Error("You can only pin a published post.");
  }
  await db
    .update(personas)
    .set({ pinnedPostId: postId })
    .where(eq(personas.id, post.personaId));
  revalidatePath(`/c/${slug}/u/${post.handle}`);
}

export async function unpinPostAction(slug: string, postId: number): Promise<void> {
  const ctx = await loadActionContext(slug);
  const post = await loadPinnable(ctx, postId);
  await db
    .update(personas)
    .set({ pinnedPostId: null })
    .where(
      and(eq(personas.id, post.personaId), eq(personas.pinnedPostId, postId)),
    );
  revalidatePath(`/c/${slug}/u/${post.handle}`);
}

// ---------------------------------------------------------------------------
// Like / boost — performed as the acting persona.
// ---------------------------------------------------------------------------
export async function toggleLikeAction(
  slug: string,
  postId: number,
): Promise<{ liked: boolean; count: number }> {
  const ctx = await loadActionContext(slug);
  const target = await loadVisibleTarget(ctx, postId);
  if (!target) throw new Error("Post not available.");

  const personaId = ctx.actingPersona.id;
  const existing = await db
    .select({ id: likes.id })
    .from(likes)
    .where(and(eq(likes.personaId, personaId), eq(likes.postId, postId)))
    .limit(1);

  let liked: boolean;
  if (existing.length) {
    await db.delete(likes).where(eq(likes.id, existing[0].id));
    liked = false;
  } else {
    await db
      .insert(likes)
      .values({ campaignId: ctx.campaign.id, personaId, postId })
      .onConflictDoNothing();
    liked = true;
  }

  if (liked) {
    await notify({
      campaignId: ctx.campaign.id,
      recipientPersonaId: target.personaId,
      actorPersonaId: personaId,
      type: "like",
      postId,
    });
  } else {
    await removeLikeNotification(personaId, postId);
  }

  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(likes)
    .where(and(eq(likes.postId, postId), eq(likes.campaignId, ctx.campaign.id)));
  return { liked, count: Number(c) };
}

export async function toggleBoostAction(
  slug: string,
  postId: number,
): Promise<{ reposted: boolean; count: number }> {
  const ctx = await loadActionContext(slug);
  const target = await loadVisibleTarget(ctx, postId);
  if (!target) throw new Error("Post not available.");

  const personaId = ctx.actingPersona.id;
  const existing = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        eq(posts.personaId, personaId),
        eq(posts.repostOfPostId, postId),
        eq(posts.content, ""),
        isNull(posts.deletedAt),
      ),
    )
    .limit(1);

  let reposted: boolean;
  if (existing.length) {
    await db.delete(posts).where(eq(posts.id, existing[0].id));
    reposted = false;
  } else {
    await db
      .insert(posts)
      .values({
        campaignId: ctx.campaign.id,
        personaId,
        content: "",
        status: "published",
        publishedAt: sql`date_trunc('milliseconds', now())`,
        repostOfPostId: postId,
      })
      .onConflictDoNothing();
    reposted = true;
  }

  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(posts)
    .where(
      and(
        eq(posts.repostOfPostId, postId),
        eq(posts.campaignId, ctx.campaign.id),
        isNull(posts.deletedAt),
        sql`${posts.publishedAt} is not null and ${posts.publishedAt} <= now()`,
      ),
    );

  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/explore`);
  return { reposted, count: Number(c) };
}
