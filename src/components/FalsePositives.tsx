import { monthKeyET } from "../lib/engine";
import type { Policy } from "../lib/types";
import type { WrongBlock } from "./analysis";
import { dollars, money, monthName, shortDate } from "./format";

type Props = {
  rows: WrongBlock[];
  policy: Policy;
  raiseTo: number | null;
  onRaise: (cents: number) => void;
  onOpen: (txnId: string) => void;
};

function explain(rows: WrongBlock[], policy: Policy, raiseTo: number | null): string {
  const top = rows[0];
  const txn = top.verdict.txn;
  const holder = txn.userName ?? txn.cardName ?? "this card";
  const cap = policy.monthlyCapCents === null ? "The" : `A ${dollars(policy.monthlyCapCents)}`;
  const first = `${top.canonical} shows up in ${top.months} of ${top.windowMonths} months for ${holder}.`;
  const second = `${cap} monthly limit blocks it in ${monthName(monthKeyET(txn.postedAt))}.`;
  if (raiseTo === null) return `${first} ${second}`;
  const cleared = rows.length === 1 ? "clears it" : `clears all ${rows.length} rows`;
  return `${first} ${second} Raising the limit to ${dollars(raiseTo)} ${cleared}.`;
}

export function FalsePositives({ rows, policy, raiseTo, onRaise, onOpen }: Props) {
  return (
    <div className="annoy">
      <h2>Charges this rule would block</h2>
      {rows.length === 0 ? (
        <p className="empty">No charges blocked yet.</p>
      ) : null}
      {rows.map(({ verdict, canonical, months, windowMonths }) => (
        <button
          key={verdict.txn.id}
          type="button"
          className="row"
          title={`${verdict.txn.userName ?? ""}, ${shortDate(verdict.txn.postedAt)}`}
          onClick={() => onOpen(verdict.txn.id)}
        >
          <span className="m">{canonical}</span>
          <span className="w">
            {months} of {windowMonths} months
          </span>
          <span className="n num">{money(verdict.txn.amountCents)}</span>
        </button>
      ))}
      {rows.length === 0 ? null : <p className="note">{explain(rows, policy, raiseTo)}</p>}
      {raiseTo === null || rows.length === 0 ? null : (
        <div className="acts">
          <button type="button" className="btn small" onClick={() => onRaise(raiseTo)}>
            Raise limit to {dollars(raiseTo)}
          </button>
        </div>
      )}
    </div>
  );
}
