import "../load-env";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../index";
import {
  bookmarks,
  campaigns,
  decorations,
  follows,
  likes,
  memberships,
  notifications,
  personas,
  pollVotes,
  polls,
  posts,
  users,
} from "../schema";
import { BLOOMR_THEME } from "../../lib/themes";
import { generateInviteCode } from "../../lib/ids";
import { PERSONA_AVATAR_FRAMES } from "../../lib/theme-types";
import type { DecorationSpec } from "../../lib/theme-types";
import type { NotificationType } from "../schema";

// ---------------------------------------------------------------------------
// Thornfeed: a Skald demo campaign seeded from the freeform cast of a flower-
// house D&D game (Queendom of Elarosea, the Star-Fallen, the god-eating Queen).
// The DM persona is the Narrator; every NPC is DM-owned. Every PC and NPC
// interacts with every other at least twice (enforced at the bottom). All seed
// users are prefixed "tf_" so cleanup never deletes another campaign's accounts.
// Post copy is written to read like a real, funny feed (and run through the
// humanizer): distinct per-persona voices, banter, running bits, no AI tells.
// Run:  pnpm seed thornfeed   (DB must have the current schema applied)
// ---------------------------------------------------------------------------

const SLUG = "thornfeed";
const PASSWORD = "password123";

type OwnerKey =
  | "dm"
  | "calanthe"
  | "cleke"
  | "dez"
  | "kirill"
  | "layla"
  | "spadae"
  | "val"
  | "vesperae";

// every seed login is "tf_" + its owner key, so the delete list is exact
const OWNER_KEYS: OwnerKey[] = [
  "dm",
  "calanthe",
  "cleke",
  "dez",
  "kirill",
  "layla",
  "spadae",
  "val",
  "vesperae",
];
const uname = (k: OwnerKey) => `tf_${k}`;

type Frame = (typeof PERSONA_AVATAR_FRAMES)[number];

interface PersonaSeed {
  owner: OwnerKey;
  handle: string;
  displayName: string;
  bio: string;
  isNpc: boolean;
  frame: Frame;
  banner?: boolean;
}

// The Narrator (DM's primary persona, not an NPC) + every PC + every DM-owned NPC.
const personaSeeds: PersonaSeed[] = [
  // --- the DM, acting as the Narrator ---
  { owner: "dm", handle: "thequill", displayName: "Narrator", isNpc: false, frame: "default", banner: true, bio: "Keeper of this tale. I narrate; I do not intervene. (Mostly.) Can't tell you what happens next. Can absolutely foreshadow it to death." },

  // --- player characters (each owned by its own player) ---
  { owner: "calanthe", handle: "artiststruggle", displayName: "Calanthe Orchidaceae", isNpc: false, frame: "blossom", banner: true, bio: "Heir to House Orchidaceae. Dancer. Painter (you'll see). Year five of a one-year thesis. It's called the artist's struggle, look it up." },
  { owner: "cleke", handle: "blindpilot", displayName: "Cleke", isNpc: false, frame: "manaHalo", banner: true, bio: "Pilot from a world I can't remember. Now a bird, somehow. Blindfold of borrowed feathers. Hands know a cockpit my head doesn't. Send help, or a manual." },
  { owner: "dez", handle: "spysson", displayName: "Dez", isNpc: false, frame: "none", bio: "Spy's kid. Soldier's kid. Loyal to my mother, allergic to nobility, fluent in sarcasm. No I will not lower my voice." },
  { owner: "kirill", handle: "verdantpilgrim", displayName: "Kirill Amaterasu", isNpc: false, frame: "wreath", banner: true, bio: "Verdant Mendicant on my first solo job. Guardian of one (1) sacred calf. I trust everyone instantly and I will bring you soup. Do not waste food near me." },
  { owner: "layla", handle: "byprocedure", displayName: "Layla", isNpc: false, frame: "hudBracket", banner: true, bio: "SubCaptain of the Guard. Used to be middle management in another life, literally. Currently building the complaints form this Queendom forgot to make." },
  { owner: "spadae", handle: "courtescapee", displayName: "Spadae", isNpc: false, frame: "medallion", bio: "Caelrosa nobility, outside the court walls for the first time ever. Everything out here is terrifying and amazing. Is this normal? Nobody will tell me if this is normal." },
  { owner: "val", handle: "steadyhand", displayName: "Val", isNpc: false, frame: "default", banner: true, bio: "Blackthorn slums. Tanner's son. Protect family and innocents, no torture, no slavery. Few words, fewer threats I don't keep. Here to bring mine home." },
  { owner: "vesperae", handle: "seesomethingdo", displayName: "Vesperae Locke", isNpc: false, frame: "wreath", banner: true, bio: "Quit the Canopy to live the creed: see something, do something. I catch the people the hierarchy throws out. Yes I will make it your problem too." },

  // --- NPCs (all owned by the DM) ---
  { owner: "dm", handle: "thegildedcrown", displayName: "Queen Acantha", isNpc: true, frame: "medallion", banner: true, bio: "Acantha Rosaceae, by root and thorn, Queen of Elarosea. 301 years and counting. You're welcome. 🌹" },
  { owner: "dm", handle: "grandarchivist", displayName: "Corbin Locke", isNpc: true, frame: "medallion", bio: "Grand Archivist of Loquat. I keep the records and, lately, my conscience. Everything I post is deniable. You didn't read this." },
  { owner: "dm", handle: "unionmother", displayName: "Alicia", isNpc: true, frame: "none", bio: "Loquat loom-hand. Organizing the Roots one shift at a time. Mother. I bend systems built to break us. Eat something." },
  { owner: "dm", handle: "nightshadebeau", displayName: "Aeneas Solanaceae", isNpc: true, frame: "default", bio: "Academy-trained. Misunderstood. Once rescued someone and got called a villain for it. Truly the real victim here. Open to arrangements." },
  { owner: "dm", handle: "featherbond", displayName: "Alice", isNpc: true, frame: "wreath", bio: "Elder of the Appori clan, Skydwellers of the high reaches. I sponsored Cleke's feathers. Trust is woven, not given. Breathe, child." },
  { owner: "dm", handle: "thewallspeaks", displayName: "Cassimir", isNpc: true, frame: "none", bio: "Second son of Blackthorn. The writing on the walls is a letter from my brother. It is NOT grief. Zoom in on the third brick. Do your own research." },
  { owner: "dm", handle: "thedefector", displayName: "Edmund Vane", isNpc: true, frame: "hudBracket", bio: "Was sent to kill Elara Vane. Took her name instead. Of the Birds now. I forged half the clean papers in this city, so." },
  { owner: "dm", handle: "themurmuration", displayName: "Elara Vane", isNpc: true, frame: "blossom", banner: true, bio: "Once the Queen's right hand. Now I run the Birds. Trying to save her from what she ate. The birds are always listening. Yes, to this too." },
  { owner: "dm", handle: "captainbriar", displayName: "Thorn-Captain Briar", isNpc: true, frame: "hudBracket", bio: "Thorn-Captain, field command. Clean papers, nothing to fear. We keep the peace one example at a time, and we do love a good example." },
  { owner: "dm", handle: "willowmask", displayName: "Thorn-Agent Nettle", isNpc: true, frame: "hudBracket", bio: "Thorn-Agent. Willow mask. I know what you dreamed last night. I'm patient, and I'm closer than your last exhale. Stay in your lane. I'm in everyone's." },
  { owner: "dm", handle: "whoswatching", displayName: "Sable", isNpc: true, frame: "none", bio: "You'll see me when I want you to. There's a letter under the writing. That's all I'm giving you for free." },
  { owner: "dm", handle: "thequeensthorns", displayName: "The Queen's Thorns", isNpc: true, frame: "hudBracket", banner: true, bio: "Official account of the Crown's Thorns. Enforcement, conscription, and god-hunting, with a smile. Serve and be remembered. 🌹 #ServeWithPride" },
  { owner: "dm", handle: "thequeensroots", displayName: "The Queen's Roots", isNpc: true, frame: "none", bio: "We do not announce ourselves. This account is the exception. We don't follow you back. (We're already following you.)" },
];

