"use client";

import { useMemo, useState } from "react";
import cardsData from "../../data/cards.json";
import merchantsData from "../../data/merchants.json";
import transactionsData from "../../data/transactions.json";
import { replay } from "../lib/engine";
import { findings } from "../lib/findings";
import type { Card, Merchant, Policy, Txn, Verdict } from "../lib/types";

const txns = transactionsData as Txn[];
const cards = cardsData as Card[];
const merchants = merchantsData as Record<string, Merchant>;
const detected = findings(txns, cards, merchants);

const DEFAULT_POLICY: Policy = {
  maxPerTxnCents: null,
  monthlyCapCents: null,
  mode: "blocklist",
  mccs: [],
  merchants: [],
  scope: "all",
  scopeIds: [],
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const ROW_CLASS: Record<Verdict["outcome"], string> = {
  pass: "",
  flag: "bg-amber-100 dark:bg-amber-950",
  block: "bg-red-100 dark:bg-red-950",
};

function dateET(iso: string): string {
  const parts = DATE_FORMAT.formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function money(cents: number): string {
  return USD.format(cents / 100);
}

export default function Home() {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const verdicts = useMemo(() => replay(txns, policy, merchants), [policy]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Findings</h2>
        <ul className="flex flex-col gap-2">
          {detected.map((finding) => (
            <li key={finding.id}>
              <button
                type="button"
                onClick={() => setPolicy(finding.suggested)}
                className="flex w-full items-center justify-between gap-4 rounded border border-zinc-200 px-3 py-2 text-left hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span>{finding.title}</span>
                <span className="font-mono tabular-nums">
                  {money(finding.impactCents)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
              <th className="px-2 py-1">Date</th>
              <th className="px-2 py-1">Merchant</th>
              <th className="px-2 py-1 text-right">Amount</th>
              <th className="px-2 py-1">Outcome</th>
              <th className="px-2 py-1">Reasons</th>
            </tr>
          </thead>
          <tbody>
            {verdicts.map((verdict) => (
              <tr
                key={verdict.txn.id}
                className={`border-b border-zinc-200 dark:border-zinc-800 ${ROW_CLASS[verdict.outcome]}`}
              >
                <td className="whitespace-nowrap px-2 py-1 font-mono">
                  {dateET(verdict.txn.postedAt)}
                </td>
                <td className="px-2 py-1">{verdict.txn.merchant}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">
                  {money(verdict.txn.amountCents)}
                </td>
                <td className="px-2 py-1">{verdict.outcome}</td>
                <td className="px-2 py-1">{verdict.reasons.join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
