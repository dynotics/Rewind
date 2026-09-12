import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import {
  CardSchema,
  MerchantSchema,
  TxnSchema,
  type Card,
  type Merchant,
  type Txn,
} from "../src/lib/types";

const SEED = 42;
const YEAR = 2026;
const ACCOUNT_ID = "30000000-0000-4000-8000-000000000001";
const GENERATED_ID_PREFIX = "seed-";

const MIN_ONEOFF_CENTS = 400;
const MIN_ONEOFF_AVG_CENTS = 1500;
const LEAK_SHARE = 0.08;

const HOLDER = {
  ethan: "Ethan Parker",
  maya: "Maya Thompson",
  daniel: "Daniel Rivera",
  lucas: "Lucas Bennett",
  sofia: "Sofia Martin",
  hannah: "Hannah Brooks",
  emma: "Emma Walsh",
  claire: "Claire Mitchell",
} as const;

type MerchantKind = "recurring" | "oneoff";

type SeedMerchant = {
  raw: string;
  canonical: string;
  mcc: string;
  mccName: string;
  kind: MerchantKind;
};

type SeedCard = Card & { userId: string };

type SeedMonth = { year: number; month: number; days: number };

type Row = Omit<Txn, "id">;

type Recurrence = {
  merchant: SeedMerchant;
  day: number;
  baseCents: number;
  fixed: boolean;
};

type CardPlan = {
  card: SeedCard;
  desired: number[];
  scale: number;
  recurrences: Recurrence[];
};

type MccGuess = { mcc: string; mccName: string };

const CONFERENCE_MERCHANT: SeedMerchant = {
  raw: "EVENTBRITE*SCALECONF26",
  canonical: "Eventbrite",
  mcc: "7399",
  mccName: "Business services",
  kind: "oneoff",
};

const ELECTRONICS_MERCHANT: SeedMerchant = {
  raw: "APPLE STORE R088 NYC",
  canonical: "Apple Store",
  mcc: "5732",
  mccName: "Electronics stores",
  kind: "oneoff",
};

const GAMBLING_MERCHANT: SeedMerchant = {
  raw: "DRAFTKINGS SPORTSBOOK",
  canonical: "DraftKings",
  mcc: "7995",
  mccName: "Betting and gambling",
  kind: "oneoff",
};

const PERSONAL_MERCHANT: SeedMerchant = {
  raw: "NORDSTROM #0812",
  canonical: "Nordstrom",
  mcc: "5311",
  mccName: "Department stores",
  kind: "oneoff",
};

const SAAS_MERCHANT: SeedMerchant = {
  raw: "NOTION LABS INC",
  canonical: "Notion",
  mcc: "7372",
  mccName: "Computer programming and data processing",
  kind: "recurring",
};

const CLOUD_MERCHANT: SeedMerchant = {
  raw: "DIGITALOCEAN.COM",
  canonical: "DigitalOcean",
  mcc: "4816",
  mccName: "Computer network and information services",
  kind: "recurring",
};

