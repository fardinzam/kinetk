import { describe, expect, it } from "vitest";

import type { Queryable } from "@/server/db/pool";

import { checkRateLimit } from "./webhook-rate-limit";

type Counter = { count: number };

function makeDb(counters: Map<string, Counter> = new Map()): Queryable {
  return {
    async query(_text: string, values?: unknown[]) {
      const [tokenHash] = values as [string];
      const key = tokenHash;

      if (!counters.has(key)) {
        counters.set(key, { count: 0 });
      }

      const counter = counters.get(key)!;
      counter.count += 1;

      return {
        rows: [{ request_count: counter.count }],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    },
  };
}

describe("checkRateLimit", () => {
  it("allows the first request", async () => {
    expect(await checkRateLimit("hash_a", 10, makeDb())).toBe(true);
  });

  it("allows the 10th request", async () => {
    const counters = new Map([["hash_a", { count: 9 }]]);
    expect(await checkRateLimit("hash_a", 10, makeDb(counters))).toBe(true);
  });

  it("rejects the 11th request", async () => {
    const counters = new Map([["hash_a", { count: 10 }]]);
    expect(await checkRateLimit("hash_a", 10, makeDb(counters))).toBe(false);
  });

  it("different token hashes have independent counters", async () => {
    const db = makeDb();
    await checkRateLimit("hash_a", 10, db);
    await checkRateLimit("hash_a", 10, db);
    // hash_b starts at 0, not 2
    expect(await checkRateLimit("hash_b", 10, db)).toBe(true);
  });
});
