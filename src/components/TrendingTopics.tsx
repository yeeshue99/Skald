import Link from "next/link";
import type { TrendingTopic } from "@/lib/queries";

// Presentational list of trending hashtags; each row links to the hashtag
// search. The caller supplies the surrounding card/heading.
export function TrendingTopics({
  slug,
  topics,
}: {
  slug: string;
  topics: TrendingTopic[];
}) {
  return (
    <ul className="-mx-1">
      {topics.map((t, i) => (
        <li key={t.tag}>
          <Link
            href={`/c/${slug}/search?q=${encodeURIComponent(`#${t.display}`)}`}
            className="block rounded-base px-1.5 py-1.5 transition-colors hover:bg-surface-hover"
          >
            <span className="block text-xs text-muted">{i + 1} · Trending</span>
            <span className="block truncate font-semibold text-text">
              #{t.display}
            </span>
            <span className="block text-xs text-muted">
              {t.count} {t.count === 1 ? "post" : "posts"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
