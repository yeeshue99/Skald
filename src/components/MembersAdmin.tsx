"use client";

import { useTransition } from "react";
import {
  removeMemberAction,
  setMemberRoleAction,
} from "@/app/actions/campaigns";
import type { MemberRow } from "@/lib/queries";
import { Avatar } from "./Avatar";
import { Button } from "./ui";

export function MembersAdmin({
  slug,
  members,
  creatorUserId,
  meUserId,
}: {
  slug: string;
  members: MemberRow[];
  creatorUserId: number;
  meUserId: number;
}) {
  const [pending, start] = useTransition();

  return (
    <ul className="divide-y divide-border">
      {members.map((m) => {
        const isCreator = m.userId === creatorUserId;
        const isMe = m.userId === meUserId;
        const primary = m.personas[0];
        return (
          <li key={m.userId} className="flex items-center gap-3 py-3">
            <Avatar
              name={primary?.displayName ?? m.username}
              avatarUrl={primary?.avatarUrl}
              size={36}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">
                {primary?.displayName ?? m.username}{" "}
                <span className="text-muted">@{m.username}</span>
              </p>
              <p className="text-xs text-muted">
                {m.role === "dm" ? "DM" : "Player"} · {m.personas.length} persona
                {m.personas.length === 1 ? "" : "s"}
                {isCreator ? " · creator" : ""}
              </p>
            </div>

            {!isMe && !isCreator ? (
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await setMemberRoleAction(
                        slug,
                        m.userId,
                        m.role === "dm" ? "player" : "dm",
                      );
                    })
                  }
                >
                  {m.role === "dm" ? "Make player" : "Make DM"}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${m.username}? Their personas and posts will be deleted.`,
                      )
                    )
                      start(async () => {
                        await removeMemberAction(slug, m.userId);
                      });
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <span className="shrink-0 text-xs text-muted">
                {isMe ? "you" : "creator"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
