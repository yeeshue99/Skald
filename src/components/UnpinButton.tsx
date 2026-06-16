"use client";

import { useTransition } from "react";
import { unpinPostAction } from "@/app/actions/posts";

export function UnpinButton({ slug, postId }: { slug: string; postId: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          try {
            await unpinPostAction(slug, postId);
          } catch {
            /* ignore */
          }
        })
      }
      disabled={pending}
      className="ml-auto text-xs font-medium text-primary transition-colors hover:underline disabled:opacity-50"
    >
      {pending ? "Unpinning…" : "Unpin"}
    </button>
  );
}
