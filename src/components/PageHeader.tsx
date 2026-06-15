import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// The desktop top bar for a page. On mobile the wordmark bar (MobileNav) is the
// top chrome instead, so this is hidden below md.
export function PageHeader({
  title,
  subtitle,
  backHref,
  children,
  desktopOnly = true,
}: {
  title: ReactNode;
  subtitle?: string;
  backHref?: string;
  children?: ReactNode;
  desktopOnly?: boolean;
}) {
  return (
    <header
      className={`sticky top-0 z-10 items-center gap-3 border-b border-border bg-bg/80 px-4 py-2.5 backdrop-blur ${desktopOnly ? "hidden md:flex" : "flex"}`}
    >
      {backHref ? (
        <Link
          href={backHref}
          className="-ml-1 rounded-full p-1.5 text-text hover:bg-surface-hover"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
      ) : null}
      <div className="min-w-0">
        <h1 className="truncate font-display text-lg font-bold leading-tight text-text">
          {title}
        </h1>
        {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="ml-auto">{children}</div> : null}
    </header>
  );
}
