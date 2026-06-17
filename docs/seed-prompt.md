# Worldbuilder prompt

Give this prompt to a capable LLM to generate a `seed.json` for a new campaign,
then load it with the seeder (see the README's "Seeding a campaign from a world"
section). The JSON shape here is exactly what `src/db/seeds/seed-petalfall.ts` reads.

Replace the bracketed inputs, then paste everything below to the model.

---

You are a Dungeon Master and social-media-roleplay author. Build a self-consistent
campaign world for the in-world microblog "Skald" (a Twitter/X clone where every
account is a character) and populate a believable feed.

Output ONE strict JSON object, no markdown, no commentary, no trailing commas.
Every cross-reference must resolve.

FILL IN (then delete this block):
- PREMISE: <<one or two sentences: genre, setting, central tension>>
- TONE: <<e.g. lighthearted banter, grimdark, comedic, political intrigue>>
- PLAYER CHARACTERS: <<each PC's real name + a one-line concept; or "invent N">>
- NPC COUNT: <<default 8>>
- FEED SIZE: <<default 60 posts>>
- TIME WINDOW: <<default: spread across the last 12 in-world days, newest ~2h ago>>

HARD CONSTRAINTS (a violation makes the seed fail):
- handle: 2-24 chars, only [A-Za-z0-9_], unique across all personas, no leading @.
- displayName <= 40 chars; bio <= 200; post content <= 500.
- A post is EITHER a plain post OR a reply OR a quote OR a boost, never two.
  A boost MUST have content "".
- Every author / follower / following / likedBy value is a persona "ref" you
  defined. Every replyTo / quoteOf / boostOf is a post "ref" that exists and has
  an EARLIER postedAt than the post referencing it.
- @mentions in content must match an existing persona handle exactly.

OUTPUT SHAPE (emit strict JSON; comments here are illustrative only):
{
  "campaign": {
    "name": "string, 1-40 chars (the wordmark)",
    "tagline": "<= 140 chars",
    "description": "1-3 sentences",
    "presetId": "one of: strix | scrollr | bloomr | holonet | default"
  },
  "personas": [
    {
      "ref": "npc_oracle",            // local unique id used by posts/follows
      "kind": "npc",                  // "npc" (DM-run) | "pc" (a player)
      "handle": "OracleOfVex",        // the in-feed @handle (can be a fun name)
      "displayName": "The Oracle",    // shown name (for a PC, their in-world alias)
      "bio": "<= 200 chars, in character",
      "account": "",                  // PC only: real-name login username; omit for NPCs
      "avatarHint": "short visual description (used as a generation hint)"
    }
  ],
  "posts": [
    {
      "ref": "p1",
      "author": "npc_oracle",         // persona ref
      "type": "post",                 // post | reply | quote | boost
      "content": "<= 500 chars; may use @handle and #hashtag",
      "replyTo": null,                // post ref if type=reply
      "quoteOf": null,                // post ref if type=quote
      "boostOf": null,                // post ref if type=boost (content must be "")
      "imageHint": "",                // optional; if set, the seeder attaches a placeholder image
      "postedAt": "-3d4h",            // relative to now: Nd / Nh / Nm, newest near 0
      "likedBy": ["pc_thorne"]        // persona refs
    }
  ],
  "follows": [
    { "follower": "pc_thorne", "following": "npc_oracle" }
  ]
}

GUIDANCE:
- Pick presetId by genre: strix = gothic arcane academia; scrollr = medieval
  parchment; bloomr = pastoral / botanical; holonet = sci-fi cyberpunk; default
  = neutral.
- Give every persona a distinct voice. For PCs, the `account` is their real
  character name (the login) while `handle` is a fun, character-flavoured @handle
  and `displayName` is whatever they go by in the setting.
- Make it read like a real feed: threads (post -> several replies), quote-dunks,
  boosts of big announcements, running gags, a couple of low-stakes plot threads.
  Mix it up: ~45% posts, ~30% replies, ~15% quotes, ~10% boosts.
- Likes cluster on spicy/important posts. Build a believable follow graph.

Return ONLY the JSON object.
