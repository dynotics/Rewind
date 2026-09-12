import { useMemo } from "react";
import { monthKeyET } from "../lib/engine";
import type { CardRecommendation } from "../lib/recommend";
import type { Card, Policy, Verdict } from "../lib/types";
import { appliesToCard } from "./analysis";
import { dollars, limitLabel, monthName, plural } from "./format";

type Props = {
  cards: Card[];
  verdicts: Verdict[];
  revealed: number;
  months: string[];
  recommendations: CardRecommendation[];
  policy: Policy;
  selectedCardId: string | null;
  onSelect: (card: Card) => void;
};

type CardReplay = {
  spent: number;
  blocked: { count: number; cents: number };
  flagged: { count: number; cents: number };
  byMonth: Map<string, number>;
};

function replayByCard(verdicts: Verdict[], monthKeys: string[], revealed: number): Map<string, CardReplay> {
  const byCard = new Map<string, CardReplay>();
  for (let index = 0; index < revealed; index += 1) {
    const verdict = verdicts[index];
    const id = verdict.txn.cardId ?? "";
    const entry = byCard.get(id) ?? {
      spent: 0,
      blocked: { count: 0, cents: 0 },
      flagged: { count: 0, cents: 0 },
      byMonth: new Map<string, number>(),
    };
    const cents = verdict.txn.amountCents;
    const month = monthKeys[index];
    entry.spent += cents;
    entry.byMonth.set(month, (entry.byMonth.get(month) ?? 0) + cents);
    if (verdict.outcome === "block") {
      entry.blocked.count += 1;
      entry.blocked.cents += cents;
    }
    if (verdict.outcome === "flag") {
      entry.flagged.count += 1;
      entry.flagged.cents += cents;
    }
    byCard.set(id, entry);
  }
  return byCard;
}

type BarsProps = {
  months: string[];
  byMonth: Map<string, number>;
  rec: CardRecommendation | undefined;
  cap: number | null;
};

function MonthBars({ months, byMonth, rec, cap }: BarsProps) {
  const finals = rec?.monthlyTotals ?? [];
  const peak = Math.max(1, ...finals.map((entry) => entry.cents));

  return (
    <span className="bars" aria-hidden="true">
      {months.map((month) => {
        const cents = byMonth.get(month) ?? 0;
        const over = cap !== null && cents > cap;
        return (
          <i
            key={month}
            className={over ? "on over" : cents > 0 ? "on" : ""}
            style={{ height: `${Math.max(4, (cents / peak) * 100)}%` }}
            title={`${monthName(month)}: ${dollars(cents)}`}
          />
        );
      })}
    </span>
  );
}

function stoppedLabel(entry: CardReplay | undefined): { text: string; tone: string } {
  if (entry === undefined) return { text: "None", tone: "" };
  if (entry.blocked.count > 0) {
    return { text: `${entry.blocked.count} blocked, ${dollars(entry.blocked.cents)}`, tone: "block" };
  }
  if (entry.flagged.count > 0) return { text: `${entry.flagged.count} flagged`, tone: "flag" };
  return { text: "None", tone: "" };
}

type RowProps = {
  card: Card;
  entry: CardReplay | undefined;
  rec: CardRecommendation | undefined;
  months: string[];
  cap: number | null;
  selected: boolean;
  onSelect: (card: Card) => void;
};

function CardRow({ card, entry, rec, months, cap, selected, onSelect }: RowProps) {
  const stopped = stoppedLabel(entry);
  return (
    <button type="button" className={`card-row ${selected ? "on" : ""}`} aria-pressed={selected} onClick={() => onSelect(card)}>
      <span>
        <span className="name">{card.name}</span>
        <span className="meta num"> ••{card.last4}</span>
        <span className="meta block-line">{card.holderName === null ? "No cardholder" : `Held by ${card.holderName}`}</span>
      </span>
      <span className="limit">
        <span className="meta block-line">Rho limit</span>
        <span className="num">{limitLabel(card)}</span>
      </span>
      <span className="figures">
        <MonthBars months={months} byMonth={entry?.byMonth ?? new Map()} rec={rec} cap={cap} />
        <span className="fig">
          <span className="fl">Spend replayed</span>
          <span className="fv num">{dollars(entry?.spent ?? 0)}</span>
        </span>
        <span className="fig">
          <span className="fl">Suggested limit</span>
          <span className="fv num">{rec && rec.monthlyCapCents > 0 ? `${dollars(rec.monthlyCapCents)}/mo` : "None"}</span>
        </span>
        <span className="fig">
          <span className="fl">Stopped by rule</span>
          <span className={`fv num ${stopped.tone}`}>{stopped.text}</span>
        </span>
      </span>
    </button>
  );
}

export function CardsList({ cards, verdicts, revealed, months, recommendations, policy, selectedCardId, onSelect }: Props) {
  const monthKeys = useMemo(() => verdicts.map((verdict) => monthKeyET(verdict.txn.postedAt)), [verdicts]);
  const replayed = replayByCard(verdicts, monthKeys, revealed);
  const totalSpent = [...replayed.values()].reduce((sum, entry) => sum + entry.spent, 0);

  return (
    <>
      <div className="lead">
        <span className="amt num">{dollars(totalSpent)}</span>
        <span className="what">spent across {plural(cards.length, "card")}</span>
        <span className="sub">Figures follow the replay cursor. Pick a card to load a rule sized to its real spend.</span>
      </div>
      <div className="cards">
        {cards.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            entry={replayed.get(card.id)}
            rec={recommendations.find((item) => item.cardId === card.id)}
            months={months}
            cap={appliesToCard(card, policy) ? policy.monthlyCapCents : null}
            selected={selectedCardId === card.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>
  );
}
