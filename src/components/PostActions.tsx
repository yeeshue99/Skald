"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, Heart, MessageCircle, Quote, Repeat2, Share } from "lucide-react";
import { toggleBoostAction, toggleLikeAction } from "@/app/actions/posts";
import { toggleBookmarkAction } from "@/app/actions/bookmarks";
import { compactNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

export function PostActions({
  slug,
  postId,
  likeCount,
  liked,
  repostCount,
  reposted,
  replyCount,
  bookmarked,
  canInteract,
}: {
  slug: string;
  postId: number;
  likeCount: number;
  liked: boolean;
  repostCount: number;
  reposted: boolean;
  replyCount: number;
  bookmarked: boolean;
  canInteract: boolean;
}) {
  const [like, setLike] = useState({ on: liked, count: likeCount });
  const [boost, setBoost] = useState({ on: reposted, count: repostCount });
  const [marked, setMarked] = useState(bookmarked);
  const [copied, setCopied] = useState(false);
  // bumped each time a reaction turns ON; the key change remounts the burst
  // span so its themed CSS animation replays. CSS gates it on reduced-motion.
  const [likeBurst, setLikeBurst] = useState(0);
  const [boostBurst, setBoostBurst] = useState(0);
  const [, start] = useTransition();
  const [boostMenu, setBoostMenu] = useState(false);
  const boostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boostRef.current && !boostRef.current.contains(e.target as Node))
        setBoostMenu(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function onLike() {
    if (!canInteract) return;
    if (!like.on) setLikeBurst((k) => k + 1);
    const optimistic = {
      on: !like.on,
      count: like.count + (like.on ? -1 : 1),
    };
    setLike(optimistic);
    start(async () => {
      try {
        const res = await toggleLikeAction(slug, postId);
        setLike({ on: res.liked, count: res.count });
      } catch {
        setLike(like);
      }
    });
  }

  function onBoost() {
    if (!canInteract) return;
    if (!boost.on) setBoostBurst((k) => k + 1);
    const optimistic = {
      on: !boost.on,
      count: boost.count + (boost.on ? -1 : 1),
    };
    setBoost(optimistic);
    start(async () => {
      try {
        const res = await toggleBoostAction(slug, postId);
        setBoost({ on: res.reposted, count: res.count });
      } catch {
        setBoost(boost);
      }
    });
  }

  function onBookmark() {
    if (!canInteract) return;
    const next = !marked;
    setMarked(next);
    start(async () => {
      try {
        const res = await toggleBookmarkAction(slug, postId);
        setMarked(res.bookmarked);
      } catch {
        setMarked(!next);
      }
    });
  }

  async function onShare() {
    const url = `${window.location.origin}/c/${slug}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div className="mt-2 flex items-center justify-between pr-6 text-muted">
      <Link
        href={`/c/${slug}/post/${postId}`}
        className="action-btn group flex items-center gap-1.5 text-sm transition-colors hover:text-link"
        aria-label="Replies"
      >
        <span className="rounded-full p-1.5 transition-colors group-hover:bg-link/10">
          <MessageCircle className="size-4.5" />
        </span>
        {replyCount > 0 ? compactNumber(replyCount) : null}
      </Link>

      <div ref={boostRef} className="relative">
        <button
          type="button"
          onClick={() => canInteract && setBoostMenu((v) => !v)}
          disabled={!canInteract}
          aria-pressed={boost.on}
          aria-haspopup="menu"
          aria-expanded={boostMenu}
          className={cn(
            "action-btn group flex items-center gap-1.5 text-sm transition-colors enabled:hover:text-repost disabled:cursor-default",
            boost.on && "text-repost",
          )}
          aria-label="Repost or quote"
        >
          <span className="relative rounded-full p-1.5 transition-colors group-enabled:group-hover:bg-repost/10">
            {boostBurst > 0 ? (
              <span key={boostBurst} className="reaction-burst" aria-hidden />
            ) : null}
            <Repeat2 className="size-4.5" />
          </span>
          {boost.count > 0 ? compactNumber(boost.count) : null}
        </button>
        {boostMenu ? (
          <div
            role="menu"
            className="absolute left-0 z-20 mt-1 w-40 overflow-hidden rounded-base border border-border bg-surface text-text shadow-lg"
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setBoostMenu(false);
                onBoost();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
            >
              <Repeat2 className="size-4" /> {boost.on ? "Undo repost" : "Repost"}
            </button>
            <Link
              role="menuitem"
              href={`/c/${slug}/post/${postId}/quote`}
              onClick={() => setBoostMenu(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
            >
              <Quote className="size-4" /> Quote
            </Link>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onLike}
        disabled={!canInteract}
        aria-pressed={like.on}
        className={cn(
          "action-btn group flex items-center gap-1.5 text-sm transition-colors enabled:hover:text-like disabled:cursor-default",
          like.on && "text-like",
        )}
        aria-label="Like"
      >
        <span className="relative rounded-full p-1.5 transition-colors group-enabled:group-hover:bg-like/10">
          {likeBurst > 0 ? (
            <span key={likeBurst} className="reaction-burst" aria-hidden />
          ) : null}
          <Heart className={cn("size-4.5", like.on && "fill-current")} />
        </span>
        {like.count > 0 ? compactNumber(like.count) : null}
      </button>

      <button
        type="button"
        onClick={onBookmark}
        disabled={!canInteract}
        aria-pressed={marked}
        className={cn(
          "action-btn group flex items-center gap-1.5 text-sm transition-colors enabled:hover:text-primary disabled:cursor-default",
          marked && "text-primary",
        )}
        aria-label={marked ? "Remove bookmark" : "Bookmark"}
      >
        <span className="rounded-full p-1.5 transition-colors group-enabled:group-hover:bg-primary/10">
          <Bookmark className={cn("size-4.5", marked && "fill-current")} />
        </span>
      </button>

      <button
        type="button"
        onClick={onShare}
        className="action-btn group flex items-center gap-1.5 text-sm transition-colors hover:text-link"
        aria-label="Copy link"
      >
        <span className="rounded-full p-1.5 transition-colors group-hover:bg-link/10">
          <Share className="size-4.5" />
        </span>
        {copied ? <span className="text-xs">copied</span> : null}
      </button>
    </div>
  );
}
