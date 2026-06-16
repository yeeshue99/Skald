import { notFound } from "next/navigation";
import { requireCampaignContext } from "@/lib/campaign";
import { getThread, type PersonaSummary } from "@/lib/queries";
import { PostCard } from "@/components/PostCard";
import { Composer } from "@/components/Composer";
import { PageHeader } from "@/components/PageHeader";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const ctx = await requireCampaignContext(slug);
  const thread = await getThread(ctx.campaign.id, postId, ctx.actingPersona.id);
  if (!thread) notFound();

  const personas: PersonaSummary[] = ctx.myPersonas.map((p) => ({
    id: p.id,
    handle: p.handle,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isNpc: p.isNpc,
    avatarFrame: p.avatarFrame,
  }));
  const myPersonaIds = personas.map((p) => p.id);
  const isDm = ctx.role === "dm";

  return (
    <>
      <PageHeader title="Post" backHref={`/c/${slug}`} desktopOnly={false} />

      {thread.ancestors.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          slug={slug}
          myPersonaIds={myPersonaIds}
          isDm={isDm}
        />
      ))}

      <PostCard
        post={thread.root}
        slug={slug}
        myPersonaIds={myPersonaIds}
        isDm={isDm}
        highlight
      />

      <div className="border-b border-border bg-surface/30">
        <Composer
          slug={slug}
          personas={personas}
          actingPersonaId={ctx.actingPersona.id}
          replyToPostId={thread.root.id}
          placeholder="Post your reply"
        />
      </div>

      {thread.replies.length > 0 ? (
        thread.replies.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            slug={slug}
            myPersonaIds={myPersonaIds}
            isDm={isDm}
          />
        ))
      ) : (
        <div className="px-6 py-12 text-center text-muted">
          No replies yet. Be the first.
        </div>
      )}
    </>
  );
}
