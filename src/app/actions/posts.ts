"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { likes, posts } from "@/db/schema";
import { loadActionContext, ownsPersona, type CampaignContext } from "@/lib/campaign";
import { composeSchema } from "@/lib/validation";
import { type FormState } from "@/lib/form";
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

  const parsed = composeSchema.safeParse({
    content: formData.get("content"),
    imageUrl: formData.get("imageUrl"),
    scheduledAt: formData.get("scheduledAt"),
    asDraft: formData.get("asDraft"),
    replyToPostId: formData.get("replyToPostId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your post." };
  }
  const { content, imageUrl, scheduledAt, asDraft, replyToPostId } = parsed.data;

  const text = content.trim();
  if (!text && !imageUrl) return { error: "Write something or add an image." };

  // validate reply target (and remember its author so we can notify them)
  let replyTarget: Visible | null = null;
  if (replyToPostId != null) {
    replyTarget = await loadVisibleTarget(ctx, replyToPostId);
    if (!replyTarget) {
      return { error: "That post is no longer available to reply to." };
    }
  }

  // status + publish instant. Truncate to milliseconds so the value matches the
  // precision of feed cursors (which round-trip through JS Date / ISO strings),
  // keeping keyset pagination exact.
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

  const [created] = await db
    .insert(posts)
    .values({
      campaignId: ctx.campaign.id,
      personaId: authorId,
      content: text,
      imageUrl: imageUrl || null,
      status,
      publishedAt: publishedAt as Date | null,
      replyToPostId: replyToPostId ?? null,
    })
    .returning({ id: posts.id });

  // notify on reply + @mention, but only once the post is actually live — a
  // scheduled or draft post shouldn't ping anyone before it's visible
  if (status === "published") {
    const replyRecipient = replyTarget?.personaId ?? null;
    if (replyToPostId != null && replyRecipient != null) {
      await notify({
        campaignId: ctx.campaign.id,
        recipientPersonaId: replyRecipient,
        actorPersonaId: authorId,
        type: "reply",
        postId: created.id,
      });
    }
    await notifyMentions({
      campaignId: ctx.campaign.id,
      actorPersonaId: authorId,
      postId: created.id,
      content: text,
      exclude: replyRecipient != null ? [replyRecipient] : [],
    });
  }

  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/explore`);
  if (replyToPostId != null) revalidatePath(`/c/${slug}/post/${replyToPostId}`);
  if (status !== "published") revalidatePath(`/c/${slug}/queue`);
  return { ok: true };
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
