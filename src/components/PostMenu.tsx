"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Pin, Trash2 } from "lucide-react";
import { deletePostAction, pinPostAction } from "@/app/actions/posts";
import { showToast } from "./Toaster";

export function PostMenu({ slug, postId }: { slug: string; postId: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Soft-delete immediately and offer an Undo toast (no confirm dialog).
  function onDelete() {
    setOpen(false);
    start(async () => {
      try {
        await deletePostAction(slug, postId);
        showToast("Post deleted", { slug, postId });
      } catch {
        showToast("Couldn't delete that post");
      }
    });
  }

  function onPin() {
    setOpen(false);
    start(async () => {
      try {
        await pinPostAction(slug, postId);
        showToast("Pinned to profile");
      } catch {
        showToast("Couldn't pin that post");
      }
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-1.5 text-muted transition-colors hover:bg-surface-hover hover:text-text"
        aria-label="Post menu"
      >
        <MoreHorizontal className="size-[18px]" />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-base border border-border bg-surface shadow-lg">
          <Link
            href={`/c/${slug}/post/${postId}/edit`}
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition-colors hover:bg-surface-hover"
          >
            <Pencil className="size-4" /> Edit
          </Link>
          <button
            type="button"
            onClick={onPin}
            disabled={pending}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            <Pin className="size-4" /> Pin to profile
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-like transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            <Trash2 className="size-4" /> {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
