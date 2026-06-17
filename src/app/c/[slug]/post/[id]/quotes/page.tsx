import { notFound } from "next/navigation";
import { requireCampaignContext } from "@/lib/campaign";
import { getQuotesOf } from "@/lib/queries";
import { PostCard } from "@/components/PostCard";
import { PageHeader } from "@/components/PageHeader";

export default async function QuotesPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const ctx = await requireCampaignContext(slug);
  // getQuotesOf returns null when the target post isn't visible (deleted, future,
  // or in another campaign), so quotes of a hidden post can't be enumerated.
  const feed = await getQuotesOf(
    ctx.campaign.id,
    postId,
    ctx.actingPersona.id,
    null,
  );
  if (!feed) notFound();

  const myPersonaIds = ctx.myPersonas.map((p) => p.id);
  const isDm = ctx.role === "dm";

  return (
    <>
      <PageHeader
        title="Quotes"
        backHref={`/c/${slug}/post/${postId}`}
        desktopOnly={false}
      />

      {feed.posts.length > 0 ? (
        feed.posts.map((p) => (
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
          No quotes yet.
        </div>
      )}
    </>
  );
}
