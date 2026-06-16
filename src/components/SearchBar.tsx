"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

// Navigates to /c/<slug>/search?q=... on submit. Seeded with the current query
// so the box reflects what's being shown.
export function SearchBar({
  slug,
  initialQuery = "",
  autoFocus = false,
}: {
  slug: string;
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    router.push(
      `/c/${slug}/search${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ""}`,
    );
  }

  return (
    <form onSubmit={submit} role="search">
      <div className="flex items-center gap-2 rounded-full border border-border bg-bg/60 px-3 py-2 transition-colors focus-within:border-primary">
        <Search className="size-4 shrink-0 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search posts and people"
          aria-label="Search posts and people"
          maxLength={100}
          autoFocus={autoFocus}
          className="w-full bg-transparent text-sm text-text placeholder:text-muted/70 focus:outline-none"
        />
      </div>
    </form>
  );
}
