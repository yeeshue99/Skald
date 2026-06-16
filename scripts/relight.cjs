/* eslint-disable @typescript-eslint/no-require-imports */
// Rewrites the Petalfall seed's posts + follows with a lighter, banter-forward
// tone, sets PC logins (real names) + fun @handles (display stays the alias),
// lightens the campaign meta, and removes the wall / Maret Voss / Petal-Prophet
// entirely. Keeps campaign + remaining personas intact. Run:
//   node scripts/relight.cjs   then   pnpm seed:petalfall
const fs = require("node:fs");
const path = require("node:path");
const FILE = path.resolve(__dirname, "seed.petalfall.json");
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

const P = (ref, author, content, postedAt, likedBy = [], extra = {}) => ({
  ref,
  author,
  type: extra.type || "post",
  content,
  replyTo: extra.replyTo ?? null,
  quoteOf: extra.quoteOf ?? null,
  boostOf: extra.boostOf ?? null,
  imageHint: extra.imageHint ?? "",
  postedAt,
  likedBy,
});

const posts = [];
posts.push(P("p1", "npc_herald", `By Her Will, the Gilded Peace enters its 301st glorious year. To celebrate, the Crown will hold a LIVE public demonstration of an exciting new strategic innovation on the Blackthorn Blood-Sand. Details soon™. Rumour is a weed. Subscribe to this account. 🌹 #GildedPeace`, "-12d", ["npc_briar", "npc_nettle", "npc_lord"]));
posts.push(P("p2", "pc_dez", `301 years and the big announcement is "details soon". love that for us. they really invented the medieval press release.`, "-11d20h", ["pc_layla", "npc_rourke", "pc_calanthe", "pc_vesperae"], { type: "quote", quoteOf: "p1" }));
posts.push(P("p3", "npc_pell", `skewers two for a copper at Quinn Market, char's proper today. queue's out the door with the demo crowds in town. forming an orderly line is, turns out, NOT a Blackthorn skill. come hungry. come patient. 🍢`, "-11d18h", ["pc_kirill", "pc_val", "npc_cassimir", "pc_calanthe"], { imageHint: "a smoky charcoal grill stacked with skewers at a market stall" }));
posts.push(P("p6", "pc_kirill", `Big day. Buttercup (cow) saw her first city. She was very brave. A heron rode on her back for a whole mile and I think they're friends now. Be gentle with the small things, even when the small thing is a very large cow. 🐄`, "-11d10h", ["pc_calanthe", "pc_vesperae", "npc_pell", "pc_spadae", "pc_val"], { imageHint: "a very large cow in a city street with a heron perched on her back" }));
posts.push(P("p7", "pc_calanthe", `Ren your cow has more emotional range than most people I've dated. I'm doing a piece about her. Movement only. I call it "Bovine, Becoming". The premiere is at the Cinquefoil inn. Attendance is, spiritually, mandatory.`, "-11d9h", ["pc_kirill", "pc_dez", "pc_vesperae"], { type: "reply", replyTo: "p6" }));
posts.push(P("p8", "pc_dez", `"spiritually mandatory" is how I'm getting out of it, then.`, "-11d8h", ["pc_layla", "pc_val", "pc_calanthe", "pc_vesperae"], { type: "reply", replyTo: "p7" }));
posts.push(P("p9", "npc_briar", `Operational note. The Quinn Market skewer queue forms without structure and loses ~11 minutes per peak hour to indecision. I have drawn a two-lane system. Compliance is voluntary. Efficiency is not. #arithmetic`, "-11d4h", ["npc_nettle", "pc_layla", "npc_lord"]));
posts.push(P("p10", "pc_layla", `A Thorn-Captain just published a process-improvement deck for a snack cart. I have genuinely sat in worse stand-ups. @ThornCapt_Briar if you ever want out of law enforcement, ops is hiring and we respect a lane diagram.`, "-11d2h", ["pc_dez", "pc_vesperae", "npc_rourke", "pc_calanthe", "npc_pell"], { type: "quote", quoteOf: "p9" }));
posts.push(P("p11", "npc_briar", `I do not "want out". I want the queue to move. These are not the same. ...They could be. #arithmetic`, "-11d1h", ["pc_layla", "pc_dez"], { type: "reply", replyTo: "p10" }));
posts.push(P("p12", "npc_nettle", `Someone has eaten my lunch from the Roots cold-room. I will find you. I tasted the air. Pickled egg, regret, and a mustard sold at exactly one stall. I am not angry. I am methodical. The mustard knows what it did.`, "-10d22h", ["npc_jackdaw", "pc_dez", "pc_calanthe", "npc_rourke"]));
posts.push(P("p13", "npc_pell", `ma'am that's my mustard. half the market buys my mustard. you've narrowed it to "has been to a market".`, "-10d20h", ["pc_dez", "npc_rourke", "pc_calanthe", "pc_val", "pc_layla"], { type: "reply", replyTo: "p12" }));
posts.push(P("p14", "npc_jackdaw", `A little bird saw the culprit. The bird will tell you, for a small favour. The favour: stop writing your name on the cold-room eggs. It's undignified for a god-hunter. Tick. Tick. 🐦`, "-10d18h", ["pc_dez", "npc_rourke", "npc_pell"], { type: "reply", replyTo: "p12" }));
posts.push(P("p15", "pc_val", `Back in Blackthorn. Walked past my old street. The bakery's still there. The baker remembered I was a quiet kid who ate a lot. Gave me a bun, free, called me "big lad". I am thirty-one. I will be defending this bun with my life. Family is everything. So is the bun.`, "-10d12h", ["pc_kirill", "pc_vesperae", "pc_dez", "pc_calanthe", "npc_pell", "pc_spadae"]));
posts.push(P("p16", "pc_vesperae", `Vlad has known peace for one (1) bun and we are all better for it. (Lienne)`, "-10d10h", ["pc_val", "pc_kirill", "pc_layla", "pc_calanthe"], { type: "reply", replyTo: "p15" }));
posts.push(P("p17", "npc_lord", `My steward says my son worries. About everything. The demo, the seating, whether the cushions clash with the banners. I told him a man should pick one worry and commit to it. Mine is being left alone. I am very good at it.`, "-10d8h", ["npc_cassimir", "npc_pell", "pc_val", "pc_spadae"]));
posts.push(P("p18", "npc_cassimir", `Father posted. Father has NEVER posted. And he called my worrying a "hobby". I have a SPREADSHEET of things that could go wrong at this demo. It has 1,114 rows. ...okay maybe it is a hobby. Snacks at mine if anyone wants to help me catastrophise productively.`, "-10d6h", ["npc_pell", "pc_kirill", "pc_spadae", "pc_val", "pc_calanthe"], { type: "reply", replyTo: "p17" }));
posts.push(P("p20", "pc_spadae", `I'll help. I'm an archivist, I catalogue things, and "1,114 ways a cow-adjacent war-machine demo could go wrong" is the best filing problem I've had all year. I'll bring acid-free labels and a fresh ledger. (Edric)`, "-10d4h", ["npc_cassimir", "pc_vesperae", "pc_kirill"], { type: "reply", replyTo: "p18" }));
posts.push(P("p21", "npc_rourke", `The Golden Bough has "graciously" offered to "optimise" Medlar harbour fees. Translation: they invented six new fees and named one of them "gratitude". Two hundred years I've sailed this coast. I'll be paying "gratitude" over my cold dead hull. #Medlar`, "-9d20h", ["npc_jackdaw", "pc_layla", "pc_vesperae", "pc_dez"]));
posts.push(P("p22", "pc_layla", `"Gratitude fee" is the most evil line item I've ever seen and I worked in procurement. @Capt_Rourke forward me the invoice, I want to frame it. Then dispute it.`, "-9d18h", ["npc_rourke", "pc_vesperae", "pc_dez", "pc_calanthe"], { type: "reply", replyTo: "p21" }));
posts.push(P("p23", "npc_herald", `PROCLAMATION. The strategic innovation has a name: the Tactical Aether-Golem. It NEVER makes a wrong call. Public demo in 7 days, Blood-Sand, Lord @Lord_Blackthorn presiding. The future does not guess. The future does not grieve. The future has excellent posture. 🌹 #Blackthorn`, "-9d12h", ["npc_briar", "npc_nettle", "npc_lord"], { imageHint: "a polished brass-and-aether war-golem under a crimson banner on a sand arena" }));
posts.push(P("p24", "pc_dez", `"never makes a wrong call" is a bold thing to print seven days before you switch it on in front of a crowd. I'll bring snacks. Not for me. For the show.`, "-9d10h", ["pc_layla", "pc_calanthe", "npc_rourke", "pc_vesperae", "npc_pell"], { type: "quote", quoteOf: "p23" }));
posts.push(P("p25", "pc_layla", `Every "never wrong" product I've seen shipped it the week before it was extremely wrong, on stage, to applause that curdled in real time. Not saying. Just bringing a chair. @CrownHerald does it have a rollback plan.`, "-9d8h", ["pc_dez", "pc_vesperae", "npc_rourke", "pc_calanthe"], { type: "quote", quoteOf: "p23" }));
posts.push(P("p28", "pc_calanthe", `Update on "Bovine, Becoming": I've added a SECOND movement. It's about grief. The cow is not in it. The cow could not be reached for rehearsal (she was asleep). This is my Difficult Period. Tickets still spiritually mandatory. Do NOT ask me to paint the poster.`, "-9d2h", ["pc_kirill", "pc_dez", "pc_vesperae", "pc_val"]));
posts.push(P("p29", "pc_kirill", `Buttercup wasn't asleep, she was being a cow at the clover field, but I didn't want to interrupt your art. She says break a leg. (Not literally. Please don't. I worry.)`, "-9d1h", ["pc_calanthe", "pc_vesperae", "pc_val", "pc_spadae"], { type: "reply", replyTo: "p28" }));
posts.push(P("p30", "pc_cleke", `I can see the thread on a person. Where they came from. Most lead somewhere I could follow home. The Aether-Golem has no thread at all. It just... stops. I don't love that. I'll think about it tomorrow. Today the heron and I are watching the cow. (Kael)`, "-8d18h", ["pc_dez", "pc_spadae", "pc_kirill", "pc_vesperae", "npc_jackdaw"]));
posts.push(P("p31", "npc_jackdaw", `Clever bird notices the box with no string. Pull that thread carefully, little courier. Or don't; some boxes are happier closed. The starlings and I will watch the demo from a very safe roof. Bring the snacks the cynic keeps promising. 🐦`, "-8d16h", ["pc_cleke", "pc_dez", "pc_spadae"], { type: "reply", replyTo: "p30" }));
posts.push(P("p32", "npc_nettle", `I have identified the lunch thief. It was, on reflection, me. I packed two and forgot. I have apologised to the market. I have NOT apologised to the mustard; the mustard owes ME an apology for being delicious. Investigation closed. The hunger was real.`, "-8d12h", ["npc_pell", "pc_dez", "npc_jackdaw", "npc_rourke", "pc_calanthe"]));
posts.push(P("p33", "npc_briar", `Agent. You opened a market-wide inquiry into your own forgotten lunch. I have the incident report. It is four pages. One page is a diagram of the mustard. We are not the same. #arithmetic`, "-8d10h", ["npc_nettle", "pc_layla", "pc_dez", "npc_pell"], { type: "quote", quoteOf: "p32" }));
posts.push(P("p34", "npc_nettle", `the diagram was THOROUGH, Captain.`, "-8d9h", ["npc_briar", "pc_dez", "pc_calanthe"], { type: "reply", replyTo: "p33" }));
posts.push(P("p35", "npc_lord", `They're building seating on my Blood-Sand for the demo. Carpenters everywhere. One asked if I wanted a "VIP box". I have buried soldiers in this yard. Now there's a man selling cushions in it. I did not become a war-lord for cushions. ...I took the cushion. My back is forty.`, "-8d6h", ["npc_pell", "npc_cassimir", "pc_val", "pc_dez", "pc_calanthe"]));
posts.push(P("p36", "pc_val", `Take the cushion, my lord. Strongest men I know all have bad backs. It's from carrying everyone else.`, "-8d5h", ["npc_lord", "pc_kirill", "pc_vesperae", "npc_cassimir"], { type: "reply", replyTo: "p35" }));
posts.push(P("p40", "npc_rourke", `Brought a Medlar family up the coast today, no charge, because the Bough wanted a "gratitude fee" and I'd rather eat my own spyglass. They had a kid who'd never seen a skewer. @Pells_Skewers sending them your way. Do the green sauce.`, "-7d8h", ["npc_pell", "pc_vesperae", "pc_kirill", "npc_jackdaw", "pc_val", "pc_layla"]));
posts.push(P("p41", "npc_pell", `green sauce is BACK for the kid. tell 'em first one's free, second one's also free, I'm not a monster. Rourke you salty old hull, there's a good heart under all that vinegar. 🍢`, "-7d6h", ["npc_rourke", "pc_kirill", "pc_val", "pc_vesperae", "pc_calanthe"], { type: "reply", replyTo: "p40" }));
posts.push(P("b2", "pc_kirill", "", "-7d4h", [], { type: "boost", boostOf: "p41" }));
posts.push(P("p42", "npc_herald", `Three days to the demonstration! The Tactical Aether-Golem completed final calibration and performs FLAWLESSLY in tests. The Crown reminds citizens that unsanctioned "cow-based art" near the venue is discouraged. Enjoy responsibly. 🌹 #Blackthorn`, "-6d12h", ["npc_briar", "npc_nettle", "npc_lord"]));
posts.push(P("p43", "pc_calanthe", `Did the CROWN just subtweet my cow piece. In the official proclamation. @CrownHerald I have never felt more validated. "Cow-based art" is going on the poster. (Edric is making the poster. I'm not allowed near posters.)`, "-6d10h", ["pc_kirill", "pc_dez", "pc_vesperae", "pc_spadae", "npc_pell"], { type: "quote", quoteOf: "p42" }));
posts.push(P("p44", "pc_spadae", `I am making the poster. It will have correct dates and zero paint. This is the only way. (Edric)`, "-6d9h", ["pc_calanthe", "pc_vesperae", "pc_dez", "pc_val"], { type: "reply", replyTo: "p43" }));
posts.push(P("p45", "pc_dez", `things in Blackthorn right now: a never-wrong war machine nobody's switched on yet, a cow with a heron familiar and an actual fan club, and a Thorn-Captain who fixed the snack queue using BIRDS. I came here to lie low. loudest place I've ever been. send help. send a skewer.`, "-6d4h", ["pc_layla", "pc_calanthe", "pc_vesperae", "pc_kirill", "npc_pell", "pc_val", "pc_spadae"]));
posts.push(P("p46", "pc_vesperae", `You're smiling though. I can tell through the text. (Lienne)`, "-6d2h", ["pc_dez", "pc_calanthe", "pc_kirill", "pc_val"], { type: "reply", replyTo: "p45" }));
posts.push(P("p47", "npc_jackdaw", `A favour comes due. Years ago a certain captain owed me one. Today I collected: I had her teach the snack queue to a flock of starlings. They now form two lanes. They are MORE compliant than the citizens. The Captain calls it a triumph. I call it Tuesday. 🐦`, "-5d18h", ["npc_briar", "pc_dez", "npc_pell", "pc_calanthe", "pc_layla"]));
posts.push(P("p48", "npc_briar", `Confirmed. The starlings hold the lanes. Wing-discipline exceeds market average by 40%. I have offered them seasonal contracts. This is, to date, the most successful operation of my career. I am not joking. I do not joke. #arithmetic`, "-5d16h", ["npc_jackdaw", "npc_nettle", "pc_layla", "pc_dez", "pc_calanthe"], { type: "quote", quoteOf: "p47" }));
posts.push(P("p49", "pc_layla", `A Thorn-Captain just out-recruited the entire city using BIRDS and a queue diagram. Every founder I ever worked for, take notes. THIS is leadership. @ThornCapt_Briar the birds have better retention than my last three teams.`, "-5d14h", ["npc_briar", "pc_dez", "pc_vesperae", "pc_calanthe", "npc_rourke"], { type: "quote", quoteOf: "p48" }));
posts.push(P("b3", "pc_dez", "", "-5d12h", [], { type: "boost", boostOf: "p48" }));
posts.push(P("p53", "pc_kirill", `Buttercup update: she has been invited to the Aether-Golem demonstration. By a child. Who drew her an invitation. It says "deer cow your art is good". We are going. She is wearing a flower. This is the best day. 🐄🌸`, "-4d12h", ["pc_calanthe", "pc_vesperae", "pc_dez", "npc_pell", "pc_val", "pc_spadae", "npc_lord"], { imageHint: "a cow wearing a single flower, looking pleased with herself" }));
posts.push(P("p54", "pc_calanthe", `MY COW PIECE GOT THE COW INVITED TO A CROWN EVENT. art works. ART WORKS. I'm crying. Edric write this down.`, "-4d10h", ["pc_kirill", "pc_dez", "pc_vesperae", "pc_spadae"], { type: "reply", replyTo: "p53" }));
posts.push(P("p55", "npc_lord", `The cow may have my VIP cushion. The cow has done nothing wrong in its life, which is more than I can say for anyone else attending.`, "-4d8h", ["pc_kirill", "pc_calanthe", "pc_val", "pc_dez", "npc_pell", "pc_vesperae"], { type: "reply", replyTo: "p53" }));
posts.push(P("b4", "npc_lord", "", "-4d6h", [], { type: "boost", boostOf: "p53" }));
posts.push(P("p56", "npc_herald", `TOMORROW. The Tactical Aether-Golem demonstration. Schools released early. The future arrives at noon, on the Blood-Sand, and it does NOT make mistakes. Please disregard the cow. The cow is not part of the program. ...The cow may stay. By Her Will. 🌹`, "-2d12h", ["npc_lord", "npc_briar", "pc_kirill", "pc_calanthe"]));
posts.push(P("p57", "pc_dez", `they folded on the cow IN THE SAME PROCLAMATION. "please disregard the cow" followed immediately by "the cow may stay". this is the most relatable the Crown has ever been.`, "-2d10h", ["pc_layla", "pc_calanthe", "pc_vesperae", "pc_kirill", "npc_pell", "pc_val"], { type: "quote", quoteOf: "p56" }));
posts.push(P("p61", "npc_briar", `Demonstration security plan finalised. Crowd lanes: starling-enforced. Snack logistics: @Pells_Skewers, two-lane. Contingency for "the cow": the cow has clearance. Contingency for the Golem being wrong: there is none. It is never wrong. ...I built one anyway. #arithmetic`, "-1d18h", ["pc_layla", "pc_dez", "npc_nettle", "npc_lord", "npc_pell"]));
posts.push(P("p62", "pc_layla", `"There is no contingency, I built one anyway" is the single most competent sentence ever posted to this feed. @ThornCapt_Briar marry me (professionally) (as a co-founder) (equity split negotiable).`, "-1d16h", ["npc_briar", "pc_dez", "pc_vesperae", "pc_calanthe", "npc_rourke"], { type: "quote", quoteOf: "p61" }));
posts.push(P("p63", "pc_val", `Whole crew's going to the demo tomorrow. Maro's pretending he doesn't care. Maren's calling it her audience. Ren's bringing the cow. Edric's bringing labels. Lienne's bringing a dispute form "just in case". Kael keeps staring at the machine like it owes him money. I'm bringing snacks AND the bun.`, "-1d8h", ["pc_dez", "pc_calanthe", "pc_kirill", "pc_spadae", "pc_vesperae", "pc_cleke", "pc_layla"]));
posts.push(P("p64", "pc_cleke", `I'm staring because it has no thread, Vlad. Everything here has a thread. The cow has a thread. That box has nothing. Tomorrow I find out if that's a problem or just rude. Either way: snacks. (Kael)`, "-1d6h", ["pc_val", "pc_dez", "pc_spadae", "npc_jackdaw", "pc_vesperae"], { type: "reply", replyTo: "p63" }));
posts.push(P("p66", "pc_calanthe", `Tomorrow I premiere "Bovine, Becoming" (two movements) at the demo afterparty, whether there is an afterparty or not. The cow co-stars. The Crown subtweeted us into relevance. Edric made a poster with NO paint and CORRECT dates. Growth. I have grown. See you on the Blood-Sand, darlings. 🌸`, "-6h", ["pc_kirill", "pc_dez", "pc_vesperae", "pc_spadae", "pc_val", "npc_pell"]));
posts.push(P("p67", "npc_herald", `Noon. The Blood-Sand. The future. (And, per overwhelming public demand, the cow.) By Her Will. 🌹 #Blackthorn #GildedPeace`, "-2h", ["npc_lord", "npc_briar", "pc_kirill", "pc_calanthe", "pc_dez", "npc_pell", "pc_val"]));

