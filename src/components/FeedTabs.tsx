import Link from "next/link";
import { cn } from "@/lib/cn";

// Home-feed tabs: "Following" (people the acting persona follows + self) and
// "Everyone" (the whole campaign). Server-rendered links; the active tab comes
// from the page's `?tab` search param.
export function FeedTabs({
  slug,
  active,
}: {
  slug: string;
  active: "following" | "everyone";
}) {
  const base = `/c/${slug}`;
  const tabs = [
    { key: "following" as const, label: "Following", href: base },
    { key: "everyone" as const, label: "Everyone", href: `${base}?tab=everyone` },
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
