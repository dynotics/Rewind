import { useState } from "react";
import type { CardChange } from "../lib/changePlan";
import type { Card } from "../lib/types";

type Props = {
  plan: CardChange[];
  cards: Card[];
  onViewCards: () => void;
};

type CopyState = "idle" | "copied" | "failed";

function PlanLine({ line }: { line: string }) {
  const split = line.indexOf(": ");
  const field = line.slice(0, split);
  const rest = line.slice(split + 2);

  if (split === -1 || field.includes(" ")) {
    return <div className="l note">{line}</div>;
  }
  if (rest.includes(" -> ")) {
    const [from, to] = rest.split(" -> ");
    return (
      <div className="l">
        {field}  <b>{from}</b>  to  <b>{to}</b>
      </div>
    );
  }
  const verb = rest.startsWith("- ") ? "remove" : "add";
  return (
    <div className="l">
      {field}  {verb} <b>{rest.slice(2)}</b>
    </div>
  );
}

export function ChangePlan({ plan, cards, onViewCards }: Props) {
  const [copy, setCopy] = useState<CopyState>("idle");

  const copyJson = () => {
    const payload = plan.map((change) => ({ card_id: change.cardId, ...change.payload }));
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(
      () => setCopy("copied"),
      () => setCopy("failed"),
    );
    window.setTimeout(() => setCopy("idle"), 1600);
  };

  return (
    <div className="plan">
      <h2>Settings to apply in Rho</h2>
      {plan.length === 0 ? (
        <p className="empty">Nothing to change. This rule matches the current card settings.</p>
      ) : null}
      {plan.map((change) => {
        const card = cards.find((item) => item.id === change.cardId);
        return (
          <div key={change.cardId} className="card">
            <div className="n">
              {change.cardName}
              {card === undefined ? null : <span className="last4 num"> ••{card.last4}</span>}
            </div>
            {change.lines.map((line) => (
              <PlanLine key={line} line={line} />
            ))}
          </div>
        );
      })}
      <div className="acts">
        <button type="button" className="btn primary" onClick={copyJson} disabled={plan.length === 0}>
          {copy === "copied" ? "Copied" : copy === "failed" ? "Copy failed" : "Copy as JSON"}
        </button>
        <button type="button" className="btn" onClick={onViewCards}>
          View cards
        </button>
      </div>
    </div>
  );
}
