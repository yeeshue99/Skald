import { requireCampaignContext } from "@/lib/campaign";
import { getHomeFeed, type PersonaSummary } from "@/lib/queries";
import { Composer } from "@/components/Composer";
import { FeedList } from "@/components/FeedList";
import { PageHeader } from "@/components/PageHeader";

export default async function HomeFeedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireCampaignContext(slug);
  const feed = await getHomeFeed(ctx.campaign.id, ctx.actingPersona.id, null);

  const personas: PersonaSummary[] = ctx.myPersonas.map((p) => ({
    id: p.id,
    handle: p.handle,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isNpc: p.isNpc,
  }));

  return (
    <>
      <PageHeader title="Home" />
      <div className="border-b border-border">
        <Composer
          slug={slug}
          personas={personas}
          actingPersonaId={ctx.actingPersona.id}
        />
      </div>
      <FeedList
        slug={slug}
        type="home"
        initialPosts={feed.posts}
        initialCursor={feed.nextCursor}
        myPersonaIds={personas.map((p) => p.id)}
        isDm={ctx.role === "dm"}
        emptyMessage="Your home feed is quiet. Follow some characters over in Explore, or post the first tweet."
      />
    </>
  );
}
