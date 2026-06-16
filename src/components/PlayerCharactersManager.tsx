"use client";

import { useActionState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import {
  createPlayerPersonaAction,
  reassignPersonaAction,
} from "@/app/actions/personas";
import { emptyFormState } from "@/lib/form";
import type { MemberRow } from "@/lib/queries";
import { Avatar } from "./Avatar";
import { ErrorText, Field, TextInput } from "./ui";
import { SubmitButton } from "./SubmitButton";

// DM-only: create extra characters for a player and reassign any persona's owner.
// A persona owned by a player is their character (full control); owned by the DM
// it's an NPC. The acting-as machinery already lets a player switch between them.
export function PlayerCharactersManager({
  slug,
  members,
}: {
  slug: string;
  members: MemberRow[];
}) {
  const [state, action] = useActionState(
    createPlayerPersonaAction,
    emptyFormState,
  );
  const [pending, start] = useTransition();

  const players = members.filter((m) => m.role !== "dm");

  function reassign(personaId: number, newOwnerUserId: number) {
    start(async () => {
      try {
        await reassignPersonaAction(slug, personaId, newOwnerUserId);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Couldn't reassign.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <form
        action={action}
        className="space-y-3 rounded-base border border-border p-4"
      >
        <h3 className="flex items-center gap-2 font-semibold text-text">
          <UserPlus className="size-4" /> Create a character for a player
        </h3>
        <input type="hidden" name="slug" value={slug} />
        {players.length === 0 ? (
          <p className="text-sm text-muted">
            No players yet. Add a member first.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Player">
                <select
                  name="memberUserId"
                  required
                  defaultValue=""
                  className="w-full rounded-base border border-border bg-bg/60 px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="" disabled>
                    Pick a player…
                  </option>
                  {players.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      @{p.username}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Character name">
                <TextInput
                  name="displayName"
                  placeholder="Sir Reginald"
                  required
                />
              </Field>
              <Field label="Handle">
                <TextInput
                  name="handle"
                  placeholder="reginald"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </Field>
            </div>
            <ErrorText>{state.error}</ErrorText>
            {state.ok ? (
              <p className="text-sm text-repost">
                Character created and assigned.
              </p>
            ) : null}
            <SubmitButton size="sm" pendingLabel="Creating…">
              Create character
            </SubmitButton>
          </>
        )}
      </form>

      <div className="space-y-4">
        {members.map((m) => (
          <div key={m.userId}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              @{m.username} · {m.role === "dm" ? "DM" : "Player"} ·{" "}
              {m.personas.length} character{m.personas.length === 1 ? "" : "s"}
            </p>
            {m.personas.length === 0 ? (
              <p className="text-sm text-muted">No characters.</p>
            ) : (
              <ul className="divide-y divide-border rounded-base border border-border">
                {m.personas.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <Avatar
                      name={p.displayName}
                      avatarUrl={p.avatarUrl}
                      size={32}
                      frame={p.avatarFrame}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-text">
                        {p.displayName}
                        {p.isNpc ? (
                          <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                            NPC
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted">@{p.handle}</p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                      Owner
                      <select
                        value={m.userId}
                        disabled={pending}
                        onChange={(e) => reassign(p.id, Number(e.target.value))}
                        className="rounded border border-border bg-bg px-2 py-1 text-text disabled:opacity-50"
                      >
                        {members.map((o) => (
                          <option key={o.userId} value={o.userId}>
                            @{o.username}
                            {o.role === "dm" ? " (DM)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
