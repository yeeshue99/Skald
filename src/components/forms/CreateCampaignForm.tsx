"use client";

import { useActionState, useState } from "react";
import { createCampaignAction } from "@/app/actions/campaigns";
import { PRESETS } from "@/lib/themes";
import { emptyFormState } from "@/lib/form";
import { Field, TextInput, ErrorText } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { cn } from "@/lib/cn";

export function CreateCampaignForm() {
  const [state, action] = useActionState(createCampaignAction, emptyFormState);
  const [presetId, setPresetId] = useState(PRESETS[1]?.id ?? "default");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="presetId" value={presetId} />

      <Field
        label="Campaign name"
        hint="This is the app's wordmark. You can restyle everything later."
      >
        <TextInput name="name" placeholder="STR/X, Scrollr, The Sunken Crown…" required />
      </Field>

      <div>
        <span className="mb-2 block text-sm font-medium text-text">Theme</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((p) => {
            const active = p.id === presetId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
                className={cn(
                  "overflow-hidden rounded-base border text-left transition",
                  active
                    ? "border-primary ring-2 ring-primary/50"
                    : "border-border hover:border-primary/50",
                )}
                style={{ background: p.colors.background }}
              >
                <div className="p-3" style={{ color: p.colors.text }}>
                  <div
                    className="truncate text-lg font-bold"
                    style={{
                      fontFamily: `"${p.fonts.display}", serif`,
                      color: p.colors.primary,
                    }}
                  >
                    {p.appName}
                  </div>
                  <div className="mt-2 flex gap-1">
                    {[p.colors.primary, p.colors.accent, p.colors.like].map(
                      (c, i) => (
                        <span
                          key={i}
                          className="size-4 rounded-full"
                          style={{ background: c }}
                        />
                      ),
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your DM character" hint="e.g. The Narrator">
          <TextInput name="dmDisplayName" placeholder="The Narrator" required />
        </Field>
        <Field label="Your handle">
          <TextInput
            name="dmHandle"
            placeholder="dm"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>
      </div>

      <ErrorText>{state.error}</ErrorText>
      <SubmitButton className="w-full" pendingLabel="Creating campaign…">
        Create campaign
      </SubmitButton>
    </form>
  );
}
