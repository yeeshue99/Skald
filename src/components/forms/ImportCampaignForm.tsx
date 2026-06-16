"use client";

import { useActionState, useState } from "react";
import { FileUp } from "lucide-react";
import { importCampaignAction } from "@/app/actions/import-campaign";
import { emptyFormState } from "@/lib/form";
import { ErrorText } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function ImportCampaignForm() {
  const [state, action] = useActionState(importCampaignAction, emptyFormState);
  const [fileName, setFileName] = useState("");

  return (
    <form action={action} className="space-y-3">
      <label className="flex cursor-pointer items-center gap-2 rounded-base border border-dashed border-border bg-bg/40 px-3 py-2.5 text-sm text-muted transition-colors hover:border-primary/60 hover:text-text">
        <input
          type="file"
          name="file"
          accept="application/json,.json"
          required
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
        <FileUp className="size-4 shrink-0 text-primary" />
        <span className="truncate">
          {fileName || "Choose a campaign export (.json)"}
        </span>
      </label>

      <ErrorText>{state.error}</ErrorText>

      <SubmitButton
        variant="secondary"
        className="w-full"
        pendingLabel="Importing…"
      >
        Import a campaign
      </SubmitButton>
    </form>
  );
}
