import "../load-env";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../index";
import {
  campaigns,
  follows,
  likes,
  memberships,
  personas,
  posts,
  users,
} from "../schema";
import { STRIX_THEME } from "../../lib/themes";
import { generateInviteCode } from "../../lib/ids";

const SLUG = "strix";
const PASSWORD = "password123";

async function main() {
  console.log("Seeding the STR/X demo campaign…");

  // --- clean any previous demo data so re-seeding is idempotent ---
  const existing = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.slug, SLUG));
  if (existing.length) {
    await db.delete(campaigns).where(eq(campaigns.slug, SLUG));
  }
  await db
    .delete(users)
    .where(inArray(users.usernameLower, ["dm", "tasha", "kael"]));

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // --- users ---
  const [dm] = await db
    .insert(users)
    .values({ username: "dm", usernameLower: "dm", passwordHash })
    .returning({ id: users.id });
  const [p1] = await db
    .insert(users)
    .values({ username: "tasha", usernameLower: "tasha", passwordHash })
    .returning({ id: users.id });
  const [p2] = await db
    .insert(users)
    .values({ username: "kael", usernameLower: "kael", passwordHash })
    .returning({ id: users.id });

  // --- campaign ---
  const inviteCode = generateInviteCode();
  const [campaign] = await db
    .insert(campaigns)
    .values({
      slug: SLUG,
      name: STRIX_THEME.appName,
      description: "The shared feed of the five colleges.",
      theme: { ...STRIX_THEME },
      inviteCode,
      createdByUserId: dm.id,
    })
    .returning({ id: campaigns.id });
  const cid = campaign.id;

  // --- memberships ---
  await db.insert(memberships).values([
    { userId: dm.id, campaignId: cid, role: "dm" },
    { userId: p1.id, campaignId: cid, role: "player" },
    { userId: p2.id, campaignId: cid, role: "player" },
  ]);

  // --- personas ---
  type PersonaSeed = {
    owner: number;
    handle: string;
    displayName: string;
    bio: string;
    isNpc: boolean;
    avatarUrl?: string;
  };
  const personaSeeds: PersonaSeed[] = [
    { owner: dm.id, handle: "headmaster", displayName: "Dean Nole", bio: "Dean of Strixhaven. Mind the owlin in the stacks.", isNpc: false },
    { owner: dm.id, handle: "oracle", displayName: "The Biblioplex Oracle", bio: "I only speak in portents. Usually.", isNpc: true },
    { owner: dm.id, handle: "silverquill", displayName: "Silverquill College", bio: "Words are weapons. Spelling counts.", isNpc: true },
    { owner: dm.id, handle: "witherbloom", displayName: "Witherbloom College", bio: "Life, death, and excellent compost.", isNpc: true },
    { owner: dm.id, handle: "prismari", displayName: "Prismari College", bio: "Make it loud. Make it burn. Make it art.", isNpc: true },
    { owner: dm.id, handle: "quandrix", displayName: "Quandrix College", bio: "The pattern beneath everything.", isNpc: true },
    { owner: dm.id, handle: "lorehold", displayName: "Lorehold College", bio: "We dig up the past. Sometimes it digs back.", isNpc: true },
    { owner: p1.id, handle: "tasha", displayName: "Tasha Brightwater", bio: "Quandrix first-year. Ask me about fractals.", isNpc: false },
    { owner: p2.id, handle: "kael", displayName: "Kael Emberfell", bio: "Prismari. Yes, that was me. No, I won't apologize.", isNpc: false },
  ];

  const personaRows = await db
    .insert(personas)
    .values(
      personaSeeds.map((s) => ({
        campaignId: cid,
        ownerUserId: s.owner,
        handle: s.handle,
        handleLower: s.handle.toLowerCase(),
        displayName: s.displayName,
        bio: s.bio,
        avatarUrl: s.avatarUrl ?? null,
        isNpc: s.isNpc,
      })),
    )
    .returning({ id: personas.id, handleLower: personas.handleLower });

  const pid = new Map(personaRows.map((r) => [r.handleLower, r.id]));
  const P = (h: string) => pid.get(h)!;

  // set each member's acting persona to their own character / dean
  await db
    .update(memberships)
    .set({ actingPersonaId: P("headmaster") })
    .where(eq(memberships.userId, dm.id));
  await db
    .update(memberships)
    .set({ actingPersonaId: P("tasha") })
    .where(eq(memberships.userId, p1.id));
  await db
    .update(memberships)
    .set({ actingPersonaId: P("kael") })
    .where(eq(memberships.userId, p2.id));

  // --- posts (timeline goes from oldest to newest) ---
  const now = Date.now();
  const ago = (mins: number) => new Date(now - mins * 60_000);

  type PostSeed = {
    handle: string;
    content: string;
    minutesAgo: number;
    imageUrl?: string;
    replyTo?: string; // a key into the createdPosts map
    key?: string;
  };

  const topLevel: PostSeed[] = [
    { key: "welcome", handle: "headmaster", content: "Welcome back to Strixhaven, students. The Biblioplex is open. The mascots are loose. Try to survive the semester. 📜", minutesAgo: 600 },
    { key: "oracle1", handle: "oracle", content: "A door that was sealed for a hundred years will open before the next full moon. Bring snacks.", minutesAgo: 540 },
    { key: "prismari1", handle: "prismari", content: "Tonight: the annual Prismari light-storm over the quad. Bring sunglasses. And a fire extinguisher.", minutesAgo: 420, imageUrl: "https://picsum.photos/seed/prismari/800/450" },
    { key: "tasha1", handle: "tasha", content: "first week and I already owe a book to the Biblioplex Oracle. send help (and flashcards) @quandrix", minutesAgo: 300 },
    { key: "kael1", handle: "kael", content: "okay WHO turned the fountain into lava. (it was me. it's fine. mostly.)", minutesAgo: 180 },
    { key: "wither1", handle: "witherbloom", content: "Reminder: the carnivorous plants in Greenhouse 3 have NOT been fed. This is not a drill.", minutesAgo: 90 },
    { key: "lore1", handle: "lorehold", content: "Dig site update: the bones are talking again. They have notes on your essays.", minutesAgo: 35 },
  ];

  const createdPosts = new Map<string, number>();
  for (const s of topLevel) {
    const [row] = await db
      .insert(posts)
      .values({
        campaignId: cid,
        personaId: P(s.handle),
        content: s.content,
        imageUrl: s.imageUrl ?? null,
        status: "published",
        publishedAt: ago(s.minutesAgo),
      })
      .returning({ id: posts.id });
    if (s.key) createdPosts.set(s.key, row.id);
  }

  // replies
  const replies: PostSeed[] = [
    { handle: "quandrix", content: "@tasha Returns are due by the third bell. The Oracle does not accept excuses, only fractals.", minutesAgo: 280, replyTo: "tasha1" },
    { handle: "kael", content: "@prismari I'm bringing the fire extinguisher AND the marshmallows.", minutesAgo: 400, replyTo: "prismari1" },
    { handle: "silverquill", content: "@kael We have drafted a formal complaint. It is, admittedly, very well written.", minutesAgo: 160, replyTo: "kael1" },
  ];
  for (const s of replies) {
    await db.insert(posts).values({
      campaignId: cid,
      personaId: P(s.handle),
      content: s.content,
      status: "published",
      publishedAt: ago(s.minutesAgo),
      replyToPostId: s.replyTo ? createdPosts.get(s.replyTo)! : null,
    });
  }

  // a scheduled reveal (DM-only until it goes live) and a draft
  await db.insert(posts).values({
    campaignId: cid,
    personaId: P("oracle"),
    content: "The sealed door is open. Come to the Biblioplex. Come alone. Or don't, that's worse.",
    status: "scheduled",
    publishedAt: new Date(now + 2 * 60 * 60 * 1000),
  });
  await db.insert(posts).values({
    campaignId: cid,
    personaId: P("headmaster"),
    content: "(draft) Announcement about the inter-college duel — finalize the rules first.",
    status: "draft",
    publishedAt: null,
  });

  // --- follows ---
  const followPairs: [string, string][] = [
    ["tasha", "headmaster"],
    ["tasha", "quandrix"],
    ["tasha", "oracle"],
    ["kael", "prismari"],
    ["kael", "headmaster"],
    ["kael", "tasha"],
    ["headmaster", "oracle"],
    ["silverquill", "lorehold"],
    ["witherbloom", "prismari"],
  ];
  await db.insert(follows).values(
    followPairs.map(([f, t]) => ({
      campaignId: cid,
      followerPersonaId: P(f),
      followingPersonaId: P(t),
    })),
  );

  // --- a few likes ---
  const likePairs: [string, string][] = [
    ["tasha", "welcome"],
    ["kael", "welcome"],
    ["tasha", "oracle1"],
    ["headmaster", "kael1"],
    ["kael", "prismari1"],
  ];
  await db.insert(likes).values(
    likePairs.map(([h, key]) => ({
      campaignId: cid,
      personaId: P(h),
      postId: createdPosts.get(key)!,
    })),
  );

  console.log("\n✅ Seed complete!\n");
  console.log("  Campaign:    STR/X   →   /c/strix");
  console.log(`  Invite code: ${inviteCode}`);
  console.log("  Logins (password for all: " + PASSWORD + ")");
  console.log("    • dm     (the DM — owns all the NPC accounts)");
  console.log("    • tasha  (player)");
  console.log("    • kael   (player)");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
