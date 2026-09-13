import type { Filter, Tally, Total } from "./analysis";
import { dollars } from "./format";

type Props = {
  tally: Tally;
  revealed: number;
  total: number;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  noRule: boolean;
};

const ROWS: { key: Exclude<Filter, "all">; label: string; tone: string }[] = [
  { key: "block", label: "Blocked", tone: "block" },
  { key: "caught", label: "Blocked on purpose", tone: "pass" },
  { key: "flag", label: "Flagged for review", tone: "flag" },
  { key: "wrong", label: "Blocked by mistake", tone: "dim" },
];

function figure(total: Total): string {
  return total.count === 0 ? "0" : `${total.count}, ${dollars(total.cents)}`;
}

export function ReplayStats({ tally, revealed, total, filter, onFilter, noRule }: Props) {
  return (
    <div className="stats">
      <div className="stat">
        <span>Transactions replayed</span>
        <span className="num dim">
          {revealed} of {total}
        </span>
        <button
          type="button"
          className="clear"
          hidden={filter === "all"}
          onClick={() => onFilter("all")}
        >
          Clear filter ×
        </button>
      </div>
      {noRule ? (
        <p className="empty">Pick a finding on the left to test its rule against these {total} transactions.</p>
      ) : (
        ROWS.map((row) => (
          <button
            key={row.key}
            type="button"
            className={`stat ${filter === row.key ? "on" : ""}`}
            aria-pressed={filter === row.key}
            title={filter === row.key ? "Show all" : `Show only ${row.label.toLowerCase()}`}
            onClick={() => onFilter(filter === row.key ? "all" : row.key)}
          >
            <span>{row.label}</span>
            <span className={`num ${row.tone}`}>{figure(tally[row.key])}</span>
          </button>
        ))
      )}
    </div>
  );
}
