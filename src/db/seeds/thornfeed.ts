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
// Run:  pnpm tsx src/db/seeds/thornfeed.ts   (DB must have the current schema)
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
  { owner: "dm", handle: "thequill", displayName: "Narrator", isNpc: false, frame: "default", banner: true, bio: "Keeper of this tale. I narrate; I do not intervene. (Mostly.) The saga of the Star-Fallen, told as it falls." },

  // --- player characters (each owned by its own player) ---
  { owner: "calanthe", handle: "artiststruggle", displayName: "Calanthe Orchidaceae", isNpc: false, frame: "blossom", banner: true, bio: "Heir to House Orchidaceae of Cinquefoil. Dancer, 'painter,' five-year Florescence and counting. More than the name." },
  { owner: "cleke", handle: "blindpilot", displayName: "Cleke", isNpc: false, frame: "manaHalo", banner: true, bio: "Pilot from a world I can't remember. Aarakocra now. Blindfold of sponsor feathers. Looking for the name the sky took." },
  { owner: "dez", handle: "spysson", displayName: "Dez", isNpc: false, frame: "none", bio: "Son of a Lake People spy and a soldier who vanished to save us. Loyal to my mother, allergic to nobility." },
  { owner: "kirill", handle: "verdantpilgrim", displayName: "Kirill Amaterasu", isNpc: false, frame: "wreath", banner: true, bio: "Verdant Mendicant, first solo assignment. Guardian of the sacred calf. I despise waste and trust too easily." },
  { owner: "layla", handle: "byprocedure", displayName: "Layla", isNpc: false, frame: "hudBracket", banner: true, bio: "SubCaptain of the Guard, Elarosea. Woke up here with a corporate brain. Corruption is just a broken process I'll fix." },
  { owner: "spadae", handle: "courtescapee", displayName: "Spadae", isNpc: false, frame: "medallion", bio: "Caelrosa nobility, out past the court walls for the first time. Nephew of the late Icarly. Learning fast." },
  { owner: "val", handle: "steadyhand", displayName: "Val", isNpc: false, frame: "default", banner: true, bio: "Blackthorn slums. Tanner's son. Protect family and innocents, no torture, no slavery. Here to bring mine home." },
  { owner: "vesperae", handle: "seesomethingdo", displayName: "Vesperae Locke", isNpc: false, frame: "wreath", banner: true, bio: "Left Loquat's Canopy to live the creed: see something, do something. I catch the ones the hierarchy throws away." },

  // --- NPCs (all owned by the DM) ---
  { owner: "dm", handle: "thegildedcrown", displayName: "Queen Acantha", isNpc: true, frame: "medallion", banner: true, bio: "Acantha Rosaceae, by root and thorn, Queen of Elarosea. 301 years of the Gilded Peace. You are welcome." },
  { owner: "dm", handle: "grandarchivist", displayName: "Corbin Locke", isNpc: true, frame: "medallion", bio: "Grand Archivist of Loquat. I keep the records and, lately, my conscience. Enrich the workers, enrich the world." },
  { owner: "dm", handle: "unionmother", displayName: "Alicia", isNpc: true, frame: "none", bio: "Loquat loom-hand, organizing the Roots one shift at a time. Mother. I bend systems built to break us." },
  { owner: "dm", handle: "nightshadebeau", displayName: "Aeneas Solanaceae", isNpc: true, frame: "default", bio: "Academy-trained. Misunderstood. I rescued someone once and they called it a crime. Open to the right arrangement." },
  { owner: "dm", handle: "featherbond", displayName: "Alice", isNpc: true, frame: "wreath", bio: "Elder of the Appori clan, Skydwellers of the high reaches. I sponsor the feathers Cleke wears. Trust is woven, not given." },
  { owner: "dm", handle: "thewallspeaks", displayName: "Cassimir", isNpc: true, frame: "none", bio: "Second son of Blackthorn. The writing on the walls is a letter. My brother isn't done. Read it with me." },
  { owner: "dm", handle: "thedefector", displayName: "Edmund Vane", isNpc: true, frame: "hudBracket", bio: "Sent to end Elara Vane. Chose her name instead. Of the Birds now. Debts get paid in this family." },
  { owner: "dm", handle: "themurmuration", displayName: "Elara Vane", isNpc: true, frame: "blossom", banner: true, bio: "Once the Queen's right hand. Now I lead the Birds. Trying to save her from what she's become before it's too late." },
  { owner: "dm", handle: "captainbriar", displayName: "Thorn-Captain Briar", isNpc: true, frame: "hudBracket", bio: "Thorn-Captain, field command. The peace is kept one example at a time. Clean papers, clear conscience." },
  { owner: "dm", handle: "willowmask", displayName: "Thorn-Agent Nettle", isNpc: true, frame: "hudBracket", bio: "Thorn-Agent. I wear a willow mask and I taste what you'd rather I didn't. I am patient. I am close." },
  { owner: "dm", handle: "whoswatching", displayName: "Sable", isNpc: true, frame: "none", bio: "You'll notice me when I want you to. Not before. There's a letter under the writing." },
  { owner: "dm", handle: "thequeensthorns", displayName: "The Queen's Thorns", isNpc: true, frame: "hudBracket", banner: true, bio: "The Crown's blade. Enforcement, conscription, god-hunting. Serve and be remembered. Refuse and be remembered." },
  { owner: "dm", handle: "thequeensroots", displayName: "The Queen's Roots", isNpc: true, frame: "none", bio: "Intelligence of the Crown. We do not announce ourselves. This is the exception." },
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
  { key: "queenProclaim", handle: "thegildedcrown", minutesAgo: 23040, content: "Three hundred and one years of the Gilded Peace. No famine the histories would recognize, no war you would survive. You are welcome. Sleep easily; your Queen does not. 🌹" },
  { key: "corbinRoots", handle: "grandarchivist", minutesAgo: 21600, content: "The Ascent groans again over the Roots. The Canopy will not feel it. I felt it from my chair in the Grand Archive, and I am ashamed of the chair. #RootsOfLoquat" },
  { key: "aliciaUnion", handle: "unionmother", minutesAgo: 20160, content: "Eleventh shift with no relief. They tell the loom-hands the quota is the Crown's will. The Crown has never threaded a needle. We organize at the third bell. #ScribesUnion" },
  { key: "grandReplyAlicia", handle: "grandarchivist", minutesAgo: 20100, replyTo: "aliciaUnion", content: "@unionmother The third bell, then. I can't be seen on your side of the Ascent, but the quota sheets that 'went missing' did not wander off by themselves. Enrich the workers, enrich the world. Quietly, for now." },

  // --- Session 1: the Festival of Falling Stars (Narrator self-thread) ---
  { key: "t1", handle: "thequill", minutesAgo: 20000, content: "The Festival of Falling Stars opens in Benz. Lanterns on the water, a sacred calf newly born, eight strangers who do not yet know each other. Remember this quiet. It does not last. 🧵 #FallingStars" },
  { key: "t2", handle: "thequill", minutesAgo: 19990, replyTo: "t1", content: "At the height of the revels the sky tears. A shard of the dying Weeping Star falls into the crowd and shatters into eight. Each splinter chooses a host. None of them was asked." },
  { key: "t3", handle: "thequill", minutesAgo: 19980, replyTo: "t2", content: "Star-Fallen things crawl out of the light. The Crown's Thorns arrive a breath later, and somehow the blame lands on the strangers. 'Sedition,' they call it. Convenient." },
  { key: "t4", handle: "thequill", minutesAgo: 19970, replyTo: "t3", content: "And in the same heartbeat all eight share one vision, one voice not their own: 'Find the others... before she does.' Then they run. They are still running. #FindTheOthers" },

  { key: "kirillFestival", handle: "verdantpilgrim", minutesAgo: 19900, imageUrl: img("benz-calf"), content: "Benz smells like river-lilies and fried dough and I have cried twice already. The calf is HERE. She is real. I will guard her with everything I am. #FallingStars" },
  { key: "spadaeFirstTime", handle: "courtescapee", minutesAgo: 19850, content: "First time past the Caelrosa court walls and the sky just... fell on us? Is it always like this out here? @verdantpilgrim you seem calm. Teach me how to be calm." },
  { key: "laylaWakes", handle: "byprocedure", minutesAgo: 19800, content: "Woke up three weeks ago wearing a SubCaptain's gorget and someone else's death. Cause of death: redacted, even to me. The org chart here is a war crime. Day 21. #Reincorporated" },
  { key: "boostKirillT1", handle: "verdantpilgrim", minutesAgo: 19000, quoteOf: "t1", content: "" },

  // --- Sessions 2-3: Loquat, the Roots, the Envisionarium ---
  { key: "vesperaeCreed", handle: "seesomethingdo", minutesAgo: 16000, content: "Left the Canopy a year and a half ago and I have not missed the view. From up there you cannot see the people you stand on. See something, do something. @grandarchivist taught me that, even if he won't say so." },
  { key: "corbinReplyVesperae", handle: "grandarchivist", minutesAgo: 15990, replyTo: "vesperaeCreed", content: "@seesomethingdo I taught you no such thing out loud and I'll deny it in any Canopy room you like. Off the record: you were always going to be braver than me. Don't get caught being right too early." },
  { key: "valRescue", handle: "steadyhand", minutesAgo: 15900, content: "A year and a half ago a beast left me for dead in a forest and a stranger I'd never met carried me out on her back. Asked for nothing. I've trusted exactly one person on sight since. @seesomethingdo." },
  { key: "boostVesAlicia", handle: "seesomethingdo", minutesAgo: 15500, quoteOf: "aliciaUnion", content: "" },
  { key: "dezArgument", handle: "spysson", minutesAgo: 14400, content: "For the record the 'argument' my mother and I had in the Envisionarium was theatre for whatever Thorn was listening. For the record I'd say worse to her face and mean none of it. @unionmother" },
  { key: "aliciaReplyDez", handle: "unionmother", minutesAgo: 14380, replyTo: "dezArgument", content: "@spysson You'd say worse and I raised you to. Say it loud, say it true, and duck after. Your father drew them off so you could have a mouth like that. Use it." },
  { key: "kirillBlueprints", handle: "verdantpilgrim", minutesAgo: 14350, content: "I have never stolen anything in my life and I lifted a god-surveillance blueprint out from under a psychic in a willow mask. I feel ILL. I would do it again. @willowmask did not even blink." },
  { key: "nettleDeal", handle: "willowmask", minutesAgo: 14300, content: "An open offer, since the festival children read this feed: the shards for your freedom. No theatrics, no mask between us. You refused once. I am patient, and I am already closer than you think." },
  { key: "boostRootsNettle", handle: "thequeensroots", minutesAgo: 14290, quoteOf: "nettleDeal", content: "" },
  { key: "dezQuoteAlicia", handle: "spysson", minutesAgo: 13000, quoteOf: "aliciaUnion", content: "This is my mother. The Crown took my father for loving her across a border that wasn't supposed to bend. She's been bending Loquat ever since. Don't @ me about nobility." },

  // --- Sessions 4-5: the Canopy, the Grand Archives, the Ledger ---
  { key: "calantheArt", handle: "artiststruggle", minutesAgo: 11000, imageUrl: img("orchid-horse"), content: "New piece finished. They say a true Orchidaceae can paint the soul. This is a soul. (It is a horse. I know it's a horse. Let me have this.) Five years of Florescence and THIS is the breakthrough." },
  { key: "elaraLedger", handle: "themurmuration", minutesAgo: 10000, content: "A certain Census changed hands in the dark and never noticed the swap. The Birds thank a certain light-fingered guest. Safe passage was the least we owed. Fly low. #TheMurmuration" },
  { key: "corbinWarn", handle: "grandarchivist", minutesAgo: 9800, content: "To my guests: the main host arrives at midnight and they are not coming for tea. Take the Canopy road, take the papers, do not take the scenic route. This is the last favor I can do openly." },
  { key: "vesperaeQuoteCorbin", handle: "seesomethingdo", minutesAgo: 9700, quoteOf: "corbinWarn", content: "My father, doing the bravest thing he knows: a warning, sideways, with deniability built in. I love him. I left so I'd never have to add the 'deniability' part." },
  { key: "laylaArchives", handle: "byprocedure", minutesAgo: 9600, content: "Found the org chart I actually wanted. Three operations, three towns, three gods on a watchlist like inventory. Cinquefoil. Medlar. Blackthorn. Someone is doing logistics on the divine and I want their spreadsheet." },

  // --- Session 6: the road, Gallowfen, Posy, the Levy ---
  { key: "narratorRoad", handle: "thequill", minutesAgo: 5800, content: "The road to Blackthorn runs grey and long. A shrine slides past unvisited; a Thorn checkpoint waves them through; and a village called Gallowfen waits with its storefronts hollow and its young men gone." },
  { key: "valStall", handle: "steadyhand", minutesAgo: 5700, imageUrl: img("gallowfen-stall"), content: "Set up a meat stall in a town too quiet to be alive. For one afternoon Gallowfen had noise again. People came out of their houses just to stand near it. That's the part I can't stop thinking about." },
  { key: "posyDream", handle: "thequill", minutesAgo: 5500, imageUrl: img("red-flower"), content: "A girl named Posy sleeps a sleep with no bottom. The shards rouse her for one bright minute. She speaks: a great red flower, no time passing, one unbroken night. Then she's gone again. Remember the red flower." },
  { key: "boostSpadaePosy", handle: "courtescapee", minutesAgo: 5400, quoteOf: "posyDream", content: "" },
  { key: "spadaeLevy", handle: "courtescapee", minutesAgo: 5300, content: "Stood in a doorway tonight and watched a Levy take people the way you'd take firewood. We didn't move. I keep telling myself we couldn't. I'm not sleeping well on it. #TheLevy" },
  { key: "caravanRumor", handle: "spysson", minutesAgo: 5200, content: "A caravan came through Gallowfen from the Capital a month back, maybe two. Nobody can say who or why. In my experience 'nobody can say' means somebody was paid not to. #TheLevy" },
  { key: "laylaQuoteQueen", handle: "byprocedure", minutesAgo: 5100, quoteOf: "queenProclaim", content: "'You are welcome.' Three hundred years of peace and a girl in Gallowfen sleeps under a red flower she can't wake from. Show me the line item where that's the price of welcome." },
  { key: "pollPost", handle: "thequill", minutesAgo: 4800, poll: { options: ["Cinquefoil: Alithiel", "Medlar: Aeolus", "Blackthorn: Valerius", "Toward the red flower"], days: 3 }, content: "The shards pull three ways at once. Where does the saga go next, friends? (Vote. I'm contractually unable to tell you, but I can count.) #ShardBound" },

  // --- Session 7: Blackthorn ---
  { key: "valGates", handle: "steadyhand", minutesAgo: 3000, content: "Walked back into Blackthorn under a false name and the gate officer who's known me since I was small looked right through me. I don't know if that's the disguise working or the town forgetting its own. Home." },
  { key: "valFamily", handle: "steadyhand", minutesAgo: 2900, content: "Father and Rue, both taken in the same Levy. Crown Works Installation Seven. My mother set out three bowls from habit and then just sat there. I'm getting them back. All of them. @captainbriar, your records have their names." },
  { key: "cassimirWalls", handle: "thewallspeaks", minutesAgo: 2700, imageUrl: img("blackthorn-walls"), content: "The writing on the walls started the DAY Theron died. Call that grief if you want. I call it a letter I haven't finished reading. My brother is not done talking. #WallWritings" },
  { key: "valReplyCassimir", handle: "steadyhand", minutesAgo: 2650, replyTo: "cassimirWalls", content: "@thewallspeaks Grew up three streets from your wall. Folk down here have read messages in the brickwork since before your brother. Doesn't make you wrong. Make me wrong by finding the hand that writes them." },
  { key: "pollCass", handle: "thewallspeaks", minutesAgo: 2600, poll: { options: ["My brother", "A hoax", "Something worse", "I don't want to know"], days: 2 }, content: "Settle this for me, then. The writing covering Blackthorn's walls is: #WallWritings" },
  { key: "calantheSable", handle: "artiststruggle", minutesAgo: 2500, content: "Spotted a woman watching the lord's son from a rooftop, perfectly still, and then she simply wasn't there. @courtescapee saw her too. Tell me we both saw her. @whoswatching, I assume that's you." },
  { key: "spadaeReplyCalanthe", handle: "courtescapee", minutesAgo: 2450, replyTo: "calantheSable", content: "@artiststruggle We both saw her. I'm not losing my mind, or we're losing it together, which is somehow comforting. Court never taught me what to do when the rooftop looks back." },
  { key: "aetherIntel", handle: "verdantpilgrim", minutesAgo: 2400, content: "Word at The Common Room: the Aether Golem 'demonstration' is in three days in the square. Everyone's excited. I've seen the binding-cloth it's wrapped in. I don't think it's a machine they're waking up." },
  { key: "cassimirLord", handle: "thewallspeaks", minutesAgo: 2200, content: "He called me 'my son' tonight in the voice he saves for Theron. First time since the funeral. I should feel chosen. I feel like a stand-in who learned the lines. @steadyhand @verdantpilgrim, don't make me regret trusting you two." },
  { key: "kirillReplyCassimir", handle: "verdantpilgrim", minutesAgo: 2100, replyTo: "cassimirLord", content: "@thewallspeaks I take the walls seriously. I take YOU seriously. A letter that costs you this much is worth finishing, but don't let a ghost spend you. Eat something. I'm bringing soup." },

  // --- recent chatter / relationships ---
  { key: "aeneasReturn", handle: "nightshadebeau", minutesAgo: 1800, content: "People love to rewrite a rescue into a crime. I pulled Calanthe out of a very bad situation and got branded for it. Funny how the Potentilla name only matters when there's blame to assign. @artiststruggle, we should talk." },
  { key: "calantheReplyAeneas", handle: "artiststruggle", minutesAgo: 1750, replyTo: "aeneasReturn", content: "@nightshadebeau We have nothing to say that a witness shouldn't hear. You didn't pull me out of anything. You arranged the river and then offered me a rope. I dance now. I don't need saving." },
  { key: "clekeMemory", handle: "blindpilot", minutesAgo: 1600, content: "Flew something once. My hands know a cockpit my head can't name. The blindfold's feathers say I'm trusted; I can't remember earning a single one. @featherbond, who was I before the sky?" },
  { key: "aliceSponsor", handle: "featherbond", minutesAgo: 1550, replyTo: "clekeMemory", content: "@blindpilot You were someone who kept his word in a storm. The feathers don't lie, child. You earn them again every day you wear them. The clan remembers, even when you can't." },
  { key: "edmundDefect", handle: "thedefector", minutesAgo: 1500, content: "I was sent to put a knife in the one person who's spent her life keeping knives out of other people. I chose her name instead of her blood. The Vanes keep their debts. @themurmuration." },
  { key: "elaraQuoteEdmund", handle: "themurmuration", minutesAgo: 1490, quoteOf: "edmundDefect", content: "He came to kill me and stayed to outlive his orders. The Birds don't recruit the loyal; we recruit the ones who finally choose. Welcome home, Edmund." },
  { key: "queenSeclusion", handle: "thegildedcrown", minutesAgo: 1400, content: "Your Queen withdraws a while to tend a long garden. Do not mistake the quiet for absence. The roots go deeper than you will ever dig. 🌹" },
  { key: "thornsNotice", handle: "thequeensthorns", minutesAgo: 1300, content: "The Thorns are recruiting in Blackthorn. The Levy is mercy with a deadline. Serve the Crown and the Crown remembers you. Refuse, and the Crown remembers that too. #TheLevy" },
  { key: "briarOrder", handle: "captainbriar", minutesAgo: 1200, content: "Deserter sweeps on the Blackthorn road are doubled as of today. If your papers are clean you have nothing to fear. If they are not, run faster. The Thorns keep the peace one example at a time." },
  { key: "boostThornsBriar", handle: "thequeensthorns", minutesAgo: 1190, quoteOf: "briarOrder", content: "" },
  { key: "edmundReplyBriar", handle: "thedefector", minutesAgo: 1180, replyTo: "briarOrder", content: "@captainbriar Funny, I used to write reports exactly this confident. Right up until the morning I changed which side the confidence served. 'Clean papers.' Sure." },
  { key: "laylaReplyBriar", handle: "byprocedure", minutesAgo: 1150, replyTo: "briarOrder", content: "@captainbriar 'Nothing to fear if your papers are clean' is what every rotten system says right before it audits you into a grave. I've read your sweep numbers. They don't add up to safety. They add up to a quota." },
  { key: "vesperaeBlackthorn", handle: "seesomethingdo", minutesAgo: 1000, content: "Blackthorn is the worst thing I've seen, and I grew up watching Loquat eat its own. The difference is here they've stopped pretending the people are anything but fuel. We're not leaving until that's not true." },
  { key: "valQuoteVesperae", handle: "steadyhand", minutesAgo: 990, quoteOf: "vesperaeBlackthorn", content: "Whatever she decides, that's the way I'm walking. She found me dying and didn't ask who I was first. Few people in this country can say they've never once made me earn their help." },
  { key: "valReplyVesperae", handle: "steadyhand", minutesAgo: 950, replyTo: "vesperaeBlackthorn", content: "@seesomethingdo Then we make it not true. You carried me out of a forest for nothing once. I've got a debt and a list of names in Installation Seven. Point me." },
  { key: "laylaQueen", handle: "byprocedure", minutesAgo: 900, content: "I used to think the Queen was just... administration. A very old manager executing very old policy. I'm starting to think the policy IS her, all the way down, and that is so much worse. @thegildedcrown, what are you?" },
  { key: "queenReplyLayla", handle: "thegildedcrown", minutesAgo: 880, replyTo: "laylaQueen", content: "@byprocedure A SubCaptain with questions. How novel. I have outlived every clever person who finished that sentence. Tend your post, little import. The garden has room for one more root." },
  { key: "elaraReplyLayla", handle: "themurmuration", minutesAgo: 870, replyTo: "laylaQueen", content: "@byprocedure Careful asking what she is in the open. I asked, once, from closer than anyone. I'm still hunting the answer, and the part of her that used to know my name. Some questions she hears." },
  { key: "rootsWatch", handle: "thequeensroots", minutesAgo: 800, content: "The Roots do not announce themselves. Consider this the exception. Three subjects of interest have entered Blackthorn. We are not in a hurry. We never have to be." },
  { key: "sableReveal", handle: "whoswatching", minutesAgo: 700, content: "@artiststruggle you both saw me. That was the point. Watch the lord's son, not the watcher. There's a letter under the wall-writing and it isn't from a dead brother. Find me before the demonstration." },
  { key: "cassimirQuoteSable", handle: "thewallspeaks", minutesAgo: 690, quoteOf: "sableReveal", content: "A letter under the writing that ISN'T from Theron. I want to call you a liar so badly. Why does part of me already believe you. @whoswatching" },
  { key: "kirillGuardian", handle: "verdantpilgrim", minutesAgo: 500, content: "Learned today the accord my clan signed might not 'pass the calf forward' to any sanctuary at all. If someone has touched her with a ledger and a price, there is no waste I despise more than that one. @thequeensroots." },
  { key: "clekeReplyKirill", handle: "blindpilot", minutesAgo: 480, replyTo: "kirillGuardian", content: "@verdantpilgrim If they put a price on something you swore to guard, that's not an accord, that's a receipt. I don't remember much, but I remember what a sold-out feels like. I'll fly her out myself." },

  // --- scheduled reveals (future, not yet visible / not notifying) ---
  { key: "schedNarrator", handle: "thequill", scheduledInMin: 2880, content: "Next: the square fills, the cloth comes off, and somewhere a girl dreams of a red flower opening. Session 8 begins when you do. #ShardBound" },
  { key: "schedDemo", handle: "thequeensthorns", scheduledInMin: 4320, content: "PUBLIC NOTICE: the Aether Golem will be unveiled in Blackthorn square. Attendance is encouraged. Absence will be noted. The Crown's newest guardian wakes for you. 🌹" },

  // --- drafts (never published, never notify) ---
  { key: "draftLayla", handle: "byprocedure", draft: true, content: "(draft, not sending yet) Full corruption brief on the Levy quotas: names, dates, the missing caravan manifest. Once I post this I can't un-post it. Need one more source." },
  { key: "draftVesperae", handle: "seesomethingdo", draft: true, content: "(draft) The thing I want to say to every Canopy scholar who taught me 'efficiency.' Saving it for when it will cost them something." },
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
  verdantpilgrim: "kirillFestival",
  byprocedure: "laylaArchives",
  courtescapee: "spadaeLevy",
  steadyhand: "valFamily",
  seesomethingdo: "vesperaeBlackthorn",
};

