import type { Verdict } from "../lib/types";
import type { Filter, Tally } from "./analysis";
import { Ledger, type LedgerRow } from "./Ledger";
import { ReplayStats } from "./ReplayStats";
import { ReplayStrip } from "./ReplayStrip";
import { plural } from "./format";
import { SPEEDS, type Playback } from "./usePlayback";

type Props = {
  verdicts: Verdict[];
  rows: LedgerRow[];
  revealed: number;
  playback: Playback;
  tally: Tally;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  openTxnId: string | null;
  openIndex: number | null;
  onOpen: (txnId: string) => void;
  monthCount: number;
  scopeLabel: string;
  noRule: boolean;
};

const FILTER_LABEL: Record<Filter, string> = {
  all: "",
  block: "blocked",
  flag: "flagged for review",
  wrong: "blocked by mistake",
};

function PlayRing({ playback }: { playback: Playback }) {
  return (
    <button
      type="button"
      className="ring"
      onClick={playback.toggle}
      aria-label={playback.playing ? "Pause replay" : "Play replay"}
    >
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="track" cx="18" cy="18" r="16" />
        <circle
          className="prog"
          cx="18"
          cy="18"
          r="16"
          pathLength="100"
          style={{ strokeDashoffset: 100 - playback.progress * 100 }}
        />
      </svg>
      <span className={playback.playing ? "pause" : "tri"} />
    </button>
  );
}

function SpeedControl({ playback }: { playback: Playback }) {
  return (
    <div className="speed" role="group" aria-label="Playback speed">
      {SPEEDS.map((speed) => (
        <button
          key={speed.label}
          type="button"
          className={speed === playback.speed ? "on" : ""}
          aria-pressed={speed === playback.speed}
          onClick={() => playback.setSpeed(speed)}
        >
          {speed.label}
        </button>
      ))}
    </div>
  );
}

export function ReplayPanel(props: Props) {
  const { playback, filter, rows } = props;
  const shown = filter === "all" ? "" : `${FILTER_LABEL[filter]} `;

  return (
    <div className="replay">
      <div className="head">
        <h2>Replay</h2>
        <span className="note">this rule against the last {plural(props.monthCount, "month")}</span>
        <div className="acts">
          <PlayRing playback={playback} />
          <SpeedControl playback={playback} />
          <button type="button" className="btn" onClick={playback.skip} disabled={playback.progress >= 1}>
            Skip to end
          </button>
        </div>
      </div>

      <ReplayStrip verdicts={props.verdicts} revealed={props.revealed} openIndex={props.openIndex} onSeek={playback.seek} />

      <ReplayStats
        tally={props.tally}
        revealed={props.revealed}
        total={props.verdicts.length}
        filter={filter}
        onFilter={props.onFilter}
        noRule={props.noRule}
      />

      <div className="ledger-bar">
        <span>
          {rows.length} {shown}
          {rows.length === 1 ? "transaction" : "transactions"} on {props.scopeLabel}
        </span>
      </div>

      <Ledger
        rows={rows}
        revealed={props.revealed}
        playing={playback.playing}
        openTxnId={props.openTxnId}
        onOpen={props.onOpen}
      />
    </div>
  );
}
