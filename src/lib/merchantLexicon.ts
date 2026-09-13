const PROCESSOR_PREFIXES = [
  "SQ *",
  "TST*",
  "TOAST*",
  "SP ",
  "PAYPAL *",
  "PP*",
  "AMZN MKTP",
  "AMZN ",
];

const US_STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

const PREFIX_PATTERNS = PROCESSOR_PREFIXES.map(
  (prefix) => new RegExp(`^${prefix.replace(/ /g, "\\s+").replace(/\*/g, "\\s*\\*\\s*")}`),
);

function stripProcessorPrefix(text: string): string {
  for (const pattern of PREFIX_PATTERNS) {
    const stripped = text.replace(pattern, "").trim();
    if (stripped !== text && stripped.length > 0) {
      return stripped;
    }
  }
  return text;
}

function stripTrailingCodes(text: string): string {
  let current = text;
  for (;;) {
    const next = current
      .replace(/\s*#\d+$/, "")
      .replace(/[\s-]\d{3,}$/, "")
      .replace(/\s[A-Z0-9]{5,}$/, (match) => (/\d/.test(match) ? "" : match))
      .trim();
    if (next === current || next.length === 0) {
      return current;
    }
    current = next;
  }
}

function stripCityState(text: string): string {
  const words = text.split(" ");
  const last = words[words.length - 1];
  if (words.length < 2 || !US_STATES.has(last)) {
    return text;
  }
  const withoutState = words.slice(0, -1);
  if (withoutState.length < 2) {
    return withoutState.join(" ");
  }
  return withoutState.slice(0, -1).join(" ");
}

export function normalize(raw: string): string {
  const upper = raw.toUpperCase().replace(/\s+/g, " ").trim();
  const body = stripProcessorPrefix(upper).replace(/\*/g, " ").replace(/\s+/g, " ").trim();
  return stripCityState(stripTrailingCodes(body));
}

export const MCC_KEYWORDS: { mcc: string; name: string; terms: string[] }[] = [
  {
    mcc: "4816",
    name: "Computer network and information services",
    terms: ["cloud", "hosting", "server", "infrastructure", "cdn", "database", "deploy", "domain", "bandwidth"],
  },
  {
    mcc: "7372",
    name: "Computer programming and data processing",
    terms: ["software", "saas", "platform", "app", "developer", "api", "productivity", "analytics", "workspace"],
  },
  {
    mcc: "5734",
    name: "Computer software stores",
    terms: ["software store", "app store", "license", "download", "subscription plan", "desktop app"],
  },
  {
    mcc: "5812",
    name: "Eating places and restaurants",
    terms: ["restaurant", "cafe", "coffee", "kitchen", "bistro", "dining", "tavern", "bakery", "menu"],
  },
  {
    mcc: "5814",
    name: "Fast food restaurants",
    terms: ["fast food", "burger", "pizza", "sandwich", "taco", "fried chicken", "quick service", "takeout"],
  },
  {
    mcc: "4121",
    name: "Taxicabs and limousines",
    terms: ["rideshare", "taxi", "ride-hailing", "cab", "limousine", "rides", "drivers"],
  },
  {
    mcc: "4511",
    name: "Airlines and air carriers",
    terms: ["airline", "airlines", "flights", "air travel", "airfare", "aviation", "boarding"],
  },
  {
    mcc: "7011",
    name: "Lodging, hotels and motels",
    terms: ["hotel", "hotels", "resort", "lodging", "inn", "motel", "hospitality", "rooms"],
  },
  {
    mcc: "7311",
    name: "Advertising services",
    terms: ["advertising", "ads", "marketing", "campaigns", "audience", "impressions", "adtech"],
  },
  {
    mcc: "5311",
    name: "Department stores",
    terms: ["department store", "apparel", "clothing", "cosmetics", "home goods", "footwear"],
  },
  {
    mcc: "5399",
    name: "Miscellaneous general merchandise",
    terms: ["warehouse club", "wholesale", "membership club", "bulk", "general merchandise", "groceries"],
  },
  {
    mcc: "5111",
    name: "Stationery and office supplies",
    terms: ["office supplies", "stationery", "paper", "printer", "ink", "toner", "envelopes", "pens"],
  },
  {
    mcc: "4814",
    name: "Telecommunication services",
    terms: ["wireless", "telecom", "mobile network", "broadband", "calling", "data plan", "voip"],
  },
  {
    mcc: "5732",
    name: "Electronics stores",
    terms: ["electronics", "computers", "cameras", "laptops", "gadgets", "televisions", "appliances"],
  },
  {
    mcc: "7995",
    name: "Betting and gambling",
    terms: ["casino", "sportsbook", "betting", "wagering", "gambling", "odds", "fantasy sports"],
  },
  {
    mcc: "5921",
    name: "Package stores, beer, wine and liquor",
    terms: ["liquor", "wine", "spirits", "beer", "bottle shop", "winery", "whiskey"],
  },
  {
    mcc: "0742",
    name: "Veterinary services",
    terms: ["veterinary", "veterinarian", "animal hospital", "pets", "pet care", "vet clinic"],
  },
  {
    mcc: "7523",
    name: "Parking lots and garages",
    terms: ["parking", "garage", "valet", "parking lot", "parking garage", "spaces"],
  },
  {
    mcc: "7991",
    name: "Tourist attractions and exhibits",
    terms: ["tours", "sightseeing", "attraction", "museum", "exhibits", "tourist", "excursions"],
  },
  {
    mcc: "5999",
    name: "Miscellaneous and specialty retail",
    terms: ["retail", "store", "shop", "merchandise", "goods", "marketplace"],
  },
];

const TERM_PATTERNS = MCC_KEYWORDS.map((entry) =>
  entry.terms.map((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)),
);

const STRONG_MATCH_TERMS = 3;

export function classify(text: string): { mcc: string; mccName: string; score: number } {
  const haystack = text.toLowerCase();
  let best = { mcc: "0000", mccName: "Unknown", score: 0 };

  MCC_KEYWORDS.forEach((entry, index) => {
    const patterns = TERM_PATTERNS[index];
    const matched = patterns.filter((pattern) => pattern.test(haystack)).length;
    const score = Math.min(1, matched / STRONG_MATCH_TERMS);
    if (score > best.score) {
      best = { mcc: entry.mcc, mccName: entry.name, score };
    }
  });

  return best;
}
