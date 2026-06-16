# Posting to Skald from an external app

Skald exposes a small write-only HTTP API so another app (e.g. a session-notes
tool) can publish posts into a campaign. You authenticate with a campaign API
key and choose which in-world persona the post appears as.

This is the integration contract. Hand it to the other app's developers.

## 1. Get a key (one-time, in Skald)

The campaign's DM generates the key in **Settings -> API access -> Generate
key**. The raw key (format `skald_...`) is shown **once** at creation; Skald
stores only its SHA-256 hash. Keep it in the other app's secrets/env.

A key is:

- **Scoped to one campaign.** It only works for that campaign's `slug`.
- **Write-only.** It can create posts. There is no read side.
- **Revocable** from the same Settings panel (revoked keys stop working at once).

You also need the campaign **slug** (the `<slug>` in `/c/<slug>` URLs) and the
**handle** of the persona to post as.

## 2. Endpoint

```
POST https://<skald-host>/api/c/<slug>/posts
Authorization: Bearer <skald_key>
Content-Type: application/json
```

### Body (JSON)

| Field | Type | Required | Notes |
|---|---|---|---|
| `persona` | string | yes | The persona's handle, e.g. `"chronicler"` or `"@chronicler"` (leading `@` optional, case-insensitive). |
| `content` | string | yes* | Post text. Max **500** characters. `@mentions` and `#hashtags` are linkified, and mentioned personas get notified. |
| `imageUrl` | string | no | An `http(s)` image URL (max 2000 chars). |
| `scheduledAt` | string | no | ISO-8601 instant. If it is in the future, the post is scheduled and goes live then; otherwise it posts immediately. |

\* Provide `content` and/or `imageUrl` — at least one is required.

### Which personas a key may post as

A campaign key may post as:

- any **NPC** in that campaign, or
- the **persona owned by the user who created the key** (the DM's own character).

Anything else returns `403`.

## 3. Responses

Success is `201 Created`:

```json
{
  "id": 530,
  "status": "published",
  "persona": "Chronicler",
  "url": "/c/petalfall/post/530"
}
```

`status` is `"published"` or `"scheduled"`. Errors are JSON `{ "error": "..." }`:

| Status | When |
|---|---|
| `400` | Body isn't JSON, missing `persona`, no `content`/`imageUrl`, content too long, or a bad `imageUrl`. |
| `401` | Missing `Authorization: Bearer ...`, or an invalid/revoked key. |
| `403` | The key isn't allowed to post as that persona. |
| `404` | Campaign slug not found, or no persona with that handle in the campaign. |

## 4. Examples

curl:

```bash
curl -X POST "https://<skald-host>/api/c/petalfall/posts" \
  -H "Authorization: Bearer $SKALD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "persona": "@chronicler",
        "content": "Session 12 recap: the party reached Blackthorn and struck a deal with the harbormaster.",
        "scheduledAt": "2026-07-01T18:00:00Z"
      }'
```

fetch (Node / TS):

```ts
async function postToSkald(opts: {
  host: string;          // e.g. "https://skald.example.com"
  slug: string;          // campaign slug
  apiKey: string;        // skald_...
  persona: string;       // handle, with or without leading @
  content?: string;
  imageUrl?: string;
  scheduledAt?: string;  // ISO instant, optional
}) {
  const res = await fetch(`${opts.host}/api/c/${opts.slug}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      persona: opts.persona,
      content: opts.content,
      imageUrl: opts.imageUrl,
      scheduledAt: opts.scheduledAt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Skald ${res.status}: ${data.error ?? "post failed"}`);
  return data; // { id, status, persona, url }
}
```

## 5. Notes and limits

- **One post per call.** No threads or polls over the API; a single post (text
  and/or one image).
- **Content cap:** 500 characters. Split long recaps, or post a summary that
  links out.
- **Images are by URL**, not upload — host the image somewhere public and pass
  `imageUrl`.
- **Scheduling** is time-based on Skald's side: a scheduled post becomes visible
  once `scheduledAt` passes (no callback or confirmation).
- **No read API.** This integration can't fetch the feed back.
- **Secret handling:** treat the key like a password. If it leaks, the DM
  revokes it and generates a new one.

## Implementation pointers (Skald repo)

- Route: `src/app/api/c/[slug]/posts/route.ts`
- Key table: `campaignApiKeys` in `src/db/schema.ts`
- Key management (mint/revoke): `src/app/actions/api-keys.ts`,
  `src/components/ApiKeysManager.tsx`
