import type { Card, Finding } from "../lib/types";

const TIME_ZONE = "America/New_York";

const CENTS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  month: "2-digit",
  day: "2-digit",
});

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const CLOCK = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const KIND_LABEL: Record<Finding["kind"], string> = {
  duplicate_subscription: "Same vendor on two cards",
  control_leakage: "Card allows spending it shouldn't",
  risk_category: "Category nobody blocked",
  no_limit: "No spending limit set",
  limit_too_high: "Limit set far above actual spend",
  spend_acceleration: "Spending climbing month over month",
};

export function money(cents: number): string {
  return CENTS.format(cents / 100);
}

export function dollars(cents: number): string {
  return WHOLE.format(Math.round(cents / 100));
}

export function shortDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso)).replace("/", "-");
}

export function longDate(iso: string): string {
  return LONG_DATE.format(new Date(iso));
}

export function clock(date: Date): string {
  return CLOCK.format(date);
}

export function monthName(key: string): string {
  return MONTH_NAMES[Number(key.slice(5, 7)) - 1] ?? key;
}

export function monthShort(key: string): string {
  return monthName(key).slice(0, 3);
}

export function rangeLabel(months: string[]): string {
  if (months.length === 0) return "No history";
  const first = months[0];
  const last = months[months.length - 1];
  const year = last.slice(0, 4);
  if (first === last) return `${monthName(last)} ${year}`;
  const firstYear = first.slice(0, 4) === year ? "" : ` ${first.slice(0, 4)}`;
  return `${monthName(first)}${firstYear} to ${monthName(last)} ${year}`;
}

export function limitLabel(card: Card): string {
  if (card.limitCents === null) return "No limit";
  const type = card.limitType === null ? "" : ` ${card.limitType.replace("_", " ")}`;
  return `${dollars(card.limitCents)}${type}`;
}

export function sentence(reason: string): string {
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

export function plural(count: number, word: string): string {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}
