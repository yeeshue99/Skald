"use client";

import { useEffect, useState } from "react";

// Renders an instant in the viewer's own timezone. Computed on mount so server
// and client never disagree (the server has no idea what zone the viewer is in).
export function LocalTime({
  iso,
  mode = "datetime",
  className,
}: {
  iso: string;
  mode?: "datetime" | "date" | "time";
  className?: string;
}) {
  const [text, setText] = useState<string>(() =>
    iso.slice(0, 16).replace("T", " "),
  );

  useEffect(() => {
    const opts: Intl.DateTimeFormatOptions =
      mode === "date"
        ? { year: "numeric", month: "short", day: "numeric" }
        : mode === "time"
          ? { hour: "numeric", minute: "2-digit" }
          : {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            };
    setText(new Intl.DateTimeFormat(undefined, opts).format(new Date(iso)));
  }, [iso, mode]);

  return (
    <time dateTime={iso} suppressHydrationWarning className={className}>
      {text}
    </time>
  );
}