const MERCHANTS: SeedMerchant[] = [
  { raw: "LINEAR.APP", canonical: "Linear", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "FIGMA MONTHLY", canonical: "Figma", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "SLACK T0288FJ21", canonical: "Slack", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "GITHUB, INC.", canonical: "GitHub", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "VERCEL INC", canonical: "Vercel", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "SENTRY.IO", canonical: "Sentry", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "ZOOM.COM 888-799-9666", canonical: "Zoom", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "ATLASSIAN", canonical: "Atlassian", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "HUBSPOT INC", canonical: "HubSpot", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "1PASSWORD", canonical: "1Password", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "DROPBOX*8K2LM1", canonical: "Dropbox", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "DATADOG INC", canonical: "Datadog", mcc: "7372", mccName: "Computer programming and data processing", kind: "recurring" },
  { raw: "APPLE.COM/BILL", canonical: "Apple", mcc: "5734", mccName: "Computer software stores", kind: "recurring" },
  { raw: "MICROSOFT*STORE 4418", canonical: "Microsoft", mcc: "5734", mccName: "Computer software stores", kind: "oneoff" },
  { raw: "STEAM PURCHASE 9921", canonical: "Steam", mcc: "5734", mccName: "Computer software stores", kind: "oneoff" },
  { raw: "AWS EMEA", canonical: "Amazon Web Services", mcc: "4816", mccName: "Computer network and information services", kind: "recurring" },
  { raw: "GOOGLE CLOUD 1A2B3C", canonical: "Google Cloud", mcc: "4816", mccName: "Computer network and information services", kind: "recurring" },
  { raw: "CLOUDFLARE", canonical: "Cloudflare", mcc: "4816", mccName: "Computer network and information services", kind: "recurring" },
  { raw: "NAMECHEAP.COM*HOSTING", canonical: "Namecheap", mcc: "4816", mccName: "Computer network and information services", kind: "oneoff" },
  { raw: "SQ *BLUE BOTTLE 0041", canonical: "Blue Bottle Coffee", mcc: "5812", mccName: "Eating places and restaurants", kind: "oneoff" },
  { raw: "TST* GRAMERCY TAVERN", canonical: "Gramercy Tavern", mcc: "5812", mccName: "Eating places and restaurants", kind: "oneoff" },
  { raw: "TOAST*OLIVE AND VINE", canonical: "Olive and Vine", mcc: "5812", mccName: "Eating places and restaurants", kind: "oneoff" },
  { raw: "SQ *JOE COFFEE 1823", canonical: "Joe Coffee", mcc: "5812", mccName: "Eating places and restaurants", kind: "oneoff" },
  { raw: "DIG INN 0042", canonical: "Dig", mcc: "5812", mccName: "Eating places and restaurants", kind: "oneoff" },
  { raw: "TST* HANOI HOUSE", canonical: "Hanoi House", mcc: "5812", mccName: "Eating places and restaurants", kind: "oneoff" },
  { raw: "MEALPAL SUBSCRIPTION", canonical: "MealPal", mcc: "5812", mccName: "Eating places and restaurants", kind: "recurring" },
  { raw: "GRUBHUB*PLUS MEMBER", canonical: "Grubhub", mcc: "5812", mccName: "Eating places and restaurants", kind: "recurring" },
  { raw: "DOORDASH*DASHPASS", canonical: "DoorDash", mcc: "5812", mccName: "Eating places and restaurants", kind: "recurring" },
  { raw: "SWEETGREEN 0188", canonical: "Sweetgreen", mcc: "5814", mccName: "Fast food restaurants", kind: "oneoff" },
  { raw: "CHIPOTLE 1455", canonical: "Chipotle", mcc: "5814", mccName: "Fast food restaurants", kind: "oneoff" },
  { raw: "SHAKE SHACK 0091", canonical: "Shake Shack", mcc: "5814", mccName: "Fast food restaurants", kind: "oneoff" },
  { raw: "PRET A MANGER 4412", canonical: "Pret A Manger", mcc: "5814", mccName: "Fast food restaurants", kind: "oneoff" },
  { raw: "STARBUCKS STORE 09182", canonical: "Starbucks", mcc: "5814", mccName: "Fast food restaurants", kind: "oneoff" },
  { raw: "DELTA AIR LINES 0068", canonical: "Delta Air Lines", mcc: "4511", mccName: "Airlines and air carriers", kind: "oneoff" },
  { raw: "UNITED 0162334455", canonical: "United Airlines", mcc: "4511", mccName: "Airlines and air carriers", kind: "oneoff" },
  { raw: "JETBLUE AIRWAYS 2790", canonical: "JetBlue", mcc: "4511", mccName: "Airlines and air carriers", kind: "oneoff" },
  { raw: "AMERICAN AIR 0012987", canonical: "American Airlines", mcc: "4511", mccName: "Airlines and air carriers", kind: "oneoff" },
  { raw: "MARRIOTT HOTELS 0412", canonical: "Marriott", mcc: "7011", mccName: "Lodging, hotels and motels", kind: "oneoff" },
  { raw: "HILTON GARDEN INN NYC", canonical: "Hilton Garden Inn", mcc: "7011", mccName: "Lodging, hotels and motels", kind: "oneoff" },
  { raw: "AIRBNB * HM4KJ2N9", canonical: "Airbnb", mcc: "7011", mccName: "Lodging, hotels and motels", kind: "oneoff" },
  { raw: "HYATT PLACE AUSTIN", canonical: "Hyatt Place", mcc: "7011", mccName: "Lodging, hotels and motels", kind: "oneoff" },
  { raw: "UBER *TRIP", canonical: "Uber", mcc: "4121", mccName: "Taxicabs and limousines", kind: "oneoff" },
  { raw: "LYFT *RIDE THU 4PM", canonical: "Lyft", mcc: "4121", mccName: "Taxicabs and limousines", kind: "oneoff" },
  { raw: "CURB TAXI 0912 NYC", canonical: "Curb", mcc: "4121", mccName: "Taxicabs and limousines", kind: "oneoff" },
  { raw: "REVEL RIDE 8831", canonical: "Revel", mcc: "4121", mccName: "Taxicabs and limousines", kind: "oneoff" },
  { raw: "FACEBK *ADS 4K2J9", canonical: "Meta Ads", mcc: "7311", mccName: "Advertising services", kind: "recurring" },
  { raw: "GOOGLE *ADS8891234", canonical: "Google Ads", mcc: "7311", mccName: "Advertising services", kind: "recurring" },
  { raw: "LINKEDIN ADS 88213", canonical: "LinkedIn Ads", mcc: "7311", mccName: "Advertising services", kind: "oneoff" },
  { raw: "REDDIT ADS PLATFORM", canonical: "Reddit Ads", mcc: "7311", mccName: "Advertising services", kind: "oneoff" },
  { raw: "TARGET 00021884", canonical: "Target", mcc: "5311", mccName: "Department stores", kind: "oneoff" },
  { raw: "MACYS 0041 HERALD SQ", canonical: "Macys", mcc: "5311", mccName: "Department stores", kind: "oneoff" },
  { raw: "COSTCO WHSE #1088", canonical: "Costco", mcc: "5399", mccName: "Miscellaneous general merchandise", kind: "oneoff" },
  { raw: "BJS WHOLESALE 0173", canonical: "BJs Wholesale Club", mcc: "5399", mccName: "Miscellaneous general merchandise", kind: "oneoff" },
  { raw: "AMZN MKTP US*2K4XJ", canonical: "Amazon", mcc: "5999", mccName: "Miscellaneous and specialty retail", kind: "oneoff" },
  { raw: "ETSY.COM 8812K", canonical: "Etsy", mcc: "5999", mccName: "Miscellaneous and specialty retail", kind: "oneoff" },
  { raw: "CONTAINER STORE 0091", canonical: "The Container Store", mcc: "5999", mccName: "Miscellaneous and specialty retail", kind: "oneoff" },
  { raw: "STAPLES 00114882", canonical: "Staples", mcc: "5111", mccName: "Stationery and office supplies", kind: "oneoff" },
  { raw: "ODP/OFFICE DEPOT 2211", canonical: "Office Depot", mcc: "5111", mccName: "Stationery and office supplies", kind: "oneoff" },
  { raw: "W.B. MASON CO INC", canonical: "W.B. Mason", mcc: "5111", mccName: "Stationery and office supplies", kind: "recurring" },
  { raw: "VERIZON WIRELESS PMT", canonical: "Verizon Wireless", mcc: "4814", mccName: "Telecommunication services", kind: "recurring" },
  { raw: "T-MOBILE*POSTPAID", canonical: "T-Mobile", mcc: "4814", mccName: "Telecommunication services", kind: "recurring" },
  { raw: "TWILIO INC 8884", canonical: "Twilio", mcc: "4814", mccName: "Telecommunication services", kind: "recurring" },
  { raw: "BEST BUY 00014412", canonical: "Best Buy", mcc: "5732", mccName: "Electronics stores", kind: "oneoff" },
  { raw: "B AND H PHOTO 0091", canonical: "B and H Photo Video", mcc: "5732", mccName: "Electronics stores", kind: "oneoff" },
  { raw: "FANDUEL SPORTSBOOK NJ", canonical: "FanDuel", mcc: "7995", mccName: "Betting and gambling", kind: "oneoff" },
  { raw: "ASTOR WINES SPIRITS", canonical: "Astor Wines and Spirits", mcc: "5921", mccName: "Package stores, beer, wine and liquor", kind: "oneoff" },
  { raw: "TOTAL WINE #1102", canonical: "Total Wine and More", mcc: "5921", mccName: "Package stores, beer, wine and liquor", kind: "oneoff" },
  { raw: "PETCO VETERINARY 1188", canonical: "Petco", mcc: "0742", mccName: "Veterinary services", kind: "oneoff" },
  { raw: "BLUE PEARL VET NYC", canonical: "BluePearl Pet Hospital", mcc: "0742", mccName: "Veterinary services", kind: "oneoff" },
  { raw: "IRON MOUNTAIN 0091", canonical: "Iron Mountain", mcc: "7399", mccName: "Business services", kind: "recurring" },
  { raw: "ADP PAYROLL FEES", canonical: "ADP", mcc: "7399", mccName: "Business services", kind: "recurring" },
  { raw: "LEGALZOOM.COM INC", canonical: "LegalZoom", mcc: "7399", mccName: "Business services", kind: "oneoff" },
  CONFERENCE_MERCHANT,
  ELECTRONICS_MERCHANT,
  GAMBLING_MERCHANT,
  PERSONAL_MERCHANT,
  SAAS_MERCHANT,
  CLOUD_MERCHANT,
];

