"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { addMemberAction } from "@/app/actions/campaigns";
import { emptyFormState } from "@/lib/form";
import { ErrorText, Field, TextInput } from "./ui";
import { SubmitButton } from "./SubmitButton";

// DM-only: provision a human player directly (login + starting character),
// instead of (or alongside) sharing the invite code.
export function AddMemberForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(addMemberAction, emptyFormState);

  return (
    <form
      action={action}
      className="mb-5 space-y-3 rounded-base border border-border p-4"
    >
      <h3 className="flex items-center gap-2 font-semibold text-text">
        <UserPlus className="size-4" /> Add a member
      </h3>
      <p className="text-xs text-muted">
        Creates a login and a starting character for a player. Share the username
        and password with them so they can sign in; they can edit their character
        later, and you can change their role below.
      </p>
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Username (their login)">
          <TextInput
            name="username"
            placeholder="alex"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </Field>
        <Field label="Temporary password" hint="At least 8 characters.">
          <TextInput
            name="password"
            type="text"
            placeholder="share this with the player"
            autoComplete="off"
            required
          />
        </Field>
        <Field label="Character name">
          <TextInput name="displayName" placeholder="Maro Coppersmart" required />
        </Field>
        <Field label="Character handle">
          <TextInput
            name="handle"
            placeholder="maro"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </Field>
      </div>
      <ErrorText>{state.error}</ErrorText>
      {state.ok ? (
        <p className="text-sm text-repost">
          Member added. Share their username and password so they can sign in.
        </p>
      ) : null}
      <SubmitButton size="sm" pendingLabel="Adding…">
        Add member
      </SubmitButton>
    </form>
  );
}
