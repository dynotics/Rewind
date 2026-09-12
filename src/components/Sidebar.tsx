export type View = "findings" | "rules" | "cards";

export type SyncState =
  | { status: "idle" }
  | { status: "syncing" }
  | { status: "failed"; message: string };

type Props = {
  view: View;
  onView: (view: View) => void;
  collapsed: boolean;
  onCollapse: () => void;
  findingsCount: number;
  cardsCount: number;
  live: boolean;
  syncedAt: string | null;
  sync: SyncState;
  onSync: () => void;
};

function NavIcon({ view }: { view: View | "sync" }) {
  const paths = {
    findings: (
      <>
        <circle cx="8" cy="8" r="6" />
        <circle cx="8" cy="8" r="2" />
      </>
    ),
    rules: <path d="M3 5h10M3 8h7M3 11h10" />,
    cards: (
      <>
        <rect x="2" y="4" width="12" height="8" rx="1.5" />
        <path d="M2 7h12" />
      </>
    ),
    sync: (
      <>
        <path d="M3 8a5 5 0 0 1 8.5-3.5M13 8a5 5 0 0 1-8.5 3.5" />
        <path d="M11 2v3h-3M5 14v-3h3" />
      </>
    ),
  };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      {paths[view]}
    </svg>
  );
}

function Brand({ onCollapse, collapsed }: Pick<Props, "onCollapse" | "collapsed">) {
  return (
    <div className="brand">
      <div className="mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l-3 2" />
          <path d="M4.5 9a8 8 0 0 1 2.2-3.3M3.2 12.8l1.3-3.8 3.8 1.3" />
        </svg>
        <span>Rewind</span>
      </div>
      <button
        type="button"
        className="collapse"
        onClick={onCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <path d="M6 3v10" />
        </svg>
      </button>
    </div>
  );
}

function syncLabel(sync: SyncState, live: boolean): string {
  if (sync.status === "syncing") return "Syncing...";
  return live ? "Use seeded history" : "Sync from Rho";
}

export function Sidebar(props: Props) {
  const { view, onView, sync, live } = props;
  const tab = (id: View, label: string, count?: number) => (
    <button type="button" className={view === id ? "on" : ""} onClick={() => onView(id)} title={label}>
      <NavIcon view={id} />
      <span>{label}</span>
      {count === undefined ? null : <span className="count num">{count}</span>}
    </button>
  );

  return (
    <aside className="side">
      <Brand onCollapse={props.onCollapse} collapsed={props.collapsed} />
      <div className={`org ${live ? "live" : ""}`}>
        <i className="dot" />
        <span>{live ? "Rho sandbox, live" : "Rho sandbox"}</span>
      </div>
      <nav className="nav">
        {tab("findings", "Findings", props.findingsCount)}
        {tab("rules", "Rules")}
        {tab("cards", "Cards", props.cardsCount)}
        <div className="group">Data</div>
        <button type="button" onClick={props.onSync} disabled={sync.status === "syncing"} title={syncLabel(sync, live)}>
          <NavIcon view="sync" />
          <span>{syncLabel(sync, live)}</span>
        </button>
      </nav>
      <div className="foot">
        {live ? "Settled card spend from Rho" : "6 months of settled card spend"}
        <br />
        {props.syncedAt === null ? "Seeded sandbox history" : `Synced today, ${props.syncedAt}`}
        {sync.status === "failed" ? <span className="err"><br />{sync.message}</span> : null}
      </div>
    </aside>
  );
}
