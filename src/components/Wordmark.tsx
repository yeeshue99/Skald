import { cn } from "@/lib/cn";

export function Wordmark({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span className={cn("font-display font-bold tracking-tight", className)}>
      {name}
    </span>
  );
}
