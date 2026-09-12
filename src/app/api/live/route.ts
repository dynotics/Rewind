import { NextResponse } from "next/server";
import { fetchAll } from "../../../lib/rho";
import { toCards, toTxns, type RhoCard, type RhoTxn } from "../../../lib/mapRho";

export async function GET() {
  try {
    const rawCards = await fetchAll<RhoCard>("/cards", {});
    const rawTxns = await fetchAll<RhoTxn>("/transactions", {
      transaction_type: "card_debit",
      status: "settled",
    });

    return NextResponse.json({
      cards: toCards(rawCards),
      txns: toTxns(rawTxns),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rho request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