// ---- removal: drop the wall / Maret Voss / Petal-Prophet entirely ----
const REMOVE = new Set(["npc_wall", "npc_maret", "npc_prophet"]);
const removedHandles = ["the_wall_remembers", "Maret_Voss", "PetalProphet"];
data.personas = data.personas.filter((p) => !REMOVE.has(p.ref));

// ---- PCs: login = real first name; @handle = fun; displayName = alias ----
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const funHandle = {
  pc_dez: "AllegedlyAGuard",
  pc_cleke: "SeesMoreThanISay",
  pc_layla: "AuditsEverything",
  pc_calanthe: "DoNotAskMeToPaint",
  pc_kirill: "ButtercupsManager",
  pc_spadae: "LabelsEverything",
  pc_val: "DefendsTheBun",
  pc_vesperae: "PowerIsADebt",
};
const aliasHandle = {
  pc_dez: "Maro_Coppersmart",
  pc_cleke: "Kael_Aloft",
  pc_layla: "Capt_Sera_Voss",
  pc_calanthe: "Maren_Thessaly",
  pc_kirill: "Ren_on_the_road",
  pc_spadae: "Edric_Vance",
  pc_val: "Vlad_hiresword",
  pc_vesperae: "Lienne_Ashford",
};
for (const p of data.personas) {
  if (p.kind !== "pc") continue;
  p.account = cap(p.ref.replace(/^pc_/, ""));
  if (funHandle[p.ref]) p.handle = funHandle[p.ref];
}
for (const post of posts) {
  for (const ref of Object.keys(funHandle)) {
    post.content = post.content
      .split("@" + aliasHandle[ref])
      .join("@" + funHandle[ref]);
  }
  // safety: strip likes by removed personas + any lingering @mentions of them
  post.likedBy = (post.likedBy || []).filter((r) => !REMOVE.has(r));
  for (const h of removedHandles) {
    post.content = post.content.replace(new RegExp("\\s*@" + h + "\\b", "g"), "");
  }
}

