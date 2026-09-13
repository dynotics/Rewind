import { describe, expect, it } from "vitest";
import { clampRange, parseRange, txnsInRange } from "../src/components/useMonthRange";
import type { Txn } from "../src/lib/types";

const MONTHS = ["2026-03", "2026-04", "2026-05", "2026-06"];

function txn(postedAt: string): Txn {
  return {
    id: postedAt,
    accountId: "acct_1",
    postedAt,
    amountCents: 1000,
    merchant: "AWS",
    cardId: "card_1",
    cardName: "Marketing",
    userId: "user_1",
    userName: "Dana Reyes",
    logoUrl: null,
  };
}

describe("parseRange", () => {
  it("reads a start and end month out of the query parameter", () => {
    expect(parseRange("2026-04..2026-06")).toEqual({ start: "2026-04", end: "2026-06" });
  });

  it("ignores a missing or malformed parameter", () => {
    expect(parseRange(null)).toBeNull();
    expect(parseRange("2026-04")).toBeNull();
  });
});

describe("clampRange", () => {
  it("defaults to the full window", () => {
    expect(clampRange(null, MONTHS)).toEqual({ start: "2026-03", end: "2026-06" });
  });

  it("keeps a range that sits inside the data", () => {
    expect(clampRange({ start: "2026-04", end: "2026-05" }, MONTHS)).toEqual({
      start: "2026-04",
      end: "2026-05",
    });
  });

  it("never reaches past the months on hand", () => {
    expect(clampRange({ start: "2025-01", end: "2027-12" }, MONTHS)).toEqual({
      start: "2026-03",
      end: "2026-06",
    });
    expect(clampRange({ start: "2026-05", end: "2027-12" }, MONTHS)).toEqual({
      start: "2026-05",
      end: "2026-06",
    });
  });

  it("snaps onto months the dataset actually has", () => {
    expect(clampRange({ start: "2026-04", end: "2026-05" }, ["2026-03", "2026-06"])).toEqual({
      start: "2026-03",
      end: "2026-06",
    });
  });

  it("straightens a reversed range", () => {
    expect(clampRange({ start: "2026-05", end: "2026-04" }, MONTHS)).toEqual({
      start: "2026-04",
      end: "2026-05",
    });
  });

  it("has no range without history", () => {
    expect(clampRange(null, [])).toBeNull();
  });
});

describe("txnsInRange", () => {
  const txns = [txn("2026-03-10T15:00:00Z"), txn("2026-04-10T15:00:00Z"), txn("2026-05-10T15:00:00Z")];

  it("keeps only the charges posted inside the window", () => {
    const kept = txnsInRange(txns, { start: "2026-04", end: "2026-05" });
    expect(kept.map((item) => item.postedAt)).toEqual(["2026-04-10T15:00:00Z", "2026-05-10T15:00:00Z"]);
  });

  it("buckets by Eastern month, not UTC", () => {
    const newYear = [txn("2026-04-01T02:30:00Z")];
    expect(txnsInRange(newYear, { start: "2026-03", end: "2026-03" })).toHaveLength(1);
    expect(txnsInRange(newYear, { start: "2026-04", end: "2026-04" })).toHaveLength(0);
  });
});
