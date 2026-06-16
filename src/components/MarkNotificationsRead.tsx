"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsReadAction } from "@/app/actions/notifications";

// Marks notifications read once when the page mounts, then refreshes so the nav
// badge updates. No-ops when there's nothing unread.
export function MarkNotificationsRead({
  slug,
  hasUnread,
}: {
  slug: string;
  hasUnread: boolean;
}) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !hasUnread) return;
    done.current = true;
    markNotificationsReadAction(slug).then(() => router.refresh());
  }, [slug, hasUnread, router]);
  return null;
}
