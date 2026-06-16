import "./load-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./index";
import {
  campaigns,
  follows,
  likes,
  memberships,
  personas,
  posts,
  users,
} from "./schema";
import { getPreset } from "../lib/themes";
import { generateInviteCode } from "../lib/ids";
import {
  HANDLE_RE,
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME,
  MAX_POST_LENGTH,
} from "../lib/validation";

// ---------------------------------------------------------------------------
// Seeds a campaign from a JSON payload (the shape produced by the worldbuilder
// prompt). Idempotent: re-running wipes the prior campaign of the same slug and
// the user accounts it created, then rebuilds. Run with:
//   pnpm seed:petalfall            (defaults to scripts/seed.petalfall.json)
//   pnpm tsx src/db/seed-petalfall.ts path/to/other.json my-slug
// ---------------------------------------------------------------------------

const DATA_FILE = process.argv[2] ?? "scripts/seed.petalfall.json";
const SLUG_OVERRIDE = process.argv[3]; // optional
const PASSWORD = "petalfall"; // shared dev password for every login

type Kind = "npc" | "pc";
type PostType = "post" | "reply" | "quote" | "boost";

interface PersonaJ {
  ref: string;
  kind: Kind;
  handle: string;
  displayName: string;
  bio?: string;
  player?: string;
  avatarHint?: string;
  /** explicit avatar URL; if absent, a deterministic avatar is generated */
  avatarUrl?: string;
  voice?: string;
  /** optional login username for a PC; defaults to the handle if absent. Lets a
   *  character sign in under their real name while posting under a Blackthorn
   *  alias (handle + displayName). */
  account?: string;
}
interface PostJ {
  ref: string;
  author: string;
  type: PostType;
  content: string;
  replyTo?: string | null;
  quoteOf?: string | null;
  boostOf?: string | null;
  imageHint?: string;
  /** explicit image URL; if absent and imageHint is set, a placeholder is used */
  imageUrl?: string;
  postedAt: string;
  likedBy?: string[];
}
interface FollowJ {
  follower: string;
  following: string;
}
interface Seed {
  campaign: {
    name: string;
    tagline?: string;
    description?: string;
    presetId: string;
  };
  personas: PersonaJ[];
  posts: PostJ[];
  follows?: FollowJ[];
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "campaign"
  );
}

// Parse a postedAt like "-13d2h" / "-7d" / "-3d20h" / "-45m" into a Date, or an
// ISO string straight through. Everything is in the past relative to `now`.
function parseWhen(s: string, now: number): Date {
  const trimmed = s.trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return new Date(trimmed);
  const m = trimmed.match(/^-?\s*(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) {
    throw new Error(`Unparseable postedAt: ${JSON.stringify(s)}`);
  }
  const days = +(m[1] ?? 0);
  const hours = +(m[2] ?? 0);
  const mins = +(m[3] ?? 0);
  const ms = ((days * 24 + hours) * 60 + mins) * 60_000;
  return new Date(now - ms);
}

// Keyless, deterministic avatar per persona (DiceBear, seeded by handle), so a
// seeded campaign reads as populated instead of a wall of initials.
function genAvatar(handle: string): string {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(handle)}`;
}

// Placeholder image for a post that carries an imageHint. It does NOT match the
// hint (that needs a text-to-image API); it just fills the image slot so layouts
// with media are exercised. Seeded by the post ref so it's stable across reseeds.
function postImage(ref: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent("skald-" + ref)}/900/506`;
}

