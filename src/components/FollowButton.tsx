"use client";

import { useState, useTransition } from "react";
import { toggleFollowAction } from "@/app/actions/follow";
import { buttonClasses } from "./ui";
import { cn } from "@/lib/cn";

export function FollowButton({
  slug,
  targetPersonaId,
  initialFollowing,
  size = "sm",
  compact = false,
}: {
  slug: string;
  targetPersonaId: number;
  initialFollowing: boolean;
  size?: "sm" | "md";
  /** drop the fixed min-width for tight, inline placements (e.g. feed posts) */
  compact?: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [hovering, setHovering] = useState(false);
  const [, start] = useTransition();

  function onClick() {
    const next = !following;
    setFollowing(next);
    start(async () => {
      try {
        const res = await toggleFollowAction(slug, targetPersonaId);
        setFollowing(res.following);
      } catch {
        setFollowing(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        buttonClasses(
          following ? "secondary" : "primary",
          size,
          compact ? "min-w-0" : "min-w-24",
        ),
        following && hovering && "border-like/50 text-like",
      )}
    >
      {following ? (hovering ? "Unfollow" : "Following") : "Follow"}
    </button>
  );
}
