import { useMemo, type KeyboardEvent, type PointerEvent } from "react";
import { monthKeyET } from "../lib/engine";
import type { Verdict } from "../lib/types";
import { monthName, monthShort } from "./format";

type Props = {
  verdicts: Verdict[];
  revealed: number;
  openIndex: number | null;
  onSeek: (fraction: number) => void;
};

const TICK_CLASS: Record<Verdict["outcome"], string> = {
  pass: "p",
  flag: "f",
  block: "b",
};

const KEY_STEP = 0.02;

function monthSegments(verdicts: Verdict[]): { month: string; count: number; start: number }[] {
  const segments: { month: string; count: number; start: number }[] = [];
  verdicts.forEach((verdict, index) => {
    const month = monthKeyET(verdict.txn.postedAt);
    const last = segments[segments.length - 1];
    if (last !== undefined && last.month === month) last.count += 1;
    else segments.push({ month, count: 1, start: index });
  });
  return segments;
}

export function ReplayStrip({ verdicts, revealed, openIndex, onSeek }: Props) {
  const segments = useMemo(() => monthSegments(verdicts), [verdicts]);
  const total = Math.max(1, verdicts.length);
  const progress = revealed / total;

  const seekFrom = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onSeek((event.clientX - box.left) / box.width);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") onSeek(progress + KEY_STEP);
    if (event.key === "ArrowLeft") onSeek(progress - KEY_STEP);
    if (event.key === "Home") onSeek(0);
    if (event.key === "End") onSeek(1);
  };

  return (
    <div
      className="strip"
      role="slider"
      tabIndex={0}
      aria-label="Replay position"
      aria-valuemin={0}
      aria-valuemax={verdicts.length}
      aria-valuenow={revealed}
      aria-valuetext={`${revealed} of ${verdicts.length} transactions`}
      onPointerDown={seekFrom}
      onPointerMove={(event) => event.buttons === 1 && seekFrom(event)}
      onKeyDown={onKey}
    >
      <div className="months">
        {segments.map((segment) => (
          <span
            key={segment.month}
            className={segment.start < revealed ? "on" : ""}
            style={{ flex: `${segment.count} 1 0` }}
            title={`${monthName(segment.month)}: ${segment.count} transactions`}
          >
            {monthShort(segment.month)}
          </span>
        ))}
      </div>
      <div className="ticks">
        {verdicts.map((verdict, index) => (
          <i key={verdict.txn.id} className={index < revealed ? TICK_CLASS[verdict.outcome] : ""} />
        ))}
      </div>
      <div className="track-line">
        <div className="cursor" style={{ width: `${progress * 100}%` }} />
      </div>
      {openIndex === null ? null : (
        <span className="marker" style={{ left: `${((openIndex + 0.5) / total) * 100}%` }} />
      )}
    </div>
  );
}