// which persona each owner acts as by default (DM -> Narrator, each player -> PC)
const ACTING: Record<OwnerKey, string> = {
  dm: "thequill",
  calanthe: "artiststruggle",
  cleke: "blindpilot",
  dez: "spysson",
  kirill: "verdantpilgrim",
  layla: "byprocedure",
  spadae: "courtescapee",
  val: "steadyhand",
  vesperae: "seesomethingdo",
};

// ---------------------------------------------------------------------------
// Posts. Timeline is oldest -> newest. A post is published (minutesAgo),
// scheduled (scheduledInMin, future), or a draft (draft: true). replyTo chains a
// thread/reply; quoteOf with content is a quote, quoteOf with "" content is a
// plain boost. The array is ordered so every referenced key is inserted first.
// ---------------------------------------------------------------------------
interface PostSeed {
  key: string;
  handle: string;
  content: string;
  minutesAgo?: number;
  scheduledInMin?: number;
  draft?: boolean;
  imageUrl?: string;
  replyTo?: string;
  quoteOf?: string;
  poll?: { options: string[]; days: number };
}

const img = (s: string) => `https://picsum.photos/seed/${s}/800/450`;

const POSTS: PostSeed[] = [
  // --- background voices (before the saga proper) ---
  { key: "queenProclaim", handle: "thegildedcrown", minutesAgo: 23040, content: "301 years of the Gilded Peace and not one thank-you note. You're welcome anyway. Sleep well tonight. Your Queen does not, but that's a me problem. 🌹" },
  { key: "corbinRoots", handle: "grandarchivist", minutesAgo: 21600, content: "The Ascent groaned over the Roots again today. The Canopy didn't feel a thing. I felt it from a very comfortable chair in the Grand Archive and I have never been more ashamed of a chair. #RootsOfLoquat" },
  { key: "aliciaUnion", handle: "unionmother", minutesAgo: 20160, content: "Eleventh shift, no relief, and they keep telling the loom-hands the quota is 'the Crown's will.' The Crown has never once threaded a needle. Organizing at the third bell. Bring your own tea. #ScribesUnion" },
  { key: "grandReplyAlicia", handle: "grandarchivist", minutesAgo: 20100, replyTo: "aliciaUnion", content: "@unionmother The third bell, then. I can't be seen on your side of the Ascent, so I won't be. But the quota sheets that 'went missing' did not get up and walk off on their own. I am not winking. You can't see me. #RootsOfLoquat" },

  // --- Session 1: the Festival of Falling Stars (Narrator self-thread) ---
  { key: "t1", handle: "thequill", minutesAgo: 20000, content: "The Festival of Falling Stars opens in Benz. Lanterns on the water, a sacred calf just born, eight strangers who have never met. Soak in the quiet. I am legally required to tell you it does not last. (thread) #FallingStars" },
  { key: "t2", handle: "thequill", minutesAgo: 19990, replyTo: "t1", content: "The sky splits at the worst possible moment, as skies do. A shard of the dying Weeping Star drops into the crowd and shatters into eight. Each piece picks a host. Nobody filled out a consent form." },
  { key: "t3", handle: "thequill", minutesAgo: 19980, replyTo: "t2", content: "Then things crawl out of the light, the Thorns arrive a heartbeat later, and somehow the people getting blamed are the strangers holding glowing rocks. A tale as old as time, this part." },
  { key: "t4", handle: "thequill", minutesAgo: 19970, replyTo: "t3", content: "All eight hear the same voice at once: 'Find the others before she does.' Deeply ominous. Zero further instructions. So they run. They are, to this day, still running. #FindTheOthers" },

  { key: "kirillFestival", handle: "verdantpilgrim", minutesAgo: 19900, imageUrl: img("benz-calf"), content: "BENZ SMELLS INCREDIBLE. River lilies, fried dough, and the sacred calf is HERE, she is REAL, and she blinked at me. I have cried twice. I will guard her with my whole body. #FallingStars" },
  { key: "clekeFirst", handle: "blindpilot", minutesAgo: 19880, content: "Woke up with feathers, a blindfold, no memory, at a festival, holding a glowing rock, being chased. Solid 2 out of 10 morning. My hands keep reaching for controls that aren't there. Controls for what? No idea. Love that for me." },
  { key: "spadaeFirstTime", handle: "courtescapee", minutesAgo: 19850, content: "First time outside the Caelrosa court walls and the SKY ATTACKED US. Is that normal out here? Does the sky just do that? @verdantpilgrim you seem weirdly calm, please teach me your ways. #IsThisNormal" },
  { key: "laylaWakes", handle: "byprocedure", minutesAgo: 19800, content: "Day 21 in someone else's body, with a SubCaptain's rank and no memory of how I died (the file is REDACTED, to ME). No incident-report process. No onboarding. This org chart is a crime scene. #Reincorporated" },
  { key: "dezFest", handle: "spysson", minutesAgo: 19780, content: "Great festival. Glowing space rock now fused to my chest, wanted for treason by sundown, stuck with seven strangers. My mother is going to have notes. So many notes." },
  { key: "boostKirillT1", handle: "verdantpilgrim", minutesAgo: 19000, quoteOf: "t1", content: "" },
  { key: "valShard", handle: "steadyhand", minutesAgo: 18000, content: "Everyone keeps asking what the shard feels like. Feels like a splinter you can't dig out that sometimes whispers. So: a splinter. Moving on. I've got family in Blackthorn to get back to." },

  // --- Sessions 2-3: Loquat, the Roots, the Envisionarium ---
  { key: "vesperaeCreed", handle: "seesomethingdo", minutesAgo: 16000, content: "Quit the Canopy a year and a half ago and I do not miss the view. From up there you can't see the people you're standing on. See something, do something. @grandarchivist taught me that. He will deny it. Watch." },
  { key: "corbinReplyVesperae", handle: "grandarchivist", minutesAgo: 15990, replyTo: "vesperaeCreed", content: "@seesomethingdo I taught you no such thing, and I'll say so in any Canopy room you name. Quietly: you were always going to be braver than me. Loudly: who is this person, I have never met her. Stay alive." },
  { key: "valRescue", handle: "steadyhand", minutesAgo: 15900, content: "A year and a half ago a beast left me for dead in a forest. A stranger I'd never met hauled me out on her back and asked for nothing. I've trusted exactly one person on sight since. Hi @seesomethingdo." },
  { key: "vesperaeReplyVal", handle: "seesomethingdo", minutesAgo: 15880, replyTo: "valRescue", content: "@steadyhand You were heavier than you looked and you owe me nothing, so stop telling people you owe me. (He is going to keep telling people. I have made my peace with it.)" },
  { key: "boostVesAlicia", handle: "seesomethingdo", minutesAgo: 15500, quoteOf: "aliciaUnion", content: "" },
  { key: "dezArgument", handle: "spysson", minutesAgo: 14400, content: "PSA: the screaming match my mother and I had in the Envisionarium was 100% theatre for whatever Thorn was eavesdropping. I love her. I would say worse to her face and mean none of it. @unionmother" },
  { key: "aliciaReplyDez", handle: "unionmother", minutesAgo: 14380, replyTo: "dezArgument", content: "@spysson You'd say worse because I RAISED you to. Say it loud, say it true, duck after. Your father drew off a whole patrol so you could grow up with a mouth like that. Use it. And eat a vegetable." },
  { key: "dezQuoteAlicia", handle: "spysson", minutesAgo: 13000, quoteOf: "aliciaUnion", content: "That's my mother. The Crown took my father for loving her across a border that wasn't supposed to bend. She's spent every year since bending Loquat right back. Do NOT @ me about nobility today." },
  { key: "kirillBlueprints", handle: "verdantpilgrim", minutesAgo: 14350, content: "Update: I have never stolen so much as a grape, and today I lifted a god-surveillance blueprint out from under an actual psychic in a willow mask. I feel SICK. I would do it again right now. @willowmask did not even blink, and honestly, same." },
  { key: "nettleDeal", handle: "willowmask", minutesAgo: 14300, content: "An open offer to the festival children reading this: the shards for your freedom. No theatrics, no mask between us. You said no once. I have eternity and excellent patience, and I'm closer than your last exhale." },
  { key: "clekeReplyNettle", handle: "blindpilot", minutesAgo: 14280, replyTo: "nettleDeal", content: "@willowmask buddy. pal. the mask IS the theatrics. you have to workshop the pitch." },
  { key: "boostRootsNettle", handle: "thequeensroots", minutesAgo: 14290, quoteOf: "nettleDeal", content: "" },

  // --- Sessions 4-5: the Canopy, the Grand Archives, the Ledger ---
  { key: "calantheArt", handle: "artiststruggle", minutesAgo: 11000, imageUrl: img("orchid-horse"), content: "Finished a new piece. They say a true Orchidaceae can paint the soul. Behold: a soul. (It's a horse. I'm aware it's a horse. The soul is INSIDE the horse.) Five years of Florescence and I've never been more sure. #ArtistStruggle" },
  { key: "dezQuoteArt", handle: "spysson", minutesAgo: 10900, quoteOf: "calantheArt", content: "this is a horse" },
  { key: "spadaeReplyArt", handle: "courtescapee", minutesAgo: 10880, replyTo: "calantheArt", content: "@artiststruggle I think it's beautiful! What kind of animal is it?" },
  { key: "calantheReplySpadae", handle: "artiststruggle", minutesAgo: 10860, replyTo: "spadaeReplyArt", content: "@courtescapee IT IS A HORSE, SPADAE. Clearly. Obviously. A horse. You know what, you are both uninvited to my gallery opening." },
  { key: "elaraLedger", handle: "themurmuration", minutesAgo: 10000, content: "A certain Census changed hands in the dark and didn't notice the swap until the alarm went off. The Birds thank a certain light-fingered guest. Safe passage was the least we owed. Fly low. #TheMurmuration" },
  { key: "corbinWarn", handle: "grandarchivist", minutesAgo: 9800, content: "To my houseguests: the main host arrives at midnight and is NOT bringing a casserole. Take the Canopy road, take the papers, skip the scenic route. This is the last favor I can do with the lights on." },
  { key: "vesperaeQuoteCorbin", handle: "seesomethingdo", minutesAgo: 9700, quoteOf: "corbinWarn", content: "My father. Doing the bravest thing he knows how to do: a warning, sideways, with plausible deniability stapled to it. I love him. I left so I'd never have to add the stapling part." },
  { key: "laylaArchives", handle: "byprocedure", minutesAgo: 9600, content: "Found the org chart I actually wanted. Three operations, three towns, three gods filed like office supplies. Cinquefoil. Medlar. Blackthorn. Somebody is running LOGISTICS on the divine and I need to see their spreadsheet so badly it hurts." },
  { key: "clekeLayla", handle: "blindpilot", minutesAgo: 9580, replyTo: "laylaArchives", content: "@byprocedure you're from one of these too, aren't you. it's the way you said 'spreadsheet.' takes one to know one. what was your last job before the dying-and-waking-up-as-a-fantasy-cop thing" },
  { key: "laylaReplyCleke", handle: "byprocedure", minutesAgo: 9560, replyTo: "clekeLayla", content: "@blindpilot Middle management. You? And yes, before you ask, I already tried to file an incident report about the entire Queendom. The form does not exist. So I'm building the form." },
  { key: "kirillAurora", handle: "verdantpilgrim", minutesAgo: 8000, imageUrl: img("aurora-calf"), content: "Aurora update for everyone asking (nobody asked, telling you anyway): she's eating, she's glowing a little, and she let me braid flowers into her tail today. Best assignment in the world. Will protect with violence, then apologize for the violence, then protect again." },

  // --- Session 6: the road, Gallowfen, Posy, the Levy ---
  { key: "narratorRoad", handle: "thequill", minutesAgo: 5800, content: "The road to Blackthorn runs long and grey. A shrine slides past unvisited (rude). A Thorn checkpoint waves them through (suspicious). And Gallowfen waits ahead, storefronts hollow, no young men anywhere. Read that last part twice." },
  { key: "valStall", handle: "steadyhand", minutesAgo: 5700, imageUrl: img("gallowfen-stall"), content: "Set up a meat stall in a town too quiet to be alive. For one afternoon Gallowfen had NOISE again. People came out of their houses just to stand near it. Can't stop thinking about that part. Sold out too." },
  { key: "spadaeStall", handle: "courtescapee", minutesAgo: 5690, replyTo: "valStall", content: "@steadyhand I have never sold anything in my entire life and you handed me a cleaver and said 'don't lose a finger.' I did not lose a finger. New personal best. Possibly my proudest day." },
  { key: "posyDream", handle: "thequill", minutesAgo: 5500, imageUrl: img("red-flower"), content: "A girl named Posy sleeps a sleep with no floor. The shards wake her for one bright minute. She says: a great red flower, no time passing, one long unbroken night. Then she's gone again. Everyone remember the red flower. There will be a quiz." },
  { key: "boostSpadaePosy", handle: "courtescapee", minutesAgo: 5400, quoteOf: "posyDream", content: "" },
  { key: "spadaeLevy", handle: "courtescapee", minutesAgo: 5300, content: "Watched a Levy take people tonight the way you'd take firewood. We stood in a doorway and didn't move. I keep telling myself we couldn't have. Not sleeping great. Court did not prepare me for this one. #TheLevy" },
  { key: "caravanRumor", handle: "spysson", minutesAgo: 5200, content: "Local intel: a caravan rolled through Gallowfen from the Capital a month or two back. Nobody can say who, nobody can say why. In my professional experience, 'nobody can say' means somebody got paid to forget. #TheLevy" },
  { key: "laylaQuoteQueen", handle: "byprocedure", minutesAgo: 5100, quoteOf: "queenProclaim", content: "'You're welcome.' Three centuries of peace and a kid in Gallowfen is asleep under a red flower she can't wake up from. Show me the line item where that's the cost of welcome. I'll wait. I have a form for this." },
  { key: "pollPost", handle: "thequill", minutesAgo: 4800, poll: { options: ["Cinquefoil: Alithiel", "Medlar: Aeolus", "Blackthorn: Valerius", "Just follow the red flower"], days: 3 }, content: "The shards are pulling three ways at once, which is two too many. Where to next, friends? I cannot tell you the answer (contractually) but I can absolutely count your votes. #ShardBound" },

  // --- Session 7: Blackthorn ---
  { key: "valGates", handle: "steadyhand", minutesAgo: 3000, content: "Walked back into Blackthorn under a fake name and the gate officer who's known me since I was knee-high looked straight through me. Can't tell if the disguise is that good or the town just forgot its own. Either way. Home, I guess." },
  { key: "valFamily", handle: "steadyhand", minutesAgo: 2900, content: "Father and Rue, both taken in the same Levy. Crown Works Installation Seven. My mother set out three bowls tonight out of habit, then sat there looking at them. I'm getting them back. All three bowls full. @captainbriar, you've got their names on file." },
  { key: "briarReplyVal", handle: "captainbriar", minutesAgo: 2880, replyTo: "valFamily", content: "@steadyhand The Crown does not discuss personnel assignments with civilians. If you have a grievance, there is a process. (There is not a process.) Move along, citizen." },
  { key: "laylaReplyBriarVal", handle: "byprocedure", minutesAgo: 2870, replyTo: "briarReplyVal", content: "@captainbriar 'there is a process' followed immediately by no process is the single most honest thing the Crown has ever posted. Screenshotting this for the complaints form. You're exhibit one." },
  { key: "cassimirWalls", handle: "thewallspeaks", minutesAgo: 2700, imageUrl: img("blackthorn-walls"), content: "The writing on the walls started the DAY my brother died. You can call that grief. I call it a letter I'm not done reading. Theron is still talking. Zoom in on the third brick. ZOOM IN. #WallWritings" },
  { key: "dezQuoteCassimir", handle: "spysson", minutesAgo: 2690, quoteOf: "cassimirWalls", content: "I zoomed in on the third brick. It's a brick." },
  { key: "valReplyCassimir", handle: "steadyhand", minutesAgo: 2650, replyTo: "cassimirWalls", content: "@thewallspeaks Grew up three streets from that wall. Folks down here have read messages in the brickwork since before your brother could walk. Doesn't make you wrong. Prove me wrong: find the hand that's writing them. I'll bring a lantern." },
  { key: "kirillReplyCassimir", handle: "verdantpilgrim", minutesAgo: 2640, replyTo: "cassimirWalls", content: "@thewallspeaks I believe you AND I think you should sleep. Both can be true. Bringing soup. We can read the wall after soup." },
  { key: "pollCass", handle: "thewallspeaks", minutesAgo: 2600, poll: { options: ["My brother, obviously", "A hoax", "Something so much worse", "I don't want to know"], days: 2 }, content: "Fine. Settle it for me. The writing covering every wall in Blackthorn is, be honest: #WallWritings" },
  { key: "calantheSable", handle: "artiststruggle", minutesAgo: 2500, content: "Saw a woman watching the lord's son from a rooftop, perfectly still, and then she just wasn't there. @courtescapee saw her too. Tell me we both saw her and I'm not having an artist's breakdown. @whoswatching, I assume that's your whole brand." },
  { key: "spadaeReplyCalanthe", handle: "courtescapee", minutesAgo: 2450, replyTo: "calantheSable", content: "@artiststruggle We both saw her. So either we're both losing it or neither of us is, and doing it together is somehow comforting. Court never covered 'the rooftop is looking back at you.'" },
  { key: "sableReplyCalanthe", handle: "whoswatching", minutesAgo: 2440, replyTo: "calantheSable", content: "@artiststruggle You weren't supposed to see me. Take it as a compliment to your eyes and an insult to my week." },
  { key: "aetherIntel", handle: "verdantpilgrim", minutesAgo: 2400, content: "Overheard at The Common Room: the Aether Golem 'demonstration' is in three days, town square, big crowd expected. Everyone's so excited. I've seen the binding-cloth they've got it wrapped in. I don't think that's a machine they're about to wake up. I don't like this at all." },
  { key: "cassimirLord", handle: "thewallspeaks", minutesAgo: 2200, content: "He called me 'my son' tonight. Used the voice he saves for Theron. First time since the funeral. I should feel chosen. I feel like an understudy who finally got handed the lines. @steadyhand @verdantpilgrim, you two are the only ones taking the walls seriously. Please don't make me regret it." },
  { key: "kirillReplyCassimirLord", handle: "verdantpilgrim", minutesAgo: 2100, replyTo: "cassimirLord", content: "@thewallspeaks I take the walls seriously AND I take you seriously, separate from the walls. A letter that costs you this much is worth finishing. Just don't let a ghost spend you down to nothing. Soup's still warm." },

  // --- recent chatter / relationships, running bits ---
  { key: "aeneasReturn", handle: "nightshadebeau", minutesAgo: 1800, content: "Funny how the world rewrites a rescue into a crime. I pulled Calanthe out of a very bad situation and got branded for my trouble. The Potentilla name only matters when there's blame to hand out, apparently. @artiststruggle, we should talk." },
  { key: "calantheReplyAeneas", handle: "artiststruggle", minutesAgo: 1750, replyTo: "aeneasReturn", content: "@nightshadebeau We have nothing to say that a witness shouldn't hear. You didn't pull me out of anything. You arranged the river, handed me a rope, then billed me for the rope. I dance now. I don't need a hero. I need you blocked." },
  { key: "vesperaeReplyAeneas", handle: "seesomethingdo", minutesAgo: 1745, replyTo: "aeneasReturn", content: "@nightshadebeau I work outside the system to catch exactly the kind of man who stages a rescue for a dowry. Filing your name for later. See something, do something. You're the something." },
  { key: "aeneasReplyVesperae", handle: "nightshadebeau", minutesAgo: 1730, replyTo: "vesperaeReplyAeneas", content: "@seesomethingdo You people are so dramatic. It was a calculated risk with a clear return on investment. She was supposed to be grateful. None of you understand high finance." },
  { key: "dezQuoteAeneas", handle: "spysson", minutesAgo: 1720, quoteOf: "aeneasReturn", content: "imagine staging a kidnapping for the dowry and then posting through the fallout. couldn't be me. couldn't be you either, @nightshadebeau, allegedly, except it absolutely was." },
  { key: "clekeMemory", handle: "blindpilot", minutesAgo: 1600, content: "Flew something once. My hands know a cockpit my head can't name. These feathers say I'm trusted; I can't remember earning a single one of them. @featherbond, who was I before the sky took the rest?" },
  { key: "aliceSponsor", handle: "featherbond", minutesAgo: 1550, replyTo: "clekeMemory", content: "@blindpilot You were a man who kept his word in a storm. The feathers don't lie, child, even when memory does. You earn them again every day you choose to wear them. The clan remembers for you until you can. Now eat." },
  { key: "featherbondWatch", handle: "featherbond", minutesAgo: 1450, content: "Today I watched a young man reach for controls that weren't there, a young noble flinch at an open sky, and a girl insist a horse was a soul. The high reaches teach patience. You are all going to need so much of it. @blindpilot, breathe." },
  { key: "calantheReplyAlice", handle: "artiststruggle", minutesAgo: 1440, replyTo: "featherbondWatch", content: "@featherbond THANK you, finally, someone with taste. The horse DOES have a soul. (Wait. Were you being nice about it, or)" },
  { key: "edmundDefect", handle: "thedefector", minutesAgo: 1500, content: "I was sent to put a knife in the one person who's spent her whole life keeping knives out of other people. Chose her name over her blood instead. The Vanes pay their debts. @themurmuration, still the best bad decision I ever made." },
  { key: "elaraQuoteEdmund", handle: "themurmuration", minutesAgo: 1490, quoteOf: "edmundDefect", content: "He came to kill me and stayed to outlive his orders. The Birds don't recruit the loyal. We recruit the ones who finally choose. Welcome home, Edmund. You're on dish duty." },
  { key: "queenSeclusion", handle: "thegildedcrown", minutesAgo: 1400, content: "Your Queen is withdrawing a while to tend a long garden. Do not confuse the quiet with absence, darlings. The roots go deeper than you will ever dig. Water yourselves while I'm away. 🌹" },
  { key: "thornsNotice", handle: "thequeensthorns", minutesAgo: 1300, content: "The Thorns are RECRUITING in Blackthorn! The Levy is just mercy with a deadline. Serve the Crown and the Crown remembers you. Refuse, and, well, the Crown remembers that too! Smile, citizen. 🌹 #ServeWithPride" },
  { key: "valQuoteThorns", handle: "steadyhand", minutesAgo: 1290, quoteOf: "thornsNotice", content: "this is the account that took my father and sister, and it uses a flower emoji. i have never wanted to put my fist through a poster this badly, and it's a POSTER." },
  { key: "byprocedureReplyThorns", handle: "byprocedure", minutesAgo: 1280, replyTo: "thornsNotice", content: "@thequeensthorns 'mercy with a deadline' is the most evil sentence I've read since I got here, and I read this Queendom's actual org chart. who writes your copy. i want to file a complaint about them specifically." },
  { key: "briarOrder", handle: "captainbriar", minutesAgo: 1200, content: "Deserter sweeps on the Blackthorn road are doubled effective today. Clean papers, nothing to fear. Dirty papers, run faster. We keep the peace one example at a time, and we do love a good example." },
  { key: "boostThornsBriar", handle: "thequeensthorns", minutesAgo: 1190, quoteOf: "briarOrder", content: "" },
  { key: "edmundReplyBriar", handle: "thedefector", minutesAgo: 1180, replyTo: "briarOrder", content: "@captainbriar I used to write reports this confident. Right up until the morning I switched which side the confidence worked for. 'Clean papers.' Sure, captain. I forged half the clean papers in this city. Sleep tight." },
  { key: "nettleReplyBriar", handle: "willowmask", minutesAgo: 1170, replyTo: "briarOrder", content: "@captainbriar Examples are loud. I prefer the quiet method. By the time you make an example of someone, I already know what they dreamed last night. Stay in your lane, captain. I'm in everyone's." },
  { key: "vesperaeBlackthorn", handle: "seesomethingdo", minutesAgo: 1000, content: "Blackthorn is the worst thing I've seen, and I grew up watching Loquat eat its own. The difference is here they've stopped pretending the people are anything but fuel. We are not leaving until that sentence isn't true. Mark it." },
  { key: "valQuoteVesperae", handle: "steadyhand", minutesAgo: 990, quoteOf: "vesperaeBlackthorn", content: "Whatever she decides, that's the direction I'm walking. She found me dying and didn't ask my name first. Not many people in this country can say they've never once made me earn their kindness. She's one of them." },
  { key: "valReplyVesperae", handle: "steadyhand", minutesAgo: 950, replyTo: "vesperaeBlackthorn", content: "@seesomethingdo Then we make it not true. You carried me out of a forest once for nothing. I've got a debt and a list of names in Installation Seven. Point me at the wall and step back." },
  { key: "laylaQueen", handle: "byprocedure", minutesAgo: 900, content: "I used to think the Queen was just administration. A very old manager running very old policy. Now I think the policy IS her, all the way down, which is so much worse. @thegildedcrown what ARE you. This is a genuine HR question." },
  { key: "queenReplyLayla", handle: "thegildedcrown", minutesAgo: 880, replyTo: "laylaQueen", content: "@byprocedure A SubCaptain with questions. How precious. I have outlived every clever soul who finished that sentence, darling. Tend your post. The garden always has room for one more root, and you would compost beautifully." },
  { key: "elaraReplyLayla", handle: "themurmuration", minutesAgo: 870, replyTo: "laylaQueen", content: "@byprocedure Careful asking that one out loud. I asked once, from closer than anyone ever stood. Still looking for the answer, and for the piece of her that used to know my name. She hears questions. She's listening to this one." },
  { key: "rootsWatch", handle: "thequeensroots", minutesAgo: 800, content: "The Roots do not announce themselves. Consider this the exception. Three subjects of interest have entered Blackthorn. We are never in a hurry. We don't even follow you back. (We are already following you.)" },
  { key: "clekeReplyRoots", handle: "blindpilot", minutesAgo: 790, replyTo: "rootsWatch", content: "@thequeensroots 'we don't announce ourselves' posted from the announcements account. incredible. genuinely some of the operational security of all time." },
  { key: "unionmotherWatch", handle: "unionmother", minutesAgo: 600, content: "Heard the festival kids are causing problems for the Crown three towns over. Good. Loquat's loom-hands stand with anyone who makes that flower-emoji account nervous. Solidarity travels. So does my soup recipe, ask @verdantpilgrim. #ScribesUnion" },
  { key: "kirillReplyAlicia", handle: "verdantpilgrim", minutesAgo: 580, replyTo: "unionmotherWatch", content: "@unionmother THE SOUP RECIPE. I have made it for everyone in this party whether they asked or not. @thewallspeaks got soup. @steadyhand got soup. Solidarity tastes like leeks. Thank you for raising a son who heckles cops, we love @spysson." },
  { key: "dezReplySoup", handle: "spysson", minutesAgo: 575, replyTo: "kirillReplyAlicia", content: "@verdantpilgrim do not drag my mother into your soup propaganda. (the soup is good. the soup is genuinely good. tell absolutely no one I said that.)" },
  { key: "sableReveal", handle: "whoswatching", minutesAgo: 700, content: "@artiststruggle You both saw me on purpose, in the end. Watch the lord's son, not the watcher. There's a letter UNDER the wall-writing, and it is not from a dead brother. Find me before the demonstration. Come alone or don't. Doesn't change the letter." },
  { key: "cassimirQuoteSable", handle: "thewallspeaks", minutesAgo: 690, quoteOf: "sableReveal", content: "A letter under the writing that ISN'T from Theron. I want to call you a liar more than I've ever wanted anything. So why does part of me already believe you. @whoswatching what did you see." },
  { key: "kirillGuardian", handle: "verdantpilgrim", minutesAgo: 500, content: "Found out today the accord my clan signed might not 'pass the calf forward' to any sanctuary at all. If someone has put a PRICE on Aurora, there is no waste in this world I despise more than that one. @thequeensroots, care to comment. I'll wait. I'm very patient when I'm furious." },
  { key: "clekeReplyKirill", handle: "blindpilot", minutesAgo: 480, replyTo: "kirillGuardian", content: "@verdantpilgrim if they slapped a price tag on something you swore to protect, that's not an accord, that's a receipt. I don't remember much, but I remember exactly what getting sold out feels like. I'll fly her out myself. I clearly know how to fly. Probably." },
  { key: "rootsReplyKirill", handle: "thequeensroots", minutesAgo: 470, replyTo: "kirillGuardian", content: "@verdantpilgrim We don't comment. (We are commenting.) The calf is an asset of the Crown. So, increasingly, are you. Patience is a Root specialty. We'll see whose runs out first." },

  // --- scheduled reveals (future, not yet visible / not notifying) ---
  { key: "schedNarrator", handle: "thequill", scheduledInMin: 2880, content: "Next: the square fills, the cloth comes off the Golem, and somewhere a sleeping girl dreams of a red flower opening its first petal. Session 8 starts when you do. Bring courage. Bring snacks. Mostly snacks. #ShardBound" },
  { key: "schedDemo", handle: "thequeensthorns", scheduledInMin: 4320, content: "PUBLIC NOTICE: the Aether Golem unveils in Blackthorn square in three days. Attendance encouraged! Absence noted! The Crown's newest guardian wakes FOR you. Bring the whole family. Especially the family. 🌹 #ServeWithPride" },

  // --- drafts (never published, never notify) ---
  { key: "draftLayla", handle: "byprocedure", draft: true, content: "(draft, not posting yet) Full brief on the Levy quotas: names, dates, the caravan manifest nobody will admit exists. The second I post this I can't unpost it, and they'll know I can read a spreadsheet. One more source. Then it goes up." },
  { key: "draftVesperae", handle: "seesomethingdo", draft: true, content: "(draft) The thing I actually want to say to every Canopy scholar who ever taught me the word 'efficiency.' Saving it for the day it costs them something instead of me." },
  { key: "draftCalanthe", handle: "artiststruggle", draft: true, content: "(draft) gallery opening invite list. removed: Spadae. removed: Dez. re-added Spadae, he meant well. Dez stays removed. the horse stays. the horse is the centerpiece." },
];

