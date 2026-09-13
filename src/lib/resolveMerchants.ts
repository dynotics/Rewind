import { tavily, type TavilyClient } from "@tavily/core";
import { classify, normalize } from "./merchantLexicon";
import type { Merchant } from "./types";

const MAX_RESULTS = 3;
const SEARCH_CONCURRENCY = 4;
const EXTRACT_CONCURRENCY = 4;
const DOMAIN_BONUS = 0.15;
const MAX_CONFIDENCE = 0.95;
const PRICING_MCCS = ["7372", "4816", "5734"];
const PRICING_MIN_CONFIDENCE = 0.5;
const PRICE_WINDOW = 80;
const SEAT_PHRASES = ["per user", "per seat", "/user"];
const MONTH_PHRASES = ["per month", "/mo"];
const MIN_DOMAIN_LABEL = 3;
const PLAUSIBLE_PREFIX = 5;

const AGGREGATOR_DOMAINS = [
  "ramp.com",
  "wikipedia.org",
  "crunchbase.com",
  "linkedin.com",
  "g2.com",
  "bloomberg.com",
  "reuters.com",
  "globaldata.com",
  "youtube.com",
  "hoteldive.com",
  "contrary.com",
];

const AGGREGATOR_PREFIXES = ["investor."];
const AGGREGATOR_SUBSTRINGS = ["news"];

export type Evidence = { domain: string | null; title: string; snippet: string };

type SearchResult = { title: string; url: string; content: string };

type Classification = { mcc: string; mccName: string; score: number };

type Pass1 = { evidence: Evidence; classified: Classification };

type PriceUnit = "seat" | "month";

type Price = { listPriceCents: number; priceUnit: PriceUnit };

const EMPTY_EVIDENCE: Evidence = { domain: null, title: "", snippet: "" };

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

function toEvidence(result: SearchResult | undefined): Evidence {
  if (result === undefined) return EMPTY_EVIDENCE;
  return {
    domain: new URL(result.url).hostname.replace(/^www\./, ""),
    title: result.title,
    snippet: result.content,
  };
}

function isAggregator(domain: string | null): boolean {
  if (domain === null) return false;
  if (AGGREGATOR_PREFIXES.some((prefix) => domain.startsWith(prefix))) return true;
  if (AGGREGATOR_SUBSTRINGS.some((part) => domain.includes(part))) return true;
  return AGGREGATOR_DOMAINS.some((known) => domain === known || domain.endsWith(`.${known}`));
}

