import { avatarColor, initials } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { PersonaAvatarFrame } from "@/lib/theme-types";

export function Avatar({
  name,
  avatarUrl,
  size = 44,
  className,
  frame,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  /** the persona's chosen avatar frame. "default" (or omitted) inherits the
   *  campaign theme's frame; any other value overrides it for this avatar. */
  frame?: PersonaAvatarFrame;
}) {
  const dim = `${size}px`;
  // A wrapper carries the .avatar-frame class so frame decorations (box-shadow
  // rings, plus any ::before/::after pieces) render on BOTH photo and initials
  // avatars — a replaced <img> can't paint pseudo-elements. A per-persona frame
  // is published as data-frame, which the CSS uses to override the campaign
  // default for that one avatar (see globals.css).
  return (
    <span
      data-frame={frame && frame !== "default" ? frame : undefined}
      className={cn(
        "avatar-frame relative inline-flex shrink-0 items-center justify-center rounded-full",
        className,
      )}
      style={{ width: dim, height: dim }}
    >
      {avatarUrl ? (
        // user-provided URLs are arbitrary, so a plain <img> (no domain allowlist)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="size-full rounded-full bg-surface object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-full items-center justify-center rounded-full font-semibold text-white"
          style={{ background: avatarColor(name), fontSize: size * 0.4 }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
