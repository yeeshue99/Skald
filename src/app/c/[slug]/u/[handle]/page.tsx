import Link from "next/link";
import { notFound } from "next/navigation";
import { Pin } from "lucide-react";
import { requireCampaignContext } from "@/lib/campaign";
import {
  getPersonaPosts,
  getPersonaReplies,
  getPinnedPost,
  getProfile,
} from "@/lib/queries";
import { compactNumber } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { FeedList } from "@/components/FeedList";
import { PostCard } from "@/components/PostCard";
import { ProfileTabs } from "@/components/ProfileTabs";
import { FollowButton } from "@/components/FollowButton";
import { UnpinButton } from "@/components/UnpinButton";
import { EditPersonaButton } from "@/components/EditPersonaButton";
import { ChangePasswordButton } from "@/components/ChangePasswordButton";
import { PageHeader } from "@/components/PageHeader";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; handle: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug, handle } = await params;
  const { tab } = await searchParams;
  const replies = tab === "replies";
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
  const [feed, pinned] = await Promise.all([
    replies
      ? getPersonaReplies(ctx.campaign.id, persona.id, ctx.actingPersona.id, null)
      : getPersonaPosts(ctx.campaign.id, persona.id, ctx.actingPersona.id, null),
    getPinnedPost(ctx.campaign.id, persona.id, ctx.actingPersona.id),
  ]);
  const canEdit =
    ctx.myPersonas.some((p) => p.id === persona.id) || ctx.role === "dm";
  const isSelf = persona.id === ctx.actingPersona.id;
  const myPersonaIds = ctx.myPersonas.map((p) => p.id);
  const isDm = ctx.role === "dm";
  // keep the pinned post from also appearing in its chronological slot — but
  // only on the Posts tab, where the pinned block is shown. On Replies the
  // pinned post (a top-level post) belongs in the feed and must not be dropped.
  const initialPosts =
    !replies && pinned
      ? feed.posts.filter((p) => p.id !== pinned.id)
      : feed.posts;

  return (
    <>
      <PageHeader
        title={persona.displayName}
        subtitle={`${compactNumber(profile.postCount)} posts`}
        backHref={`/c/${slug}`}
        desktopOnly={false}
      />

      <div className="border-b border-border">
        {persona.bannerUrl ? (
          // user-provided URL, so a plain <img> (no domain allowlist)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={persona.bannerUrl}
            alt=""
            className="h-28 w-full object-cover"
          />
        ) : (
          <div
            className="h-28"
            style={{
              backgroundImage:
                "linear-gradient(120deg, var(--primary), var(--accent))",
            }}
          />
        )}
        <div className="px-4 pb-4">
          <div className="-mt-12 flex items-end justify-between">
            <Avatar
              name={persona.displayName}
              avatarUrl={persona.avatarUrl}
              size={88}
              className="border-4 border-bg"
              frame={persona.avatarFrame}
            />
            <div className="mb-1 flex items-center gap-2">
              {canEdit ? (
                <>
                  <EditPersonaButton
                    slug={slug}
                    persona={{
                      id: persona.id,
                      handle: persona.handle,
                      displayName: persona.displayName,
                      bio: persona.bio,
                      avatarUrl: persona.avatarUrl,
                      bannerUrl: persona.bannerUrl,
                      avatarFrame: persona.avatarFrame,
                    }}
                    label={isSelf ? "Edit profile" : "Edit"}
                  />
                  {isSelf ? <ChangePasswordButton /> : null}
                </>
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

      <ProfileTabs
        slug={slug}
        handleLower={handleLower}
        active={replies ? "replies" : "posts"}
      />

      {!replies && pinned ? (
        <div>
          <div className="flex items-center gap-1.5 px-4 pt-2 text-xs font-semibold text-muted">
            <Pin className="size-3.5" /> Pinned
            {canEdit ? <UnpinButton slug={slug} postId={pinned.id} /> : null}
          </div>
          <PostCard
            post={pinned}
            slug={slug}
            myPersonaIds={myPersonaIds}
            isDm={isDm}
            pinned={true}
          />
        </div>
      ) : null}

      <FeedList
        key={replies ? "replies" : "posts"}
        slug={slug}
        type={replies ? "replies" : "profile"}
        handleLower={handleLower}
        initialPosts={initialPosts}
        initialCursor={feed.nextCursor}
        myPersonaIds={myPersonaIds}
        isDm={isDm}
        emptyMessage={
          replies
            ? `${persona.displayName} hasn't replied to anything yet.`
            : `${persona.displayName} hasn't posted yet.`
        }
      />
    </>
  );
}
