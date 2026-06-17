"use client";

import { useActionState, useState } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { emptyFormState } from "@/lib/form";
import { Button, ErrorText, Field, TextInput } from "./ui";
import { SubmitButton } from "./SubmitButton";
import { Modal } from "./Modal";

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

      <Modal open={open} onClose={close} title="Change password">
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
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <SubmitButton size="sm" pendingLabel="Updating…">
                Update password
              </SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