// posts a persona pins to its profile (published posts only)
const PINNED: Record<string, string> = {
  thequill: "t1",
  thegildedcrown: "queenProclaim",
  grandarchivist: "corbinRoots",
  unionmother: "aliciaUnion",
  nightshadebeau: "aeneasReturn",
  featherbond: "aliceSponsor",
  thewallspeaks: "cassimirWalls",
  thedefector: "edmundDefect",
  themurmuration: "elaraLedger",
  captainbriar: "briarOrder",
  willowmask: "nettleDeal",
  whoswatching: "sableReveal",
  thequeensthorns: "thornsNotice",
  thequeensroots: "rootsWatch",
  artiststruggle: "calantheArt",
  blindpilot: "clekeMemory",
  spysson: "dezQuoteAlicia",
  verdantpilgrim: "kirillAurora",
  byprocedure: "laylaArchives",
  courtescapee: "spadaeLevy",
  steadyhand: "valFamily",
  seesomethingdo: "vesperaeBlackthorn",
};

// likes: [postKey, [liker handles]] (published posts only)
const LIKES: [string, string[]][] = [
  ["queenProclaim", ["captainbriar", "thequeensthorns", "nightshadebeau", "willowmask"]],
  ["aliciaUnion", ["spysson", "seesomethingdo", "grandarchivist", "steadyhand", "verdantpilgrim"]],
  ["t1", ["verdantpilgrim", "artiststruggle", "courtescapee", "blindpilot", "steadyhand"]],
  ["t4", ["byprocedure", "seesomethingdo", "spysson", "themurmuration"]],
  ["kirillFestival", ["courtescapee", "featherbond", "steadyhand", "artiststruggle", "blindpilot"]],
  ["clekeFirst", ["byprocedure", "spysson", "courtescapee", "steadyhand"]],
  ["laylaWakes", ["spysson", "blindpilot", "seesomethingdo", "courtescapee"]],
  ["dezFest", ["steadyhand", "byprocedure", "artiststruggle", "blindpilot"]],
  ["valRescue", ["seesomethingdo", "verdantpilgrim", "blindpilot", "featherbond"]],
  ["vesperaeReplyVal", ["steadyhand", "verdantpilgrim", "spysson"]],
  ["dezQuoteAlicia", ["seesomethingdo", "steadyhand", "byprocedure", "verdantpilgrim"]],
  ["aliciaReplyDez", ["spysson", "seesomethingdo", "verdantpilgrim", "steadyhand"]],
  ["kirillBlueprints", ["spysson", "seesomethingdo", "steadyhand", "themurmuration", "blindpilot"]],
  ["clekeReplyNettle", ["spysson", "byprocedure", "steadyhand", "artiststruggle", "courtescapee"]],
  ["calantheArt", ["courtescapee", "verdantpilgrim", "blindpilot", "nightshadebeau", "featherbond"]],
  ["dezQuoteArt", ["blindpilot", "byprocedure", "steadyhand", "courtescapee"]],
  ["elaraLedger", ["thedefector", "seesomethingdo", "spysson", "byprocedure"]],
  ["corbinWarn", ["seesomethingdo", "steadyhand", "themurmuration", "byprocedure"]],
  ["laylaArchives", ["themurmuration", "seesomethingdo", "spysson", "thequeensroots", "blindpilot"]],
  ["laylaReplyCleke", ["blindpilot", "spysson", "seesomethingdo", "courtescapee"]],
  ["kirillAurora", ["artiststruggle", "courtescapee", "seesomethingdo", "steadyhand", "featherbond", "blindpilot"]],
  ["posyDream", ["verdantpilgrim", "steadyhand", "courtescapee", "artiststruggle", "blindpilot"]],
  ["valStall", ["seesomethingdo", "verdantpilgrim", "courtescapee", "spysson"]],
  ["laylaQuoteQueen", ["seesomethingdo", "spysson", "steadyhand", "themurmuration"]],
  ["valFamily", ["seesomethingdo", "verdantpilgrim", "byprocedure", "blindpilot", "courtescapee"]],
  ["laylaReplyBriarVal", ["steadyhand", "seesomethingdo", "spysson", "thedefector", "blindpilot"]],
  ["cassimirWalls", ["steadyhand", "verdantpilgrim", "artiststruggle", "courtescapee", "whoswatching"]],
  ["dezQuoteCassimir", ["blindpilot", "byprocedure", "steadyhand", "courtescapee"]],
  ["calantheSable", ["courtescapee", "thewallspeaks", "whoswatching", "spysson"]],
  ["valQuoteThorns", ["seesomethingdo", "spysson", "verdantpilgrim", "byprocedure", "unionmother"]],
  ["byprocedureReplyThorns", ["steadyhand", "spysson", "seesomethingdo", "thedefector", "blindpilot"]],
  ["edmundReplyBriar", ["byprocedure", "seesomethingdo", "themurmuration", "steadyhand"]],
  ["nettleReplyBriar", ["whoswatching", "thequeensroots"]],
  ["vesperaeBlackthorn", ["steadyhand", "spysson", "byprocedure", "verdantpilgrim", "courtescapee"]],
  ["queenReplyLayla", ["willowmask", "captainbriar", "nightshadebeau"]],
  ["clekeReplyRoots", ["spysson", "byprocedure", "steadyhand", "artiststruggle", "courtescapee"]],
  ["sableReveal", ["thewallspeaks", "artiststruggle", "courtescapee", "byprocedure"]],
  ["kirillGuardian", ["blindpilot", "seesomethingdo", "steadyhand", "artiststruggle", "unionmother"]],
  ["unionmotherWatch", ["verdantpilgrim", "spysson", "seesomethingdo", "steadyhand"]],
  ["kirillReplyAlicia", ["unionmother", "spysson", "steadyhand", "thewallspeaks", "seesomethingdo"]],
  ["aeneasReplyVesperae", ["seesomethingdo", "spysson", "artiststruggle", "byprocedure"]],
];

