import { describe, expect, it } from "vitest";
import {
  matchesQuery,
  parseQuery,
  removeWord,
  scanWords,
  tokenSuggestions,
  tokenWord,
} from "../src/components/query";
import type { Merchant, Txn, Verdict } from "../src/lib/types";

const MERCHANTS: Record<string, Merchant> = {
  "BLUE BOTTLE #12": { raw: "BLUE BOTTLE #12", canonical: "Blue Bottle Coffee", mcc: "5814", mccName: "Fast food", confidence: 1 },
  "BETMGM ONLINE": { raw: "BETMGM ONLINE", canonical: "BetMGM", mcc: "7995", mccName: "Betting", confidence: 1 },
};

function txn(over: Partial<Txn> = {}): Txn {
  return {
    id: "t1",
    accountId: "acct_1",
    postedAt: "2026-04-10T15:00:00Z",
    amountCents: 10000,
    merchant: "BLUE BOTTLE #12",
    cardId: "card_1",
    cardName: "Marketing",
    userId: "user_1",
    userName: "Maya Chen",
    logoUrl: null,
    ...over,
  };
}

function verdict(over: Partial<Txn> = {}, outcome: Verdict["outcome"] = "pass"): Verdict {
  return { txn: txn(over), outcome, reasons: [], runningMonthCents: 0 };
}

const matches = (query: string, item: Verdict) => matchesQuery(parseQuery(query), item, MERCHANTS);

describe("scanWords", () => {
  it("splits on whitespace and records where each word sits", () => {
    expect(scanWords("above:500 latte")).toEqual([
      { text: "above:500", start: 0, end: 9 },
      { text: "latte", start: 10, end: 15 },
    ]);
  });

  it("keeps a quoted value together as one word", () => {
    expect(scanWords('card:"maya chen" tea').map((word) => word.text)).toEqual([
      'card:"maya chen"',
      "tea",
    ]);
  });
});

describe("parseQuery", () => {
  it("reads every supported token", () => {
    const parsed = parseQuery("above:500 below:50 card:maya mcc:7995 is:blocked month:2026-04");
    expect(parsed.tokens.map((token) => [token.key, token.value])).toEqual([
      ["above", "50000"],
      ["below", "5000"],
      ["card", "maya"],
      ["mcc", "7995"],
      ["is", "block"],
      ["month", "2026-04"],
    ]);
    expect(parsed.words).toEqual([]);
  });

  it("treats an unknown key as plain text", () => {
    const parsed = parseQuery("colour:blue coffee");
    expect(parsed.tokens).toEqual([]);
    expect(parsed.words).toEqual(["colour:blue", "coffee"]);
  });

  it("treats a known key with a value it cannot take as plain text", () => {
    for (const query of ["above:lots", "is:refunded", "month:april"]) {
      expect(parseQuery(query).tokens).toEqual([]);
      expect(parseQuery(query).words).toHaveLength(1);
    }
  });

  it("ignores a key with nothing typed after it yet", () => {
    expect(parseQuery("mcc: latte")).toEqual({ tokens: [], words: ["latte"] });
  });

  it("accepts a written-out amount and labels it in dollars", () => {
    const [token] = parseQuery("above:$1,250").tokens;
    expect(token.value).toBe("125000");
    expect(token.label).toBe("$1,250");
  });

  it("unquotes a value that carries a space", () => {
    expect(parseQuery('card:"maya chen"').tokens[0].value).toBe("maya chen");
  });
});

