import { avatarColor, initials } from "@/lib/format";
import { cn } from "@/lib/cn";

export function Avatar({
  name,
  avatarUrl,
  size = 44,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const dim = `${size}px`;
  if (avatarUrl) {
    // user-provided URLs are arbitrary, so a plain <img> (no domain allowlist)
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn("shrink-0 rounded-full bg-surface object-cover", className)}
        style={{ width: dim, height: dim }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className,
      )}
      style={{
        width: dim,
        height: dim,
        background: avatarColor(name),
        fontSize: size * 0.4,
      }}
    >
      {initials(name)}
    </span>
  );
}
