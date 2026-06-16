"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { restorePostAction } from "@/app/actions/posts";

const TOAST_EVENT = "skald:toast";
const TOAST_MS = 6000;

type UndoTarget = { slug: string; postId: number };
type ToastDetail = { message: string; undo?: UndoTarget };
type Toast = ToastDetail & { id: number };

// Fire a toast from anywhere (e.g. after a delete). Decoupled via a window
// event so the toast survives the triggering component unmounting.
export function showToast(message: string, undo?: UndoTarget) {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, undo } }),
  );
}

// Mounted once in the campaign layout. Renders transient toasts; a toast with
// an `undo` target offers an Undo that restores the soft-deleted post.
export function Toaster() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );

  useEffect(() => {
    let n = 0;
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      const id = ++n;
      setToasts((t) => [...t, { id, ...detail }]);
      setTimeout(() => dismiss(id), TOAST_MS);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, [dismiss]);

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="feed-pill pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text shadow-lg"
        >
          <span>{t.message}</span>
          {t.undo ? (
            <button
              type="button"
              onClick={() => {
                const { slug, postId } = t.undo!;
                restorePostAction(slug, postId)
                  .then(() => router.refresh())
                  .catch(() => {});
                dismiss(t.id);
              }}
              className="font-semibold text-primary hover:underline"
            >
              Undo
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
