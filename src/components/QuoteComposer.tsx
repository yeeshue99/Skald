"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { createPostAction } from "@/app/actions/posts";
import { emptyFormState } from "@/lib/form";
import { MAX_POST_LENGTH } from "@/lib/validation";
import type { PersonaSummary, PostView } from "@/lib/queries";
import { Avatar } from "./Avatar";
import { Button } from "./ui";
import { cn } from "@/lib/cn";

// A single-post composer that quotes another post (embeds it via repostOfPostId).
// Deliberately simpler than the main Composer: no threads, polls, scheduling, or
// images — a quote is one immediate post of commentary around the quoted one.
export function QuoteComposer({
  slug,
  personas,
  actingPersonaId,
  quoted,
}: {
  slug: string;
  personas: PersonaSummary[];
  actingPersonaId: number;
  quoted: PostView;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createPostAction,
    emptyFormState,
  );
  const [content, setContent] = useState("");
  const [authorId, setAuthorId] = useState(actingPersonaId);
  const [personaOpen, setPersonaOpen] = useState(false);

  const author = personas.find((p) => p.id === authorId) ?? personas[0];
  const remaining = MAX_POST_LENGTH - content.length;
  const over = remaining < 0;
  const empty = content.trim().length === 0;

  useEffect(() => {
    // the quote is a new root post; send the author to the feed to see it
    if (state.ok) router.push(`/c/${slug}`);
  }, [state, router, slug]);

  return (
    <form action={formAction} className="px-4 py-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="authorPersonaId" value={authorId} />
      <input
        type="hidden"
        name="segments"
        value={JSON.stringify([{ content, imageUrl: "" }])}
      />
      <input type="hidden" name="repostOfPostId" value={quoted.id} />
      {/* createPostAction reads these; empty = publish now, not a draft */}
      <input type="hidden" name="scheduledAt" value="" />
      <input type="hidden" name="asDraft" value="" />

      <div className="flex gap-3">
        <Avatar
          name={author.displayName}
          avatarUrl={author.avatarUrl}
          size={44}
          frame={author.avatarFrame}
        />

        <div className="min-w-0 flex-1">
          {personas.length > 1 ? (
            <div className="relative mb-1 inline-block">
              <button
                type="button"
                onClick={() => setPersonaOpen((v) => !v)}
                className="fx-btn inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-primary hover:bg-surface-hover"
              >
                posting as {author.displayName}
                <ChevronDown className="size-3" />
              </button>
              {personaOpen ? (
                <div className="absolute z-20 mt-1 max-h-64 w-60 overflow-auto rounded-base border border-border bg-surface p-1 shadow-lg">
                  {personas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setAuthorId(p.id);
                        setPersonaOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-[calc(var(--app-radius)/1.5)] px-2 py-1.5 text-left text-sm hover:bg-surface-hover",
                        p.id === authorId && "bg-surface-hover",
                      )}
                    >
                      <Avatar
                        name={p.displayName}
                        avatarUrl={p.avatarUrl}
                        size={28}
                        frame={p.avatarFrame}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-text">
                          {p.displayName}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          @{p.handle}
                          {p.isNpc ? " · NPC" : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment"
            autoFocus
            rows={3}
            className="w-full resize-none bg-transparent text-[17px] leading-relaxed text-text placeholder:text-muted/70 focus:outline-none"
          />

          {/* the quoted post, embedded read-only */}
          <div className="quote-card mt-1 rounded-base border border-border p-3">
            <div className="flex items-center gap-1.5 text-sm">
              <Avatar
                name={quoted.author.displayName}
                avatarUrl={quoted.author.avatarUrl}
                size={20}
                frame={quoted.author.avatarFrame}
              />
              <span className="font-semibold text-text">
                {quoted.author.displayName}
              </span>
              <span className="text-muted">@{quoted.author.handle}</span>
            </div>
            {quoted.content ? (
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-text">
                {quoted.content}
              </p>
            ) : null}
            {quoted.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={quoted.imageUrl}
                alt=""
                className="mt-2 max-h-60 w-full rounded-base border border-border object-cover"
              />
            ) : null}
          </div>

          {state.error ? (
            <p className="mt-2 text-sm text-like">{state.error}</p>
          ) : null}

          <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
            <span
              className={cn(
                "ml-auto text-xs tabular-nums",
                over ? "text-like" : "text-muted",
              )}
            >
              {remaining}
            </span>
            <Button type="submit" size="sm" disabled={pending || empty || over}>
              {pending ? "…" : "Quote"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
