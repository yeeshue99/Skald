"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { changePasswordAction } from "@/app/actions/auth";
import { emptyFormState } from "@/lib/form";
import { Button, ErrorText, Field, TextInput } from "./ui";
import { SubmitButton } from "./SubmitButton";

// Account-level: lets the signed-in user change their own login password.
export function ChangePasswordButton({
  variant = "ghost",
  size = "sm",
}: {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(changePasswordAction, emptyFormState);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        Change password
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-md rounded-base border border-border bg-surface p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-text">
                Change password
              </h2>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-1 text-muted hover:bg-surface-hover hover:text-text"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            {state.ok ? (
              <div className="space-y-4">
                <p className="text-sm text-repost">
                  Password updated. Use it next time you sign in.
                </p>
                <div className="flex justify-end">
                  <Button size="sm" onClick={close}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form action={action} className="space-y-3">
                <Field label="Current password">
                  <TextInput
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </Field>
                <Field label="New password" hint="At least 8 characters.">
                  <TextInput
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <Field label="Confirm new password">
                  <TextInput
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <ErrorText>{state.error}</ErrorText>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={close}
                  >
                    Cancel
                  </Button>
                  <SubmitButton size="sm" pendingLabel="Updating…">
                    Update password
                  </SubmitButton>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