// private bookmarks: [handle, postKey] (not counted as interactions)
const BOOKMARKS: [string, string][] = [
  ["byprocedure", "queenProclaim"],
  ["themurmuration", "laylaArchives"],
  ["seesomethingdo", "corbinWarn"],
  ["steadyhand", "cassimirWalls"],
  ["spysson", "aliciaUnion"],
  ["courtescapee", "sableReveal"],
  ["verdantpilgrim", "posyDream"],
  ["willowmask", "kirillBlueprints"],
  ["captainbriar", "valFamily"],
  ["thequeensroots", "aetherIntel"],
  ["byprocedure", "caravanRumor"],
];

// poll votes: [handle, optionIdx]
const POLL_VOTES: Record<string, [string, number][]> = {
  pollPost: [
    ["steadyhand", 2], ["seesomethingdo", 2], ["verdantpilgrim", 3], ["artiststruggle", 0],
    ["blindpilot", 3], ["spysson", 2], ["byprocedure", 2], ["courtescapee", 0],
    ["themurmuration", 1], ["unionmother", 2], ["thedefector", 1], ["captainbriar", 2],
    ["willowmask", 3], ["featherbond", 3],
  ],
  pollCass: [
    ["steadyhand", 2], ["verdantpilgrim", 0], ["artiststruggle", 2], ["courtescapee", 3],
    ["whoswatching", 2], ["seesomethingdo", 1], ["byprocedure", 1], ["spysson", 3],
    ["blindpilot", 0], ["captainbriar", 1],
  ],
};

