import { useMemo } from "react";
import { changePlan } from "../lib/changePlan";
import { replay } from "../lib/engine";
import type { Card, Merchant, Policy } from "../lib/types";
import {
  EMPTY_POLICY,
  capToClear,
  fixesFor,
  inScope,
  matchesFilter,
  monthWindow,
  peersOf,
  tally,
  wronglyBlocked,
  type Filter,
} from "./analysis";
import { matchesQuery, parseQuery } from "./query";
import type { Dataset } from "./useDataset";
import type { TxnContext } from "./TxnDrawer";

type Options = {
  data: Dataset;
  merchants: Record<string, Merchant>;
  policy: Policy;
  progress: number;
  filter: Filter;
  query: string;
};

export function scopeLabel(policy: Policy, cards: Card[]): string {
  if (policy.scope === "all" || policy.scopeIds.length === 0) return "all cards";
  const names = cards
    .filter((card) => policy.scopeIds.includes(policy.scope === "card" ? card.id : card.userId ?? ""))
    .map((card) => (policy.scope === "card" ? card.name : card.holderName ?? card.name));
  return [...new Set(names)].join(", ");
}

export function useReplay({ data, merchants, policy, progress, filter, query }: Options) {
  const verdicts = useMemo(() => replay(data.txns, policy, merchants), [data, policy, merchants]);
  const months = useMemo(() => monthWindow(data.txns), [data]);
  const indexById = useMemo(() => new Map(verdicts.map((verdict, index) => [verdict.txn.id, index])), [verdicts]);
  const wrong = useMemo(() => wronglyBlocked(verdicts, data.txns, merchants), [verdicts, data, merchants]);
  const wrongIds = useMemo(() => new Set(wrong.map((row) => row.verdict.txn.id)), [wrong]);
  const plan = useMemo(
    () => (policy === EMPTY_POLICY ? [] : changePlan(policy, data.cards, data.txns)),
    [policy, data],
  );
  const raiseTo = useMemo(() => capToClear(wrong, data.txns, policy), [wrong, data, policy]);
  // Parsed here rather than per row, and so a half-typed `above:` drops out before it can filter.
  const parsed = useMemo(() => parseQuery(query), [query]);

  const candidates = useMemo(() => {
    const everyone = policy.scope === "all" || policy.scopeIds.length === 0;
    return verdicts
      .map((verdict, index) => ({ verdict, index }))
      .filter(({ verdict }) => everyone || inScope(verdict.txn, policy))
      .filter(({ verdict }) => matchesQuery(parsed, verdict, merchants))
      .filter(({ verdict }) => matchesFilter(verdict, filter, wrongIds));
  }, [verdicts, policy, parsed, merchants, filter, wrongIds]);

  const revealed = Math.floor(progress * verdicts.length);
  const rows = filter === "all" ? candidates : candidates.filter((row) => row.index < revealed);
  const indexOf = (txnId: string | null) => (txnId === null ? null : indexById.get(txnId) ?? null);

  return {
    verdicts,
    months,
    revealed,
    rows,
    plan,
    raiseTo,
    indexOf,
    tally: tally(verdicts.slice(0, revealed), wrongIds),
    wrongShown: wrong.filter((row) => (indexById.get(row.verdict.txn.id) ?? 0) < revealed),
    wrongFor: (txnId: string) => wrong.find((row) => row.verdict.txn.id === txnId),
  };
}

export function txnContext(
  index: number,
  replayed: ReturnType<typeof useReplay>,
  data: Dataset,
  merchants: Record<string, Merchant>,
  policy: Policy,
): TxnContext {
  const verdict = replayed.verdicts[index];
  const peers = peersOf(verdict.txn, data.txns, merchants);
  return {
    verdict,
    card: data.cards.find((card) => card.id === verdict.txn.cardId),
    merchant: merchants[verdict.txn.merchant],
    inScope: inScope(verdict.txn, policy),
    wrong: replayed.wrongFor(verdict.txn.id),
    peerCount: peers.length,
    peerMonths: monthWindow(peers).length,
    windowMonths: replayed.months.length,
    fixes: fixesFor(verdict, policy, merchants, data.txns),
  };
}

export function neighbourException(
  replayed: ReturnType<typeof useReplay>,
  policy: Policy,
  from: number,
  direction: 1 | -1,
): number | null {
  for (let index = from + direction; index >= 0 && index < replayed.verdicts.length; index += direction) {
    const verdict = replayed.verdicts[index];
    if (verdict.outcome !== "pass" && inScope(verdict.txn, policy)) return index;
  }
  return null;
}
