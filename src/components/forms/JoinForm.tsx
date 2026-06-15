"use client";

import { useActionState } from "react";
import { joinCampaignAction } from "@/app/actions/campaigns";
import { emptyFormState } from "@/lib/form";
import { Field, TextInput, ErrorText } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function JoinForm({ defaultCode }: { defaultCode?: string }) {
  const [state, action] = useActionState(joinCampaignAction, emptyFormState);
  return (
    <form action={action} className="space-y-4">
      <Field label="Invite code" hint="Ask your DM for this">
        <TextInput
          name="code"
          defaultValue={defaultCode ?? ""}
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono tracking-widest"
          required
        />
      </Field>
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
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton className="w-full" pendingLabel="Joining…">
        Join campaign
      </SubmitButton>
    </form>
  );
}
