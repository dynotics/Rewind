import { monthKeyET } from "../lib/engine";
import type { Merchant, Txn, Verdict } from "../lib/types";
import { dollars, money, monthName } from "./format";

/**
 * The search box speaks a small token language: `above:500 mcc:7995 is:blocked coffee`.
 * Anything that is not a well-formed token — an unknown key, a value the key cannot
 * take — falls through to plain text and matches the merchant name instead.
 */
export type TokenKey = "above" | "below" | "card" | "mcc" | "is" | "month";

export type Token = {
  key: TokenKey;
  /** Normalised for matching: cents for amounts, an outcome for `is`, lowercase text elsewhere. */
  value: string;
  /** Human-facing form, shown on the chip. */
  label: string;
  /** The word exactly as it sits in the query, so a chip can remove it again. */
  word: string;
};

export type Query = { tokens: Token[]; words: string[] };

export type Word = { text: string; start: number; end: number };

const KEYS: TokenKey[] = ["above", "below", "card", "mcc", "is", "month"];

const OUTCOMES: Record<string, Verdict["outcome"]> = {
  blocked: "block",
  flagged: "flag",
  passed: "pass",
};

const OUTCOME_LABEL: Record<Verdict["outcome"], string> = {
  block: "Blocked",
  flag: "Flagged",
  pass: "Passed",
};

const MONTH_KEY = /^\d{4}-\d{2}$/;

/** Dollar thresholds offered for `above:` and `below:`, kept to the ones that split the data. */
const LADDER = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const LADDER_SHOWN = 6;

export function isTokenKey(value: string): value is TokenKey {
  return (KEYS as string[]).includes(value);
}

/** Splits on whitespace, but keeps `card:"maya chen"` together as one word. */
export function scanWords(text: string): Word[] {
  const words: Word[] = [];
  let start = -1;
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') quoted = !quoted;
    if (!quoted && /\s/.test(char)) {
      if (start >= 0) words.push({ text: text.slice(start, index), start, end: index });
      start = -1;
    } else if (start < 0) {
      start = index;
    }
  }
  if (start >= 0) words.push({ text: text.slice(start), start, end: text.length });

  return words;
}

