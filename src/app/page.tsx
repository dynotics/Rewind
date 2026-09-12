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
  pass: "hover:bg-[#2E2B26]",
  flag: "bg-[rgba(255,214,98,0.16)] hover:bg-[rgba(255,214,98,0.24)]",
  block: "bg-[rgba(255,127,67,0.18)] hover:bg-[rgba(255,127,67,0.26)]",
};

const OUTCOME_CLASS: Record<Verdict["outcome"], string> = {
  pass: "bg-[rgba(169,211,160,0.13)] text-[#A9D3A0]",
  flag: "bg-[rgba(255,214,98,0.12)] text-[#FFD662]",
  block: "bg-[rgba(255,127,67,0.13)] text-[#FF9A6B]",
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
    <main className="grid min-h-screen w-full flex-1 grid-cols-1 bg-[#1A1815] font-sans text-sm leading-[1.45] text-white tabular-nums antialiased lg:grid-cols-[320px_minmax(0,1fr)]">
      <section className="border-b border-[#36322E] bg-[#191613] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <h2 className="px-[18px] pb-2 pt-5 text-[23px] font-semibold tracking-[-0.02em] text-white">
          Findings
        </h2>
        <ul className="flex flex-col border-t border-[#26231F]">
          {detected.map((finding) => (
            <li key={finding.id}>
              <button
                type="button"
                aria-pressed={policy === finding.suggested}
                onClick={() => setPolicy(finding.suggested)}
                className="flex w-full flex-col items-start gap-[5px] border-b border-l-2 border-b-[#26231F] border-l-transparent px-[18px] py-[13px] text-left hover:bg-[#211E1B] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#F8B056] aria-pressed:border-l-[#F8B056] aria-pressed:bg-[#2E2B26]"
              >
                <span className="text-[13px] leading-[1.35] text-white">
                  {finding.title}
                </span>
                <span className="text-[12.5px] text-[#EDE9E3] tabular-nums">
                  {money(finding.impactCents)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex min-w-0 flex-col px-[22px] pb-[30px] pt-5 lg:h-screen">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#36322E] bg-[#211E1B]">
          <div className="max-h-[70vh] min-h-0 flex-1 overflow-auto lg:max-h-none">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="text-left">
                  <th className="sticky top-0 z-10 w-[106px] border-b border-[#26231F] bg-[#211E1B] px-4 py-[9px] text-[11px] font-normal text-[#8A8784]">
                    Date
                  </th>
                  <th className="sticky top-0 z-10 border-b border-[#26231F] bg-[#211E1B] px-4 py-[9px] text-[11px] font-normal text-[#8A8784]">
                    Merchant
                  </th>
                  <th className="sticky top-0 z-10 w-[96px] border-b border-[#26231F] bg-[#211E1B] px-4 py-[9px] text-right text-[11px] font-normal text-[#8A8784]">
                    Amount
                  </th>
                  <th className="sticky top-0 z-10 w-[110px] border-b border-[#26231F] bg-[#211E1B] px-4 py-[9px] text-[11px] font-normal text-[#8A8784]">
                    Outcome
                  </th>
                  <th className="sticky top-0 z-10 border-b border-[#26231F] bg-[#211E1B] px-4 py-[9px] text-[11px] font-normal text-[#8A8784]">
                    Reasons
                  </th>
                </tr>
              </thead>
              <tbody>
                {verdicts.map((verdict) => (
                  <tr
                    key={verdict.txn.id}
                    className={`border-b border-[#26231F] last:border-b-0 ${ROW_CLASS[verdict.outcome]}`}
                  >
                    <td className="whitespace-nowrap px-4 py-[11px] align-middle text-white tabular-nums">
                      {dateET(verdict.txn.postedAt)}
                    </td>
                    <td className="px-4 py-[11px] align-middle text-white">
                      {verdict.txn.merchant}
                    </td>
                    <td className="whitespace-nowrap px-4 py-[11px] text-right align-middle text-white tabular-nums">
                      {money(verdict.txn.amountCents)}
                    </td>
                    <td className="px-4 py-[11px] align-middle">
                      <span
                        className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] capitalize ${OUTCOME_CLASS[verdict.outcome]}`}
                      >
                        {verdict.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-[11px] align-middle text-[11.5px] text-[#8A8784]">
                      {verdict.reasons.join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