const RESERVED_RAWS = new Set([
  CONFERENCE_MERCHANT.raw,
  ELECTRONICS_MERCHANT.raw,
  GAMBLING_MERCHANT.raw,
  PERSONAL_MERCHANT.raw,
  SAAS_MERCHANT.raw,
  CLOUD_MERCHANT.raw,
]);

// Gambling, liquor and vet only ever appear where main() plants them.
const PLANTED_ONLY_MCCS = new Set(["7995", "5921", "0742"]);

// Maya's allowlist leakage is limited to software and rideshare merchants.
const LEAK_MCCS = new Set(["7372", "5734", "4121"]);

const ONEOFF_POOL = MERCHANTS.filter(
  (merchant) =>
    merchant.kind === "oneoff" &&
    !PLANTED_ONLY_MCCS.has(merchant.mcc) &&
    !RESERVED_RAWS.has(merchant.raw),
);

const RECURRING_POOL = MERCHANTS.filter(
  (merchant) => merchant.kind === "recurring" && !RESERVED_RAWS.has(merchant.raw),
);

const LEAK_POOL = ONEOFF_POOL.filter((merchant) => LEAK_MCCS.has(merchant.mcc));

const LIQUOR_POOL = MERCHANTS.filter((merchant) => merchant.mcc === "5921");

