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
  type: "home" | "explore" | "profile" | "bookmarks";
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

  // keep the latest posts readable inside the polling closure. Sync after commit
  // (not during render) so we never write a ref mid-render.
  const postsRef = useRef(posts);
  useEffect(() => {
    postsRef.current = posts;
  });

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
      } else if (fresh.some((p) => p.status === "scheduled")) {
        // a scheduled post just went live (it's still status 'scheduled' until a
        // page load sweeps it). Its publishedAt is ~now, so surface the batch at
        // the top immediately instead of hiding it behind the pill, and render
        // the scheduled one as a normal published post.
        prepend(
          fresh.map((p) =>
            p.status === "scheduled" ? { ...p, status: "published" } : p,
          ),
        );
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
    // when the tab returns to the foreground, check immediately so a post that
    // went live while it was hidden surfaces without waiting for the next tick
    const onVisible = () => {
      if (document.visibilityState === "visible") checkNewer(false);
    };
    window.addEventListener(FEED_POSTED_EVENT, onPosted);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener(FEED_POSTED_EVENT, onPosted);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkNewer]);

  function revealNew() {
    prepend(pendingNew);
    setPendingNew([]);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
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
    <div className="feed-list">
      {pendingNew.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4">
          <button
            type="button"
            onClick={revealNew}
            className="feed-pill pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary shadow-lg motion-safe:transition-transform motion-safe:hover:scale-[1.03]"
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
              showFollow={type !== "profile"}
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
