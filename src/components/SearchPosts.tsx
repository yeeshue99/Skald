"use client";

import { useState, useTransition } from "react";
import type { PostView } from "@/lib/queries";
import { searchPostsAction } from "@/app/actions/search";
import { PostCard } from "./PostCard";
import { Button } from "./ui";

// Post search results with keyset "load more". No live polling (unlike the
// feed) — a search is a point-in-time query.
export function SearchPosts({
  slug,
  query,
  initialPosts,
  initialCursor,
  myPersonaIds,
  isDm,
}: {
  slug: string;
  query: string;
  initialPosts: PostView[];
  initialCursor: string | null;
  myPersonaIds: number[];
  isDm: boolean;
}) {
  const [posts, setPosts] = useState<PostView[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, startLoad] = useTransition();

  function loadMore() {
    startLoad(async () => {
      const res = await searchPostsAction(slug, query, cursor);
      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...res.posts.filter((p) => !ids.has(p.id))];
      });
      setCursor(res.nextCursor);
    });
  }

  return (
    <div>
      {posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          slug={slug}
          myPersonaIds={myPersonaIds}
          isDm={isDm}
        />
      ))}
      {cursor ? (
        <div className="p-4 text-center">
          <Button variant="secondary" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-muted">
          End of results.
        </div>
      )}
    </div>
  );
}
