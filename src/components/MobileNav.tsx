"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  CalendarClock,
  Compass,
  Home,
  Plus,
  Search,
  User,
} from "lucide-react";
import type { ComponentType } from "react";
import type { PersonaSummary } from "@/lib/queries";
import { Wordmark } from "./Wordmark";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { cn } from "@/lib/cn";

export function MobileNav({
  slug,
  appName,
  myHandle,
  personas,
  actingPersonaId,
  unreadNotifications = 0,
}: {
  slug: string;
  appName: string;
  myHandle: string;
  personas: PersonaSummary[];
  actingPersonaId: number;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const base = `/c/${slug}`;

  const tabs: {
    href: string;
    icon: ComponentType<{ className?: string }>;
    exact?: boolean;
    label: string;
  }[] = [
    { href: base, icon: Home, exact: true, label: "Home" },
    { href: `${base}/explore`, icon: Compass, label: "Explore" },
    { href: `${base}/queue`, icon: CalendarClock, label: "Queue" },
    { href: `${base}/u/${myHandle.toLowerCase()}`, icon: User, label: "Profile" },
  ];

  return (
    <>
      <header className="chrome-bar sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-bg/85 px-3 py-2 backdrop-blur md:hidden">
        <Link href={base} className="min-w-0 shrink overflow-hidden">
          <Wordmark name={appName} className="block truncate text-xl text-primary" />
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`${base}/notifications`}
            aria-label="Notifications"
            className="fx-btn relative rounded-full p-2 text-text hover:bg-surface-hover"
          >
            <Bell className="size-5" />
            {unreadNotifications > 0 ? (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-bg" />
            ) : null}
          </Link>
          <Link
            href={`${base}/search`}
            aria-label="Search"
            className="fx-btn rounded-full p-2 text-text hover:bg-surface-hover"
          >
            <Search className="size-5" />
          </Link>
          <Link
            href={`${base}/bookmarks`}
            aria-label="Bookmarks"
            className="fx-btn rounded-full p-2 text-text hover:bg-surface-hover"
          >
            <Bookmark className="size-5" />
          </Link>
          <div className="w-32 sm:w-44">
            <PersonaSwitcher
              slug={slug}
              personas={personas}
              actingPersonaId={actingPersonaId}
            />
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {tabs.slice(0, 2).map((t) => (
          <Tab key={t.href} {...t} active={isActive(pathname, t)} />
        ))}
        <Link
          href={`${base}/compose`}
          className="fx-btn -mt-4 flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg"
          aria-label="Post"
        >
          <Plus className="size-6" />
        </Link>
        {tabs.slice(2).map((t) => (
          <Tab key={t.href} {...t} active={isActive(pathname, t)} />
        ))}
      </nav>
    </>
  );
}

function isActive(
  pathname: string,
  t: { href: string; exact?: boolean },
): boolean {
  return t.exact ? pathname === t.href : pathname.startsWith(t.href);
}

function Tab({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "fx-btn flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px]",
        active ? "text-primary" : "text-muted",
      )}
    >
      <Icon className="size-6" />
    </Link>
  );
}