// ---- follows: party clique + curated cross-graph (no removed personas) ----
const pcRefs = ["pc_dez", "pc_cleke", "pc_layla", "pc_calanthe", "pc_kirill", "pc_spadae", "pc_val", "pc_vesperae"];
const follows = [];
const seen = new Set();
const F = (a, b) => {
  if (a === b || REMOVE.has(a) || REMOVE.has(b)) return;
  const k = `${a}|${b}`;
  if (seen.has(k)) return;
  seen.add(k);
  follows.push({ follower: a, following: b });
};
for (const a of pcRefs) for (const b of pcRefs) F(a, b);
for (const pc of pcRefs) F(pc, "npc_pell");
for (const pc of pcRefs) F(pc, "npc_jackdaw");
[["pc_spadae", "npc_cassimir"],
 ["pc_kirill", "npc_lord"],
 ["pc_calanthe", "npc_herald"], ["pc_calanthe", "npc_cassimir"],
 ["pc_dez", "npc_rourke"], ["pc_dez", "npc_briar"],
 ["pc_layla", "npc_briar"], ["pc_layla", "npc_rourke"],
 ["pc_val", "npc_lord"], ["pc_val", "npc_cassimir"], ["pc_val", "npc_pell"],
 ["pc_vesperae", "npc_rourke"], ["pc_vesperae", "npc_jackdaw"], ["pc_vesperae", "npc_briar"],
 ["pc_cleke", "npc_jackdaw"]].forEach(([a, b]) => F(a, b));
