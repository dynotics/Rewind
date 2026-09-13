import { monthShort, plural } from "./format";
import type { MonthRange } from "./useMonthRange";

type Props = {
  months: string[];
  range: MonthRange;
  onRange: (range: MonthRange) => void;
  txnCount: number;
};

function monthLabel(key: string): string {
  return `${monthShort(key)} ${key.slice(0, 4)}`;
}

function MonthSelect({ value, months, onPick, label }: { value: string; months: string[]; onPick: (month: string) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onPick(event.target.value)}>
      {months.map((month) => (
        <option key={month} value={month}>
          {monthLabel(month)}
        </option>
      ))}
    </select>
  );
}

export function RangeControl({ months, range, onRange, txnCount }: Props) {
  return (
    <div className="range">
      <MonthSelect
        label="Start month"
        value={range.start}
        months={months}
        onPick={(month) => onRange({ start: month, end: month > range.end ? month : range.end })}
      />
      <span>to</span>
      <MonthSelect
        label="End month"
        value={range.end}
        months={months}
        onPick={(month) => onRange({ start: month < range.start ? month : range.start, end: month })}
      />
      <span className="count">{plural(txnCount, "transaction")}</span>
    </div>
  );
}
