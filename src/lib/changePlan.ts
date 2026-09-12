import type { Card, Policy, Txn } from "./types";

const DOLLARS = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export type CardChange = {
  cardId: string;
  cardName: string;
  lines: string[];
  payload: Record<string, unknown>;
};

function dollars(cents: number): string {
  return DOLLARS.format(Math.round(cents / 100));
}

function applies(card: Card, policy: Policy): boolean {
  if (policy.scope === "all") return true;
  if (policy.scope === "card") return policy.scopeIds.includes(card.id);
  return card.userId !== null && policy.scopeIds.includes(card.userId);
}

function missing(from: string[], against: string[]): string[] {
  return from.filter((value) => !against.includes(value));
}

function listDiff(
  field: string,
  current: string[],
  proposed: string[],
  lines: string[],
  payload: Record<string, unknown>,
): void {
  const added = missing(proposed, current);
  const removed = missing(current, proposed);
  if (added.length === 0 && removed.length === 0) return;
  if (added.length > 0) lines.push(`${field}: + ${added.join(", ")}`);
  if (removed.length > 0) lines.push(`${field}: - ${removed.join(", ")}`);
  payload[field] = proposed;
}

export function changePlan(
  policy: Policy,
  cards: Card[],
  txns: Txn[],
): CardChange[] {
  void txns;
  const changes: CardChange[] = [];

  for (const card of cards) {
    if (!applies(card, policy)) continue;

    const lines: string[] = [];
    const payload: Record<string, unknown> = {};

    if (
      policy.monthlyCapCents !== null &&
      policy.monthlyCapCents !== card.limitCents
    ) {
      const current =
        card.limitCents === null ? "none" : `$${dollars(card.limitCents)}`;
      const proposed = `$${dollars(policy.monthlyCapCents)}`;
      lines.push(
        card.limitType !== null && card.limitType !== "monthly"
          ? `spending_limit: ${current} ${card.limitType} -> ${proposed} monthly`
          : `spending_limit: ${current} -> ${proposed}`,
      );
      payload.spending_limit = policy.monthlyCapCents;
      payload.spending_limit_type = "monthly";
    }

    const allowMode =
      card.allowedMccs.length > 0 || card.allowedMerchants.length > 0;
    listDiff(
      allowMode ? "allowed_categories" : "blocked_categories",
      allowMode ? card.allowedMccs : card.blockedMccs,
      policy.mccs,
      lines,
      payload,
    );
    listDiff(
      allowMode ? "allowed_merchants" : "blocked_merchants",
      allowMode ? card.allowedMerchants : card.blockedMerchants,
      policy.merchants,
      lines,
      payload,
    );

    if (lines.length === 0) continue;

    if (policy.maxPerTxnCents !== null) {
      lines.push(
        `per-charge max $${dollars(policy.maxPerTxnCents)}: Rho exposes no per-charge card control. Use a lower monthly limit or a fixed-amount virtual card above this size.`,
      );
    }

    changes.push({ cardId: card.id, cardName: card.name, lines, payload });
  }

  return changes;
}
