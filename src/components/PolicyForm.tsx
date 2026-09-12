import { useId, useState } from "react";
import type { Card, Policy } from "../lib/types";

export type Option = { value: string; label: string };

type Props = {
  value: Policy;
  onChange: (policy: Policy) => void;
  cards: Card[];
  mccOptions: Option[];
  merchantOptions: Option[];
};

function MoneyInput({ cents, onCents, label }: { cents: number | null; onCents: (cents: number | null) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <span className="money-field">
      $
      <input
        className="field num"
        inputMode="decimal"
        aria-label={label}
        placeholder="None"
        value={draft ?? (cents === null ? "" : String(cents / 100))}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = Number.parseFloat(event.target.value.replace(/[$,]/g, ""));
          onCents(Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null);
        }}
      />
    </span>
  );
}

function Picker({ chosen, options, onChosen, label }: { chosen: string[]; options: Option[]; onChosen: (values: string[]) => void; label: string }) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const labelOf = (value: string) => options.find((option) => option.value === value)?.label;

  const add = (raw: string) => {
    const needle = raw.trim().toLowerCase();
    const match = options.find(
      (option) => option.value.toLowerCase() === needle || option.label.toLowerCase() === needle,
    );
    if (match === undefined) return false;
    if (!chosen.includes(match.value)) onChosen([...chosen, match.value]);
    setDraft("");
    return true;
  };

  return (
    <div className="picker">
      <input
        className="field"
        list={listId}
        value={draft}
        aria-label={label}
        placeholder="Search to add"
        onChange={(event) => {
          if (!add(event.target.value)) setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") add(draft);
        }}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.value} label={option.label === option.value ? undefined : option.label} />
        ))}
      </datalist>
      <div className="chips">
        {chosen.map((value) => (
          <span key={value} className="chip">
            {value === labelOf(value) || labelOf(value) === undefined ? value : `${value} ${labelOf(value)}`}
            <button type="button" aria-label={`Remove ${value}`} onClick={() => onChosen(chosen.filter((item) => item !== value))}>
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function ScopeField({ value, onChange, cards }: Pick<Props, "value" | "onChange" | "cards">) {
  const holders = [...new Map(cards.filter((card) => card.userId !== null).map((card) => [card.userId ?? "", card.holderName ?? card.name])).entries()];
  const entries = value.scope === "user" ? holders : cards.map((card) => [card.id, `${card.name}, ${card.last4}`] as const);
  const toggle = (id: string, on: boolean) => {
    const rest = value.scopeIds.filter((item) => item !== id);
    onChange({ ...value, scopeIds: on ? [...rest, id] : rest });
  };

  return (
    <div>
      <select
        className="field"
        aria-label="Applies to"
        value={value.scope}
        onChange={(event) => onChange({ ...value, scope: event.target.value as Policy["scope"], scopeIds: [] })}
      >
        <option value="all">All cards</option>
        <option value="card">Specific cards</option>
        <option value="user">Specific cardholders</option>
      </select>
      {value.scope === "all" ? null : (
        <div className="checks">
          {entries.map(([id, label]) => (
            <label key={id}>
              <input type="checkbox" checked={value.scopeIds.includes(id)} onChange={(event) => toggle(id, event.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function PolicyForm({ value, onChange, cards, mccOptions, merchantOptions }: Props) {
  const listWord = value.mode === "allowlist" ? "Allowed" : "Blocked";

  return (
    <div className="form">
      <span className="label">Applies to</span>
      <ScopeField value={value} onChange={onChange} cards={cards} />

      <label>Monthly limit</label>
      <MoneyInput label="Monthly limit" cents={value.monthlyCapCents} onCents={(cents) => onChange({ ...value, monthlyCapCents: cents })} />

      <label>Per-charge max</label>
      <MoneyInput label="Per-charge max" cents={value.maxPerTxnCents} onCents={(cents) => onChange({ ...value, maxPerTxnCents: cents })} />

      <span className="label">List mode</span>
      <div className="seg" role="group" aria-label="List mode">
        {(["blocklist", "allowlist"] as const).map((mode) => (
          <button key={mode} type="button" className={value.mode === mode ? "on" : ""} aria-pressed={value.mode === mode} onClick={() => onChange({ ...value, mode })}>
            {mode === "blocklist" ? "Blocklist" : "Allowlist"}
          </button>
        ))}
      </div>

      <span className="label">{listWord} categories</span>
      <Picker label={`${listWord} categories`} chosen={value.mccs} options={mccOptions} onChosen={(mccs) => onChange({ ...value, mccs })} />

      <span className="label">{listWord} merchants</span>
      <Picker label={`${listWord} merchants`} chosen={value.merchants} options={merchantOptions} onChosen={(merchants) => onChange({ ...value, merchants })} />
    </div>
  );
}
