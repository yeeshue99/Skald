"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "lucide-react";
import { updatePersonaAction } from "@/app/actions/personas";
import { emptyFormState } from "@/lib/form";
import { Button, ErrorText, Field, TextInput, Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";
import { AvatarField } from "./forms/AvatarField";

type EditablePersona = {
  id: number;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
};

export function EditPersonaButton({
  slug,
  persona,
  label = "Edit profile",
  variant = "secondary",
  size = "sm",
}: {
  slug: string;
  persona: EditablePersona;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(updatePersonaAction, emptyFormState);

  useEffect(() => {
    // close the dialog once the server action reports success
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-base border border-border bg-surface p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-text">
                Edit {persona.displayName}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-muted hover:bg-surface-hover hover:text-text"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <form action={action} className="space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="personaId" value={persona.id} />
              <Field label="Display name">
                <TextInput
                  name="displayName"
                  defaultValue={persona.displayName}
                  required
                />
              </Field>
              <Field label="Handle">
                <TextInput
                  name="handle"
                  defaultValue={persona.handle}
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </Field>
              <Field label="Bio">
                <Textarea name="bio" rows={3} defaultValue={persona.bio ?? ""} />
              </Field>
              <AvatarField
                name={persona.displayName}
                defaultUrl={persona.avatarUrl}
              />
              <ErrorText>{state.error}</ErrorText>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <SubmitButton size="sm" pendingLabel="Saving…">
                  Save
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
