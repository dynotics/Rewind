"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import merchantsData from "../../data/merchants.json";
import { findings } from "../lib/findings";
import { recommendedLimits } from "../lib/recommend";
import type { Card, Finding, Merchant, Policy } from "../lib/types";
import { EMPTY_POLICY, cardRule, type Filter } from "../components/analysis";
import { CardsList } from "../components/CardsList";
import { ChangePlan } from "../components/ChangePlan";
import { FalsePositives } from "../components/FalsePositives";
import { FindingsList } from "../components/FindingsList";
import type { Option } from "../components/PolicyForm";
import { ReplayPanel } from "../components/ReplayPanel";
import { RulePanel } from "../components/RulePanel";
import { tokenSuggestions } from "../components/query";
import { Sidebar, type View } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { TxnDrawer } from "../components/TxnDrawer";
import { useDataset, type Dataset } from "../components/useDataset";
import { txnsInRange, useMonthRange, type MonthRange } from "../components/useMonthRange";
import { usePlayback, usePlaybackClock } from "../components/usePlayback";
import { neighbourException, scopeLabel, txnContext, useReplay } from "../components/useReplay";

const merchants = merchantsData as Record<string, Merchant>;

const MCC_OPTIONS: Option[] = [
  ...new Map(Object.values(merchants).map((merchant) => [merchant.mcc, merchant.mccName])),
]
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.value.localeCompare(b.value));

const MERCHANT_OPTIONS: Option[] = [
  ...new Set(Object.values(merchants).map((merchant) => merchant.canonical)),
]
  .sort()
  .map((value) => ({ value, label: value }));

const TITLES: Record<View, string> = { findings: "Findings", rules: "Rules", cards: "Cards" };

type Rule = { policy: Policy; origin: Policy | null; id: string | null };

const NO_RULE: Rule = { policy: EMPTY_POLICY, origin: null, id: null };

function ruleHeading(rule: Rule, found: Finding[], cards: Card[]): string {
  const cardName = (id: string | null) => cards.find((card) => card.id === id)?.name ?? "this card";
  if (rule.id?.startsWith("card:")) return `Suggested rule for ${cardName(rule.id.slice(5))}`;
  const finding = found.find((item) => item.id === rule.id);
  if (finding !== undefined) return `Proposed rule for ${cardName(finding.cardId)}`;
  return rule.policy === EMPTY_POLICY ? "No rule yet. Pick a finding or a card, or edit one." : "Custom rule";
}

function useInsights(data: Dataset) {
  const found = useMemo(() => findings(data.txns, data.cards, merchants), [data]);
  const recommendations = useMemo(() => recommendedLimits(data.txns, data.cards), [data]);
  return { found, recommendations };
}

