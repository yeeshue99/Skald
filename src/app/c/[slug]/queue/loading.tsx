import { FeedSkeleton, HeaderSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <FeedSkeleton rows={4} />
    </>
  );
}
