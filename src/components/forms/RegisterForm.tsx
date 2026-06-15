"use client";

import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";
import { emptyFormState } from "@/lib/form";
import { Field, TextInput, ErrorText } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function RegisterForm({
  code,
  campaignName,
}: {
  code?: string;
  campaignName?: string;
}) {
  const [state, action] = useActionState(registerAction, emptyFormState);
  const joining = Boolean(code);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="code" value={code ?? ""} />

      {joining ? (
        <p className="rounded-base border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-text">
          You&apos;re joining{" "}
          <strong>{campaignName ?? "a campaign"}</strong>. Pick a login, then your
          character.
        </p>
      ) : null}

      <Field label="Username" hint="Your private login. 3-20 letters, numbers, or _">
        <TextInput
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <TextInput
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      {joining ? (
        <>
          <Field label="Character name" hint="How you appear in the feed">
            <TextInput name="displayName" placeholder="Tasha Brightwater" required />
          </Field>
          <Field label="Handle" hint="Your @ in this campaign">
            <TextInput
              name="handle"
              placeholder="tasha"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </Field>
        </>
      ) : null}

      <ErrorText>{state.error}</ErrorText>
      <SubmitButton className="w-full" pendingLabel="Creating…">
        {joining ? "Create account & join" : "Create account"}
      </SubmitButton>
    </form>
  );
}
