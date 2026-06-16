"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { editPostAction } from "@/app/actions/posts";
import { emptyFormState } from "@/lib/form";
import { MAX_POST_LENGTH } from "@/lib/validation";
import { ErrorText, TextInput } from "./ui";
import { SubmitButton } from "./SubmitButton";
import { cn } from "@/lib/cn";

export function EditPostForm({
  slug,
  postId,
  initialContent,
  initialImageUrl,
}: {
  slug: string;
  postId: number;
  initialContent: string;
  initialImageUrl: string | null;
}) {
  const [state, action] = useActionState(editPostAction, emptyFormState);
  const [content, setContent] = useState(initialContent);
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const remaining = MAX_POST_LENGTH - content.length;

  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className="space-y-3 p-4"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="postId" value={postId} />

      <textarea
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        autoFocus
        placeholder="Edit your post"
        className="w-full resize-none rounded-base border border-border bg-bg/60 px-3 py-2 text-[15px] leading-relaxed text-text placeholder:text-muted/70 focus:border-primary focus:outline-none"
      />
      <div className="text-right text-xs">
        <span className={cn("text-muted", remaining < 0 && "font-semibold text-like")}>
          {remaining}
        </span>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Image URL (optional)</span>
        <TextInput
          name="imageUrl"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </label>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="max-h-64 w-full rounded-base border border-border object-cover"
        />
      ) : null}

      <ErrorText>{state.error}</ErrorText>

      <div className="flex items-center justify-end gap-2">
        <Link
          href={`/c/${slug}/post/${postId}`}
          className="rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-hover"
        >
          Cancel
        </Link>
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}
