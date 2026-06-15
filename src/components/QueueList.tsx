"use client";

import { useState, useTransition } from "react";
import { CalendarClock, FileText, Send, Trash2 } from "lucide-react";
import type { PostView } from "@/lib/queries";
import {
  deletePostAction,
  publishNowAction,
  rescheduleAction,
} from "@/app/actions/posts";
import { Avatar } from "./Avatar";
import { LocalTime } from "./LocalTime";
import { Button } from "./ui";

function minLocal(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function QueueItem({ slug, post }: { slug: string; post: PostView }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    start(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Avatar
          name={post.author.displayName}
          avatarUrl={post.author.avatarUrl}
          size={28}
        />
        <span className="font-semibold text-text">
          {post.author.displayName}
        </span>
        <span className="text-muted">@{post.author.handle}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted">
          {post.status === "scheduled" && post.publishedAt ? (
            <>
              <CalendarClock className="size-3.5 text-accent" />
              <LocalTime iso={new Date(post.publishedAt).toISOString()} />
            </>
          ) : (
            <>
              <FileText className="size-3.5" /> Draft
            </>
          )}
        </span>
      </div>

      {post.content ? (
        <p className="mt-1 whitespace-pre-wrap text-[15px] text-text">
          {post.content}
        </p>
      ) : null}
      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt=""
          className="mt-2 max-h-48 rounded-base border border-border object-cover"
        />
      ) : null}

      {editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            min={minLocal()}
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded border border-border bg-bg px-2 py-1 text-sm text-text"
          />
          <Button
            size="sm"
            disabled={pending || !when}
            onClick={() =>
              run(async () => {
                await rescheduleAction(
                  slug,
                  post.id,
                  new Date(when).toISOString(),
                );
                setEditing(false);
              })
            }
          >
            Save time
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => publishNowAction(slug, post.id))}
          >
            <Send className="size-4" /> Post now
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setWhen("");
              setEditing(true);
            }}
          >
            <CalendarClock className="size-4" />
            {post.status === "scheduled" ? "Reschedule" : "Schedule"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Delete this post?"))
                run(() => deletePostAction(slug, post.id));
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-like">{error}</p> : null}
    </div>
  );
}

export function QueueList({
  slug,
  scheduled,
  drafts,
}: {
  slug: string;
  scheduled: PostView[];
  drafts: PostView[];
}) {
  if (scheduled.length === 0 && drafts.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-muted">
        Nothing queued. Use the clock icon in the composer to schedule a post or
        save a draft.
      </div>
    );
  }

  return (
    <div>
      <Section
        title="Scheduled"
        icon={<CalendarClock className="size-4 text-accent" />}
        count={scheduled.length}
      />
      {scheduled.map((p) => (
        <QueueItem key={p.id} slug={slug} post={p} />
      ))}

      <Section
        title="Drafts"
        icon={<FileText className="size-4 text-muted" />}
        count={drafts.length}
      />
      {drafts.length > 0 ? (
        drafts.map((p) => <QueueItem key={p.id} slug={slug} post={p} />)
      ) : (
        <p className="px-4 py-6 text-sm text-muted">No drafts.</p>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  count,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface/40 px-4 py-2 text-sm font-semibold text-text">
      {icon}
      {title}
      <span className="text-muted">{count}</span>
    </div>
  );
}
