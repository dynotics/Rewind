import { memo, useEffect, useRef } from "react";
import type { Verdict } from "../lib/types";
import { money, sentence, shortDate } from "./format";

export type LedgerRow = { verdict: Verdict; index: number };

type Props = {
  rows: LedgerRow[];
  revealed: number;
  playing: boolean;
  openTxnId: string | null;
  onOpen: (txnId: string) => void;
};

const ROW_CLASS: Record<Verdict["outcome"], string> = { pass: "", flag: "f", block: "b" };
const OUTCOME_LABEL: Record<Verdict["outcome"], string> = { pass: "Passed", flag: "Flagged", block: "Blocked" };
const FRESH_ROWS = 3;
const HEADER_ROOM = 36;

function useFollow(rows: LedgerRow[], revealed: number, playing: boolean) {
  const container = useRef<HTMLDivElement>(null);
  const latest = rows.findLast((row) => row.index < revealed)?.verdict.txn.id ?? null;

  useEffect(() => {
    const box = container.current;
    if (!playing || box === null) return;
    if (latest === null) {
      box.scrollTop = 0;
      return;
    }
    const row = box.querySelector(`tr[data-id="${latest}"]`);
    if (row === null) return;
    const outer = box.getBoundingClientRect();
    const inner = row.getBoundingClientRect();
    if (inner.bottom > outer.bottom) box.scrollTop += inner.bottom - outer.bottom + inner.height * 2;
    if (inner.top < outer.top + HEADER_ROOM) box.scrollTop += inner.top - outer.top - HEADER_ROOM;
  }, [latest, playing]);

  return container;
}

type LineProps = {
  verdict: Verdict;
  shown: boolean;
  fresh: boolean;
  open: boolean;
  onOpen: (txnId: string) => void;
};

const LedgerLine = memo(function LedgerLine({ verdict, shown, fresh, open, onOpen }: LineProps) {
  const txn = verdict.txn;
  const classes = [shown ? ROW_CLASS[verdict.outcome] : "dim", fresh ? "fresh" : "", open ? "open" : ""];

  return (
    <tr
      data-id={txn.id}
      className={classes.join(" ").trim()}
      tabIndex={0}
      aria-label={`${txn.merchant}, ${money(txn.amountCents)}${shown ? `, ${OUTCOME_LABEL[verdict.outcome]}` : ""}`}
      onClick={() => onOpen(txn.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(txn.id);
        }
      }}
    >
      <td className="num">{shortDate(txn.postedAt)}</td>
      <td className="merchant" title={txn.merchant}>{txn.merchant}</td>
      <td className="who">{txn.userName ?? txn.cardName ?? ""}</td>
      <td className="r num">{money(txn.amountCents)}</td>
      <td>
        {shown ? (
          <span className={`v ${verdict.outcome}`}>{OUTCOME_LABEL[verdict.outcome]}</span>
        ) : (
          <span className="v pending">Pending</span>
        )}
      </td>
      <td className="reason">{shown ? verdict.reasons.map(sentence).join("; ") : ""}</td>
    </tr>
  );
});

export function Ledger({ rows, revealed, playing, openTxnId, onOpen }: Props) {
  const container = useFollow(rows, revealed, playing);

  return (
    <div className="ledger" ref={container}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Merchant</th>
            <th>Cardholder</th>
            <th className="r">Amount</th>
            <th>Outcome</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ verdict, index }) => (
            <LedgerLine
              key={verdict.txn.id}
              verdict={verdict}
              shown={index < revealed}
              fresh={playing && index < revealed && index >= revealed - FRESH_ROWS}
              open={openTxnId === verdict.txn.id}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="empty">No transactions match.</p> : null}
    </div>
  );
}
