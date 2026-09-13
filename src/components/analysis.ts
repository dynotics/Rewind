import { monthKeyET } from "../lib/engine";
import type { CardRecommendation } from "../lib/recommend";
import type { Card, Merchant, Policy, Txn, Verdict } from "../lib/types";
import { dollars } from "./format";

const ROUNDING_CENTS = 5000;
const NEAR_MEDIAN = 0.3;
const USUAL_MIN_CHARGES = 3;

export const EMPTY_POLICY: Policy = {
  maxPerTxnCents: null,
  monthlyCapCents: null,
  mode: "blocklist",
  mccs: [],
  merchants: [],
  scope: "all",
  scopeIds: [],
};

export type Filter = "all" | "block" | "flag" | "wrong";

export type Total = { count: number; cents: number };

export type Tally = Record<Exclude<Filter, "all">, Total>;

export type WrongBlock = {
  verdict: Verdict;
  canonical: string;
  months: number;
  windowMonths: number;
};

export type Fix = { label: string; policy: Policy };

export function roundUp(cents: number): number {
  return Math.ceil(cents / ROUNDING_CENTS) * ROUNDING_CENTS;
}

export function monthWindow(txns: Txn[]): string[] {
  return [...new Set(txns.map((txn) => monthKeyET(txn.postedAt)))].sort();
}

export function inScope(txn: Txn, policy: Policy): boolean {
  if (policy.scope === "all") return true;
  if (policy.scope === "card") {
    return txn.cardId !== null && policy.scopeIds.includes(txn.cardId);
  }
  return txn.userId !== null && policy.scopeIds.includes(txn.userId);
}

export function appliesToCard(card: Card, policy: Policy): boolean {
  if (policy.scope === "all") return true;
  if (policy.scope === "card") return policy.scopeIds.includes(card.id);
  return card.userId !== null && policy.scopeIds.includes(card.userId);
}

