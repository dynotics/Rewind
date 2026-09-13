import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { monthKeyET } from "../lib/engine";
import type { Txn } from "../lib/types";
import { monthWindow } from "./analysis";

const PARAM = "range";
const SEPARATOR = "..";

export type MonthRange = { start: string; end: string };

export function parseRange(value: string | null): MonthRange | null {
  if (value === null) return null;
  const [start, end] = value.split(SEPARATOR);
  if (start === undefined || end === undefined) return null;
  return { start, end };
}

/** Snaps a wanted range onto months the dataset actually has, so it can never reach past the data. */
export function clampRange(wanted: MonthRange | null, months: string[]): MonthRange | null {
  if (months.length === 0) return null;
  const full = { start: months[0], end: months[months.length - 1] };
  if (wanted === null) return full;
  const [low, high] = wanted.start <= wanted.end ? [wanted.start, wanted.end] : [wanted.end, wanted.start];
  const inside = months.filter((month) => month >= low && month <= high);
  if (inside.length === 0) return full;
  return { start: inside[0], end: inside[inside.length - 1] };
}

function isFull(range: MonthRange, months: string[]): boolean {
  return range.start === months[0] && range.end === months[months.length - 1];
}

export function txnsInRange(txns: Txn[], range: MonthRange | null): Txn[] {
  if (range === null) return txns;
  return txns.filter((txn) => {
    const month = monthKeyET(txn.postedAt);
    return month >= range.start && month <= range.end;
  });
}

export function useMonthRange(txns: Txn[]) {
  const params = useSearchParams();
  const [wanted, setRange] = useState<MonthRange | null>(() => parseRange(params.get(PARAM)));
  const months = useMemo(() => monthWindow(txns), [txns]);
  const range = useMemo(() => clampRange(wanted, months), [wanted, months]);

  useEffect(() => {
    if (range === null) return;
    const url = new URL(window.location.href);
    if (isFull(range, months)) url.searchParams.delete(PARAM);
    else url.searchParams.set(PARAM, `${range.start}${SEPARATOR}${range.end}`);
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }, [range, months]);

  return { months, range, setRange };
}