// Recurring merchants deliberately billed on two cards, at a fixed amount on both.
const PLANTED_RECURRING: { merchant: SeedMerchant; holders: string[]; cents: number }[] = [
  { merchant: SAAS_MERCHANT, holders: [HOLDER.daniel, HOLDER.sofia], cents: 9900 },
  { merchant: CLOUD_MERCHANT, holders: [HOLDER.hannah, HOLDER.emma], cents: 4800 },
];

const MONTHS: SeedMonth[] = [3, 4, 5, 6, 7, 8].map((month) => ({
  year: YEAR,
  month,
  days: new Date(Date.UTC(YEAR, month, 0)).getUTCDate(),
}));

const MCC_RULES: { match: RegExp; guess: MccGuess }[] = [
  { match: /cloud|hosting|aws|server|network/i, guess: { mcc: "4816", mccName: "Computer network and information services" } },
  { match: /software|labs|systems|technolog/i, guess: { mcc: "7372", mccName: "Computer programming and data processing" } },
  { match: /office supply|office depot|stationery/i, guess: { mcc: "5111", mccName: "Stationery and office supplies" } },
  { match: /resort|hotel|inn\b|motel|lodge/i, guess: { mcc: "7011", mccName: "Lodging, hotels and motels" } },
  { match: /parking|garage/i, guess: { mcc: "7523", mccName: "Parking lots and garages" } },
  { match: /tour|museum|gallery|exhibit/i, guess: { mcc: "7991", mccName: "Tourist attractions and exhibits" } },
  { match: /air lines|airlines|airways/i, guess: { mcc: "4511", mccName: "Airlines and air carriers" } },
  { match: /uber|lyft|taxi|rideshare/i, guess: { mcc: "4121", mccName: "Taxicabs and limousines" } },
  { match: /restaurant|cafe|coffee|kitchen|tavern|bistro/i, guess: { mcc: "5812", mccName: "Eating places and restaurants" } },
  { match: /wireless|mobile|telecom/i, guess: { mcc: "4814", mccName: "Telecommunication services" } },
  { match: /services|consulting|group|partners/i, guess: { mcc: "7399", mccName: "Business services" } },
];

