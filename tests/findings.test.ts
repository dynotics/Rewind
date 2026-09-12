import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { findings } from "../src/lib/findings";
import { CardSchema, MerchantSchema, TxnSchema } from "../src/lib/types";

function load(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

const txns = z.array(TxnSchema).parse(load("data/transactions.json"));
const cards = z.array(CardSchema).parse(load("data/cards.json"));
const merchants = z.record(z.string(), MerchantSchema).parse(load("data/merchants.json"));

describe("findings", () => {
  const results = findings(txns, cards, merchants);

  it("detects at least one duplicate subscription", () => {
    expect(results.some((f) => f.kind === "duplicate_subscription")).toBe(true);
  });

  it("detects a risk category finding mentioning MCC 7995", () => {
    const risk = results.filter((f) => f.kind === "risk_category");
    expect(risk.some((f) => f.suggested.mccs.includes("7995"))).toBe(true);
  });

  it("gives every finding a positive impact", () => {
    for (const finding of results) {
      expect(finding.impactCents).toBeGreaterThan(0);
    }
  });

  it("sorts findings by impact descending", () => {
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i - 1].impactCents).toBeGreaterThanOrEqual(results[i].impactCents);
    }
  });
});