function isLimitBlock(verdict: Verdict): boolean {
  return (
    verdict.outcome === "block" &&
    verdict.reasons.some(
      (reason) =>
        reason.includes("monthly cap") || reason.includes("per-charge max"),
    )
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function canonicalOf(txn: Txn, merchants: Record<string, Merchant>): string {
  return merchants[txn.merchant]?.canonical ?? txn.merchant;
}

function holderKey(txn: Txn, merchants: Record<string, Merchant>): string {
  return `${txn.userId ?? txn.cardId ?? ""}:${canonicalOf(txn, merchants)}`;
}

export function peersOf(
  txn: Txn,
  txns: Txn[],
  merchants: Record<string, Merchant>,
): Txn[] {
  const key = holderKey(txn, merchants);
  return txns.filter((other) => holderKey(other, merchants) === key);
}

export function wronglyBlocked(
  verdicts: Verdict[],
  txns: Txn[],
  merchants: Record<string, Merchant>,
): WrongBlock[] {
  const windowMonths = monthWindow(txns).length;
  const results: WrongBlock[] = [];

  for (const verdict of verdicts) {
    if (verdict.outcome !== "block") continue;
    const recurring = merchants[verdict.txn.merchant]?.isRecurring === true;
    const peers = peersOf(verdict.txn, txns, merchants);
    const usual = median(peers.map((txn) => txn.amountCents));
    const near =
      peers.length >= USUAL_MIN_CHARGES &&
      Math.abs(verdict.txn.amountCents - usual) <= usual * NEAR_MEDIAN;
    if (!recurring && (!isLimitBlock(verdict) || !near)) continue;
    results.push({
      verdict,
      canonical: canonicalOf(verdict.txn, merchants),
      months: new Set(peers.map((txn) => monthKeyET(txn.postedAt))).size,
      windowMonths,
    });
  }

  return results.sort((a, b) => b.months - a.months);
}

export function tally(verdicts: Verdict[], wrongIds: Set<string>): Tally {
  const result: Tally = {
    block: { count: 0, cents: 0 },
    flag: { count: 0, cents: 0 },
    wrong: { count: 0, cents: 0 },
  };
  const add = (key: keyof Tally, cents: number) => {
    result[key].count += 1;
    result[key].cents += cents;
  };

  for (const verdict of verdicts) {
    const cents = verdict.txn.amountCents;
    if (verdict.outcome === "block") add("block", cents);
    if (verdict.outcome === "flag") add("flag", cents);
    if (wrongIds.has(verdict.txn.id)) add("wrong", cents);
  }

  return result;
}

export function matchesFilter(
  verdict: Verdict,
  filter: Filter,
  wrongIds: Set<string>,
): boolean {
  if (filter === "all") return true;
  if (filter === "wrong") return wrongIds.has(verdict.txn.id);
  return verdict.outcome === filter;
}

function scopeMonthKey(txn: Txn, policy: Policy): string {
  const holder = policy.scope === "user" ? txn.userId : txn.cardId;
  return `${holder ?? ""}:${monthKeyET(txn.postedAt)}`;
}

export function capToClear(
  wrong: WrongBlock[],
  txns: Txn[],
  policy: Policy,
): number | null {
  if (policy.monthlyCapCents === null) return null;
  const keys = new Set(wrong.map((row) => scopeMonthKey(row.verdict.txn, policy)));
  if (keys.size === 0) return null;
  const totals = new Map<string, number>();
  for (const txn of txns) {
    if (!inScope(txn, policy)) continue;
    const key = scopeMonthKey(txn, policy);
    if (keys.has(key)) totals.set(key, (totals.get(key) ?? 0) + txn.amountCents);
  }
  const needed = roundUp(Math.max(0, ...totals.values()));
  return needed > policy.monthlyCapCents ? needed : null;
}

function listFix(
  label: string,
  policy: Policy,
  field: "mccs" | "merchants",
  value: string,
  on: boolean,
): Fix {
  const without = policy[field].filter((item) => item !== value);
  return { label, policy: { ...policy, [field]: on ? [...without, value] : without } };
}

function listFixes(verdict: Verdict, policy: Policy, merchant: Merchant): Fix[] {
  const { mcc, mccName, canonical } = merchant;

  if (policy.mode === "allowlist") {
    if (!verdict.reasons.includes("not on allowlist")) return [];
    return [
      listFix(`Allow ${canonical}`, policy, "merchants", canonical, true),
      listFix(`Allow MCC ${mcc} ${mccName}`, policy, "mccs", mcc, true),
    ];
  }

  const fixes: Fix[] = [];
  if (policy.merchants.includes(canonical)) {
    fixes.push(listFix(`Unblock ${canonical}`, policy, "merchants", canonical, false));
  }
  if (policy.mccs.includes(mcc)) {
    fixes.push(listFix(`Unblock MCC ${mcc} ${mccName}`, policy, "mccs", mcc, false));
  }
  if (verdict.outcome === "pass") {
    fixes.push(listFix(`Block ${canonical}`, policy, "merchants", canonical, true));
    fixes.push(listFix(`Block MCC ${mcc} ${mccName}`, policy, "mccs", mcc, true));
  }
  return fixes;
}

function monthThrough(verdict: Verdict, txns: Txn[], policy: Policy): number {
  const key = scopeMonthKey(verdict.txn, policy);
  const until = Date.parse(verdict.txn.postedAt);
  return txns
    .filter((txn) => inScope(txn, policy) && Date.parse(txn.postedAt) <= until)
    .filter((txn) => scopeMonthKey(txn, policy) === key)
    .reduce((sum, txn) => sum + txn.amountCents, 0);
}

function limitFixes(verdict: Verdict, policy: Policy, txns: Txn[]): Fix[] {
  const fixes: Fix[] = [];
  const said = (text: string) => verdict.reasons.some((reason) => reason.includes(text));

  if (said("monthly cap") && policy.monthlyCapCents !== null) {
    const cap = roundUp(monthThrough(verdict, txns, policy));
    fixes.push({
      label: `Raise monthly limit to ${dollars(cap)}`,
      policy: { ...policy, monthlyCapCents: cap },
    });
  }
  if (said("per-charge max") && policy.maxPerTxnCents !== null) {
    const max = roundUp(verdict.txn.amountCents);
    fixes.push({
      label: `Raise per-charge max to ${dollars(max)}`,
      policy: { ...policy, maxPerTxnCents: max },
    });
  }
  return fixes;
}

export function fixesFor(
  verdict: Verdict,
  policy: Policy,
  merchants: Record<string, Merchant>,
  txns: Txn[],
): Fix[] {
  if (!inScope(verdict.txn, policy)) return [];
  const merchant = merchants[verdict.txn.merchant];
  const fromLists = merchant === undefined ? [] : listFixes(verdict, policy, merchant);
  return [...limitFixes(verdict, policy, txns), ...fromLists];
}

export function cardRule(card: Card, rec: CardRecommendation | undefined): Policy {
  const allow = card.allowedMccs.length > 0 || card.allowedMerchants.length > 0;
  return {
    maxPerTxnCents: rec?.perTxnFlagCents || null,
    monthlyCapCents: rec?.monthlyCapCents || null,
    mode: allow ? "allowlist" : "blocklist",
    mccs: allow ? card.allowedMccs : card.blockedMccs,
    merchants: allow ? card.allowedMerchants : card.blockedMerchants,
    scope: "card",
    scopeIds: [card.id],
  };
}
