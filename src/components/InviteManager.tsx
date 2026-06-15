"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { regenerateInviteAction } from "@/app/actions/campaigns";
import { CopyButton } from "./CopyButton";
import { Button } from "./ui";

export function InviteManager({ slug, code }: { slug: string; code: string }) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded bg-bg px-3 py-2 font-mono text-lg font-bold tracking-widest text-text">
          {code}
        </code>
        <CopyButton value={code} label="Copy code" />
        <CopyButton urlPath={`/register?code=${code}`} label="Copy invite link" />
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Rotate the invite code? The old one stops working."))
              return;
            start(async () => {
              await regenerateInviteAction(slug);
            });
          }}
        >
          <RefreshCw className="size-4" /> Rotate
        </Button>
      </div>
      <p className="text-xs text-muted">
        Share the code or link with players to let them join. Rotating it
        invalidates the old one.
      </p>
    </div>
  );
}