function Rewind() {
  const [view, setView] = useState<View>("findings");
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState(false);
  const [openTxnId, setOpenTxnId] = useState<string | null>(null);
  const [rule, setRule] = useState<Rule>(NO_RULE);
  const playback = usePlayback();

  const loadRule = (next: Rule) => {
    setRule(next);
    setFilter("all");
    playback.reset();
  };
  const { data, sync, toggleSource } = useDataset(() => {
    loadRule(NO_RULE);
    setOpenTxnId(null);
  });
  const { months, range, setRange } = useMonthRange(data.txns);
  const scoped = useMemo<Dataset>(() => ({ ...data, txns: txnsInRange(data.txns, range) }), [data, range]);
  usePlaybackClock(playback, scoped.txns.length);
  const pickRange = (next: MonthRange) => {
    setRange(next);
    playback.reset();
  };
  const { found, recommendations } = useInsights(scoped);
  const suggestions = useMemo(() => tokenSuggestions(scoped.txns, merchants), [scoped]);
  const policy = rule.policy;
  const replayed = useReplay({ data: scoped, merchants, policy, progress: playback.progress, filter, query });
  const editPolicy = (next: Policy) => {
    setRule((current) => ({ ...current, policy: next }));
    playback.reset();
  };
  const closeDrawer = useCallback(() => setOpenTxnId(null), []);

  const openIndex = replayed.indexOf(openTxnId);
  const step = (direction: 1 | -1) => {
    const target = openIndex === null ? null : neighbourException(replayed, policy, openIndex, direction);
    return target === null ? null : () => setOpenTxnId(replayed.verdicts[target].txn.id);
  };

  const rulePanel = (
    <RulePanel
      heading={ruleHeading(rule, found, data.cards)}
      edited={rule.origin !== null && rule.origin !== policy}
      policy={policy}
      cards={data.cards}
      mccOptions={MCC_OPTIONS}
      merchantOptions={MERCHANT_OPTIONS}
      editing={view === "rules" || editing}
      onEditing={setEditing}
      onChange={editPolicy}
      onClear={() => {
        loadRule(NO_RULE);
        setEditing(false);
      }}
      flush={view === "rules"}
    />
  );

  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <Sidebar
        view={view}
        onView={setView}
        collapsed={collapsed}
        onCollapse={() => setCollapsed((value) => !value)}
        findingsCount={found.length}
        cardsCount={data.cards.length}
        live={data.syncedAt !== null}
        syncedAt={data.syncedAt}
        sync={sync}
        onSync={toggleSource}
      />
      <div className="main">
        <TopBar
          title={TITLES[view]}
          months={months}
          range={range}
          onRange={pickRange}
          txnCount={scoped.txns.length}
          onQuery={setQuery}
          suggestions={suggestions}
        />
        <div className="body">
          <section className="col left">
            <div className="pad">
              {view === "findings" ? (
                <>
                  <FindingsList
                    findings={found}
                    selectedId={rule.id}
                    onSelect={(finding) => loadRule({ policy: finding.suggested, origin: finding.suggested, id: finding.id })}
                    cardCount={data.cards.length}
                    txnCount={scoped.txns.length}
                  />
                  {rulePanel}
                </>
              ) : null}
              {view === "rules" ? rulePanel : null}
              {view === "cards" ? (
                <CardsList
                  cards={data.cards}
                  verdicts={replayed.verdicts}
                  revealed={replayed.revealed}
                  months={replayed.months}
                  recommendations={recommendations}
                  policy={policy}
                  selectedCardId={rule.id?.startsWith("card:") ? rule.id.slice(5) : null}
                  onSelect={(card) => {
                    const next = cardRule(card, recommendations.find((item) => item.cardId === card.id));
                    loadRule({ policy: next, origin: next, id: `card:${card.id}` });
                  }}
                />
              ) : null}
              {view === "cards" && rule.id !== null ? rulePanel : null}
            </div>
          </section>

          <section className="col right">
            <ReplayPanel
              verdicts={replayed.verdicts}
              rows={replayed.rows}
              revealed={replayed.revealed}
              playback={playback}
              tally={replayed.tally}
              filter={filter}
              onFilter={setFilter}
              openTxnId={openTxnId}
              openIndex={openIndex}
              onOpen={setOpenTxnId}
              monthCount={replayed.months.length}
              scopeLabel={scopeLabel(policy, data.cards)}
            />
            {policy === EMPTY_POLICY ? null : (
              <div className="lower">
                <FalsePositives
                  rows={replayed.wrongShown}
                  policy={policy}
                  raiseTo={replayed.raiseTo}
                  onRaise={(cents) => editPolicy({ ...policy, monthlyCapCents: cents })}
                  onOpen={setOpenTxnId}
                />
                <ChangePlan plan={replayed.plan} cards={data.cards} onViewCards={() => setView("cards")} />
              </div>
            )}
          </section>
        </div>
      </div>

      {openIndex === null ? null : (
        <TxnDrawer
          context={txnContext(openIndex, replayed, scoped, merchants, policy)}
          policy={policy}
          onApply={editPolicy}
          onPrev={step(-1)}
          onNext={step(1)}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <Rewind />
    </Suspense>
  );
}
