export function PostSkeleton() {
  return (
    <div className="flex gap-3 border-b border-border px-4 py-3">
      <div className="size-11 shrink-0 animate-pulse rounded-full bg-surface-hover" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-40 animate-pulse rounded bg-surface-hover" />
        <div className="h-3 w-full animate-pulse rounded bg-surface-hover" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-hover" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="sticky top-0 z-10 hidden items-center border-b border-border bg-bg/80 px-4 py-3 backdrop-blur md:flex">
      <div className="h-5 w-28 animate-pulse rounded bg-surface-hover" />
    </div>
  );
}
