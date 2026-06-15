import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCampaignContext } from "@/lib/campaign";
import { getPersonaPosts, getProfile } from "@/lib/queries";
import { compactNumber } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { FeedList } from "@/components/FeedList";
import { FollowButton } from "@/components/FollowButton";
import { EditPersonaButton } from "@/components/EditPersonaButton";
import { PageHeader } from "@/components/PageHeader";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string; handle: string }>;
}) {
  const { slug, handle } = await params;
  const ctx = await requireCampaignContext(slug);
  const handleLower = decodeURIComponent(handle)
    .replace(/^@/, "")
    .toLowerCase();

  const profile = await getProfile(
    ctx.campaign.id,
    handleLower,
    ctx.actingPersona.id,
  );
  if (!profile) notFound();

  const persona = profile.persona;
  const feed = await getPersonaPosts(
    ctx.campaign.id,
    persona.id,
    ctx.actingPersona.id,
    null,
  );
  const canEdit =
    ctx.myPersonas.some((p) => p.id === persona.id) || ctx.role === "dm";
  const isSelf = persona.id === ctx.actingPersona.id;

  return (
    <>
      <PageHeader
        title={persona.displayName}
        subtitle={`${compactNumber(profile.postCount)} posts`}
        backHref={`/c/${slug}`}
        desktopOnly={false}
      />

      <div className="border-b border-border">
        <div
          className="h-28"
          style={{
            backgroundImage:
              "linear-gradient(120deg, var(--primary), var(--accent))",
          }}
        />
        <div className="px-4 pb-4">
          <div className="-mt-12 flex items-end justify-between">
            <Avatar
              name={persona.displayName}
              avatarUrl={persona.avatarUrl}
              size={88}
              className="border-4 border-bg"
            />
            <div className="mb-1">
              {canEdit ? (
                <EditPersonaButton
                  slug={slug}
                  persona={{
                    id: persona.id,
                    handle: persona.handle,
                    displayName: persona.displayName,
                    bio: persona.bio,
                    avatarUrl: persona.avatarUrl,
                  }}
                  label={isSelf ? "Edit profile" : "Edit"}
                />
              ) : (
                <FollowButton
                  slug={slug}
                  targetPersonaId={persona.id}
                  initialFollowing={profile.followedByMe}
                  size="md"
                />
              )}
            </div>
          </div>

          <div className="mt-3">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-text">
              {persona.displayName}
              {ctx.role === "dm" && persona.isNpc ? (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                  NPC
                </span>
              ) : null}
            </h2>
            <p className="text-muted">@{persona.handle}</p>
            {persona.bio ? (
              <p className="mt-2 whitespace-pre-wrap text-text">{persona.bio}</p>
            ) : null}

            <div className="mt-3 flex gap-4 text-sm">
              <span className="text-muted">
                <span className="font-bold text-text">
                  {compactNumber(profile.followingCount)}
                </span>{" "}
                Following
              </span>
              <span className="text-muted">
                <span className="font-bold text-text">
                  {compactNumber(profile.followerCount)}
                </span>{" "}
                Followers
              </span>
            </div>

            {ctx.role === "dm" ? (
              <p className="mt-2 text-xs text-muted">
                Played by{" "}
                <Link href="#" className="text-muted">
                  @{profile.ownerUsername}
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <FeedList
        slug={slug}
        type="profile"
        handleLower={handleLower}
        initialPosts={feed.posts}
        initialCursor={feed.nextCursor}
        myPersonaIds={ctx.myPersonas.map((p) => p.id)}
        isDm={ctx.role === "dm"}
        emptyMessage={`${persona.displayName} hasn't posted yet.`}
      />
    </>
  );
}