// likes: [postKey, [liker handles]] (published posts only)
const LIKES: [string, string[]][] = [
  ["queenProclaim", ["captainbriar", "thequeensthorns", "nightshadebeau", "willowmask"]],
  ["aliciaUnion", ["spysson", "seesomethingdo", "grandarchivist", "steadyhand", "themurmuration"]],
  ["t1", ["verdantpilgrim", "artiststruggle", "courtescapee", "blindpilot", "steadyhand"]],
  ["t4", ["byprocedure", "seesomethingdo", "spysson", "themurmuration"]],
  ["kirillFestival", ["courtescapee", "featherbond", "steadyhand", "artiststruggle"]],
  ["laylaWakes", ["spysson", "blindpilot", "seesomethingdo", "courtescapee"]],
  ["vesperaeCreed", ["steadyhand", "grandarchivist", "spysson", "byprocedure"]],
  ["valRescue", ["seesomethingdo", "verdantpilgrim", "blindpilot", "featherbond"]],
  ["nettleDeal", ["thequeensroots", "thequeensthorns", "captainbriar"]],
  ["kirillBlueprints", ["spysson", "seesomethingdo", "steadyhand", "themurmuration"]],
  ["calantheArt", ["courtescapee", "verdantpilgrim", "blindpilot", "nightshadebeau", "featherbond"]],
  ["elaraLedger", ["thedefector", "seesomethingdo", "spysson", "byprocedure"]],
  ["corbinWarn", ["seesomethingdo", "steadyhand", "themurmuration", "byprocedure"]],
  ["laylaArchives", ["themurmuration", "seesomethingdo", "spysson", "thequeensroots"]],
  ["posyDream", ["verdantpilgrim", "steadyhand", "courtescapee", "artiststruggle", "blindpilot"]],
  ["valStall", ["seesomethingdo", "verdantpilgrim", "courtescapee", "spysson"]],
  ["valFamily", ["seesomethingdo", "verdantpilgrim", "byprocedure", "blindpilot", "captainbriar"]],
  ["cassimirWalls", ["steadyhand", "verdantpilgrim", "artiststruggle", "courtescapee", "whoswatching"]],
  ["calantheSable", ["courtescapee", "thewallspeaks", "whoswatching", "spysson"]],
  ["laylaQueen", ["seesomethingdo", "spysson", "themurmuration", "steadyhand", "blindpilot"]],
  ["vesperaeBlackthorn", ["steadyhand", "spysson", "byprocedure", "verdantpilgrim", "courtescapee"]],
  ["sableReveal", ["thewallspeaks", "artiststruggle", "courtescapee", "byprocedure"]],
  ["edmundDefect", ["themurmuration", "seesomethingdo", "byprocedure"]],
  ["aliceSponsor", ["blindpilot", "verdantpilgrim", "steadyhand"]],
  ["kirillGuardian", ["blindpilot", "seesomethingdo", "steadyhand", "artiststruggle"]],
  ["aetherIntel", ["steadyhand", "byprocedure", "seesomethingdo", "thewallspeaks"]],
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
];

// poll votes: [handle, optionIdx]
const POLL_VOTES: Record<string, [string, number][]> = {
  pollPost: [
    ["steadyhand", 2], ["seesomethingdo", 2], ["verdantpilgrim", 3], ["artiststruggle", 0],
    ["blindpilot", 3], ["spysson", 2], ["byprocedure", 2], ["courtescapee", 0],
    ["themurmuration", 1], ["unionmother", 2], ["thedefector", 1], ["captainbriar", 2],
    ["willowmask", 3],
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
  const pairKey = (a: string, b: string) => [a.toLowerCase(), b.toLowerCase()].sort().join(" ");
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
    console.error(`\n❌ Interaction matrix INCOMPLETE — ${missing.length} pair(s) below 2:`);
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
  console.log(`    • ${uname("dm")}  (the DM — acts as the Narrator, owns every NPC)`);
  for (const k of OWNER_KEYS.filter((x) => x !== "dm")) {
    const persona = personaSeeds.find((s) => s.owner === k && !s.isNpc)!;
    console.log(`    • ${uname(k)}  (player — ${persona.displayName})`);
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
