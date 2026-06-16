import { requireCampaignContext } from "@/lib/campaign";
import { getBookmarksFeed } from "@/lib/queries";
import { FeedList } from "@/components/FeedList";
import { PageHeader } from "@/components/PageHeader";

export default async function BookmarksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireCampaignContext(slug);
  const feed = await getBookmarksFeed(ctx.campaign.id, ctx.actingPersona.id, null);

  return (
    <>
      <PageHeader title="Bookmarks" subtitle="Posts you've saved" />
      <FeedList
        slug={slug}
        type="bookmarks"
        initialPosts={feed.posts}
        initialCursor={feed.nextCursor}
        myPersonaIds={ctx.myPersonas.map((p) => p.id)}
        isDm={ctx.role === "dm"}
        emptyMessage="No bookmarks yet. Tap the bookmark icon on a post to save it here."
      />
    </>
  );
}
