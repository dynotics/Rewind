import { describe, expect, it } from "vitest";
import { replay } from "../src/lib/engine";
import type { Merchant, Policy, Txn } from "../src/lib/types";

const MERCHANTS: Record<string, Merchant> = {
  "NOTION LABS INC": {
    raw: "NOTION LABS INC",
    canonical: "Notion",
    mcc: "7372",
    mccName: "Computer Programming Services",
    isRecurring: true,
    confidence: 0.98,
  },
  DRAFTKINGS: {
    raw: "DRAFTKINGS",
    canonical: "DraftKings",
    mcc: "7995",
    mccName: "Betting and Casino Gambling",
    isRecurring: false,
    confidence: 0.95,
  },
  "SQ *BLUE BOTTLE": {
    raw: "SQ *BLUE BOTTLE",
    canonical: "Blue Bottle Coffee",
    mcc: "5812",
    mccName: "Eating Places and Restaurants",
    isRecurring: false,
    confidence: 0.91,
  },
};

function txn(
  id: string,
  postedAt: string,
  amountCents: number,
  merchant: string,
  cardId: string,
): Txn {
  return {
    id,
    accountId: "acct_1",
    postedAt,
    amountCents,
    merchant,
    cardId,
    cardName: null,
    userId: null,
    userName: null,
    logoUrl: null,
  };
}

function policy(overrides: Partial<Policy>): Policy {
  return {
    maxPerTxnCents: null,
    monthlyCapCents: null,
    mode: "blocklist",
    mccs: [],
    merchants: [],
    scope: "all",
    scopeIds: [],
    ...overrides,
  };
}

describe("replay", () => {
  it("passes a transaction under the cap with no merchant match", () => {
    const txns = [
      txn("t1", "2026-02-10T15:00:00Z", 4200, "SQ *BLUE BOTTLE", "card_1"),
    ];

    const verdicts = replay(
      txns,
      policy({ monthlyCapCents: 50000, mccs: ["7995"] }),
      MERCHANTS,
    );

    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].outcome).toBe("pass");
    expect(verdicts[0].reasons).toEqual([]);
    expect(verdicts[0].runningMonthCents).toBe(4200);
  });

  it("blocks a merchant whose mcc is on the blocklist and names the mcc", () => {
    const txns = [
      txn("t1", "2026-02-11T15:00:00Z", 9900, "DRAFTKINGS", "card_1"),
    ];

    const verdicts = replay(txns, policy({ mccs: ["7995"] }), MERCHANTS);

    expect(verdicts[0].outcome).toBe("block");
    expect(verdicts[0].reasons).toEqual([
      "MCC 7995 (Betting and Casino Gambling) blocked",
    ]);
    expect(verdicts[0].runningMonthCents).toBe(0);
  });

  it("blocks the transaction that crosses the monthly cap and resets the next month", () => {
    const txns = [
      txn("t1", "2026-03-05T15:00:00Z", 30000, "NOTION LABS INC", "card_1"),
      txn("t2", "2026-04-01T02:00:00Z", 25000, "SQ *BLUE BOTTLE", "card_1"),
      txn("t3", "2026-04-02T15:00:00Z", 20000, "SQ *BLUE BOTTLE", "card_1"),
    ];

    const verdicts = replay(txns, policy({ monthlyCapCents: 50000 }), MERCHANTS);

    expect(verdicts[0].outcome).toBe("pass");
    expect(verdicts[0].runningMonthCents).toBe(30000);

    expect(verdicts[1].outcome).toBe("block");
    expect(verdicts[1].reasons).toEqual(["exceeds monthly cap ($500)"]);
    expect(verdicts[1].runningMonthCents).toBe(30000);

    expect(verdicts[2].outcome).toBe("pass");
    expect(verdicts[2].runningMonthCents).toBe(20000);
  });

  it("blocked transaction does not consume monthly budget", () => {
    const txns = [
      txn("t1", "2026-05-02T15:00:00Z", 8000, "SQ *BLUE BOTTLE", "card_1"),
      txn("t2", "2026-05-09T15:00:00Z", 5000, "SQ *BLUE BOTTLE", "card_1"),
      txn("t3", "2026-05-16T15:00:00Z", 2000, "SQ *BLUE BOTTLE", "card_1"),
    ];

    const verdicts = replay(txns, policy({ monthlyCapCents: 10000 }), MERCHANTS);

    expect(verdicts.map((verdict) => verdict.outcome)).toEqual([
      "pass",
      "block",
      "pass",
    ]);
    expect(verdicts.map((verdict) => verdict.runningMonthCents)).toEqual([
      8000, 8000, 10000,
    ]);
  });

  it("allowlist mode blocks merchants not on the list", () => {
    const txns = [
      txn("t1", "2026-06-03T15:00:00Z", 1500, "NOTION LABS INC", "card_1"),
      txn("t2", "2026-06-04T15:00:00Z", 1600, "SQ *BLUE BOTTLE", "card_1"),
      txn("t3", "2026-06-05T15:00:00Z", 1700, "UNKNOWN VENDOR", "card_1"),
    ];

    const verdicts = replay(
      txns,
      policy({ mode: "allowlist", merchants: ["Notion"] }),
      MERCHANTS,
    );

    expect(verdicts[0].outcome).toBe("pass");
    expect(verdicts[0].reasons).toEqual([]);

    expect(verdicts[1].outcome).toBe("block");
    expect(verdicts[1].reasons).toEqual(["not on allowlist"]);

    expect(verdicts[2].outcome).toBe("block");
    expect(verdicts[2].reasons).toEqual(["not on allowlist"]);
  });
});
