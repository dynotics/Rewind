import { CardSchema, TxnSchema, type Card, type Txn } from "./types";

type RhoCategory = { code: string };
type RhoMerchant = { name: string };

export type RhoCard = {
  id: string;
  name: string;
  last_4: string;
  cardholder?: {
    user_id: string;
    first_name: string;
    last_name: string;
  } | null;
  spending_limit?: { amount: number } | null;
  spending_limit_type?: string | null;
  blocked_categories?: RhoCategory[];
  blocked_merchants?: RhoMerchant[];
  allowed_categories?: RhoCategory[];
  allowed_merchants?: RhoMerchant[];
};

export type RhoTxn = {
  id: string;
  account_id: string;
  posted_at?: string | null;
  initiated_at?: string | null;
  amount: { amount: number };
  counterparty_name?: string | null;
  card_id?: string | null;
  card_name?: string | null;
  user_id?: string | null;
  user_full_name?: string | null;
  counterparty_logo_url?: string | null;
};

function toCard(card: RhoCard) {
  const cardholder = card.cardholder;
  return {
    id: card.id,
    name: card.name,
    last4: card.last_4,
    userId: cardholder?.user_id ?? null,
    holderName: cardholder
      ? `${cardholder.first_name} ${cardholder.last_name}`
      : null,
    limitCents: card.spending_limit?.amount ?? null,
    limitType: card.spending_limit_type ?? null,
    blockedMccs: (card.blocked_categories ?? []).map((c) => c.code),
    blockedMerchants: (card.blocked_merchants ?? []).map((m) => m.name),
    allowedMccs: (card.allowed_categories ?? []).map((c) => c.code),
    allowedMerchants: (card.allowed_merchants ?? []).map((m) => m.name),
  };
}

function toTxn(txn: RhoTxn) {
  return {
    id: txn.id,
    accountId: txn.account_id,
    postedAt: txn.posted_at ?? txn.initiated_at ?? null,
    amountCents: Math.abs(txn.amount.amount),
    merchant: txn.counterparty_name ?? "",
    cardId: txn.card_id ?? null,
    cardName: txn.card_name ?? null,
    userId: txn.user_id ?? null,
    userName: txn.user_full_name ?? null,
    logoUrl: txn.counterparty_logo_url ?? null,
  };
}

type MappedTxn = ReturnType<typeof toTxn>;

function isPosted(txn: MappedTxn): txn is MappedTxn & { postedAt: string } {
  return txn.postedAt !== null;
}

export function toCards(rawCards: RhoCard[]): Card[] {
  return CardSchema.array().parse(rawCards.map(toCard));
}

export function toTxns(rawTxns: RhoTxn[]): Txn[] {
  const byKey = new Map<string, MappedTxn & { postedAt: string }>();
  for (const txn of rawTxns.map(toTxn).filter(isPosted)) {
    byKey.set(`${txn.id}:${txn.accountId}`, txn);
  }
  return TxnSchema.array().parse(
    [...byKey.values()].sort((a, b) => a.postedAt.localeCompare(b.postedAt)),
  );
}
