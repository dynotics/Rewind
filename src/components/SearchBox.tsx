import { useEffect, useMemo, useRef, useState } from "react";
import {
  TOKEN_HINT,
  isTokenKey,
  parseToken,
  scanWords,
  splitWord,
  tokenWord,
  type Suggestion,
  type Suggestions,
  type TokenKey,
} from "./query";

type Props = {
  onQuery: (query: string) => void;
  suggestions: Suggestions;
};

const MENU_ID = "search-tokens";
const MENU_MAX = 8;

/**
 * A finished word, drawn inside the box as `key: value`. Plain search terms carry the
 * `text` key, which is not a token key — nothing but the chip's own label reads it.
 */
type ChipView = { key: string; text: string };

/** The token key being typed at the caret, plus the part of its value written so far. */
function keyAtCaret(draft: string, caret: number): { key: TokenKey; typed: string; word: string } | null {
  const word = scanWords(draft).find((item) => caret >= item.start && caret <= item.end);
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

function Chip({ chip, onRemove }: { chip: ChipView; onRemove: () => void }) {
  return (
    <li className="chip">
      <b>{chip.key}:</b>
      <span>{chip.text}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${chip.key} ${chip.text}`}>
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M1 1L9 9M9 1L1 9" />
        </svg>
      </button>
    </li>
  );
}

/**
 * The box holds the finished words as chips and keeps only the word being typed in the
 * input. Both halves are joined back into the query string the rest of the app filters on,
 * so this component is the one place that decides where a word stops being editable.
 */
export function SearchBox({ onQuery, suggestions }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [words, setWords] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
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

  const push = (nextWords: string[], nextDraft: string) => {
    const unique = [...new Set(nextWords)];
    setWords(unique);
    setDraft(nextDraft);
    setCaret(nextDraft.length);
    onQuery([...unique, nextDraft].filter((part) => part !== "").join(" "));
  };

  const typing = open ? keyAtCaret(draft, caret) : null;
  const list = typing === null ? [] : narrow(suggestions[typing.key], typing.typed);
  const showMenu = typing !== null && list.length > 0;
  const index = Math.min(active, list.length - 1);

  const chips = useMemo<ChipView[]>(
    () =>
      words.map((word) => {
        const token = parseToken(word);
        if (token === null) return { key: "text", text: word.replace(/"/g, "") };
        // The suggestion label is the fuller one: a category name beside its code, a
        // cardholder's whole name. It only misses when the value is off the current data.
        const found = suggestions[token.key].find((item) => item.value === token.value);
        return { key: token.key, text: found?.label ?? token.label };
      }),
    [words, suggestions],
  );

  const accept = (suggestion: Suggestion) => {
    if (typing === null) return;
    const picked = tokenWord(typing.key, suggestion.typed);
    const rest = scanWords(draft).map((item) => (item.text === typing.word ? picked : item.text));
    push([...words, ...rest], "");
    setActive(0);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (showMenu) setOpen(false);
      else push([], "");
      return;
    }
    if (event.key === "Backspace" && draft === "" && words.length > 0) {
      event.preventDefault();
      push(words.slice(0, -1), "");
      return;
    }
    if (showMenu) {
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
      return;
    }
    // Nothing to pick: whatever is typed becomes a chip of its own, a plain search term.
    const written = scanWords(draft).map((item) => item.text);
    if (event.key === "Enter" && written.length > 0) {
      event.preventDefault();
      push([...words, ...written], "");
    }
  };

  return (
    <div className="tools">
      <div className="search" ref={box}>
        {/* A click on the box, but not on a chip's button, lands in the input. */}
        <div
          className="field"
          onMouseDown={(event) => {
            if ((event.target as HTMLElement).closest("button, input") !== null) return;
            event.preventDefault();
            input.current?.focus();
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>

          {/* Chips and the input share one wrapping row, so the ⌘K hint keeps its place. */}
          <div className="entry">
            {chips.length === 0 ? null : (
              <ul className="chips" aria-label="Active filters">
                {chips.map((chip, position) => (
                  <Chip
                    key={words[position]}
                    chip={chip}
                    onRemove={() => {
                      push(
                        words.filter((_, at) => at !== position),
                        draft,
                      );
                      input.current?.focus();
                    }}
                  />
                ))}
              </ul>
            )}

            <input
              ref={input}
              value={draft}
              role="combobox"
              aria-expanded={showMenu}
              aria-controls={MENU_ID}
              aria-autocomplete="list"
              aria-activedescendant={showMenu ? `${MENU_ID}-${index}` : undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                setCaret(event.target.selectionStart ?? event.target.value.length);
                setActive(0);
                setOpen(true);
                onQuery([...words, event.target.value].filter((part) => part !== "").join(" "));
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
              placeholder={chips.length === 0 ? "Search findings" : ""}
              aria-label="Search transactions"
            />
          </div>
          <kbd>⌘K</kbd>
        </div>

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
    </div>
  );
}
