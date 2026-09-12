import type { Merchant, Policy, Txn, Verdict } from "./types";

type Outcome = Verdict["outcome"];

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
});

export function monthKeyET(iso: string): string {
  const parts = MONTH_FORMAT.formatToParts(new Date(iso));
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

function inScope(txn: Txn, policy: Policy): boolean {
  if (policy.scope === "all") return true;
  if (policy.scope === "card") {
    return txn.cardId !== null && policy.scopeIds.includes(txn.cardId);
  }
  return txn.userId !== null && policy.scopeIds.includes(txn.userId);
}

function scopeKey(txn: Txn, policy: Policy): string {
  if (policy.scope === "user") return txn.userId ?? "";
  return txn.cardId ?? "";
}

function dollars(cents: number): string {
  return String(Math.round(cents / 100));
}

function merchantReasons(
  merchant: Merchant | undefined,
  policy: Policy,
): string[] {
  if (policy.mode === "blocklist") {
    if (merchant === undefined) return [];
    const reasons: string[] = [];
    if (policy.mccs.includes(merchant.mcc)) {
      reasons.push(`MCC ${merchant.mcc} (${merchant.mccName}) blocked`);
    }
    if (policy.merchants.includes(merchant.canonical)) {
      reasons.push(`${merchant.canonical} blocked`);
    }
    return reasons;
  }

  if (policy.mccs.length === 0 && policy.merchants.length === 0) return [];

  const listed =
    merchant !== undefined &&
    (policy.mccs.includes(merchant.mcc) ||
      policy.merchants.includes(merchant.canonical));

  return listed ? [] : ["not on allowlist"];
}

export function replay(
  txns: Txn[],
  policy: Policy,
  merchants: Record<string, Merchant>,
): Verdict[] {
  const ordered = [...txns].sort(
    (a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt),
  );
  const totals = new Map<string, number>();
  const verdicts: Verdict[] = [];

  for (const txn of ordered) {
    if (!inScope(txn, policy)) {
      verdicts.push({
        txn,
        outcome: "pass",
        reasons: [],
        runningMonthCents: 0,
      });
      continue;
    }

    const reasons = merchantReasons(merchants[txn.merchant], policy);
    let outcome: Outcome = reasons.length > 0 ? "block" : "pass";

    if (
      outcome !== "block" &&
      policy.maxPerTxnCents !== null &&
      txn.amountCents > policy.maxPerTxnCents
    ) {
      outcome = "flag";
      reasons.push(`over per-charge max ($${dollars(policy.maxPerTxnCents)})`);
    }

    const key = `${scopeKey(txn, policy)}:${monthKeyET(txn.postedAt)}`;
    const running = totals.get(key) ?? 0;

    if (
      outcome !== "block" &&
      policy.monthlyCapCents !== null &&
      running + txn.amountCents > policy.monthlyCapCents
    ) {
      outcome = "block";
      reasons.push(`exceeds monthly cap ($${dollars(policy.monthlyCapCents)})`);
    }

    const runningMonthCents =
      outcome === "block" ? running : running + txn.amountCents;
    totals.set(key, runningMonthCents);
    verdicts.push({ txn, outcome, reasons, runningMonthCents });
  }

  return verdicts;
}
