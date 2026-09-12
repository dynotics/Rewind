import type { Card, Policy } from "../lib/types";
import { dollars, limitLabel } from "./format";
import { PolicyForm, type Option } from "./PolicyForm";

type Props = {
  heading: string;
  edited: boolean;
  policy: Policy;
  cards: Card[];
  mccOptions: Option[];
  merchantOptions: Option[];
  editing: boolean;
  onEditing: (editing: boolean) => void;
  onChange: (policy: Policy) => void;
  onClear: () => void;
  flush?: boolean;
};

function appliesTo(policy: Policy, cards: Card[]): string {
  if (policy.scope === "all") return "All cards";
  if (policy.scopeIds.length === 0) return "No cards selected";
  if (policy.scope === "card") {
    return cards
      .filter((card) => policy.scopeIds.includes(card.id))
      .map((card) => `${card.name}, card ${card.last4}`)
      .join("; ");
  }
  const names = cards
    .filter((card) => card.userId !== null && policy.scopeIds.includes(card.userId))
    .map((card) => card.holderName ?? card.name);
  return [...new Set(names)].join("; ");
}

function Chips({ values, options }: { values: string[]; options: Option[] }) {
  if (values.length === 0) return <>None</>;
  return (
    <>
      {values.map((value) => {
        const label = options.find((option) => option.value === value)?.label;
        return (
          <span key={value} className="chip">
            {label === undefined || label === value ? value : `${value} ${label}`}
          </span>
        );
      })}
    </>
  );
}

function RuleSummary({ policy, cards, mccOptions }: Pick<Props, "policy" | "cards" | "mccOptions">) {
  const listWord = policy.mode === "allowlist" ? "Allowed" : "Blocked";
  const single = policy.scope === "card" && policy.scopeIds.length === 1
    ? cards.find((card) => card.id === policy.scopeIds[0])
    : undefined;

  return (
    <dl className="rule">
      <dt>Applies to</dt>
      <dd>{appliesTo(policy, cards)}</dd>
      <dt>Monthly limit</dt>
      <dd className="num">{policy.monthlyCapCents === null ? "None" : dollars(policy.monthlyCapCents)}</dd>
      <dt>Per-charge max</dt>
      <dd className="num">{policy.maxPerTxnCents === null ? "None" : `${dollars(policy.maxPerTxnCents)}, flag above`}</dd>
      <dt>{listWord} categories</dt>
      <dd><Chips values={policy.mccs} options={mccOptions} /></dd>
      <dt>{listWord} merchants</dt>
      <dd><Chips values={policy.merchants} options={[]} /></dd>
      {single === undefined ? null : (
        <>
          <dt>Current limit</dt>
          <dd className="num">{limitLabel(single)}</dd>
        </>
      )}
    </dl>
  );
}

export function RulePanel(props: Props) {
  const { editing, onEditing } = props;

  return (
    <div className={`rules ${props.flush ? "flush" : ""}`}>
      <h2>
        {props.heading}
        {props.edited ? <span className="edited">edited</span> : null}
      </h2>
      <RuleSummary policy={props.policy} cards={props.cards} mccOptions={props.mccOptions} />
      {editing ? (
        <PolicyForm
          value={props.policy}
          onChange={props.onChange}
          cards={props.cards}
          mccOptions={props.mccOptions}
          merchantOptions={props.merchantOptions}
        />
      ) : null}
      <div className="acts">
        {props.flush ? null : (
          <button type="button" className="btn" onClick={() => onEditing(!editing)}>
            {editing ? "Done editing" : "Edit rule"}
          </button>
        )}
        <button type="button" className="btn" onClick={props.onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
