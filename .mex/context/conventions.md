---
name: conventions
description: How code is written in this project — naming, structure, patterns, and style. Load when writing new code or reviewing existing code.
triggers:
  - "convention"
  - "pattern"
  - "naming"
  - "style"
  - "how should I"
  - "what's the right way"
edges:
  - target: context/architecture.md
    condition: when a convention depends on understanding the system structure
last_updated: 2026-06-16
---

# Conventions

## Naming

- React components: PascalCase files (`Composer.tsx`, `PostCard.tsx`, `FeedList.tsx`).
- Server actions and lib modules: kebab/lowercase files (`posts.ts`, `follow.ts`, `campaign.ts`, `queries.ts`, `validation.ts`).
- Functions: camelCase, verb-first. Server actions end in `Action` (`createPostAction`, `loginAction`).
- DB columns: snake_case in Postgres, camelCase in TS (Drizzle maps them). Tables are plural (`posts`, `personas`, `pollVotes`).
- Imports use the `@/` alias for `src/` (e.g. `@/lib/form`).

## Structure

- Mutations live in `src/app/actions/*.ts` (`"use server"`). Reads live in `src/lib/queries.ts`. Components never query the database directly, and pages pass serializable view types (`PostView`), not raw Drizzle rows, into client components.
- Validation schemas are centralized in `src/lib/validation.ts`; the `FormState` type and form helpers (`isUniqueViolation`, `safeNext`) live in `src/lib/form.ts`. Reuse them, don't redefine.
- Tenancy and identity go through `src/lib/campaign.ts` (`loadActionContext`, `getCampaignContext`, `ownsPersona`). Don't read the session cookie or membership directly in an action.
- Tests sit next to the code: `*.test.ts` for unit (no DB), `*.itest.ts` for integration (real Postgres).

## Patterns

Server action shape. Resolve context, validate, check ownership, mutate, revalidate, return `FormState`. Never throw to the client:

```ts
// src/app/actions/posts.ts (shape)
export async function createPostAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await loadActionContext(String(formData.get("slug") ?? ""));
  const authorId = resolveAuthor(ctx, formData);
  if (authorId == null) return { error: "You can't post as that persona." };

  const parsed = composeSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your post." };

  await db.insert(posts).values({ campaignId: ctx.campaign.id, personaId: authorId, /* ... */ });
  revalidatePath(`/c/${ctx.campaign.slug}`);
  return { ok: true };
}
```

Read + hydrate. Select `RawPost` rows, then `hydrate()` into `PostView` (author, counts, viewer state, poll, nested quote) using parallel sub-queries. Apply the shared visibility predicate (`deletedAt IS NULL AND publishedAt <= now()`) and keyset cursor pagination, never raw `OFFSET`:

```ts
const rows = await db.select().from(posts).where(and(eq(posts.campaignId, id), visibleCondition()));
const views: PostView[] = await hydrate(rows, viewerPersonaId, id);
```

## Verify Checklist

Before presenting any code:

- [ ] Mutations are in `src/app/actions/*.ts`; reads go through `src/lib/queries.ts`. No DB calls in components.
- [ ] The action calls `loadActionContext` and (for persona-scoped writes) `ownsPersona`. No client-supplied `personaId` is trusted.
- [ ] Every query and insert is scoped by `campaignId`.
- [ ] Input is parsed with a Zod schema from `src/lib/validation.ts`; the action returns `FormState`, it does not throw to the client.
- [ ] Reads use the visibility predicate and keyset cursors; new feed-shaped queries hydrate to `PostView`.
- [ ] Run `pnpm typecheck` and `pnpm lint`; run `pnpm test` (and `pnpm test:integration` if a DB-touching path changed).
- [ ] `CHANGELOG.md` and `BACKLOG.md` updated if the task shipped or moved something.