[["npc_pell", "npc_rourke"], ["npc_pell", "npc_cassimir"],
 ["npc_cassimir", "npc_lord"], ["npc_cassimir", "npc_pell"],
 ["npc_rourke", "npc_pell"], ["npc_rourke", "npc_jackdaw"],
 ["npc_briar", "npc_nettle"], ["npc_briar", "npc_jackdaw"],
 ["npc_nettle", "npc_briar"], ["npc_nettle", "npc_pell"],
 ["npc_jackdaw", "npc_pell"], ["npc_jackdaw", "npc_briar"], ["npc_jackdaw", "npc_rourke"],
 ["npc_lord", "npc_cassimir"], ["npc_lord", "npc_pell"],
 ["npc_herald", "npc_briar"], ["npc_herald", "npc_lord"], ["npc_herald", "npc_nettle"]].forEach(([a, b]) => F(a, b));

// ---- scrub removed-entity references from kept personas (bio is seeded; voice
// is reference-only but the user wants it gone too) ----
const setField = (ref, field, val) => {
  const p = data.personas.find((x) => x.ref === ref);
  if (p) p[field] = val;
};
setField("npc_pell", "bio", `Skewers two for a copper at Quinn Market, char's good. Been feeding Blackthorn longer than you've been alive. Mind the queue, it gets feral. 🍢`);
setField("npc_cassimir", "bio", `Lord Blackthorn's other son. I keep count of things. Currently keeping count of everything that could go wrong at this demonstration. It's a long list.`);
setField("npc_cassimir", "voice", `Earnest, sleepless, anxious about the demo and his father's attention; counts everything; cautious hope.`);
setField("npc_lord", "voice", `Terse, weary, soldierly; short blunt lines with grief just under them; rarely engages.`);
setField("pc_spadae", "voice", `Quiet, careful, a "well actually" historian who keeps names and lost things; signs "(Edric)". (DM: Spadae, Grief / Memory.)`);

