import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db boundary so we can assert the pure guard logic (self-skip) and the
// dedup call without a database. vi.hoisted makes the spies exist before the
// hoisted vi.mock factory runs.
const m = vi.hoisted(() => {
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoNothing }));
  const insert = vi.fn(() => ({ values }));
  return { insert, values, onConflictDoNothing };
});
vi.mock("@/db", () => ({ db: { insert: m.insert } }));

import { notify } from "@/lib/notify";

beforeEach(() => {
  m.insert.mockClear();
  m.values.mockClear();
  m.onConflictDoNothing.mockClear();
});

describe("notify", () => {
  it("skips self-notifications (no insert when recipient === actor)", async () => {
    await notify({ campaignId: 1, recipientPersonaId: 5, actorPersonaId: 5, type: "like", postId: 1 });
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("inserts a real notification and dedups via onConflictDoNothing", async () => {
    await notify({ campaignId: 1, recipientPersonaId: 6, actorPersonaId: 5, type: "reply", postId: 2 });
    expect(m.insert).toHaveBeenCalledOnce();
    expect(m.values).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: 1, recipientPersonaId: 6, actorPersonaId: 5, type: "reply", postId: 2 }),
    );
    expect(m.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("defaults a missing postId to null (e.g. follows)", async () => {
    await notify({ campaignId: 1, recipientPersonaId: 6, actorPersonaId: 5, type: "follow" });
    expect(m.values).toHaveBeenCalledWith(expect.objectContaining({ postId: null }));
  });
});
