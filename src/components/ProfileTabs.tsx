import Link from "next/link";
import { cn } from "@/lib/cn";

// Profile tabs: "Posts" (top-level posts only) and "Replies" (posts and
// replies together). Server-rendered links; the active tab comes from the
// page's `?tab` search param. Mirrors FeedTabs in style and a11y.
export function ProfileTabs({
  slug,
  handleLower,
  active,
}: {
  slug: string;
  handleLower: string;
  active: "posts" | "replies";
}) {
  const base = `/c/${slug}/u/${handleLower}`;
  const tabs = [
    { key: "posts" as const, label: "Posts", href: base },
    { key: "replies" as const, label: "Replies", href: `${base}?tab=replies` },
  ];
  return (
    <nav className="z-10 flex border-b border-border bg-bg/80 backdrop-blur md:sticky md:top-0">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "fx-btn relative flex-1 py-3.5 text-center text-sm font-semibold transition-colors hover:bg-surface-hover",
              on ? "text-text" : "text-muted",
            )}
          >
            {t.label}
            {on ? (
              <span className="absolute inset-x-0 bottom-0 mx-auto h-1 w-14 rounded-full bg-primary" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