const FALLBACK_GUESS: MccGuess = {
  mcc: "5999",
  mccName: "Miscellaneous and specialty retail",
};

const NY_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function nyOffsetMs(instant: number): number {
  const parts = NY_PARTS.formatToParts(instant);
  const value = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const local = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour") % 24,
    value("minute"),
    value("second"),
  );
  return local - instant;
}

function nyToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): string {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = nyOffsetMs(naive - nyOffsetMs(naive));
  return `${new Date(naive - offset).toISOString().slice(0, 19)}Z`;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)];
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rand() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function intBetween(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function skewedCents(rand: () => number, min: number, max: number): number {
  const unit = rand();
  return min + Math.round(unit * unit * unit * (max - min));
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function hasUser(card: Card): card is SeedCard {
  return card.userId !== null;
}

function isRestricted(card: SeedCard): boolean {
  return card.allowedMccs.length > 0 || card.allowedMerchants.length > 0;
}

function isInsidePolicy(card: SeedCard, merchant: SeedMerchant): boolean {
  return (
    card.allowedMccs.includes(merchant.mcc) ||
    card.allowedMerchants.includes(merchant.canonical)
  );
}

function insidePool(card: SeedCard, pool: SeedMerchant[]): SeedMerchant[] {
  const inside = pool.filter((merchant) => isInsidePolicy(card, merchant));
  if (inside.length === 0) {
    throw new Error(`no seed merchants satisfy the allowlist on ${card.name}`);
  }
  return inside;
}

function cardLimit(card: SeedCard): number {
  if (card.limitCents === null) {
    throw new Error(`card ${card.name} has no limit to scale spend against`);
  }
  return card.limitCents;
}

// Per-month totals each card should land on, before real rows and floors are applied.
function desiredTotals(card: SeedCard, rand: () => number): number[] {
  const limit = cardLimit(card);
  switch (card.holderName) {
    case HOLDER.claire:
      return MONTHS.map(() => Math.round(limit * (0.12 + rand() * 0.08)));
    case HOLDER.emma:
      return MONTHS.map((_, index) =>
        Math.round(limit * (0.45 + index * 0.1 + (rand() - 0.5) * 0.03)),
      );
    case HOLDER.daniel:
      return MONTHS.map(() => intBetween(rand, 210000, 260000));
  }
  switch (card.limitType) {
    case "monthly":
      return MONTHS.map(() => Math.round(limit * (0.45 + rand() * 0.4)));
    case "daily":
      return MONTHS.map(() => Math.round(limit * (40 + rand() * 30)));
    case "fixed": {
      const total = limit * (0.6 + rand() * 0.2);
      const weights = MONTHS.map(() => 0.7 + rand() * 0.6);
      const weightSum = sum(weights);
      return weights.map((weight) => Math.round((total * weight) / weightSum));
    }
    default:
      throw new Error(`no seed target for ${card.name} with limit type ${card.limitType}`);
  }
}

function recurringBaseCents(scale: number, rand: () => number): number {
  return skewedCents(
    rand,
    Math.max(900, Math.round(scale * 0.005)),
    Math.max(2500, Math.round(scale * 0.06)),
  );
}

// Every card gets 2 to 4 recurring merchants with no merchant shared between cards,
// apart from the planted duplicates. Allowlisted cards pick first so their small
// inside pool is not consumed by unrestricted cards.
function assignRecurrences(
  plans: Omit<CardPlan, "recurrences">[],
  rand: () => number,
): Map<string, Recurrence[]> {
  const taken = new Set<string>();
  const ordered = [
    ...plans.filter((plan) => isRestricted(plan.card)),
    ...plans.filter((plan) => !isRestricted(plan.card)),
  ];
  const assigned = new Map<string, Recurrence[]>();
  for (const { card, scale } of ordered) {
    const planted = PLANTED_RECURRING.filter((entry) =>
      entry.holders.includes(card.holderName ?? ""),
    );
    const wanted = intBetween(rand, 2, 4) - planted.length;
    const candidates = RECURRING_POOL.filter(
      (merchant) =>
        !taken.has(merchant.raw) && (!isRestricted(card) || isInsidePolicy(card, merchant)),
    );
    const picks = shuffle(candidates, rand).slice(0, Math.max(0, wanted));
    if (picks.length + planted.length < 2) {
      throw new Error(`recurring merchant pool exhausted before ${card.name}`);
    }
    for (const merchant of picks) taken.add(merchant.raw);
    assigned.set(card.id, [
      ...planted.map((entry) => ({
        merchant: entry.merchant,
        day: intBetween(rand, 1, 28),
        baseCents: entry.cents,
        fixed: true,
      })),
      ...picks.map((merchant) => ({
        merchant,
        day: intBetween(rand, 1, 28),
        baseCents: recurringBaseCents(scale, rand),
        fixed: false,
      })),
    ]);
  }
  return assigned;
}

function buildRow(
  card: SeedCard,
  merchant: SeedMerchant,
  amountCents: number,
  month: SeedMonth,
  day: number,
  rand: () => number,
): Row {
  return {
    accountId: ACCOUNT_ID,
    postedAt: nyToIso(
      month.year,
      month.month,
      day,
      intBetween(rand, 8, 21),
      intBetween(rand, 0, 59),
      intBetween(rand, 0, 59),
    ),
    amountCents,
    merchant: merchant.raw,
    cardId: card.id,
    cardName: card.name,
    userId: card.userId,
    userName: card.holderName,
    logoUrl: null,
  };
}

function draftRow(
  card: SeedCard,
  merchant: SeedMerchant,
  month: SeedMonth,
  rand: () => number,
): Row {
  return buildRow(
    card,
    merchant,
    skewedCents(rand, 400, 90000),
    month,
    intBetween(rand, 1, month.days),
    rand,
  );
}

function recurringRows(plan: CardPlan, rand: () => number): Row[][] {
  return MONTHS.map((month) =>
    plan.recurrences.map((entry) =>
      buildRow(
        plan.card,
        entry.merchant,
        entry.fixed ? entry.baseCents : Math.round(entry.baseCents * (0.95 + rand() * 0.1)),
        month,
        entry.day,
        rand,
      ),
    ),
  );
}

// One-off drafts carry provisional amounts; fitOneoffs rescales them to the month's budget.
function draftOneoffs(plan: CardPlan, rand: () => number): Row[][] {
  if (isRestricted(plan.card)) return draftRestrictedOneoffs(plan, rand);
  const factor = Math.max(1, Math.round(plan.scale / 800000));
  return MONTHS.map((month) => {
    const count = intBetween(rand, 8, 25) * factor;
    return Array.from({ length: count }, () =>
      draftRow(plan.card, pick(ONEOFF_POOL, rand), month, rand),
    );
  });
}

// Allowlisted cards: a fixed share of all charges (recurring included) leak to
// software or rideshare merchants; everything else stays inside the allowlist.
function draftRestrictedOneoffs(plan: CardPlan, rand: () => number): Row[][] {
  const { card } = plan;
  const leakCount = intBetween(rand, 4, 6);
  const totalCharges = Math.round(leakCount / LEAK_SHARE);
  const insideCount = Math.max(
    0,
    totalCharges - leakCount - plan.recurrences.length * MONTHS.length,
  );
  const perMonth = MONTHS.map(() => Math.floor(insideCount / MONTHS.length));
  const extra = shuffle(MONTHS.map((_, index) => index), rand);
  for (const index of extra.slice(0, insideCount % MONTHS.length)) perMonth[index] += 1;

  const inside = insidePool(card, ONEOFF_POOL);
  const months = MONTHS.map((month, index) =>
    Array.from({ length: perMonth[index] }, () => draftRow(card, pick(inside, rand), month, rand)),
  );
  for (let leak = 0; leak < leakCount; leak += 1) {
    const index = intBetween(rand, 0, MONTHS.length - 1);
    months[index].push(draftRow(card, pick(LEAK_POOL, rand), MONTHS[index], rand));
  }
  return months;
}

// Final per-month totals: never below what is already booked, and for a ramping
// card strictly above the previous month.
function resolveTotals(plan: CardPlan, floors: number[]): number[] {
  const rising = plan.card.holderName === HOLDER.emma;
  const step = Math.round(cardLimit(plan.card) * 0.01);
  const totals: number[] = [];
  for (let index = 0; index < MONTHS.length; index += 1) {
    let total = Math.max(plan.desired[index], floors[index]);
    if (rising && index > 0) total = Math.max(total, totals[index - 1] + step);
    totals.push(total);
  }
  return totals;
}

function fitToTotal(rows: Row[], targetCents: number): Row[] {
  const total = rows.reduce((sum, row) => sum + row.amountCents, 0);
  const scaled = rows.map((row) =>
    Math.max(MIN_ONEOFF_CENTS, Math.round((row.amountCents * targetCents) / total)),
  );
  const order = [...scaled.keys()].sort((left, right) => scaled[right] - scaled[left]);
  let remainder = targetCents - scaled.reduce((sum, value) => sum + value, 0);
  for (const index of order) {
    if (remainder === 0) break;
    const step =
      remainder > 0 ? remainder : Math.max(remainder, MIN_ONEOFF_CENTS - scaled[index]);
    scaled[index] += step;
    remainder -= step;
  }
  return rows.map((row, index) => ({ ...row, amountCents: scaled[index] }));
}

// When a month's budget is too small for the drafted rows (a real row already
// fills the month), keep fewer one-offs rather than crushing every amount to $4.
function fitOneoffs(rows: Row[], budgetCents: number): Row[] {
  if (rows.length === 0) return [];
  const keep = Math.max(
    1,
    Math.min(rows.length, Math.floor(budgetCents / MIN_ONEOFF_AVG_CENTS)),
  );
  const kept = rows.slice(0, keep);
  return fitToTotal(kept, Math.max(budgetCents, keep * MIN_ONEOFF_CENTS));
}

function monthKey(postedAt: string): string {
  return postedAt.slice(0, 7);
}

function seedMonthKey(month: SeedMonth): string {
  return `${month.year}-${String(month.month).padStart(2, "0")}`;
}

function canonicalizeRaw(raw: string): string {
  return raw
    .replace(/\b(inc|llc|corp|ltd|co)\b\.?/gi, "")
    .replace(/[*#]+.*$/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[,\s]+$/, "")
    .trim();
}

function guessMcc(raw: string): MccGuess {
  const rule = MCC_RULES.find((entry) => entry.match.test(raw));
  return rule ? rule.guess : FALLBACK_GUESS;
}

function recurringRaws(txns: Txn[]): Set<string> {
  const seen = new Map<string, { raw: string; months: Set<string>; days: number[] }>();
  for (const txn of txns) {
    const key = `${txn.cardId ?? ""}|${txn.merchant}`;
    const entry = seen.get(key) ?? { raw: txn.merchant, months: new Set<string>(), days: [] };
    entry.months.add(monthKey(txn.postedAt));
    entry.days.push(new Date(txn.postedAt).getUTCDate());
    seen.set(key, entry);
  }
  const recurring = new Set<string>();
  for (const entry of seen.values()) {
    const spread = Math.max(...entry.days) - Math.min(...entry.days);
    if (entry.months.size >= 4 && spread <= 3) recurring.add(entry.raw);
  }
  return recurring;
}

function main(): void {
  const rand = mulberry32(SEED);

  const cards = CardSchema.array().parse(
    JSON.parse(readFileSync("data/cards.json", "utf8")),
  );
  const real = TxnSchema.array()
    .parse(JSON.parse(readFileSync("data/transactions.json", "utf8")))
    .filter((txn) => !txn.id.startsWith(GENERATED_ID_PREFIX));

  const seedCards = cards.filter(hasUser);
  const cardFor = (holder: string): SeedCard => {
    const card = seedCards.find((entry) => entry.holderName === holder);
    if (card === undefined) throw new Error(`no card held by ${holder} in data/cards.json`);
    return card;
  };
  const bigTicketCard = cardFor(HOLDER.hannah);
  const gamblingCards = [cardFor(HOLDER.lucas), cardFor(HOLDER.lucas), cardFor(HOLDER.claire)];
  const personalCard = cardFor(HOLDER.ethan);
  const liquorCard = cardFor(HOLDER.sofia);

  // Amounts already on each card-month before one-offs are fitted.
  const booked = new Map<string, number>();
  const book = (cardId: string, key: string, cents: number): void => {
    const slot = `${cardId}|${key}`;
    booked.set(slot, (booked.get(slot) ?? 0) + cents);
  };
  for (const txn of real) {
    if (txn.cardId !== null) book(txn.cardId, monthKey(txn.postedAt), txn.amountCents);
  }

  const drafts = seedCards.map((card) => {
    const desired = desiredTotals(card, rand);
    return { card, desired, scale: Math.round(sum(desired) / desired.length) };
  });
  const recurrences = assignRecurrences(drafts, rand);
  const plans: CardPlan[] = drafts.map((draft) => ({
    ...draft,
    recurrences: recurrences.get(draft.card.id) ?? [],
  }));

  const rows: Row[] = [];
  const plant = (card: SeedCard, merchant: SeedMerchant, cents: number, month: SeedMonth): void => {
    const row = buildRow(card, merchant, cents, month, intBetween(rand, 1, month.days), rand);
    book(card.id, seedMonthKey(month), cents);
    rows.push(row);
  };

  plant(bigTicketCard, CONFERENCE_MERCHANT, 185000, MONTHS[intBetween(rand, 0, 2)]);
  plant(bigTicketCard, ELECTRONICS_MERCHANT, 240000, MONTHS[intBetween(rand, 3, 5)]);
  for (const card of gamblingCards) {
    plant(card, GAMBLING_MERCHANT, intBetween(rand, 5000, 20000), pick(MONTHS, rand));
  }
  plant(personalCard, PERSONAL_MERCHANT, intBetween(rand, 17500, 18500), pick(MONTHS, rand));
  for (let index = 0; index < 2; index += 1) {
    plant(liquorCard, pick(LIQUOR_POOL, rand), intBetween(rand, 3500, 12000), pick(MONTHS, rand));
  }

  for (const plan of plans) {
    const recurring = recurringRows(plan, rand);
    const oneoffs = draftOneoffs(plan, rand);
    const bookedByMonth = MONTHS.map(
      (month, index) =>
        (booked.get(`${plan.card.id}|${seedMonthKey(month)}`) ?? 0) +
        sum(recurring[index].map((row) => row.amountCents)),
    );
    const floors = bookedByMonth.map(
      (cents, index) => cents + Math.min(oneoffs[index].length, 2) * MIN_ONEOFF_AVG_CENTS,
    );
    const totals = resolveTotals(plan, floors);
    MONTHS.forEach((_, index) => {
      rows.push(
        ...recurring[index],
        ...fitOneoffs(oneoffs[index], totals[index] - bookedByMonth[index]),
      );
    });
  }

  const generated: Txn[] = rows
    .sort((left, right) => left.postedAt.localeCompare(right.postedAt))
    .map((row, index) => ({
      id: `${GENERATED_ID_PREFIX}${String(index + 1).padStart(5, "0")}`,
      ...row,
    }));

  const merged = TxnSchema.array().parse(
    [...real, ...generated].sort((left, right) =>
      left.postedAt.localeCompare(right.postedAt),
    ),
  );

  const recurring = recurringRaws(merged);
  const usedRaws = new Set(generated.map((txn) => txn.merchant));
  const merchants: Record<string, Merchant> = {};
  for (const txn of real) {
    const guess = guessMcc(txn.merchant);
    merchants[txn.merchant] = {
      raw: txn.merchant,
      canonical: canonicalizeRaw(txn.merchant),
      mcc: guess.mcc,
      mccName: guess.mccName,
      confidence: 0.8,
      isRecurring: recurring.has(txn.merchant),
    };
  }
  for (const merchant of MERCHANTS.filter((entry) => usedRaws.has(entry.raw))) {
    merchants[merchant.raw] = {
      raw: merchant.raw,
      canonical: merchant.canonical,
      mcc: merchant.mcc,
      mccName: merchant.mccName,
      confidence: 1,
      isRecurring: recurring.has(merchant.raw),
    };
  }
  const catalog = z.record(z.string(), MerchantSchema).parse(merchants);

  writeFileSync("data/transactions.json", `${JSON.stringify(merged, null, 2)}\n`);
  writeFileSync("data/merchants.json", `${JSON.stringify(catalog, null, 2)}\n`);

  console.log(
    `seeded ${generated.length} transactions across ${seedCards.length} cards, ${
      Object.keys(catalog).length
    } merchants`,
  );
}

main();