// follow notifications to create (the follow rows themselves are the complete
// graph below; these are the subset that ping someone). [actor, recipient]
const FOLLOW_NOTIFS: [string, string][] = [
  ["willowmask", "steadyhand"], ["willowmask", "seesomethingdo"], ["willowmask", "artiststruggle"],
  ["willowmask", "verdantpilgrim"], ["willowmask", "byprocedure"], ["willowmask", "blindpilot"],
  ["willowmask", "spysson"], ["willowmask", "courtescapee"],
  ["thequeensthorns", "steadyhand"], ["thequeensthorns", "verdantpilgrim"],
  ["thegildedcrown", "byprocedure"], ["captainbriar", "steadyhand"],
  ["whoswatching", "thewallspeaks"], ["whoswatching", "artiststruggle"],
  ["seesomethingdo", "steadyhand"], ["steadyhand", "seesomethingdo"],
  ["unionmother", "spysson"], ["spysson", "unionmother"],
  ["featherbond", "blindpilot"], ["grandarchivist", "seesomethingdo"],
  ["themurmuration", "thedefector"], ["thequill", "steadyhand"],
];

async function main() {
  console.log("Seeding the Thornfeed demo campaign…");

  // --- idempotent, SCOPED cleanup: this campaign (cascades) + only our users ---
  const existing = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.slug, SLUG));
  if (existing.length) {
    await db.delete(campaigns).where(eq(campaigns.slug, SLUG));
  }
  await db.delete(users).where(inArray(users.usernameLower, OWNER_KEYS.map(uname)));

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // --- users (one login per owner key, all "tf_"-prefixed) ---
  const userRows = await db
    .insert(users)
    .values(OWNER_KEYS.map((k) => ({ username: uname(k), usernameLower: uname(k), passwordHash })))
    .returning({ id: users.id, usernameLower: users.usernameLower });
  const userId = (k: OwnerKey) => userRows.find((r) => r.usernameLower === uname(k))!.id;

  // --- campaign (Bloomr theme, kept intact but re-wordmarked to "Thornfeed") ---
  const inviteCode = generateInviteCode();
  const [campaign] = await db
    .insert(campaigns)
    .values({
      slug: SLUG,
      name: "Thornfeed",
      description: "The shared feed of the Star-Fallen and the Queendom that hunts them.",
      theme: { ...BLOOMR_THEME, appName: "Thornfeed", tagline: "Every bloom has its thorn." },
      inviteCode,
      createdByUserId: userId("dm"),
    })
    .returning({ id: campaigns.id });
  const cid = campaign.id;

  // --- memberships (DM + 8 players) ---
  await db.insert(memberships).values(
    OWNER_KEYS.map((k) => ({
      userId: userId(k),
      campaignId: cid,
      role: (k === "dm" ? "dm" : "player") as "dm" | "player",
    })),
  );

  // --- personas ---
  const personaRows = await db
    .insert(personas)
    .values(
      personaSeeds.map((s) => ({
        campaignId: cid,
        ownerUserId: userId(s.owner),
        handle: s.handle,
        handleLower: s.handle.toLowerCase(),
        displayName: s.displayName,
        bio: s.bio,
        isNpc: s.isNpc,
        avatarFrame: s.frame,
        avatarUrl: `https://picsum.photos/seed/${s.handle}-av/200/200`,
        bannerUrl: s.banner ? `https://picsum.photos/seed/${s.handle}-bn/1200/400` : null,
      })),
    )
    .returning({ id: personas.id, handleLower: personas.handleLower });

  const pid = new Map(personaRows.map((r) => [r.handleLower, r.id]));
  const P = (h: string) => pid.get(h.toLowerCase())!;
  const allHandles = personaSeeds.map((s) => s.handle);
  const knownHandles = new Set(allHandles.map((h) => h.toLowerCase()));

  // set each owner's acting persona
  for (const k of OWNER_KEYS) {
    await db
      .update(memberships)
      .set({ actingPersonaId: P(ACTING[k]) })
      .where(eq(memberships.userId, userId(k)));
  }

  // --- decorations: a shared campaign default + one player's personal pick ---
  const worldSpec: DecorationSpec = {
    overrides: { texture: "vinework", bgScroll: "sway", effects: ["leaves", "pollen"] },
  };
  const personalSpec: DecorationSpec = {
    overrides: { depth: "roseGlow", reactions: "bloom", cardFrame: "pressed" },
  };
  const [worldDeco] = await db
    .insert(decorations)
    .values({ campaignId: cid, ownerUserId: userId("dm"), name: "Wild Garden", scope: "campaign", spec: worldSpec })
    .returning({ id: decorations.id });
  const [personalDeco] = await db
    .insert(decorations)
    .values({ campaignId: cid, ownerUserId: userId("calanthe"), name: "Midnight Bloom", scope: "personal", spec: personalSpec })
    .returning({ id: decorations.id });
  // promote the shared one to the campaign default…
  await db.update(campaigns).set({ worldDecorationId: worldDeco.id }).where(eq(campaigns.id, cid));
  // …and let Calanthe's player run their personal decoration instead
  await db
    .update(memberships)
    .set({ selectedDecorationId: personalDeco.id })
    .where(eq(memberships.userId, userId("calanthe")));

  // --- posts (sequential so reply/quote/boost targets resolve in order) ---
  const now = Date.now();
  const ago = (m: number) => new Date(now - m * 60_000);
  const ahead = (m: number) => new Date(now + m * 60_000);

  const postId = new Map<string, number>();
  const byKey = new Map(POSTS.map((p) => [p.key, p]));
  const pollId = new Map<string, number>();

  for (const p of POSTS) {
    const status = p.draft ? "draft" : p.scheduledInMin != null ? "scheduled" : "published";
    const publishedAt = p.draft
      ? null
      : p.scheduledInMin != null
        ? ahead(p.scheduledInMin)
        : ago(p.minutesAgo!);
    const [row] = await db
      .insert(posts)
      .values({
        campaignId: cid,
        personaId: P(p.handle),
        content: p.content,
        imageUrl: p.imageUrl ?? null,
        status,
        publishedAt,
        replyToPostId: p.replyTo ? postId.get(p.replyTo)! : null,
        repostOfPostId: p.quoteOf ? postId.get(p.quoteOf)! : null,
      })
      .returning({ id: posts.id });
    postId.set(p.key, row.id);

    if (p.poll) {
      const [poll] = await db
        .insert(polls)
        .values({
          campaignId: cid,
          postId: row.id,
          options: p.poll.options,
          closesAt: ahead(p.poll.days * 24 * 60),
        })
        .returning({ id: polls.id });
      pollId.set(p.key, poll.id);
    }
  }

  // --- pinned posts ---
  for (const [handle, key] of Object.entries(PINNED)) {
    await db.update(personas).set({ pinnedPostId: postId.get(key)! }).where(eq(personas.id, P(handle)));
  }

  // ---------------------------------------------------------------------------
  // Interaction ledger. touch(a, b) records one interaction for the unordered
  // pair {a, b}; the self-check at the end asserts every pair reaches >= 2.
  // ---------------------------------------------------------------------------
  const ledger = new Map<string, number>();
  const pairKey = (a: string, b: string) => [a.toLowerCase(), b.toLowerCase()].sort().join(" ");
  const touch = (a: string, b: string) => {
    if (a.toLowerCase() === b.toLowerCase()) return;
    const k = pairKey(a, b);
    ledger.set(k, (ledger.get(k) ?? 0) + 1);
  };

  // notification helper (inlined to keep the seed alias-free; mirrors notify():
  // skips self, dedups like/follow via the partial unique indexes).
  const notify = async (
    recipient: string,
    actor: string,
    type: NotificationType,
    key?: string,
  ) => {
    if (recipient.toLowerCase() === actor.toLowerCase()) return;
    await db
      .insert(notifications)
      .values({
        campaignId: cid,
        recipientPersonaId: P(recipient),
        actorPersonaId: P(actor),
        type,
        postId: key ? (postId.get(key) ?? null) : null,
      })
      .onConflictDoNothing();
  };

  const MENTION_RE = /@([a-zA-Z0-9_]{2,24})/g;

  // --- follows: complete mutual graph (guarantees every pair >= 2) ---
  const followRows: { campaignId: number; followerPersonaId: number; followingPersonaId: number }[] = [];
  for (const a of allHandles) {
    for (const b of allHandles) {
      if (a === b) continue;
      followRows.push({ campaignId: cid, followerPersonaId: P(a), followingPersonaId: P(b) });
      touch(a, b);
    }
  }
  await db.insert(follows).values(followRows);
  for (const [actor, recipient] of FOLLOW_NOTIFS) await notify(recipient, actor, "follow");

  // --- replies / quotes / boosts / mentions: touch + notify (published only) ---
  for (const p of POSTS) {
    if (p.draft || p.scheduledInMin != null) continue; // unpublished: no pings
    const exclude = new Set<string>([p.handle.toLowerCase()]);

    if (p.replyTo) {
      const parent = byKey.get(p.replyTo)!.handle;
      touch(p.handle, parent);
      await notify(parent, p.handle, "reply", p.key);
      exclude.add(parent.toLowerCase());
    }
    if (p.quoteOf) {
      const target = byKey.get(p.quoteOf)!.handle;
      touch(p.handle, target);
      if (p.content !== "") {
        // a quote (non-empty) notifies; a plain boost (empty) has no notif type
        await notify(target, p.handle, "quote", p.key);
        exclude.add(target.toLowerCase());
      }
    }
    // @mentions
    MENTION_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    const mentioned = new Set<string>();
    while ((m = MENTION_RE.exec(p.content)) !== null) mentioned.add(m[1].toLowerCase());
    for (const h of mentioned) {
      if (!knownHandles.has(h) || exclude.has(h)) continue;
      touch(p.handle, h);
      await notify(h, p.handle, "mention", p.key);
    }
  }

  // --- likes (published posts) ---
  for (const [key, likers] of LIKES) {
    const author = byKey.get(key)!.handle;
    for (const liker of likers) {
      if (liker.toLowerCase() === author.toLowerCase()) continue;
      await db
        .insert(likes)
        .values({ campaignId: cid, personaId: P(liker), postId: postId.get(key)! })
        .onConflictDoNothing();
      touch(liker, author);
      await notify(author, liker, "like", key);
    }
  }

  // --- bookmarks (private, no interaction, no notification) ---
  for (const [handle, key] of BOOKMARKS) {
    await db
      .insert(bookmarks)
      .values({ campaignId: cid, personaId: P(handle), postId: postId.get(key)! })
      .onConflictDoNothing();
  }

  // --- poll votes ---
  for (const [key, votes] of Object.entries(POLL_VOTES)) {
    const pollIdent = pollId.get(key)!;
    for (const [handle, optionIdx] of votes) {
      await db
        .insert(pollVotes)
        .values({ campaignId: cid, pollId: pollIdent, personaId: P(handle), optionIdx })
        .onConflictDoNothing();
    }
  }

  // ---------------------------------------------------------------------------
  // Self-check: every unordered pair of personas must interact >= 2 times.
  // ---------------------------------------------------------------------------
  const missing: string[] = [];
  let min = Infinity;
  let max = 0;
  let pairCount = 0;
  for (let i = 0; i < allHandles.length; i++) {
    for (let j = i + 1; j < allHandles.length; j++) {
      pairCount++;
      const c = ledger.get(pairKey(allHandles[i], allHandles[j])) ?? 0;
      if (c < min) min = c;
      if (c > max) max = c;
      if (c < 2) missing.push(`  @${allHandles[i]} <-> @${allHandles[j]} = ${c}`);
    }
  }
  if (missing.length) {
    console.error(`\n❌ Interaction matrix INCOMPLETE: ${missing.length} pair(s) below 2:`);
    console.error(missing.join("\n"));
    process.exit(1);
  }

  console.log("\n✅ Thornfeed seed complete!\n");
  console.log(`  Interaction matrix OK: all ${pairCount} pairs interact >= 2x (min ${min}, max ${max}).`);
  console.log(`  Personas: ${personaSeeds.length} (8 PCs, ${personaSeeds.filter((s) => s.isNpc).length} NPCs, 1 Narrator)`);
  console.log(`  Posts: ${POSTS.length}   Follows: ${followRows.length}\n`);
  console.log(`  Campaign:    Thornfeed   →   /c/${SLUG}`);
  console.log(`  Invite code: ${inviteCode}`);
  console.log(`  Logins (password for all: ${PASSWORD}):`);
  console.log(`    • ${uname("dm")}  (the DM, acts as the Narrator, owns every NPC)`);
  for (const k of OWNER_KEYS.filter((x) => x !== "dm")) {
    const persona = personaSeeds.find((s) => s.owner === k && !s.isNpc)!;
    console.log(`    • ${uname(k)}  (player, ${persona.displayName})`);
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