export function splitWord(word: string): { key: string; value: string } | null {
  const colon = word.indexOf(":");
  if (colon <= 0) return null;
  return { key: word.slice(0, colon).toLowerCase(), value: word.slice(colon + 1).replace(/"/g, "") };
}

function parseAmount(value: string): number | null {
  const bare = value.replace(/[$,]/g, "");
  if (bare === "") return null;
  const amount = Number(bare);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function amountLabel(cents: number): string {
  return cents % 100 === 0 ? dollars(cents) : money(cents);
}

export function parseToken(word: string): Token | null {
  const split = splitWord(word);
  if (split === null) return null;
  const { key, value } = split;
  if (!isTokenKey(key) || value === "") return null;

  if (key === "above" || key === "below") {
    const cents = parseAmount(value);
    if (cents === null) return null;
    return { key, value: String(cents), label: amountLabel(cents), word };
  }
  if (key === "is") {
    const outcome = OUTCOMES[value.toLowerCase()];
    if (outcome === undefined) return null;
    return { key, value: outcome, label: OUTCOME_LABEL[outcome], word };
  }
  if (key === "month") {
    if (!MONTH_KEY.test(value)) return null;
    return { key, value, label: `${monthName(value)} ${value.slice(0, 4)}`, word };
  }
  return { key, value: value.toLowerCase(), label: value, word };
}

function isBareKey(word: string): boolean {
  const split = splitWord(word);
  return split !== null && isTokenKey(split.key) && split.value === "";
}

export function parseQuery(text: string): Query {
  const tokens: Token[] = [];
  const words: string[] = [];

  for (const word of scanWords(text)) {
    const token = parseToken(word.text);
    if (token !== null) tokens.push(token);
    // A bare `mcc:` is someone mid-token with the menu open, not a filter that matches nothing.
    else if (!isBareKey(word.text)) words.push(word.text.replace(/"/g, "").toLowerCase());
  }

  return { tokens, words };
}

export function hasOutcomeToken(query: Query): boolean {
  return query.tokens.some((token) => token.key === "is");
}

/** The word to type for a value, quoted when it carries a space. */
export function tokenWord(key: TokenKey, value: string): string {
  return `${key}:${/\s/.test(value) ? `"${value}"` : value}`;
}

export function removeWord(text: string, word: string): string {
  return scanWords(text)
    .filter((item) => item.text !== word)
    .map((item) => item.text)
    .join(" ");
}

function matchesToken(token: Token, verdict: Verdict, merchants: Record<string, Merchant>): boolean {
  const txn = verdict.txn;
  switch (token.key) {
    case "above":
      return txn.amountCents > Number(token.value);
    case "below":
      return txn.amountCents < Number(token.value);
    case "card":
      return [txn.userName, txn.cardName].some((name) => name?.toLowerCase().includes(token.value) === true);
    case "mcc":
      return merchants[txn.merchant]?.mcc === token.value;
    case "is":
      return verdict.outcome === token.value;
    case "month":
      return monthKeyET(txn.postedAt) === token.value;
  }
}

/** Tokens of one kind widen (any may match); different kinds narrow (all must match). */
export function matchesQuery(
  query: Query,
  verdict: Verdict,
  merchants: Record<string, Merchant>,
): boolean {
  const txn = verdict.txn;
  const name = `${txn.merchant} ${merchants[txn.merchant]?.canonical ?? ""}`.toLowerCase();
  if (!query.words.every((word) => name.includes(word))) return false;

  return [...new Set(query.tokens.map((token) => token.key))].every((key) =>
    query.tokens.some((token) => token.key === key && matchesToken(token, verdict, merchants)),
  );
}

export type Suggestion = {
  /** Matches a parsed token's value, so a chip can find its label. */
  value: string;
  /** What goes into the search box when this one is picked. */
  typed: string;
  label: string;
  count: number | null;
};

export type Suggestions = Record<TokenKey, Suggestion[]>;

type Bucket = { label: string; count: number };

function tallyBy(txns: Txn[], pick: (txn: Txn) => { value: string; label: string } | null): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>();
  for (const txn of txns) {
    const entry = pick(txn);
    if (entry === null) continue;
    const bucket = buckets.get(entry.value);
    if (bucket === undefined) buckets.set(entry.value, { label: entry.label, count: 1 });
    else bucket.count += 1;
  }
  return buckets;
}

function byCount(buckets: Map<string, Bucket>): Suggestion[] {
  return [...buckets]
    .map(([value, bucket]) => ({ value, typed: value, label: bucket.label, count: bucket.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function amountSuggestions(txns: Txn[], key: "above" | "below"): Suggestion[] {
  const matching = (cents: number) =>
    txns.filter((txn) => (key === "above" ? txn.amountCents > cents : txn.amountCents < cents)).length;

  return LADDER.map((amount) => ({ amount, count: matching(amount * 100) }))
    .filter(({ count }) => count > 0 && count < txns.length)
    .slice(0, LADDER_SHOWN)
    .map(({ amount, count }) => ({
      value: String(amount * 100),
      typed: String(amount),
      label: dollars(amount * 100),
      count,
    }));
}

/** Every value each token can usefully take, drawn from the transactions on screen. */
export function tokenSuggestions(txns: Txn[], merchants: Record<string, Merchant>): Suggestions {
  const cards = tallyBy(txns, (txn) => {
    const name = txn.userName ?? txn.cardName;
    return name === null ? null : { value: name.toLowerCase(), label: name };
  });
  const mccs = tallyBy(txns, (txn) => {
    const merchant = merchants[txn.merchant];
    return merchant === undefined ? null : { value: merchant.mcc, label: `${merchant.mcc} ${merchant.mccName}` };
  });
  const months = tallyBy(txns, (txn) => {
    const key = monthKeyET(txn.postedAt);
    return { value: key, label: `${monthName(key)} ${key.slice(0, 4)}` };
  });

  return {
    above: amountSuggestions(txns, "above"),
    below: amountSuggestions(txns, "below"),
    card: byCount(cards),
    mcc: byCount(mccs),
    is: Object.entries(OUTCOMES).map(([typed, outcome]) => ({
      value: outcome,
      typed,
      label: OUTCOME_LABEL[outcome],
      count: null,
    })),
    month: [...months]
      .map(([value, bucket]) => ({ value, typed: value, label: bucket.label, count: bucket.count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
  };
}

export const TOKEN_HINT: Record<TokenKey, string> = {
  above: "amount over",
  below: "amount under",
  card: "cardholder",
  mcc: "category code",
  is: "outcome",
  month: "month in range",
};
