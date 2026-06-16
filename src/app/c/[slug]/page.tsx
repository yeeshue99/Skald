import { requireCampaignContext } from "@/lib/campaign";
import {
  getExploreFeed,
  getHomeFeed,
  type PersonaSummary,
} from "@/lib/queries";
import { Composer } from "@/components/Composer";
import { FeedList } from "@/components/FeedList";
import { FeedTabs } from "@/components/FeedTabs";

export default async function HomeFeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const everyone = tab === "everyone";

  const ctx = await requireCampaignContext(slug);
  const feed = everyone
    ? await getExploreFeed(ctx.campaign.id, ctx.actingPersona.id, null)
    : await getHomeFeed(ctx.campaign.id, ctx.actingPersona.id, null);

  const personas: PersonaSummary[] = ctx.myPersonas.map((p) => ({
    id: p.id,
    handle: p.handle,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isNpc: p.isNpc,
    avatarFrame: p.avatarFrame,
  }));

  return (
    <>
      <FeedTabs slug={slug} active={everyone ? "everyone" : "following"} />
      <div className="border-b border-border">
        <Composer
          slug={slug}
          personas={personas}
          actingPersonaId={ctx.actingPersona.id}
        />
      </div>
      <FeedList
        key={everyone ? "everyone" : "following"}
        slug={slug}
        type={everyone ? "explore" : "home"}
        initialPosts={feed.posts}
        initialCursor={feed.nextCursor}
        myPersonaIds={personas.map((p) => p.id)}
        isDm={ctx.role === "dm"}
        emptyMessage={
          everyone
            ? "No posts in this campaign yet. Be the first to write something."
            : "You're not following anyone yet. Switch to Everyone to find characters to follow."
        }
      />
    </>
  );
}
