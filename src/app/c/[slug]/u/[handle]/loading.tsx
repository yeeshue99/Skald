import { FeedSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <>
      <div className="border-b border-border">
        <div className="h-28 animate-pulse bg-surface-hover" />
        <div className="px-4 pb-4">
          <div className="-mt-12 size-[88px] animate-pulse rounded-full border-4 border-bg bg-surface-hover" />
          <div className="mt-3 h-5 w-44 animate-pulse rounded bg-surface-hover" />
          <div className="mt-2 h-3 w-28 animate-pulse rounded bg-surface-hover" />
        </div>
      </div>
      <FeedSkeleton />
    </>
  );
}
