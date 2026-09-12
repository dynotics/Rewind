import { monthKeyET } from "./engine";
import type { Card, LimitType, Policy, Txn } from "./types";

const CAP_MULTIPLIER = 1.15;
const PER_TXN_MULTIPLIER = 1.25;
const ROUNDING_CENTS = 5000;

export type CardRecommendation = {
  cardId: string;
  limitType: LimitType | null;
  monthlyCapCents: number;
  perTxnFlagCents: number;
  monthsOverCap: number;
  monthlyTotals: { month: string; cents: number }[];
};

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, rank)];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function roundUpToStep(cents: number): number {
  return Math.ceil(cents / ROUNDING_CENTS) * ROUNDING_CENTS;
}

function monthWindow(txns: Txn[]): string[] {
  return [...new Set(txns.map((txn) => monthKeyET(txn.postedAt)))].sort();
}

export function recommendedLimits(
  txns: Txn[],
  cards: Card[],
): CardRecommendation[] {
  const window = monthWindow(txns);

  return cards.map((card) => {
    const cardTxns = txns.filter((txn) => txn.cardId === card.id);
    if (cardTxns.length === 0) {
      return {
        cardId: card.id,
        limitType: card.limitType,
        monthlyCapCents: 0,
        perTxnFlagCents: 0,
        monthsOverCap: 0,
        monthlyTotals: [],
      };
    }

    const totals = new Map<string, number>(window.map((month) => [month, 0]));
    for (const txn of cardTxns) {
      const month = monthKeyET(txn.postedAt);
      totals.set(month, (totals.get(month) ?? 0) + txn.amountCents);
    }

    const monthlyTotals = window.map((month) => ({
      month,
      cents: totals.get(month) ?? 0,
    }));
    const monthlyCapCents = roundUpToStep(
      p95(monthlyTotals.map((entry) => entry.cents)) * CAP_MULTIPLIER,
    );
    const perTxnFlagCents = roundUpToStep(
      p95(cardTxns.map((txn) => txn.amountCents)) * PER_TXN_MULTIPLIER,
    );

    return {
      cardId: card.id,
      limitType: card.limitType,
      monthlyCapCents,
      perTxnFlagCents,
      monthsOverCap: monthlyTotals.filter(
        (entry) => entry.cents > monthlyCapCents,
      ).length,
      monthlyTotals,
    };
  });
}

export function recommendedPolicy(txns: Txn[], cards: Card[]): Policy {
  const limits = recommendedLimits(txns, cards);

  return {
    maxPerTxnCents: median(limits.map((limit) => limit.perTxnFlagCents)),
    monthlyCapCents: median(limits.map((limit) => limit.monthlyCapCents)),
    mode: "blocklist",
    mccs: [],
    merchants: [],
    scope: "all",
    scopeIds: [],
  };
}
