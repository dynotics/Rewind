import { useEffect, useRef } from "react";
import { RangeControl } from "./RangeControl";
import type { MonthRange } from "./useMonthRange";

type Props = {
  title: string;
  months: string[];
  range: MonthRange | null;
  onRange: (range: MonthRange) => void;
  txnCount: number;
  query: string;
  onQuery: (query: string) => void;
};

export function TopBar({ title, months, range, onRange, txnCount, query, onQuery }: Props) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="top">
      <h1>{title}</h1>
      {range === null ? (
        <span className="range">No history</span>
      ) : (
        <RangeControl months={months} range={range} onRange={onRange} txnCount={txnCount} />
      )}
      <label className="search">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        <input
          ref={input}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && onQuery("")}
          placeholder="Filter by merchant"
          aria-label="Filter by merchant"
        />
        <kbd>⌘K</kbd>
      </label>
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
