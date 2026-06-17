"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared accessible dialog: scrim + centered panel with role=dialog, focus trap,
// Escape-to-close, and focus restore. Owns the title + X header so call sites
// only pass the body. Document-level listeners follow the PostMenu precedent.
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // The element that had focus when the dialog opened, captured at open time.
  const triggerRef = useRef<HTMLElement | null>(null);

  // Escape-to-close via a document listener so every open state honours it,
  // not just keystrokes that land on the panel.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus lifecycle: capture the trigger, move focus into the panel after it
  // mounts, and restore focus on close. Keyed on open so close-paths other than
  // a user click (e.g. a success effect) still restore focus.
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    triggerRef.current = trigger;

    const panel = panelRef.current;
    if (panel) {
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.focus();
      }
    }

    return () => {
      // Restore only if the trigger is still in the document; the Edit trigger
      // lives in NpcManager rows that can remount.
      const t = triggerRef.current;
      if (t && t.isConnected && document.contains(t)) {
        t.focus();
      }
      triggerRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  function onPanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusables.length === 0) {
      // Nothing tabbable inside (e.g. the success message): keep focus on the
      // panel so it cannot leak to the page behind the scrim.
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !panel.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
        className={
          className ??
          "w-full max-w-md rounded-base border border-border bg-surface p-5 shadow-2xl"
        }
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id={titleId}
            className="font-display text-lg font-bold text-text"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted hover:bg-surface-hover hover:text-text"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
