import { monthKeyET } from "./engine";
import type { Card, Finding, Merchant, Policy, Txn } from "./types";

const RISK_MCCS = ["7995", "5921", "0742"];

const RISK_CATEGORY_LABELS: Record<string, string> = {
  "7995": "gambling",
  "5921": "liquor store",
  "0742": "veterinary",
};

function dollars(cents: number): string {
  return String(Math.round(cents / 100));
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, rank)];
}

function recommendedCap(monthlyTotals: number[]): number {
  const raised = Math.ceil(p95(monthlyTotals) * 1.15);
  return Math.ceil(raised / 5000) * 5000;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group === undefined) groups.set(k, [item]);
    else group.push(item);
  }
  return groups;
}

function monthWindow(txns: Txn[]): string[] {
  return [...new Set(txns.map((txn) => monthKeyET(txn.postedAt)))].sort();
}

function monthlyTotals(txns: Txn[], window: string[]): number[] {
  const totals = new Map<string, number>(window.map((month) => [month, 0]));
  for (const txn of txns) {
    const month = monthKeyET(txn.postedAt);
    totals.set(month, (totals.get(month) ?? 0) + txn.amountCents);
  }
  return window.map((month) => totals.get(month) ?? 0);
}

function cardPolicy(cardId: string, overrides: Partial<Policy>): Policy {
  return {
    maxPerTxnCents: null,
    monthlyCapCents: null,
    mode: "blocklist",
    mccs: [],
    merchants: [],
    scope: "card",
    scopeIds: [cardId],
    ...overrides,
  };
}

function duplicateSubscriptions(
  txns: Txn[],
  cardsById: Map<string, Card>,
  merchants: Record<string, Merchant>,
): Finding[] {
  const recurring = txns.filter(
    (txn) => txn.cardId !== null && merchants[txn.merchant]?.isRecurring === true,
  );
  const byCanonical = groupBy(recurring, (txn) => merchants[txn.merchant].canonical);
  const results: Finding[] = [];

  for (const [canonical, merchantTxns] of byCanonical) {
    const byCard = [...groupBy(merchantTxns, (txn) => txn.cardId ?? "")]
      .map(([cardId, cardTxns]) => {
        const months = groupBy(cardTxns, (txn) => monthKeyET(txn.postedAt));
        const monthlyAmounts = [...months.values()].map((group) =>
          sum(group.map((txn) => txn.amountCents)),
        );
        return {
          cardId,
          name: cardsById.get(cardId)?.name ?? cardTxns[0].cardName ?? cardId,
          txns: cardTxns,
          monthCount: months.size,
          total: sum(cardTxns.map((txn) => txn.amountCents)),
          monthly: median(monthlyAmounts),
        };
      })
      .filter((entry) => entry.monthCount >= 4);

    if (byCard.length < 2) continue;

    const smaller = [...byCard].sort((a, b) => a.total - b.total)[0];
    const detail = byCard
      .map((entry) => `${entry.name} $${dollars(entry.monthly)}/mo`)
      .join(", ");

    results.push({
      id: `duplicate_subscription:${canonical}`,
      kind: "duplicate_subscription",
      title: `${canonical} billed on ${byCard.length} cards`,
      detail,
      cardId: smaller.cardId,
      evidenceTxnIds: smaller.txns.map((txn) => txn.id),
      impactCents: Math.round(smaller.monthly * 12),
      suggested: cardPolicy(smaller.cardId, {
        mode: "blocklist",
        merchants: [canonical],
      }),
    });
  }

  return results;
}

