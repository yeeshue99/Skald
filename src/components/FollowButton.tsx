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
}: {
  slug: string;
  targetPersonaId: number;
  initialFollowing: boolean;
  size?: "sm" | "md";
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
        following
          ? buttonClasses("secondary", size, "min-w-[6rem]")
          : buttonClasses("primary", size, "min-w-[6rem]"),
        following && hovering && "border-like/50 text-like",
      )}
    >
      {following ? (hovering ? "Unfollow" : "Following") : "Follow"}
    </button>
  );
}