function compress(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function nameMatchesDomain(name: string, domain: string | null): boolean {
  if (domain === null) return false;
  const label = compress(domain.split(".")[0]);
  const key = compress(name);
  if (label.length < MIN_DOMAIN_LABEL || key.length === 0) return false;
  return key.includes(label) || label.includes(key);
}

function letters(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

// A search result only earns its domain when the domain reads like the merchant.
function isPlausibleDomain(name: string, domain: string | null): boolean {
  if (domain === null) return false;
  const label = letters(domain.split(".")[0]);
  const key = letters(name);
  if (label.length === 0 || key.length === 0) return false;
  if (key.includes(label) || label.includes(key)) return true;
  return (
    label.length >= PLAUSIBLE_PREFIX &&
    key.length >= PLAUSIBLE_PREFIX &&
    label.slice(0, PLAUSIBLE_PREFIX) === key.slice(0, PLAUSIBLE_PREFIX)
  );
}

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((word) => word.replace(/[a-z]/, (letter) => letter.toUpperCase()))
    .join(" ");
}

function parsePrice(text: string): Price | null {
  const haystack = text.toLowerCase();
  let best: Price | null = null;

  for (const match of haystack.matchAll(/\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g)) {
    const start = Math.max(0, match.index - PRICE_WINDOW);
    const context = haystack.slice(start, match.index + match[0].length + PRICE_WINDOW);
    const seat = SEAT_PHRASES.some((phrase) => context.includes(phrase));
    const month = MONTH_PHRASES.some((phrase) => context.includes(phrase));
    if (!seat && !month) continue;

    const listPriceCents = Math.round(Number(match[1].replace(/,/g, "")) * 100);
    if (best === null || listPriceCents < best.listPriceCents) {
      best = { listPriceCents, priceUnit: seat ? "seat" : "month" };
    }
  }

  return best;
}

async function fetchPrice(client: TavilyClient, domain: string): Promise<Price | null> {
  try {
    const response = await client.extract([`https://${domain}/pricing`]);
    const extracted = response.results[0];
    if (extracted === undefined) return null;
    return parsePrice(extracted.rawContent);
  } catch {
    return null;
  }
}

function readEvidence(name: string, results: SearchResult[]): Pass1 {
  const first = toEvidence(results[0]);
  let classified = classify(`${name} ${first.title} ${first.snippet}`);

  const accepted = results
    .map(toEvidence)
    .find(
      (candidate) => !isAggregator(candidate.domain) && isPlausibleDomain(name, candidate.domain),
    );

  if (accepted === undefined) {
    // No result was both non-aggregator and plausibly the merchant's own site.
    return { evidence: { ...first, domain: null }, classified };
  }

  const acceptedClass = classify(`${name} ${accepted.title} ${accepted.snippet}`);
  if (acceptedClass.score > classified.score) classified = acceptedClass;

  return { evidence: accepted, classified };
}

async function searchPass(
  client: TavilyClient,
  names: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Pass1[]> {
  let done = 0;

  return mapWithConcurrency(names, SEARCH_CONCURRENCY, async (name) => {
    const response = await client.search(`${name} official site pricing`, {
      maxResults: MAX_RESULTS,
    });
    done += 1;
    onProgress?.(done, names.length);
    return readEvidence(name, response.results);
  });
}

async function fetchPrices(
  client: TavilyClient,
  domains: string[],
): Promise<Map<string, Price | null>> {
  const unique = [...new Set(domains)];
  const prices = await mapWithConcurrency(unique, EXTRACT_CONCURRENCY, (domain) =>
    fetchPrice(client, domain),
  );
  return new Map(unique.map((domain, index) => [domain, prices[index]]));
}

export async function resolveMerchants(
  raws: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, Merchant>> {
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

  const groups = new Map<string, string[]>();
  for (const raw of raws) {
    const name = normalize(raw);
    const group = groups.get(name);
    if (group === undefined) groups.set(name, [raw]);
    else group.push(raw);
  }

  const names = [...groups.keys()];
  const passes = await searchPass(client, names, onProgress);

  const resolutions = names.map((name, index) => {
    const { evidence, classified } = passes[index];
    const bonus = nameMatchesDomain(name, evidence.domain) ? DOMAIN_BONUS : 0;

    return {
      name,
      canonical: titleCase(name),
      mcc: classified.mcc,
      mccName: classified.mccName,
      confidence: Math.min(MAX_CONFIDENCE, classified.score + bonus),
      domain: evidence.domain,
    };
  });

  const priceable = resolutions.filter(
    (resolution) =>
      resolution.domain !== null &&
      PRICING_MCCS.includes(resolution.mcc) &&
      resolution.confidence >= PRICING_MIN_CONFIDENCE,
  );

  const priceByDomain = await fetchPrices(
    client,
    priceable.map((resolution) => resolution.domain as string),
  );
  const priceableNames = new Set(priceable.map((resolution) => resolution.name));

  const merchants: Record<string, Merchant> = {};
  for (const resolution of resolutions) {
    const price =
      resolution.domain !== null && priceableNames.has(resolution.name)
        ? priceByDomain.get(resolution.domain) ?? null
        : null;

    for (const raw of groups.get(resolution.name) ?? []) {
      merchants[raw] = {
        raw,
        canonical: resolution.canonical,
        mcc: resolution.mcc,
        mccName: resolution.mccName,
        confidence: resolution.confidence,
        domain: resolution.domain,
        listPriceCents: price === null ? null : price.listPriceCents,
        priceUnit: price === null ? null : price.priceUnit,
      };
    }
  }

  return merchants;
}
