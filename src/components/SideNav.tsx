"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  Compass,
  Home,
  LogOut,
  PenSquare,
  Settings,
  User,
} from "lucide-react";
import type { ComponentType } from "react";
import { logoutAction } from "@/app/actions/auth";
import type { PersonaSummary } from "@/lib/queries";
import { Wordmark } from "./Wordmark";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { buttonClasses } from "./ui";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: ComponentType<{ className?: string }>; exact?: boolean };

export function SideNav({
  slug,
  appName,
  tagline,
  isDm,
  myHandle,
  personas,
  actingPersonaId,
}: {
  slug: string;
  appName: string;
  tagline: string;
  isDm: boolean;
  myHandle: string;
  personas: PersonaSummary[];
  actingPersonaId: number;
}) {
  const pathname = usePathname();
  const base = `/c/${slug}`;

  const items: Item[] = [
    { href: base, label: "Home", icon: Home, exact: true },
    { href: `${base}/explore`, label: "Explore", icon: Compass },
    { href: `${base}/queue`, label: "Queue", icon: CalendarClock },
    { href: `${base}/u/${myHandle.toLowerCase()}`, label: "Profile", icon: User },
    ...(isDm
      ? [{ href: `${base}/settings`, label: "Settings", icon: Settings } as Item]
      : []),
  ];

  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 border-r border-border px-2 py-3 md:flex md:w-[88px] lg:w-[268px] lg:px-4">
      <Link
        href={base}
        className="mb-1 flex flex-col px-2 py-1 lg:px-3"
        title={appName}
      >
        <Wordmark name={appName} className="truncate text-2xl text-primary" />
        <span className="hidden truncate text-xs text-muted lg:block">
          {tagline}
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((it) => {
          const active = it.exact
            ? pathname === it.href
            : pathname.startsWith(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-4 rounded-full px-3 py-2.5 text-lg transition-colors hover:bg-surface-hover",
                active ? "font-bold text-text" : "text-text/90",
              )}
            >
              <Icon className="size-6 shrink-0" />
              <span className="hidden lg:inline">{it.label}</span>
            </Link>
          );
        })}

        <Link
          href={`${base}/compose`}
          className={cn(
            buttonClasses("primary", "lg"),
            "mt-2 lg:w-full lg:justify-center",
          )}
        >
          <PenSquare className="size-5 lg:hidden" />
          <span className="hidden lg:inline">Post</span>
        </Link>
      </nav>

      <div className="mt-auto space-y-2">
        <div className="hidden lg:block">
          <PersonaSwitcher
            slug={slug}
            personas={personas}
            actingPersonaId={actingPersonaId}
          />
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <LogOut className="size-5 shrink-0" />
            <span className="hidden lg:inline">Log out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
