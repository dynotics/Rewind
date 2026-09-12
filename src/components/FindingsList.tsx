import type { Finding } from "../lib/types";
import { KIND_LABEL, dollars, plural } from "./format";

type Props = {
  findings: Finding[];
  selectedId: string | null;
  onSelect: (finding: Finding) => void;
  cardCount: number;
  txnCount: number;
};

export function FindingsList({ findings, selectedId, onSelect, cardCount, txnCount }: Props) {
  const atStake = findings.reduce((sum, finding) => sum + finding.impactCents, 0);

  return (
    <>
      <div className="lead">
        <span className="amt num">{dollars(atStake)}</span>
        <span className="what">at stake across {plural(findings.length, "problem")}</span>
        <span className="sub">
          {plural(cardCount, "card")}, {plural(txnCount, "transaction")}
        </span>
      </div>

      <div className="findings">
        {findings.length === 0 ? (
          <p className="empty">No problems found in this history.</p>
        ) : null}
        {findings.map((finding) => (
          <button
            key={finding.id}
            type="button"
            className={`finding ${selectedId === finding.id ? "on" : ""}`}
            aria-pressed={selectedId === finding.id}
            onClick={() => onSelect(finding)}
            title={finding.detail}
          >
            <span className="t">{finding.title}</span>
            <span className="k">
              {KIND_LABEL[finding.kind]}, {finding.detail}
            </span>
            <span className="a num">{dollars(finding.impactCents)}</span>
          </button>
        ))}
      </div>
    </>
  );
}