function controlLeakage(
  card: Card,
  cardTxns: Txn[],
  merchants: Record<string, Merchant>,
): Finding | null {
  if (card.allowedMccs.length === 0 && card.allowedMerchants.length === 0) {
    return null;
  }

  const outside = cardTxns.filter((txn) => {
    const merchant = merchants[txn.merchant];
    if (merchant === undefined) return true;
    return (
      !card.allowedMccs.includes(merchant.mcc) &&
      !card.allowedMerchants.includes(merchant.canonical)
    );
  });
  if (outside.length === 0) return null;

  const outsideCents = sum(outside.map((txn) => txn.amountCents));
  const totalCents = sum(cardTxns.map((txn) => txn.amountCents));
  const pct = Math.round((outsideCents / totalCents) * 100);
  const byMerchant = groupBy(
    outside,
    (txn) => merchants[txn.merchant]?.canonical ?? txn.merchant,
  );
  const top = [...byMerchant]
    .map(([canonical, group]) => ({
      canonical,
      cents: sum(group.map((txn) => txn.amountCents)),
    }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 3)
    .map((entry) => entry.canonical)
    .join(", ");

  return {
    id: `control_leakage:${card.id}`,
    kind: "control_leakage",
    title: `${card.name} spends outside its allowlist`,
    detail: `${outside.length} charges, ${pct}% of spend, at ${top}`,
    cardId: card.id,
    evidenceTxnIds: outside.map((txn) => txn.id),
    impactCents: outsideCents,
    suggested: cardPolicy(card.id, {
      mode: "allowlist",
      mccs: card.allowedMccs,
      merchants: card.allowedMerchants,
    }),
  };
}

function riskCategory(
  card: Card,
  cardTxns: Txn[],
  merchants: Record<string, Merchant>,
): Finding | null {
  const risky = cardTxns.filter((txn) => {
    const mcc = merchants[txn.merchant]?.mcc;
    return (
      mcc !== undefined &&
      RISK_MCCS.includes(mcc) &&
      !card.blockedMccs.includes(mcc)
    );
  });
  if (risky.length === 0) return null;

  const byMcc = groupBy(risky, (txn) => merchants[txn.merchant].mcc);
  const detail = [...byMcc]
    .map(([, group]) => {
      const name = merchants[group[0].merchant].mccName;
      return `${name} $${dollars(sum(group.map((txn) => txn.amountCents)))}`;
    })
    .join(", ");
  const categories = [...new Set(
    [...byMcc].map(
      ([mcc, group]) => RISK_CATEGORY_LABELS[mcc] ?? merchants[group[0].merchant].mccName.toLowerCase(),
    ),
  )];
  const categoryPhrase =
    categories.length <= 1
      ? categories[0]
      : categories.length === 2
        ? categories.join(" and ")
        : `${categories.slice(0, -1).join(", ")}, and ${categories[categories.length - 1]}`;

  return {
    id: `risk_category:${card.id}`,
    kind: "risk_category",
    title: `${card.name} has ${risky.length} ${categoryPhrase} ${risky.length === 1 ? "charge" : "charges"} on a card with no category blocks`,
    detail,
    cardId: card.id,
    evidenceTxnIds: risky.map((txn) => txn.id),
    impactCents: sum(risky.map((txn) => txn.amountCents)),
    suggested: cardPolicy(card.id, { mode: "blocklist", mccs: [...byMcc.keys()] }),
  };
}

function noLimit(card: Card, cardTxns: Txn[], totals: number[]): Finding | null {
  if (card.limitCents !== null) return null;
  const largest = Math.max(0, ...totals);

  return {
    id: `no_limit:${card.id}`,
    kind: "no_limit",
    title: `${card.name} has no spending limit`,
    detail: `largest month $${dollars(largest)}`,
    cardId: card.id,
    evidenceTxnIds: cardTxns.map((txn) => txn.id),
    impactCents: largest,
    suggested: cardPolicy(card.id, { monthlyCapCents: recommendedCap(totals) }),
  };
}

function limitTooHigh(card: Card, cardTxns: Txn[], totals: number[]): Finding | null {
  if (card.limitCents === null) return null;
  if (card.limitType === "fixed") return fixedLimitTooHigh(card, cardTxns, totals);
  if (card.limitType !== "monthly") return null;
  const percentile = p95(totals);
  if (card.limitCents <= 3 * percentile) return null;
  const cap = recommendedCap(totals);
  const ratio = Math.round(card.limitCents / percentile);

  return {
    id: `limit_too_high:${card.id}`,
    kind: "limit_too_high",
    title: `${card.name} limit is ${ratio}x actual spend`,
    detail: `limit $${dollars(card.limitCents)}, 95th percentile month $${dollars(percentile)}`,
    cardId: card.id,
    evidenceTxnIds: cardTxns.map((txn) => txn.id),
    impactCents: card.limitCents - cap,
    suggested: cardPolicy(card.id, { monthlyCapCents: cap }),
  };
}

function fixedLimitTooHigh(
  card: Card,
  cardTxns: Txn[],
  totals: number[],
): Finding | null {
  if (card.limitCents === null) return null;
  const total = sum(totals);
  if (card.limitCents <= 2 * total) return null;
  const cap = recommendedCap(totals);
  const ratio = Math.round(card.limitCents / total);

  return {
    id: `limit_too_high:${card.id}`,
    kind: "limit_too_high",
    title: `${card.name} limit is ${ratio}x actual spend`,
    detail: `limit $${dollars(card.limitCents)}, ${totals.length}-month total $${dollars(total)}`,
    cardId: card.id,
    evidenceTxnIds: cardTxns.map((txn) => txn.id),
    impactCents: card.limitCents - total,
    suggested: cardPolicy(card.id, { monthlyCapCents: cap }),
  };
}

function spendAcceleration(
  card: Card,
  cardTxns: Txn[],
  window: string[],
  totals: number[],
): Finding | null {
  if (totals.length < 4) return null;
  const last = totals.slice(-3);
  const base = totals[totals.length - 4];
  const rising = last.every(
    (value, index) => value > (index === 0 ? base : last[index - 1]),
  );
  if (!rising) return null;

  const runMonths = new Set(window.slice(-3));
  const evidence = cardTxns.filter((txn) => runMonths.has(monthKeyET(txn.postedAt)));

  return {
    id: `spend_acceleration:${card.id}`,
    kind: "spend_acceleration",
    title: `${card.name} spend rising ${last.length} months straight`,
    detail: last.map((value) => `$${dollars(value)}`).join(", "),
    cardId: card.id,
    evidenceTxnIds: evidence.map((txn) => txn.id),
    impactCents: last[last.length - 1] - base,
    suggested: cardPolicy(card.id, { monthlyCapCents: recommendedCap(totals) }),
  };
}

export function findings(
  txns: Txn[],
  cards: Card[],
  merchants: Record<string, Merchant>,
): Finding[] {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const byCard = groupBy(txns, (txn) => txn.cardId ?? "");
  const window = monthWindow(txns);
  const results: Finding[] = duplicateSubscriptions(txns, cardsById, merchants);

  for (const card of cards) {
    const cardTxns = byCard.get(card.id) ?? [];
    const totals = monthlyTotals(cardTxns, window);
    const detected = [
      controlLeakage(card, cardTxns, merchants),
      riskCategory(card, cardTxns, merchants),
      noLimit(card, cardTxns, totals),
      limitTooHigh(card, cardTxns, totals),
      spendAcceleration(card, cardTxns, window, totals),
    ];
    for (const finding of detected) {
      if (finding !== null) results.push(finding);
    }
  }

  return results.sort((a, b) => b.impactCents - a.impactCents);
}
