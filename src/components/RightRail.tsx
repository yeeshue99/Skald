import Link from "next/link";
import { KeyRound, Settings, UserPlus } from "lucide-react";
import type { CampaignContext } from "@/lib/campaign";
import { getWhoToFollow } from "@/lib/queries";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { CopyButton } from "./CopyButton";
import { Card } from "./ui";

export async function RightRail({ ctx }: { ctx: CampaignContext }) {
  const { campaign, role, actingPersona } = ctx;
  const suggestions = await getWhoToFollow(campaign.id, actingPersona.id, 5);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[340px] shrink-0 overflow-y-auto px-5 py-4 xl:block">
      <Card className="mb-4 p-4">
        <h2 className="font-display text-lg font-bold text-text">
          {campaign.name}
        </h2>
        {campaign.description ? (
          <p className="mt-1 text-sm text-muted">{campaign.description}</p>
        ) : (
          <p className="mt-1 text-sm text-muted">{campaign.theme.tagline}</p>
        )}

        {role === "dm" ? (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <KeyRound className="size-3.5" /> Invite code
            </p>
            <div className="flex items-center justify-between gap-2">
              <code className="rounded bg-bg px-2 py-1 font-mono text-base font-bold tracking-widest text-text">
                {campaign.inviteCode}
              </code>
              <CopyButton value={campaign.inviteCode} label="Code" />
            </div>
            <CopyButton
              urlPath={`/register?code=${campaign.inviteCode}`}
              label="Copy invite link"
            />
            <Link
              href={`/c/${campaign.slug}/settings`}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Settings className="size-4" /> Campaign settings
            </Link>
          </div>
        ) : null}
      </Card>

      {suggestions.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-text">
            <UserPlus className="size-5" /> Who to follow
          </h2>
          <ul className="space-y-3">
            {suggestions.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <Link href={`/c/${campaign.slug}/u/${p.handle.toLowerCase()}`}>
                  <Avatar name={p.displayName} avatarUrl={p.avatarUrl} size={40} />
                </Link>
                <Link
                  href={`/c/${campaign.slug}/u/${p.handle.toLowerCase()}`}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate text-sm font-semibold text-text hover:underline">
                    {p.displayName}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    @{p.handle}
                  </span>
                </Link>
                <FollowButton
                  slug={campaign.slug}
                  targetPersonaId={p.id}
                  initialFollowing={false}
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="mt-4 px-2 text-xs text-muted">
        {campaign.theme.appName} · a Skald campaign feed
      </p>
    </aside>
  );
}
