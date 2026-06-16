"use client";

import { useState, useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { setActingPersonaAction } from "@/app/actions/personas";
import type { PersonaSummary } from "@/lib/queries";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/cn";

export function PersonaSwitcher({
  slug,
  personas,
  actingPersonaId,
}: {
  slug: string;
  personas: PersonaSummary[];
  actingPersonaId: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const current =
    personas.find((p) => p.id === actingPersonaId) ?? personas[0];

  function choose(id: number) {
    if (id === actingPersonaId) {
      setOpen(false);
      return;
    }
    start(async () => {
      await setActingPersonaAction(slug, id);
      setOpen(false);
    });
  }

  const single = personas.length <= 1;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !single && setOpen((v) => !v)}
        disabled={single || pending}
        className={cn(
          "flex w-full items-center gap-2 rounded-base border border-border p-2 text-left transition-colors",
          !single && "hover:bg-surface-hover",
        )}
      >
        <Avatar
          name={current.displayName}
          avatarUrl={current.avatarUrl}
          size={36}
          frame={current.avatarFrame}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text">
            {current.displayName}
          </span>
          <span className="block truncate text-xs text-muted">
            @{current.handle}
          </span>
        </span>
        {!single ? (
          <ChevronsUpDown className="size-4 shrink-0 text-muted" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute bottom-full z-30 mb-1 max-h-72 w-full overflow-auto rounded-base border border-border bg-surface p-1 shadow-xl">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Act as
          </p>
          {personas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p.id)}
              className="flex w-full items-center gap-2 rounded-[calc(var(--app-radius)/1.5)] px-2 py-1.5 text-left hover:bg-surface-hover"
            >
              <Avatar
                name={p.displayName}
                avatarUrl={p.avatarUrl}
                size={28}
                frame={p.avatarFrame}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text">
                  {p.displayName}
                  {p.isNpc ? (
                    <span className="ml-1 text-[10px] font-bold uppercase text-accent">
                      NPC
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-muted">
                  @{p.handle}
                </span>
              </span>
              {p.id === actingPersonaId ? (
                <Check className="size-4 text-primary" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
