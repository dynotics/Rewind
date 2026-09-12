import { useState } from "react";
import { z } from "zod";
import cardsData from "../../data/cards.json";
import transactionsData from "../../data/transactions.json";
import { CardSchema, TxnSchema, type Card, type Txn } from "../lib/types";
import { clock } from "./format";
import type { SyncState } from "./Sidebar";

export type Dataset = { cards: Card[]; txns: Txn[]; syncedAt: string | null };

const SEED: Dataset = {
  cards: cardsData as Card[],
  txns: transactionsData as Txn[],
  syncedAt: null,
};

const LiveSchema = z.object({ cards: CardSchema.array(), txns: TxnSchema.array() });
const ErrorSchema = z.object({ error: z.string() });

async function fetchLive(): Promise<Dataset | string> {
  const response = await fetch("/api/live").catch(() => null);
  if (response === null) return "Could not reach the sync route";
  const body: unknown = await response.json().catch(() => null);
  const failure = ErrorSchema.safeParse(body);
  if (!response.ok) {
    return failure.success ? `Sync failed: ${failure.data.error}` : `Sync failed (${response.status})`;
  }
  const parsed = LiveSchema.safeParse(body);
  if (!parsed.success) return "Rho returned data in an unexpected shape";
  return { ...parsed.data, syncedAt: clock(new Date()) };
}

export function useDataset(onReplace: () => void) {
  const [data, setData] = useState<Dataset>(SEED);
  const [sync, setSync] = useState<SyncState>({ status: "idle" });

  const toggleSource = async () => {
    if (data.syncedAt !== null) {
      setData(SEED);
      setSync({ status: "idle" });
      onReplace();
      return;
    }
    setSync({ status: "syncing" });
    const result = await fetchLive();
    if (typeof result === "string") {
      setSync({ status: "failed", message: result });
      return;
    }
    setData(result);
    setSync({ status: "idle" });
    onReplace();
  };

  return { data, sync, toggleSource };
}
