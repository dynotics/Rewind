import { RangeControl } from "./RangeControl";
import { SearchBox } from "./SearchBox";
import type { Suggestions } from "./query";
import type { MonthRange } from "./useMonthRange";

type Props = {
  title: string;
  months: string[];
  range: MonthRange | null;
  onRange: (range: MonthRange) => void;
  txnCount: number;
  onQuery: (query: string) => void;
  suggestions: Suggestions;
};

export function TopBar({ title, months, range, onRange, txnCount, onQuery, suggestions }: Props) {
  return (
    <header className="top">
      <h1>{title}</h1>
      {range === null ? (
        <span className="range">No history</span>
      ) : (
        <RangeControl months={months} range={range} onRange={onRange} txnCount={txnCount} />
      )}
      <SearchBox onQuery={onQuery} suggestions={suggestions} />
      <a className="link" href="https://github.com/dynotics/rewind#readme">
        Help
      </a>
      <div className="who">
        <i>D</i>
        <span>Dylan</span>
      </div>
    </header>
  );
}
