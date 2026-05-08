/* VECTOR — Sidebar, Topbar, CmdPalette */

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "problems",  label: "Problems",  icon: "problems",  count: 28 },
  { id: "triage",    label: "Triage queue", icon: "triage", pip: 198 },
  { id: "bugs",      label: "Bugs",      icon: "bug",       count: 47 },
  { id: "tickets",   label: "Tickets",   icon: "ticket",    count: 4218 },
];
const NAV2 = [
  { id: "products",  label: "Products",  icon: "product" },
  { id: "teams",     label: "Teams",     icon: "team" },
  { id: "insights",  label: "Insights",  icon: "insight" },
];

const Sidebar = ({ route, go, openCmd }) => (
  <aside className="sb">
    <div className="sb-brand">
      <span className="mark">V</span>
      <span className="name">Vector</span>
      <span className="ws">SBR · Ops</span>
    </div>
    <button className="sb-search" onClick={openCmd}>
      <Icons.search/>
      <span>Поиск, проблемы, баги…</span>
      <Kbd>⌘K</Kbd>
    </button>
    <nav className="sb-section">
      <div className="lbl">Operations</div>
      {NAV.map(n => {
        const I = Icons[n.icon];
        return (
          <button key={n.id} className={`sb-link ${route.view===n.id?"active":""}`} onClick={() => go({ view: n.id })}>
            <I/>
            <span>{n.label}</span>
            {n.pip != null
              ? <span className="pip">{n.pip}</span>
              : (n.count != null && <span className="count">{n.count}</span>)}
          </button>
        );
      })}
    </nav>
    <nav className="sb-section">
      <div className="lbl">Workspace</div>
      {NAV2.map(n => {
        const I = Icons[n.icon];
        return (
          <button key={n.id} className="sb-link" onClick={() => go({ view: n.id })}>
            <I/><span>{n.label}</span>
          </button>
        );
      })}
    </nav>
    <div className="sb-foot">
      <span className="av" style={{ background: "oklch(0.75 0.14 220)", color: "oklch(0.18 0.02 250)" }}>АК</span>
      <div className="grow">
        <div style={{ color: "var(--fg)", fontSize: 12.5 }}>Анна К.</div>
        <div className="faint" style={{ fontSize: 11 }}>Triage lead</div>
      </div>
      <Icons.bell/>
    </div>
  </aside>
);

const ROUTE_LABELS = {
  dashboard: "Dashboard",
  problems: "Problems",
  triage: "Triage queue",
  bugs: "Bugs",
  tickets: "Tickets",
  products: "Products",
  teams: "Teams",
  insights: "Insights",
};

const Topbar = ({ route, go, openCmd }) => {
  const root = ROUTE_LABELS[route.view] || "—";
  const here = route.detailId
    ? (PROBLEMS.find(p=>p.id===route.detailId)?.id || route.detailId)
    : null;
  return (
    <header className="tb">
      <div className="tb-crumb">
        <span>SBR Insurance</span>
        <span className="sep">/</span>
        <button onClick={() => go({ view: route.view, detailId: null })}
          className={here ? "" : "here"} style={{ color: here ? "var(--fg-mute)" : "var(--fg)" }}>
          {root}
        </button>
        {here && <><span className="sep">/</span><span className="here">{here}</span></>}
      </div>
      <div className="tb-spacer"/>
      <button className="btn btn-ghost" onClick={openCmd}>
        <Icons.search/><span>Поиск</span><Kbd>⌘K</Kbd>
      </button>
      <Btn icon={<Icons.ai/>} ghost>Ask AI</Btn>
      <IconBtn icon={<Icons.bell/>} title="Уведомления"/>
      <Btn icon={<Icons.plus/>} primary>Создать</Btn>
    </header>
  );
};

const CmdPalette = ({ open, onClose, go }) => {
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  React.useEffect(() => { if (open) { setQ(""); setSel(0); } }, [open]);
  if (!open) return null;
  const lc = q.toLowerCase();
  const probs = PROBLEMS.filter(p => p.title.toLowerCase().includes(lc) || p.id.toLowerCase().includes(lc)).slice(0, 5);
  const bugs = BUGS.filter(b => b.title.toLowerCase().includes(lc) || b.id.toLowerCase().includes(lc)).slice(0, 4);
  const actions = [
    { label: "Перейти в Dashboard", hint: "G then D", run: () => go({ view: "dashboard" }) },
    { label: "Перейти в Triage queue", hint: "G then T", run: () => go({ view: "triage" }) },
    { label: "Создать новую проблему", hint: "C", run: () => {} },
    { label: "Привязать обращение к проблеме", hint: "L", run: () => {} },
  ].filter(a => a.label.toLowerCase().includes(lc));
  const all = [
    ...probs.map(p => ({ kind: "problem", item: p })),
    ...bugs.map(b => ({ kind: "bug", item: b })),
    ...actions.map(a => ({ kind: "action", item: a })),
  ];
  const onKey = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") { setSel(s => Math.min(all.length-1, s+1)); e.preventDefault(); }
    if (e.key === "ArrowUp") { setSel(s => Math.max(0, s-1)); e.preventDefault(); }
    if (e.key === "Enter") {
      const x = all[sel];
      if (!x) return;
      if (x.kind === "problem") go({ view: "problems", detailId: x.item.id });
      if (x.kind === "bug") go({ view: "problems", detailId: x.item.problemId, tab: "bugs", focus: x.item.id });
      if (x.kind === "action") x.item.run();
      onClose();
    }
  };
  return (
    <div className="cmd-bg" onClick={onClose}>
      <div className="cmd" onClick={e => e.stopPropagation()}>
        <input autoFocus placeholder="Найти проблему, баг, тикет, действие…" value={q}
          onChange={e => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey}/>
        <div className="cmd-list">
          {probs.length > 0 && <div className="cmd-sect">Проблемы</div>}
          {probs.map((p, i) => {
            const idx = i;
            return (
              <div key={p.id} className={`cmd-row ${sel===idx?"sel":""}`} onMouseEnter={() => setSel(idx)}
                onClick={() => { go({ view: "problems", detailId: p.id }); onClose(); }}>
                <Icons.problems/>
                <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{p.id}</span>
                <span className="grow">{p.title}</span>
                <PriorityBadge p={p.priority}/>
              </div>
            );
          })}
          {bugs.length > 0 && <div className="cmd-sect">Баги</div>}
          {bugs.map((b, i) => {
            const idx = probs.length + i;
            return (
              <div key={b.id} className={`cmd-row ${sel===idx?"sel":""}`} onMouseEnter={() => setSel(idx)}
                onClick={() => { go({ view: "problems", detailId: b.problemId, tab: "bugs", focus: b.id }); onClose(); }}>
                <Icons.bug/>
                <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{b.id}</span>
                <span className="grow">{b.title}</span>
                <span className="hint">{b.team}</span>
              </div>
            );
          })}
          {actions.length > 0 && <div className="cmd-sect">Действия</div>}
          {actions.map((a, i) => {
            const idx = probs.length + bugs.length + i;
            return (
              <div key={a.label} className={`cmd-row ${sel===idx?"sel":""}`} onMouseEnter={() => setSel(idx)}
                onClick={() => { a.run(); onClose(); }}>
                <Icons.command/>
                <span className="grow">{a.label}</span>
                <span className="hint">{a.hint}</span>
              </div>
            );
          })}
          {all.length === 0 && <div className="empty"><h4>Ничего не найдено</h4><div>Попробуйте другой запрос</div></div>}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Sidebar, Topbar, CmdPalette });
