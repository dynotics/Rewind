import type { Filter, Tally, Total } from "./analysis";
import { dollars } from "./format";

type Props = {
  tally: Tally;
  revealed: number;
  total: number;
  filter: Filter;
  onFilter: (filter: Filter) => void;
};

const ROWS: { key: Exclude<Filter, "all">; label: string; tone: string }[] = [
  { key: "block", label: "Blocked", tone: "block" },
  { key: "caught", label: "Caught on purpose", tone: "pass" },
  { key: "flag", label: "Flagged", tone: "flag" },
  { key: "wrong", label: "Wrongly blocked", tone: "dim" },
];

function figure(total: Total): string {
  return total.count === 0 ? "0" : `${total.count}, ${dollars(total.cents)}`;
}

export function ReplayStats({ tally, revealed, total, filter, onFilter }: Props) {
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
      {ROWS.map((row) => (
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
      ))}
    </div>
  );
}
