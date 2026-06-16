"use client";

import { useActionState, useTransition } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  type ApiKeyFormState,
} from "@/app/actions/api-keys";
import { CopyButton } from "./CopyButton";
import { LocalTime } from "./LocalTime";
import { Button, ErrorText, Field, TextInput } from "./ui";
import { SubmitButton } from "./SubmitButton";

type ApiKeyRow = {
  id: number;
  label: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

const emptyState: ApiKeyFormState = {};

export function ApiKeysManager({
  slug,
  apiKeys,
}: {
  slug: string;
  apiKeys: ApiKeyRow[];
}) {
  const [state, action] = useActionState(createApiKeyAction, emptyState);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Let an external app post into this campaign over HTTP. Send the key as{" "}
        <code className="rounded bg-bg px-1 py-0.5 text-xs">
          Authorization: Bearer …
        </code>{" "}
        to:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-bg px-2 py-1 font-mono text-xs text-text">
          POST /api/c/{slug}/posts
        </code>
        <CopyButton urlPath={`/api/c/${slug}/posts`} label="Copy URL" />
      </div>
      <p className="text-xs text-muted">
        Body: a JSON object with <code>persona</code> (a @handle), and{" "}
        <code>content</code> and/or <code>imageUrl</code>; optional{" "}
        <code>scheduledAt</code> (ISO) to schedule it. A key can post as any NPC
        or as your own character.
      </p>

      <form
        action={action}
        className="flex flex-wrap items-end gap-3 rounded-base border border-border p-4"
      >
        <input type="hidden" name="slug" value={slug} />
        <div className="min-w-48 flex-1">
          <Field label="New key label" hint="e.g. the name of your notes app.">
            <TextInput name="label" placeholder="Session notes app" />
          </Field>
        </div>
        <SubmitButton size="sm" pendingLabel="Generating…">
          <KeyRound className="size-4" /> Generate key
        </SubmitButton>
      </form>

      <ErrorText>{state.error}</ErrorText>
      {state.ok && state.token ? (
        <div className="space-y-2 rounded-base border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-semibold text-text">
            Copy your key now — it won&apos;t be shown again.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-bg px-2 py-1 font-mono text-xs text-text">
              {state.token}
            </code>
            <CopyButton value={state.token} label="Copy key" />
          </div>
        </div>
      ) : null}

      {apiKeys.length > 0 ? (
        <ul className="divide-y divide-border rounded-base border border-border">
          {apiKeys.map((k) => (
            <ApiKeyRowItem key={k.id} slug={slug} apiKey={k} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No API keys yet.</p>
      )}
    </div>
  );
}

function ApiKeyRowItem({ slug, apiKey }: { slug: string; apiKey: ApiKeyRow }) {
  const [pending, start] = useTransition();
  const revoked = apiKey.revokedAt != null;

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <KeyRound className="size-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">
          {apiKey.label || "Untitled key"}
          {revoked ? (
            <span className="ml-2 rounded-full bg-like/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-like">
              Revoked
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted">
          <code className="font-mono">{apiKey.prefix}…</code>
          {" · "}created{" "}
          <LocalTime iso={new Date(apiKey.createdAt).toISOString()} />
          {" · "}
          {apiKey.lastUsedAt ? (
            <>
              last used{" "}
              <LocalTime iso={new Date(apiKey.lastUsedAt).toISOString()} />
            </>
          ) : (
            "never used"
          )}
        </p>
      </div>
      {!revoked ? (
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          aria-label={`Revoke ${apiKey.label || "key"}`}
          onClick={() => {
            if (!window.confirm("Revoke this key? Apps using it stop working."))
              return;
            start(async () => {
              await revokeApiKeyAction(slug, apiKey.id);
            });
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </li>
  );
}