function validate(seed: Seed): void {
  const errs: string[] = [];
  const personaRefs = new Set<string>();
  const handles = new Set<string>();

  for (const p of seed.personas) {
    if (personaRefs.has(p.ref)) errs.push(`duplicate persona ref: ${p.ref}`);
    personaRefs.add(p.ref);
    const h = p.handle.replace(/^@+/, "");
    if (!HANDLE_RE.test(h)) errs.push(`bad handle "${p.handle}" (${p.ref})`);
    if (handles.has(h.toLowerCase()))
      errs.push(`duplicate handle: ${p.handle}`);
    handles.add(h.toLowerCase());
    if (!p.displayName || p.displayName.length > MAX_DISPLAY_NAME)
      errs.push(`displayName length (${p.ref})`);
    if ((p.bio ?? "").length > MAX_BIO_LENGTH) errs.push(`bio too long (${p.ref})`);
    if (p.kind !== "npc" && p.kind !== "pc")
      errs.push(`bad kind "${p.kind}" (${p.ref})`);
  }

  const postRefs = new Set<string>();
  for (const t of seed.posts) {
    if (postRefs.has(t.ref)) errs.push(`duplicate post ref: ${t.ref}`);
    postRefs.add(t.ref);
    if (!personaRefs.has(t.author))
      errs.push(`post ${t.ref}: unknown author ${t.author}`);
    if ((t.content ?? "").length > MAX_POST_LENGTH)
      errs.push(`post ${t.ref}: content over ${MAX_POST_LENGTH}`);
    const targets = [t.replyTo, t.quoteOf, t.boostOf].filter(Boolean).length;
    if (t.type === "post" && targets !== 0)
      errs.push(`post ${t.ref}: plain post must not reference another`);
    if (t.type === "reply" && !t.replyTo)
      errs.push(`post ${t.ref}: reply needs replyTo`);
    if (t.type === "quote" && !t.quoteOf)
      errs.push(`post ${t.ref}: quote needs quoteOf`);
    if (t.type === "boost") {
      if (!t.boostOf) errs.push(`post ${t.ref}: boost needs boostOf`);
      if ((t.content ?? "") !== "") errs.push(`post ${t.ref}: boost must be empty`);
    }
    if (targets > 1) errs.push(`post ${t.ref}: reply/quote/boost are exclusive`);
    for (const ref of [t.replyTo, t.quoteOf, t.boostOf]) {
      if (ref && !postRefs.has(ref) && !seed.posts.some((x) => x.ref === ref))
        errs.push(`post ${t.ref}: unknown target ${ref}`);
    }
    for (const liker of t.likedBy ?? []) {
      if (!personaRefs.has(liker))
        errs.push(`post ${t.ref}: unknown liker ${liker}`);
    }
    parseWhen(t.postedAt, Date.now()); // throws on bad format
  }

  for (const f of seed.follows ?? []) {
    if (!personaRefs.has(f.follower))
      errs.push(`follow: unknown follower ${f.follower}`);
    if (!personaRefs.has(f.following))
      errs.push(`follow: unknown following ${f.following}`);
  }

  if (errs.length) {
    throw new Error(
      `Seed data failed validation:\n  - ${errs.join("\n  - ")}`,
    );
  }
}

