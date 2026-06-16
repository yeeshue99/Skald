"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AtSign,
  Heart,
  Loader2,
  MessageCircle,
  Quote,
  UserPlus,
} from "lucide-react";
import type { NotificationType } from "@/db/schema";
import type { NotificationView } from "@/lib/queries";
import { fetchNotificationsPageAction } from "@/app/actions/notifications";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "./Avatar";
import { Button } from "./ui";

const ICON = {
  like: Heart,
  reply: MessageCircle,
  follow: UserPlus,
  mention: AtSign,
  quote: Quote,
} as const;

const TINT: Record<NotificationType, string> = {
  like: "text-like",
  reply: "text-link",
  follow: "text-repost",
  mention: "text-accent",
  quote: "text-repost",
};

// "liked your post" — or "liked @npc's post" when you act as several personas.
function phrase(
  type: NotificationType,
  multiPersona: boolean,
  recipientHandle: string,
): string {
  const owner = multiPersona ? `@${recipientHandle}` : "you";
  const ownerPost = multiPersona ? `@${recipientHandle}'s post` : "your post";
  switch (type) {
    case "like":
      return `liked ${ownerPost}`;
    case "reply":
      return `replied to ${ownerPost}`;
    case "follow":
      return `followed ${owner}`;
    case "mention":
      return `mentioned ${owner}`;
    case "quote":
      return `quoted ${ownerPost}`;
  }
}

export function NotificationList({
  slug,
  initialItems,
  initialCursor,
  multiPersona,
}: {
  slug: string;
  initialItems: NotificationView[];
  initialCursor: string | null;
  multiPersona: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, start] = useTransition();

  function loadMore() {
    if (!cursor || pending) return;
    start(async () => {
      const page = await fetchNotificationsPageAction(slug, cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    });
  }

  if (items.length === 0) {
    return (
      <p className="px-6 py-16 text-center text-muted">
        No notifications yet. Likes, replies, quotes, follows, and mentions land
        here.
      </p>
    );
  }

  return (
    <>
      <ul>
        {items.map((n) => {
          const Icon = ICON[n.type];
          const href = n.post
            ? `/c/${slug}/post/${n.post.id}`
            : `/c/${slug}/u/${n.actor.handle.toLowerCase()}`;
          const unread = n.readAt == null;
          return (
            <li
              key={n.id}
              className={cn("border-b border-border", unread && "bg-primary/5")}
            >
              <Link
                href={href}
                className="flex gap-3 px-4 py-3 transition-colors hover:bg-surface/50"
              >
                <Icon className={cn("mt-1 size-5 shrink-0", TINT[n.type])} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={n.actor.displayName}
                      avatarUrl={n.actor.avatarUrl}
                      size={28}
                      frame={n.actor.avatarFrame}
                    />
                    <p className="min-w-0 text-sm text-text">
                      <span className="font-semibold">{n.actor.displayName}</span>{" "}
                      <span className="text-muted">@{n.actor.handle}</span>{" "}
                      {phrase(n.type, multiPersona, n.recipientHandle)}
                      <span className="text-muted">
                        {" · "}
                        {relativeTime(new Date(n.createdAt))}
                      </span>
                    </p>
                  </div>
                  {n.post && n.post.content ? (
                    <p className="mt-1 line-clamp-2 pl-9 text-sm text-muted">
                      {n.post.content}
                    </p>
                  ) : null}
                </div>
                {unread ? (
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {cursor ? (
        <div className="flex justify-center p-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={loadMore}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      ) : null}
    </>
  );
}