// ---- lighten campaign meta ----
data.campaign.tagline =
  "Elarosea's feed: proclamations, market gossip, and one very famous cow.";
data.campaign.description =
  "Blackthorn and the city-states of Elarosea, posting through it: Crown hype, market banter, a celebrity cow, and a \"never-wrong\" war-machine the whole town is side-eyeing. By Her Will. 🌹";

// ---- scrub removed entities from the (reference-only) worldBible ----
if (data.worldBible) {
  const bad = /\bwall\b|valerius|theron|maret|sable|weeping star|petal-?prophet|\bprophet\b|sorrel/i;
  if (Array.isArray(data.worldBible.factions))
    data.worldBible.factions = data.worldBible.factions.filter((f) => !bad.test(JSON.stringify(f)));
  if (Array.isArray(data.worldBible.timeline))
    data.worldBible.timeline = data.worldBible.timeline.filter((t) => !bad.test(String(t)));
  if (Array.isArray(data.worldBible.hooks))
    data.worldBible.hooks = data.worldBible.hooks.filter((h) => !bad.test(String(h)));
  data.worldBible.tone =
    "Lively in-world social feed: banter, bickering, running gags, and a few low-stakes threads (a cringe-y Crown product launch, a celebrity cow, a dance nobody asked for).";
}

