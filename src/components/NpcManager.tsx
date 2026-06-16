"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Trash2, UserPlus } from "lucide-react";
import {
  createPersonaAction,
  deletePersonaAction,
} from "@/app/actions/personas";
import { emptyFormState } from "@/lib/form";
import { Avatar } from "./Avatar";
import { EditPersonaButton } from "./EditPersonaButton";
import { Button, ErrorText, Field, TextInput, Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";
import type { PersonaAvatarFrame } from "@/lib/theme-types";

type Npc = {
  id: number;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  avatarFrame: PersonaAvatarFrame;
};

export function NpcManager({ slug, npcs }: { slug: string; npcs: Npc[] }) {
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-5">
      <CreateNpc
        key={formKey}
        slug={slug}
        onCreated={() => setFormKey((k) => k + 1)}
      />
      {npcs.length > 0 ? (
        <ul className="divide-y divide-border">
          {npcs.map((n) => (
            <NpcRow key={n.id} slug={slug} npc={n} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          No NPCs yet. Create one above to start posting as them.
        </p>
      )}
    </div>
  );
}

function CreateNpc({
  slug,
  onCreated,
}: {
  slug: string;
  onCreated: () => void;
}) {
  const [state, action] = useActionState(createPersonaAction, emptyFormState);

  useEffect(() => {
    if (state.ok) onCreated();
  }, [state, onCreated]);

  return (
    <form action={action} className="space-y-3 rounded-base border border-border p-4">
      <h3 className="flex items-center gap-2 font-semibold text-text">
        <UserPlus className="size-4" /> New NPC
      </h3>
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Display name">
          <TextInput name="displayName" placeholder="The Innkeeper" required />
        </Field>
        <Field label="Handle">
          <TextInput
            name="handle"
            placeholder="innkeeper"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>
      </div>
      <Field label="Bio">
        <Textarea name="bio" rows={2} placeholder="Keeper of the Prancing Pony." />
      </Field>
      <Field label="Avatar URL" hint="Optional. Leave blank for initials.">
        <TextInput name="avatarUrl" placeholder="https://…" />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton size="sm" pendingLabel="Creating…">
        Create NPC
      </SubmitButton>
    </form>
  );
}

function NpcRow({ slug, npc }: { slug: string; npc: Npc }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar
        name={npc.displayName}
        avatarUrl={npc.avatarUrl}
        size={36}
        frame={npc.avatarFrame}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">
          {npc.displayName} <span className="text-muted">@{npc.handle}</span>
        </p>
        {npc.bio ? (
          <p className="truncate text-xs text-muted">{npc.bio}</p>
        ) : null}
      </div>
      <EditPersonaButton slug={slug} persona={npc} label="Edit" />
      <Button
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Delete ${npc.displayName} and all their posts?`))
            start(async () => {
              await deletePersonaAction(slug, npc.id);
            });
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
