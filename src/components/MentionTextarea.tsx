"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";
import { searchMentionsAction } from "@/app/actions/search";
import type { PersonaSummary } from "@/lib/queries";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/cn";

// "@partial" ending at the caret, only at a word boundary so emails (a@b) and
// mid-word @ don't trigger. Group 1 is the partial handle (may be empty).
const MENTION_AT_CARET = /(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{0,24})$/;

type Props = {
  slug: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
} & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "className"
>;

// A textarea with @mention autocomplete: as you type "@", it suggests campaign
// personas (server-resolved) and inserts "@handle" on pick.
export function MentionTextarea({ slug, value, onChange, className, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState(0); // index of the "@" in the value
  const [items, setItems] = useState<PersonaSummary[]>([]);
  const [active, setActive] = useState(0);
  const pendingCaret = useRef<number | null>(null);
  const reqId = useRef(0);

  // restore the caret after a programmatic insert (the textarea is controlled)
  useEffect(() => {
    if (pendingCaret.current != null && ref.current) {
      const pos = pendingCaret.current;
      ref.current.selectionStart = ref.current.selectionEnd = pos;
      pendingCaret.current = null;
    }
  });

  // debounced suggestion fetch while a mention is being typed
  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    const t = setTimeout(() => {
      void searchMentionsAction(slug, query).then((res) => {
        if (id === reqId.current) {
          setItems(res);
          setActive(0);
        }
      });
    }, 120);
    return () => clearTimeout(t);
  }, [open, query, slug]);

  function detect(text: string, caret: number) {
    const m = MENTION_AT_CARET.exec(text.slice(0, caret));
    if (m) {
      const partial = m[1];
      setQuery(partial);
      setAnchor(caret - partial.length - 1);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
  }

  function pick(p: PersonaSummary) {
    const caret = ref.current?.selectionStart ?? value.length;
    const head = value.slice(0, anchor) + `@${p.handle} `;
    const next = head + value.slice(caret);
    pendingCaret.current = head.length;
    onChange(next);
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  const show = open && items.length > 0;
  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        // delay so a mousedown on a suggestion registers before close
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className={className}
        {...rest}
      />
      {show ? (
        <ul className="absolute left-0 top-full z-30 mt-1 max-h-64 w-72 max-w-full overflow-auto rounded-base border border-border bg-surface p-1 shadow-lg">
          {items.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                // onMouseDown fires before the textarea's blur, so the pick lands
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[calc(var(--app-radius)/1.5)] px-2 py-1.5 text-left",
                  i === active ? "bg-surface-hover" : "hover:bg-surface-hover",
                )}
              >
                <Avatar
                  name={p.displayName}
                  avatarUrl={p.avatarUrl}
                  size={28}
                  frame={p.avatarFrame}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-text">
                    {p.displayName}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    @{p.handle}
                    {p.isNpc ? " · NPC" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
