import { requireCampaignContext } from "@/lib/campaign";
import { getExploreFeed } from "@/lib/queries";
import { FeedList } from "@/components/FeedList";
import { PageHeader } from "@/components/PageHeader";

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireCampaignContext(slug);
  const feed = await getExploreFeed(ctx.campaign.id, ctx.actingPersona.id, null);

  return (
    <>
      <PageHeader
        title="Explore"
        subtitle="Everything posted across the campaign"
      />
      <FeedList
        slug={slug}
        type="explore"
        initialPosts={feed.posts}
        initialCursor={feed.nextCursor}
        myPersonaIds={ctx.myPersonas.map((p) => p.id)}
        isDm={ctx.role === "dm"}
        emptyMessage="No posts in this campaign yet. Be the first to write something."
      />
    </>
  );
}
