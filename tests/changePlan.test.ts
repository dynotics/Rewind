import { describe, expect, it } from "vitest";
import { changePlan } from "../src/lib/changePlan";
import type { Card, Policy } from "../src/lib/types";

function card(overrides: Partial<Card>): Card {
  return {
    id: "card_1",
    name: "Marketing",
    last4: "4242",
    userId: "user_1",
    holderName: "Dana Reyes",
    limitCents: null,
    limitType: null,
    blockedMccs: [],
    blockedMerchants: [],
    allowedMccs: [],
    allowedMerchants: [],
    ...overrides,
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

describe("changePlan", () => {
  it("lowers a monthly limit with a single spending_limit line", () => {
    const changes = changePlan(
      policy({ monthlyCapCents: 250000 }),
      [card({ limitCents: 500000, limitType: "monthly" })],
      [],
    );

    expect(changes).toHaveLength(1);
    expect(changes[0].lines).toEqual(["spending_limit: $5,000 -> $2,500"]);
    expect(changes[0].payload).toEqual({
      spending_limit: 250000,
      spending_limit_type: "monthly",
    });
  });

  it("targets allowed_categories for a card already in allowlist mode", () => {
    const changes = changePlan(
      policy({
        mode: "allowlist",
        mccs: ["5812", "7372"],
        merchants: ["Blue Bottle Coffee"],
      }),
      [
        card({
          allowedMccs: ["5812"],
          allowedMerchants: ["Blue Bottle Coffee"],
        }),
      ],
      [],
    );

    expect(changes).toHaveLength(1);
    expect(changes[0].lines).toEqual(["allowed_categories: + 7372"]);
    expect(changes[0].payload).toEqual({
      allowed_categories: ["5812", "7372"],
    });
    expect(changes[0].lines.join(" ")).not.toContain("blocked_categories");
    expect(changes[0].payload.blocked_categories).toBeUndefined();
  });

  it("omits a card the policy already matches", () => {
    const changes = changePlan(
      policy({
        maxPerTxnCents: 50000,
        monthlyCapCents: 250000,
        mccs: ["7995"],
        merchants: ["DraftKings"],
      }),
      [
        card({
          limitCents: 250000,
          limitType: "monthly",
          blockedMccs: ["7995"],
          blockedMerchants: ["DraftKings"],
        }),
      ],
      [],
    );

    expect(changes).toEqual([]);
  });
});
