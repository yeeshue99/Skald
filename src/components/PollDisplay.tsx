"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { votePollAction } from "@/app/actions/posts";
import type { PollView } from "@/lib/queries";
import { compactNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

// "2d", "5h", "12m" of voting time remaining (kept out of the render body so the
// current-time read stays behind a function call, like relativeTime).
function timeLeftLabel(closesAt: Date, now: Date = new Date()): string {
  const ms = closesAt.getTime() - now.getTime();
  if (ms <= 0) return "0m";
  const mins = Math.floor(ms / 60000);
  if (mins >= 1440) return `${Math.floor(mins / 1440)}d`;
  if (mins >= 60) return `${Math.floor(mins / 60)}h`;
  return `${Math.max(1, mins)}m`;
}

export function PollDisplay({
  slug,
  poll: initial,
}: {
  slug: string;
  poll: PollView;
}) {
  const [poll, setPoll] = useState<PollView>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // closesAt may arrive as a string when revived from a server-action result
  const closesAt = new Date(poll.closesAt);
  const voted = poll.myVoteIdx != null;
  const showResults = voted || poll.closed;

  function vote(idx: number) {
    if (voted || poll.closed || pending) return;
    setError(null);
    start(async () => {
      const res = await votePollAction(slug, poll.id, idx);
      if ("error" in res) setError(res.error);
      else setPoll(res);
    });
  }

  return (
    <div className="mt-2 space-y-1.5">
      {poll.options.map((opt, i) => {
        if (showResults) {
          const pct =
            poll.totalVotes > 0
              ? Math.round((opt.votes / poll.totalVotes) * 100)
              : 0;
          const mine = poll.myVoteIdx === i;
          return (
            <div
              key={i}
              className="relative overflow-hidden rounded-base border border-border"
            >
              <div
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0",
                  mine ? "bg-primary/25" : "bg-surface-hover",
                )}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  {mine ? (
                    <Check className="size-3.5 shrink-0 text-primary" />
                  ) : null}
                  <span
                    className={cn(
                      "truncate text-text",
                      mine && "font-semibold",
                    )}
                  >
                    {opt.text}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{pct}%</span>
              </div>
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => vote(i)}
            disabled={pending}
            className="fx-btn block w-full rounded-base border border-primary/50 px-3 py-1.5 text-left text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {opt.text}
          </button>
        );
      })}

      <p className="text-xs text-muted">
        {compactNumber(poll.totalVotes)} vote{poll.totalVotes === 1 ? "" : "s"}
        {" · "}
        {poll.closed ? "final results" : `${timeLeftLabel(closesAt)} left`}
      </p>
      {error ? <p className="text-xs text-like">{error}</p> : null}
    </div>
  );
}