async function main() {
  const filePath = path.resolve(process.cwd(), DATA_FILE);
  let seed: Seed;
  try {
    seed = JSON.parse(readFileSync(filePath, "utf8")) as Seed;
  } catch (e) {
    throw new Error(
      `Could not read seed JSON at ${filePath}. Save the full payload there first.\n${(e as Error).message}`,
    );
  }

  validate(seed);

  const slug = SLUG_OVERRIDE ?? slugify(seed.campaign.name);
  const pcs = seed.personas.filter((p) => p.kind === "pc");
  const npcs = seed.personas.filter((p) => p.kind === "npc");

  // login usernames: one per PC (its real name via `account`, else its handle)
  // + a campaign DM account
  const dmUsername = `${slug}_dm`;
  const pcUsername = (p: PersonaJ) =>
    (p.account ?? p.handle).replace(/^@+/, "");
  const pcUsernames = pcs.map(pcUsername);
  const allUsernamesLower = [dmUsername, ...pcUsernames].map((u) =>
    u.toLowerCase(),
  );

  console.log(`Seeding "${seed.campaign.name}"  →  /c/${slug}`);
  console.log(
    `  ${npcs.length} NPCs, ${pcs.length} PCs, ${seed.posts.length} posts, ${seed.follows?.length ?? 0} follows`,
  );

  // --- idempotent reset: drop the campaign (cascades memberships/personas/
  // posts), then the users it owned. Collect member user ids BEFORE deleting so
  // a prior run with different usernames (e.g. alias-based) is cleaned up too. ---
  const existing = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.slug, slug));
  if (existing.length) {
    const members = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.campaignId, existing[0].id));
    await db.delete(campaigns).where(eq(campaigns.slug, slug));
    const memberIds = [...new Set(members.map((m) => m.userId))];
    if (memberIds.length) {
      await db.delete(users).where(inArray(users.id, memberIds));
    }
  }
  await db.delete(users).where(inArray(users.usernameLower, allUsernamesLower));

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // --- users (DM owns all NPCs; one user per PC) ---
  const [dmUser] = await db
    .insert(users)
    .values({
      username: dmUsername,
      usernameLower: dmUsername.toLowerCase(),
      passwordHash,
    })
    .returning({ id: users.id });

  const ownerByRef = new Map<string, number>(); // persona ref -> owner user id
  for (const n of npcs) ownerByRef.set(n.ref, dmUser.id);
  for (const pc of pcs) {
    const uname = pcUsername(pc);
    const [u] = await db
      .insert(users)
      .values({
        username: uname,
        usernameLower: uname.toLowerCase(),
        passwordHash,
      })
      .returning({ id: users.id });
    ownerByRef.set(pc.ref, u.id);
  }

  // --- campaign (theme = chosen preset, re-titled to the campaign name) ---
  const preset = getPreset(seed.campaign.presetId);
  const theme = {
    ...preset,
    appName: seed.campaign.name,
    tagline: seed.campaign.tagline ?? preset.tagline,
  };
  const inviteCode = generateInviteCode();
  const [campaign] = await db
    .insert(campaigns)
    .values({
      slug,
      name: seed.campaign.name,
      description: seed.campaign.description ?? null,
      theme,
      inviteCode,
      createdByUserId: dmUser.id,
    })
    .returning({ id: campaigns.id });
  const cid = campaign.id;

  // --- memberships ---
  await db.insert(memberships).values([
    { userId: dmUser.id, campaignId: cid, role: "dm" as const },
    ...pcs.map((pc) => ({
      userId: ownerByRef.get(pc.ref)!,
      campaignId: cid,
      role: "player" as const,
    })),
  ]);

  // --- personas ---
  const personaRows = await db
    .insert(personas)
    .values(
      seed.personas.map((p) => {
        const h = p.handle.replace(/^@+/, "");
        return {
          campaignId: cid,
          ownerUserId: ownerByRef.get(p.ref)!,
          handle: h,
          handleLower: h.toLowerCase(),
          displayName: p.displayName,
          bio: p.bio ?? null,
          avatarUrl: p.avatarUrl ?? genAvatar(h),
          isNpc: p.kind === "npc",
        };
      }),
    )
    .returning({ id: personas.id, handleLower: personas.handleLower });

  // map persona ref -> id (via handle, which we kept unique)
  const idByHandle = new Map(personaRows.map((r) => [r.handleLower, r.id]));
  const personaId = (ref: string): number => {
    const p = seed.personas.find((x) => x.ref === ref)!;
    return idByHandle.get(p.handle.replace(/^@+/, "").toLowerCase())!;
  };

  // acting personas: DM acts as the first NPC; each PC acts as itself
  await db
    .update(memberships)
    .set({ actingPersonaId: personaId(npcs[0].ref) })
    .where(eq(memberships.userId, dmUser.id));
  for (const pc of pcs) {
    await db
      .update(memberships)
      .set({ actingPersonaId: personaId(pc.ref) })
      .where(eq(memberships.userId, ownerByRef.get(pc.ref)!));
  }

  // --- posts: insert in dependency order so reply/quote/boost targets exist.
  // publishedAt carries the real timeline, independent of insertion order. ---
  const now = Date.now();
  const idByPostRef = new Map<string, number>();
  const pending = [...seed.posts];
  let guard = 0;
  while (pending.length) {
    if (guard++ > seed.posts.length + 5) {
      throw new Error(
        `Cyclic/unresolvable post references near: ${pending
          .slice(0, 5)
          .map((p) => p.ref)
          .join(", ")}`,
      );
    }
    const ready = pending.filter((t) => {
      const dep = t.replyTo || t.quoteOf || t.boostOf;
      return !dep || idByPostRef.has(dep);
    });
    if (!ready.length) {
      throw new Error(
        `Stuck resolving posts (missing targets): ${pending
          .map((p) => p.ref)
          .join(", ")}`,
      );
    }
    for (const t of ready) {
      const replyToPostId = t.type === "reply" ? idByPostRef.get(t.replyTo!)! : null;
      const repostOfPostId =
        t.type === "quote"
          ? idByPostRef.get(t.quoteOf!)!
          : t.type === "boost"
            ? idByPostRef.get(t.boostOf!)!
            : null;
      const [row] = await db
        .insert(posts)
        .values({
          campaignId: cid,
          personaId: personaId(t.author),
          content: t.content ?? "",
          imageUrl:
            t.imageUrl ?? (t.imageHint?.trim() ? postImage(t.ref) : null),
          status: "published" as const,
          publishedAt: parseWhen(t.postedAt, now),
          replyToPostId,
          repostOfPostId,
        })
        .returning({ id: posts.id });
      idByPostRef.set(t.ref, row.id);
    }
    for (const t of ready) pending.splice(pending.indexOf(t), 1);
  }

  // --- likes (dedup persona+post) ---
  const likeRows: { campaignId: number; personaId: number; postId: number }[] =
    [];
  const seenLike = new Set<string>();
  for (const t of seed.posts) {
    for (const liker of t.likedBy ?? []) {
      const k = `${liker}|${t.ref}`;
      if (seenLike.has(k)) continue;
      seenLike.add(k);
      likeRows.push({
        campaignId: cid,
        personaId: personaId(liker),
        postId: idByPostRef.get(t.ref)!,
      });
    }
  }
  if (likeRows.length) await db.insert(likes).values(likeRows);

  // --- follows (dedup, skip self) ---
  const followRows: {
    campaignId: number;
    followerPersonaId: number;
    followingPersonaId: number;
  }[] = [];
  const seenFollow = new Set<string>();
  for (const f of seed.follows ?? []) {
    if (f.follower === f.following) continue;
    const k = `${f.follower}|${f.following}`;
    if (seenFollow.has(k)) continue;
    seenFollow.add(k);
    followRows.push({
      campaignId: cid,
      followerPersonaId: personaId(f.follower),
      followingPersonaId: personaId(f.following),
    });
  }
  // The home feed is a following feed. So the DM's narrator account (its acting
  // persona) follows the whole cast — logging in as the DM then shows the entire
  // timeline at /c/<slug>, not just its own posts. The curated graph above still
  // drives each PC's own feed and the follower counts. (Explore is global anyway.)
  const narratorRef = npcs[0].ref;
  for (const other of seed.personas) {
    if (other.ref === narratorRef) continue;
    const k = `${narratorRef}|${other.ref}`;
    if (seenFollow.has(k)) continue;
    seenFollow.add(k);
    followRows.push({
      campaignId: cid,
      followerPersonaId: personaId(narratorRef),
      followingPersonaId: personaId(other.ref),
    });
  }
  if (followRows.length) await db.insert(follows).values(followRows);

  console.log("\n✅ Seed complete!\n");
  console.log(`  Campaign:    ${seed.campaign.name}   →   /c/${slug}`);
  console.log(`  Invite code: ${inviteCode}`);
  console.log(`  Posts:       ${idByPostRef.size}`);
  console.log(`  Likes:       ${likeRows.length}   Follows: ${followRows.length}`);
  console.log(`\n  Logins (shared password: ${PASSWORD})`);
  console.log(`    • ${dmUsername}   (DM — owns all ${npcs.length} NPC accounts)`);
  for (const pc of pcs) {
    console.log(
      `    • ${pcUsername(pc)}   (plays "${pc.displayName}" / @${pc.handle.replace(/^@+/, "")})`,
    );
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ " + (err as Error).message);
    process.exit(1);
  });
