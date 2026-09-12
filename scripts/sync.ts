import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync } from "node:fs";
import { fetchAll } from "../src/lib/rho";
import { toCards, toTxns, type RhoCard, type RhoTxn } from "../src/lib/mapRho";

async function main() {
  const rawCards = await fetchAll<RhoCard>("/cards", {});
  const cards = toCards(rawCards);

  const rawTxns = await fetchAll<RhoTxn>("/transactions", {
    transaction_type: "card_debit",
    status: "settled",
  });
  const txns = toTxns(rawTxns);

  writeFileSync("data/cards.json", `${JSON.stringify(cards, null, 2)}\n`);
  writeFileSync("data/transactions.json", `${JSON.stringify(txns, null, 2)}\n`);

  console.log(`synced ${cards.length} cards, ${txns.length} transactions`);
}

main();
