import { useEffect } from "react";
import type { Card, Merchant, Policy, Verdict } from "../lib/types";
import type { Fix, WrongBlock } from "./analysis";
import { dollars, limitLabel, longDate, money, plural, sentence } from "./format";

export type TxnContext = {
  verdict: Verdict;
  card: Card | undefined;
  merchant: Merchant | undefined;
  inScope: boolean;
  wrong: WrongBlock | undefined;
  peerCount: number;
  peerMonths: number;
  windowMonths: number;
  fixes: Fix[];
};

type Props = {
  context: TxnContext;
  policy: Policy;
  onApply: (policy: Policy) => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
};

// Written onto merchants.json by `npm run enrich`; optional until that run lands.
type VendorEnrichment = {
  domain?: string;
  listPriceCents?: number;
  listPriceUnit?: string;
  resolvedFrom?: string;
};

const OUTCOME_LABEL: Record<Verdict["outcome"], string> = { pass: "Passed", flag: "Flagged", block: "Blocked" };

function Why({ context }: { context: TxnContext }) {
  const { verdict, inScope, wrong } = context;
  const heading = !inScope
    ? "Outside this rule"
    : verdict.outcome === "pass"
      ? "Passes this rule"
      : verdict.outcome === "block"
        ? "Why it was blocked"
        : "Why it was flagged";

  return (
    <div className={`why ${verdict.outcome === "pass" ? "" : verdict.outcome}`}>
      <h3>{heading}</h3>
      {verdict.reasons.length === 0 ? (
        <p>{inScope ? "No limit or list applies." : "Not covered by this rule."}</p>
      ) : (
        <ul>
          {verdict.reasons.map((reason) => (
            <li key={reason}>{sentence(reason)}</li>
          ))}
        </ul>
      )}
      {wrong === undefined ? null : (
        <p className="legit">
          Looks legitimate: {wrong.canonical}, {wrong.months} of {wrong.windowMonths} months for this cardholder.
        </p>
      )}
    </div>
  );
}

function MonthMeter({ verdict, policy }: { verdict: Verdict; policy: Policy }) {
  const cap = policy.monthlyCapCents;
  if (cap === null) return null;
  const blocked = verdict.outcome === "block";
  const reached = verdict.runningMonthCents + (blocked ? verdict.txn.amountCents : 0);
  const over = reached > cap;

  return (
    <>
      <dt>Month to date</dt>
      <dd>
        <span className="num">{money(reached)}</span> of <span className="num">{dollars(cap)}</span>
        {blocked && over ? " if allowed" : ""}
        <div className="meter">
          <i className={over ? "over" : ""} style={{ width: `${Math.min(100, (reached / cap) * 100)}%` }} />
        </div>
      </dd>
    </>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Vendor({ merchant }: { merchant: Merchant | undefined }) {
  const vendor = (merchant ?? {}) as VendorEnrichment;
  const pending = <span className="pending">Pending enrichment</span>;
  const source =
    vendor.resolvedFrom !== undefined ? (
      <a href={vendor.resolvedFrom} target="_blank" rel="noreferrer">
        {hostOf(vendor.resolvedFrom)}
      </a>
    ) : merchant === undefined ? (
      "Not mapped"
    ) : (
      `Seed catalog, ${Math.round(merchant.confidence * 100)}% confidence`
    );

  return (
    <>
      <dt>Domain</dt>
      <dd>
        {vendor.domain === undefined ? (
          pending
        ) : (
          <a href={`https://${vendor.domain}`} target="_blank" rel="noreferrer">
            {vendor.domain}
          </a>
        )}
      </dd>
      <dt>List price</dt>
      <dd>
        {vendor.listPriceCents === undefined ? (
          pending
        ) : (
          <>
            <span className="num">{money(vendor.listPriceCents)}</span>
            {vendor.listPriceUnit === undefined ? "" : ` ${vendor.listPriceUnit}`}
          </>
        )}
      </dd>
      <dt>Resolved from</dt>
      <dd>{source}</dd>
    </>
  );
}

function Details({ context, policy }: { context: TxnContext; policy: Policy }) {
  const { verdict, card, merchant } = context;
  return (
    <dl className="rule">
      <dt>Posted</dt>
      <dd>{longDate(verdict.txn.postedAt)}</dd>
      <dt>Card</dt>
      <dd>{card === undefined ? verdict.txn.cardName ?? "Unknown" : `${card.name}, ${card.last4}`}</dd>
      <dt>Cardholder</dt>
      <dd>{verdict.txn.userName ?? card?.holderName ?? "Unknown"}</dd>
      <dt>Rho limit today</dt>
      <dd className="num">{card === undefined ? "Unknown" : limitLabel(card)}</dd>
      <dt>Category</dt>
      <dd>{merchant === undefined ? "Not mapped" : `MCC ${merchant.mcc} ${merchant.mccName}`}</dd>
      <Vendor merchant={merchant} />
      <dt>History here</dt>
      <dd>
        {plural(context.peerCount, "charge")} in {context.peerMonths} of {context.windowMonths} months
        {merchant?.isRecurring ? ", recurring" : ""}
      </dd>
      {context.inScope ? <MonthMeter verdict={verdict} policy={policy} /> : null}
    </dl>
  );
}

export function TxnDrawer({ context, policy, onApply, onPrev, onNext, onClose }: Props) {
  const { verdict, merchant, fixes } = context;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Transaction at ${verdict.txn.merchant}`}>
        <div className="dh">
          <span className={`v ${verdict.outcome}`}>{OUTCOME_LABEL[verdict.outcome]}</span>
          <button type="button" className="x" onClick={onClose} aria-label="Close" autoFocus>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        <div className="db">
          <div className="title">
            <div className="m">{verdict.txn.merchant}</div>
            <div className="c">{merchant?.canonical ?? "Unknown merchant"}</div>
            <div className={`amount num ${verdict.outcome}`}>{money(verdict.txn.amountCents)}</div>
          </div>
          <Why context={context} />
          <Details context={context} policy={policy} />
          {fixes.length === 0 ? null : (
            <div className="fixes">
              <h3>Adjust the rule</h3>
              <div className="acts">
                {fixes.map((fix) => (
                  <button key={fix.label} type="button" className="btn" onClick={() => onApply(fix.policy)}>
                    {fix.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="df">
          <button type="button" className="btn small" onClick={onPrev ?? undefined} disabled={onPrev === null}>
            Previous exception
          </button>
          <button type="button" className="btn small" onClick={onNext ?? undefined} disabled={onNext === null}>
            Next exception
          </button>
        </div>
      </aside>
    </>
  );
}
