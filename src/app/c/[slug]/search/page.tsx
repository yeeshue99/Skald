import Link from "next/link";
import type { Metadata } from "next";
import { requireCampaignContext } from "@/lib/campaign";
import {
  getTrendingHashtags,
  searchPersonas,
  searchPosts,
  type Feed,
  type PersonaSearchResult,
  type TrendingTopic,
} from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { SearchPosts } from "@/components/SearchPosts";
import { TrendingTopics } from "@/components/TrendingTopics";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 100);
  const ctx = await requireCampaignContext(slug);

  let people: PersonaSearchResult[] = [];
  let feed: Feed = { posts: [], nextCursor: null };
  let trends: TrendingTopic[] = [];
  if (query) {
    [people, feed] = await Promise.all([
      searchPersonas(ctx.campaign.id, ctx.actingPersona.id, query, 8),
      searchPosts(ctx.campaign.id, ctx.actingPersona.id, query, 0),
    ]);
  } else {
    trends = await getTrendingHashtags(ctx.campaign.id, 10);
  }

  const ownedIds = new Set(ctx.myPersonas.map((p) => p.id));
  const myPersonaIds = ctx.myPersonas.map((p) => p.id);
  const nothing = query && people.length === 0 && feed.posts.length === 0;

  return (
    <>
      <PageHeader title="Search" />
      <div className="border-b border-border p-3">
        <SearchBar slug={slug} initialQuery={query} autoFocus={!query} />
      </div>

      {!query ? (
        <div className="p-4">
          <p className="px-2 py-6 text-center text-muted">
            Search posts and people, or jump into a trend.
          </p>
          {trends.length > 0 ? (
            <section>
              <h2 className="mb-1 px-2 font-display text-base font-bold text-text">
                Trending
              </h2>
              <TrendingTopics slug={slug} topics={trends} />
            </section>
          ) : null}
        </div>
      ) : nothing ? (
        <p className="px-6 py-16 text-center text-muted">
          No results for &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <>
          {people.length > 0 ? (
            <section className="border-b border-border">
              <h2 className="px-4 pb-1 pt-3 font-display text-base font-bold text-text">
                People
              </h2>
              <ul>
                {people.map((p) => {
                  const profileHref = `/c/${slug}/u/${p.handle.toLowerCase()}`;
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface/50"
                    >
                      <Link href={profileHref} className="shrink-0">
                        <Avatar
                          name={p.displayName}
                          avatarUrl={p.avatarUrl}
                          size={44}
                        />
                      </Link>
                      <Link href={profileHref} className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text hover:underline">
                          {p.displayName}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          @{p.handle}
                        </span>
                        {p.bio ? (
                          <span className="mt-0.5 block truncate text-sm text-text/80">
                            {p.bio}
                          </span>
                        ) : null}
                      </Link>
                      {ownedIds.has(p.id) ? (
                        <span className="shrink-0 text-xs font-medium text-muted">
                          You
                        </span>
                      ) : (
                        <FollowButton
                          slug={slug}
                          targetPersonaId={p.id}
                          initialFollowing={p.followedByMe}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="px-4 pb-1 pt-3 font-display text-base font-bold text-text">
              Posts
            </h2>
            {feed.posts.length > 0 ? (
              <SearchPosts
                slug={slug}
                query={query}
                initialPosts={feed.posts}
                initialCursor={feed.nextCursor}
                myPersonaIds={myPersonaIds}
                isDm={ctx.role === "dm"}
              />
            ) : (
              <p className="px-6 py-10 text-center text-sm text-muted">
                No posts match &ldquo;{query}&rdquo;.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
