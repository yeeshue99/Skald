---
name: add-server-action
description: Add a mutation (post, like, follow, settings change) as a server action wired to a form. Use when adding any write path.
triggers:
  - "server action"
  - "add a mutation"
  - "form submit"
  - "write path"
edges:
  - target: context/conventions.md
    condition: for the action shape and verify checklist
  - target: context/architecture.md
    condition: to see where the action sits in the write flow
last_updated: 2026-06-16
---

# Add a server action

## Context

Mutations live in `src/app/actions/*.ts` and are wired to client forms via React 19 `useActionState`. Read `context/conventions.md` for the canonical shape. The shared `FormState` type and helpers (`isUniqueViolation`, `safeNext`) are in `src/lib/form.ts`; validation schemas are in `src/lib/validation.ts`; identity/tenancy gates are in `src/lib/campaign.ts`. Use `src/app/actions/posts.ts` as the reference implementation.

## Steps

1. Add or reuse a Zod schema in `src/lib/validation.ts` for the input.
2. In the relevant `src/app/actions/*.ts` file (`"use server"` at top), export `async function <verb>Action(_prev: FormState, formData: FormData): Promise<FormState>`.
3. First line: `const ctx = await loadActionContext(slug)` (slug from the form). This resolves user + campaign + membership + acting persona.
4. For a persona-scoped write, resolve the author/persona from `ctx` and check `ownsPersona(ctx, personaId)`. Never trust a `personaId` straight off the form.
5. `safeParse` the input; on failure `return { error: parsed.error.issues[0]?.message ?? "..." }`.
6. Do the Drizzle write, scoping every clause by `ctx.campaign.id`. Wrap multi-row writes in a transaction.
7. Fire notifications (`src/lib/notify.ts`) only for published posts where relevant.
8. `revalidatePath('/c/<slug>'...)` for affected routes; `return { ok: true }` (or `redirect()` if the flow navigates).
9. Wire the form: a `"use client"` component with `useActionState(<verb>Action, emptyFormState)`.

## Gotchas

- React 19 `<form action>` auto-reset can revert controlled inputs after submit; guard with `onReset` `preventDefault` if it bites (seen on select/input).
- Unique-constraint violations surface as DB errors; use `isUniqueViolation(err)` to turn them into a friendly `FormState` instead of a 500.
- Drafts and scheduled posts must not notify; gate notifications on `status === "published"`.

## Verify

- [ ] `loadActionContext` + (for persona writes) `ownsPersona` are called.
- [ ] Every query/insert is scoped by `campaignId`.
- [ ] Returns `FormState`; does not throw to the client.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass.

## Debug

- 403/"can't act as that persona": the persona isn't in `ctx.myPersonas`, or the form sent a `personaId` the user doesn't own.
- Action silently does nothing: check the form's `useActionState` is bound and the `slug` field is present in the FormData.

## Update Scaffold

- [ ] Update `.mex/ROUTER.md` "Current Project State" if what's working changed.
- [ ] Update `.mex/context/` files if a convention shifted.
- [ ] Add new task types to `.mex/patterns/INDEX.md`.
