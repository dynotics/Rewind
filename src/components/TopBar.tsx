import { useEffect, useRef } from "react";

type Props = {
  title: string;
  range: string;
  query: string;
  onQuery: (query: string) => void;
};

export function TopBar({ title, range, query, onQuery }: Props) {
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
      <span className="range">{range}</span>
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
