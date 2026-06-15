"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp } from "lucide-react";
import type { PostView } from "@/lib/queries";
import { fetchFeedPageAction, fetchNewerFeedAction } from "@/app/actions/feed";
import { PostCard } from "./PostCard";
import { Button } from "./ui";

const POLL_MS = 12_000;
export const FEED_POSTED_EVENT = "skald:posted";

export function FeedList({
  slug,
  type,
  handleLower,
  initialPosts,
  initialCursor,
  myPersonaIds,
  isDm,
  emptyMessage = "Nothing here yet.",
}: {
  slug: string;
  type: "home" | "explore" | "profile";
  handleLower?: string;
  initialPosts: PostView[];
  initialCursor: string | null;
  myPersonaIds: number[];
  isDm: boolean;
  emptyMessage?: string;
}) {
  const [posts, setPosts] = useState<PostView[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [pendingNew, setPendingNew] = useState<PostView[]>([]);
  const [loadingMore, startLoadMore] = useTransition();

  // keep the latest posts readable inside the polling closure
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const prepend = useCallback((fresh: PostView[]) => {
    if (fresh.length === 0) return;
    setPosts((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      const add = fresh.filter((p) => !ids.has(p.id));
      return add.length ? [...add, ...prev] : prev;
    });
  }, []);

  // look for posts newer than the current head; auto-prepend the user's own
  // post, otherwise stash them behind a "N new posts" pill
  const checkNewer = useCallback(
    async (auto: boolean) => {
      const head = postsRef.current[0];
      const iso = head?.publishedAt
        ? new Date(head.publishedAt).toISOString()
        : new Date(0).toISOString();
      const id = head?.id ?? 0;

      let newer: PostView[] = [];
      try {
        newer = await fetchNewerFeedAction(slug, type, iso, id, handleLower);
      } catch {
        return;
      }
      const ids = new Set(postsRef.current.map((p) => p.id));
      const fresh = newer.filter((p) => !ids.has(p.id));
      if (fresh.length === 0) {
        if (auto) setPendingNew([]);
        return;
      }
      if (auto || postsRef.current.length === 0) {
        prepend(fresh);
        setPendingNew([]);
      } else {
        setPendingNew(fresh);
      }
    },
    [slug, type, handleLower, prepend],
  );

  // poll while the tab is visible; react instantly when this user posts
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") checkNewer(false);
    }, POLL_MS);
    const onPosted = () => checkNewer(true);
    window.addEventListener(FEED_POSTED_EVENT, onPosted);
    return () => {
      clearInterval(interval);
      window.removeEventListener(FEED_POSTED_EVENT, onPosted);
    };
  }, [checkNewer]);

  function revealNew() {
    prepend(pendingNew);
    setPendingNew([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadMore() {
    startLoadMore(async () => {
      const res = await fetchFeedPageAction(slug, type, cursor, handleLower);
      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...res.posts.filter((p) => !ids.has(p.id))];
      });
      setCursor(res.nextCursor);
    });
  }

  return (
    <div>
      {pendingNew.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4">
          <button
            type="button"
            onClick={revealNew}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary shadow-lg transition-transform hover:scale-[1.03]"
          >
            <ArrowUp className="size-4" />
            {pendingNew.length} new post{pendingNew.length === 1 ? "" : "s"}
          </button>
        </div>
      ) : null}

      {posts.length === 0 ? (
        <div className="px-6 py-16 text-center text-muted">{emptyMessage}</div>
      ) : (
        <>
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
              <Button
                variant="secondary"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted">
              That&apos;s the end of the feed.
            </div>
          )}
        </>
      )}
    </div>
  );
}