data.posts = posts;
data.follows = follows;

// ---- validate before writing ----
const errs = [];
const personaRefs = new Set(data.personas.map((p) => p.ref));
const postRefs = new Set(posts.map((p) => p.ref));
for (const post of posts) {
  if (!personaRefs.has(post.author)) errs.push(`post ${post.ref}: author ${post.author} not in personas`);
  for (const dep of [post.replyTo, post.quoteOf, post.boostOf]) {
    if (dep && !postRefs.has(dep)) errs.push(`post ${post.ref}: dangling target ${dep}`);
  }
  for (const r of post.likedBy) if (!personaRefs.has(r)) errs.push(`post ${post.ref}: liker ${r} not in personas`);
  for (const h of removedHandles) if (post.content.includes("@" + h)) errs.push(`post ${post.ref}: lingering @${h}`);
}
for (const f of follows) {
  if (!personaRefs.has(f.follower) || !personaRefs.has(f.following)) errs.push(`follow ${f.follower}->${f.following}: unknown persona`);
}
if (errs.length) {
  console.error("VALIDATION FAILED:\n  " + errs.join("\n  "));
  process.exit(1);
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
console.log(`Rewrote ${FILE}`);
console.log(`  personas: ${data.personas.length}  posts: ${posts.length}  follows: ${follows.length}`);
console.log(`  removed: ${[...REMOVE].join(", ")}`);
const overLong = posts.filter((p) => (p.content || "").length > 500);
console.log(`  posts over 500 chars: ${overLong.length}`, overLong.map((p) => p.ref).join(" "));
