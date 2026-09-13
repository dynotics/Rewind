import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  TOKEN_HINT,
  isTokenKey,
  parseQuery,
  removeWord,
  scanWords,
  splitWord,
  tokenWord,
  type Suggestion,
  type Suggestions,
  type Token,
  type TokenKey,
} from "./query";

type Props = {
  query: string;
  onQuery: (query: string) => void;
  suggestions: Suggestions;
};

const MENU_ID = "search-tokens";
const MENU_MAX = 8;

/** The token key being typed at the caret, plus the part of its value written so far. */
function keyAtCaret(query: string, caret: number): { key: TokenKey; typed: string; word: string } | null {
  const word = scanWords(query).find((item) => caret >= item.start && caret <= item.end);
  if (word === undefined) return null;
  const split = splitWord(word.text);
  if (split === null || !isTokenKey(split.key)) return null;
  return { key: split.key, typed: split.value.toLowerCase(), word: word.text };
}

function narrow(list: Suggestion[], typed: string): Suggestion[] {
  if (typed === "") return list.slice(0, MENU_MAX);
  return list
    .filter((item) => item.typed.includes(typed) || item.label.toLowerCase().includes(typed))
    .slice(0, MENU_MAX);
}

function Chip({ token, text, onRemove }: { token: Token; text: string; onRemove: () => void }) {
  return (
    <li className="chip">
      <b>{token.key}</b>
      <span>{text}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${token.key} ${text}`}>
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M1 1L9 9M9 1L1 9" />
        </svg>
      </button>
    </li>
  );
}

export function SearchBox({ query, onQuery, suggestions }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

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

  useLayoutEffect(() => {
    const at = pendingCaret.current;
    if (at === null) return;
    pendingCaret.current = null;
    input.current?.setSelectionRange(at, at);
    setCaret(at);
  }, [query]);

  const typing = open ? keyAtCaret(query, caret) : null;
  const list = typing === null ? [] : narrow(suggestions[typing.key], typing.typed);
  const showMenu = typing !== null && list.length > 0;
  const index = Math.min(active, list.length - 1);

  const tokens = useMemo(() => {
    const seen = new Set<string>();
    return parseQuery(query).tokens.filter((token) => {
      if (seen.has(token.word)) return false;
      seen.add(token.word);
      return true;
    });
  }, [query]);

  const chipText = (token: Token) =>
    suggestions[token.key].find((item) => item.value === token.value)?.label ?? token.label;

  const accept = (suggestion: Suggestion) => {
    if (typing === null) return;
    const word = scanWords(query).find((item) => item.text === typing.word);
    if (word === undefined) return;
    const inserted = `${tokenWord(typing.key, suggestion.typed)} `;
    onQuery(`${query.slice(0, word.start)}${inserted}${query.slice(word.end).replace(/^\s/, "")}`);
    pendingCaret.current = word.start + inserted.length;
    setActive(0);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (showMenu) setOpen(false);
      else onQuery("");
      return;
    }
    if (!showMenu) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : list.length - 1;
      setActive((value) => (Math.min(value, list.length - 1) + step) % list.length);
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      accept(list[index]);
    }
  };

  return (
    <div className="tools">
      <div className="search" ref={box}>
        {/* A label so a click anywhere in the box lands in the input, as it did before the menu. */}
        <label className="field">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={input}
            value={query}
            role="combobox"
            aria-expanded={showMenu}
            aria-controls={MENU_ID}
            aria-autocomplete="list"
            aria-activedescendant={showMenu ? `${MENU_ID}-${index}` : undefined}
            onChange={(event) => {
              onQuery(event.target.value);
              setCaret(event.target.selectionStart ?? event.target.value.length);
              setActive(0);
              setOpen(true);
            }}
            onClick={(event) => {
              setCaret(event.currentTarget.selectionStart ?? 0);
              setOpen(true);
            }}
            onKeyUp={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
            onBlur={(event) => {
              // Clicking a suggestion moves focus out of the input for an instant. Closing on
              // every blur unmounted the menu before the click could land on it.
              if (box.current?.contains(event.relatedTarget) === true) return;
              setOpen(false);
            }}
            onKeyDown={onKeyDown}
            placeholder="Merchant, or above:500"
            aria-label="Search transactions"
          />
          <kbd>⌘K</kbd>
        </label>

        {showMenu ? (
          <ul className="menu" id={MENU_ID} role="listbox" aria-label={`Values for ${typing.key}`}>
            <li className="menu-head" role="presentation">
              <b>{typing.key}:</b> {TOKEN_HINT[typing.key]}
            </li>
            {list.map((suggestion, position) => (
              <li
                key={suggestion.value}
                id={`${MENU_ID}-${position}`}
                role="option"
                aria-selected={position === index}
                className={position === index ? "on" : ""}
                onMouseDown={(event) => {
                  event.preventDefault();
                  accept(suggestion);
                }}
                onMouseEnter={() => setActive(position)}
              >
                <span>{suggestion.label}</span>
                {suggestion.count === null ? null : <em className="num">{suggestion.count}</em>}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {tokens.length === 0 ? null : (
        <ul className="chips" aria-label="Active filters">
          {tokens.map((token) => (
            <Chip
              key={token.word}
              token={token}
              text={chipText(token)}
              onRemove={() => {
                onQuery(removeWord(query, token.word));
                input.current?.focus();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