describe("matchesQuery", () => {
  it("matches plain text against the merchant name, raw or canonical", () => {
    expect(matches("blue bottle", verdict())).toBe(true);
    expect(matches("coffee", verdict())).toBe(true);
    expect(matches("maya", verdict())).toBe(false);
  });

  it("compares amounts in dollars", () => {
    expect(matches("above:50", verdict({ amountCents: 10000 }))).toBe(true);
    expect(matches("above:500", verdict({ amountCents: 10000 }))).toBe(false);
    expect(matches("below:50", verdict({ amountCents: 1000 }))).toBe(true);
    expect(matches("below:5", verdict({ amountCents: 1000 }))).toBe(false);
  });

  it("matches a cardholder by part of their name", () => {
    expect(matches("card:maya", verdict())).toBe(true);
    expect(matches("card:dana", verdict())).toBe(false);
    expect(matches("card:marketing", verdict({ userName: null }))).toBe(true);
  });

  it("matches a category code exactly", () => {
    expect(matches("mcc:7995", verdict({ merchant: "BETMGM ONLINE" }))).toBe(true);
    expect(matches("mcc:79", verdict({ merchant: "BETMGM ONLINE" }))).toBe(false);
  });

  it("matches the outcome behind is:", () => {
    expect(matches("is:blocked", verdict({}, "block"))).toBe(true);
    expect(matches("is:flagged", verdict({}, "block"))).toBe(false);
    expect(matches("is:passed", verdict({}, "pass"))).toBe(true);
  });

  it("buckets month by Eastern time, like the rest of the app", () => {
    expect(matches("month:2026-03", verdict({ postedAt: "2026-04-01T02:30:00Z" }))).toBe(true);
    expect(matches("month:2026-04", verdict({ postedAt: "2026-04-01T02:30:00Z" }))).toBe(false);
  });

  it("narrows across different tokens and widens within one", () => {
    const item = verdict({ amountCents: 10000 }, "block");
    expect(matches("above:50 is:blocked", item)).toBe(true);
    expect(matches("above:50 is:flagged", item)).toBe(false);
    expect(matches("is:flagged is:blocked", item)).toBe(true);
  });

  it("ands plain words with the tokens beside them", () => {
    expect(matches("above:50 blue coffee", verdict())).toBe(true);
    expect(matches("above:50 tea", verdict())).toBe(false);
  });

  it("keeps everything when the box is empty", () => {
    expect(matches("   ", verdict())).toBe(true);
  });
});

describe("tokenWord and removeWord", () => {
  it("quotes a value that carries a space", () => {
    expect(tokenWord("card", "maya chen")).toBe('card:"maya chen"');
    expect(tokenWord("mcc", "7995")).toBe("mcc:7995");
  });

  it("takes one token back out of the query", () => {
    expect(removeWord("above:500 latte is:blocked", "is:blocked")).toBe("above:500 latte");
    expect(removeWord('card:"maya chen" latte', 'card:"maya chen"')).toBe("latte");
  });
});

describe("tokenSuggestions", () => {
  const txns = [
    txn({ id: "a", amountCents: 2000, merchant: "BLUE BOTTLE #12", userName: "Maya Chen" }),
    txn({ id: "b", amountCents: 80000, merchant: "BETMGM ONLINE", userName: "Dana Reyes", postedAt: "2026-05-02T15:00:00Z" }),
    txn({ id: "c", amountCents: 90000, merchant: "BETMGM ONLINE", userName: "Dana Reyes", postedAt: "2026-05-03T15:00:00Z" }),
  ];
  const values = tokenSuggestions(txns, MERCHANTS);

  it("draws cardholders and categories from the data, commonest first", () => {
    expect(values.card.map((item) => item.label)).toEqual(["Dana Reyes", "Maya Chen"]);
    expect(values.mcc[0]).toEqual({ value: "7995", typed: "7995", label: "7995 Betting", count: 2 });
  });

  it("lists months in order with a count each", () => {
    expect(values.month).toEqual([
      { value: "2026-04", typed: "2026-04", label: "April 2026", count: 1 },
      { value: "2026-05", typed: "2026-05", label: "May 2026", count: 2 },
    ]);
  });

  it("offers only amounts that actually split the data", () => {
    expect(values.above.every((item) => item.count !== null && item.count > 0 && item.count < 3)).toBe(true);
    expect(values.above.map((item) => item.typed)).toContain("500");
  });

  it("types dollars but matches the cents a token parses to", () => {
    for (const key of ["above", "below"] as const) {
      for (const item of values[key]) {
        expect(parseQuery(`${key}:${item.typed}`).tokens[0].value).toBe(item.value);
      }
    }
  });

  it("every offered value parses back into the token it came from", () => {
    for (const [key, list] of Object.entries(values)) {
      for (const item of list) {
        const [token] = parseQuery(tokenWord(key as never, item.typed)).tokens;
        expect(token?.key).toBe(key);
        expect(token?.value).toBe(item.value);
      }
    }
  });
});
