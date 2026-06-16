"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Repeat2 } from "lucide-react";
import type { PostView } from "@/lib/queries";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "./Avatar";
import { PostActions } from "./PostActions";
import { PostMenu } from "./PostMenu";
import { PollDisplay } from "./PollDisplay";
import { FollowButton } from "./FollowButton";

function renderRichText(text: string, slug: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // @mention -> profile, #hashtag -> search, bare URL -> external link
  const re = /(@[a-zA-Z0-9_]{2,24})|(#[a-zA-Z0-9_]+)|(https?:\/\/[^\s]+)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) {
      const handle = m[1].slice(1);
      nodes.push(
        <Link
          key={key++}
          href={`/c/${slug}/u/${handle.toLowerCase()}`}
          className="text-link hover:underline"
        >
          {m[1]}
        </Link>,
      );
    } else if (m[2]) {
      nodes.push(
        <Link
          key={key++}
          href={`/c/${slug}/search?q=${encodeURIComponent(m[2])}`}
          className="text-link hover:underline"
        >
          {m[2]}
        </Link>,
      );
    } else if (m[3]) {
      nodes.push(
        <a
          key={key++}
          href={m[3]}
          target="_blank"
          rel="noreferrer"
          className="text-link hover:underline"
        >
          {m[3]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function PostCard({
  post,
  slug,
  myPersonaIds,
  isDm,
  highlight = false,
  showFollow = false,
  pinned = false,
}: {
  post: PostView;
  slug: string;
  myPersonaIds: number[];
  isDm: boolean;
  highlight?: boolean;
  /** show an inline Follow button for authors you don't already follow */
  showFollow?: boolean;
  /** this post is the author's pinned post (flips the menu to "Unpin") */
  pinned?: boolean;
}) {
  const isBoost = post.isBoost && post.repostOf != null;
  const data = isBoost ? post.repostOf! : post;
  const boostedBy = isBoost ? post.author : null;
  const author = data.author;
  const canManage = isDm || myPersonaIds.includes(author.id);
  // inline follow: only for other people's authors you don't already follow
  const canFollow =
    showFollow && !myPersonaIds.includes(author.id) && !data.authorFollowedByMe;
  // dates may arrive as strings when revived from a server action; normalize
  const when = new Date(data.publishedAt ?? data.createdAt);
  const profileHref = `/c/${slug}/u/${author.handle.toLowerCase()}`;
  const postHref = `/c/${slug}/post/${data.id}`;
  const router = useRouter();

  // Make the whole card open the post, but let the inner links/buttons/menu/
  // image and text selection behave normally.
  function onCardClick(e: React.MouseEvent) {
    if (
      e.defaultPrevented ||
      (e.target as HTMLElement).closest("a, button, img, [role='menu'], [role='dialog']")
    )
      return;
    if (window.getSelection()?.toString()) return; // don't hijack text selection
    router.push(postHref);
  }

  return (
    <article
      onClick={onCardClick}
      className={cn(
        "post-card cursor-pointer border-b border-border px-4 py-3 transition-colors",
        highlight ? "bg-surface" : "hover:bg-surface/50",
      )}
    >
      {boostedBy ? (
        <Link
          href={`/c/${slug}/u/${boostedBy.handle.toLowerCase()}`}
          className="mb-1 ml-8 flex items-center gap-2 text-xs font-semibold text-muted hover:underline"
        >
          <Repeat2 className="size-4" />
          {boostedBy.displayName} boosted
        </Link>
      ) : null}

      <div className="flex gap-3">
        <Link href={profileHref} className="pt-0.5">
          <Avatar
            name={author.displayName}
            avatarUrl={author.avatarUrl}
            size={44}
            frame={author.avatarFrame}
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm">
            <Link
              href={profileHref}
              className="truncate font-semibold text-text hover:underline"
            >
              {author.displayName}
            </Link>
            {isDm && author.isNpc ? (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                NPC
              </span>
            ) : null}
            <Link href={profileHref} className="truncate text-muted">
              @{author.handle}
            </Link>
            <span className="text-muted">·</span>
            <Link
              href={postHref}
              className="shrink-0 text-muted hover:underline"
              title={when.toISOString()}
            >
              {relativeTime(new Date(when))}
            </Link>
            {data.editedAt ? (
              <span
                className="shrink-0 text-muted"
                title={`Edited ${new Date(data.editedAt).toISOString()}`}
              >
                · edited
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              {canFollow ? (
                <FollowButton
                  slug={slug}
                  targetPersonaId={author.id}
                  initialFollowing={false}
                  compact
                />
              ) : null}
              {canManage ? (
                <PostMenu slug={slug} postId={data.id} pinned={pinned} />
              ) : null}
            </div>
          </div>

          {data.content ? (
            <p className="mt-0.5 whitespace-pre-wrap wrap-break-word text-[15px] leading-relaxed text-text">
              {renderRichText(data.content, slug)}
            </p>
          ) : null}

          {data.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.imageUrl}
              alt=""
              className="mt-2 max-h-112 w-full rounded-base border border-border object-cover"
            />
          ) : null}

          {data.poll ? <PollDisplay slug={slug} poll={data.poll} /> : null}

          {/* quote-repost embed */}
          {!isBoost && data.repostOf ? (
            <Link
              href={`/c/${slug}/post/${data.repostOf.id}`}
              className="quote-card mt-2 block rounded-base border border-border p-3 transition-colors hover:bg-surface-hover"
            >
              <div className="flex items-center gap-1.5 text-sm">
                <Avatar
                  name={data.repostOf.author.displayName}
                  avatarUrl={data.repostOf.author.avatarUrl}
                  size={20}
                  frame={data.repostOf.author.avatarFrame}
                />
                <span className="font-semibold text-text">
                  {data.repostOf.author.displayName}
                </span>
                <span className="text-muted">@{data.repostOf.author.handle}</span>
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-text">
                {data.repostOf.content}
              </p>
            </Link>
          ) : null}

          <PostActions
            slug={slug}
            postId={data.id}
            likeCount={data.likeCount}
            liked={data.likedByMe}
            repostCount={data.repostCount}
            reposted={data.repostedByMe}
            replyCount={data.replyCount}
            bookmarked={data.bookmarkedByMe}
            canInteract
          />
        </div>
      </div>
    </article>
  );
}
