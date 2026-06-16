"use client";

import { useActionState, useState } from "react";
import { completeOnboardingAction } from "@/app/actions/onboarding";
import { emptyFormState } from "@/lib/form";
import { ErrorText, Field, TextInput, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { AvatarField } from "@/components/forms/AvatarField";

export function OnboardingForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(completeOnboardingAction, emptyFormState);
  // preview-only: drives the avatar initials without making the input controlled
  const [previewName, setPreviewName] = useState("");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Character name" hint="How you appear in the feed">
        <TextInput
          name="displayName"
          placeholder="Tasha Brightwater"
          required
          autoFocus
          onChange={(e) => setPreviewName(e.target.value)}
        />
      </Field>
      <AvatarField name={previewName} hint="Optional. You can change it later." />
      <Field label="Handle" hint="Your @ in this campaign">
        <TextInput
          name="handle"
          placeholder="tasha"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>
      <Field label="Bio" hint="Optional. You can change all of this later.">
        <Textarea name="bio" rows={3} placeholder="Who are they?" />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton className="w-full" pendingLabel="Creating…">
        Enter the campaign
      </SubmitButton>
    </form>
  );
}
