/* VECTOR — icons + atoms.
   All icons are 16x16 line, currentColor stroke. */

const Icon = ({ d, size = 16, fill = "none", stroke = "currentColor", strokeWidth = 1.5, children, ...rest }) => (
  <svg className="ico" width={size} height={size} viewBox="0 0 16 16" fill={fill}
       stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {children || <path d={d} />}
  </svg>
);

const Icons = {
  dashboard: () => <Icon><path d="M2 3h5v6H2zM9 3h5v3H9zM9 8h5v5H9zM2 11h5v2H2z"/></Icon>,
  problems:  () => <Icon><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.5M8 11h.01"/></Icon>,
  triage:    () => <Icon><path d="M2 4h12M3 8h10M5 12h6"/></Icon>,
  bug:       () => <Icon><path d="M5 5a3 3 0 0 1 6 0M3 8h10M4 7v3a4 4 0 0 0 8 0V7M2 6h2M12 6h2M2 12h2M12 12h2M8 8v6"/></Icon>,
  ticket:    () => <Icon><path d="M2 5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2a1.5 1.5 0 0 0 0 3v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1.5 1.5 0 0 0 0-3z"/><path d="M7 4v8" strokeDasharray="1 1.5"/></Icon>,
  product:   () => <Icon><path d="M3 5l5-2.5L13 5v6l-5 2.5L3 11zM3 5l5 2.5M13 5l-5 2.5M8 7.5V14"/></Icon>,
  insight:   () => <Icon><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/><circle cx="8" cy="8" r="3"/></Icon>,
  search:    () => <Icon><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></Icon>,
  filter:    () => <Icon><path d="M2 4h12M4 8h8M6 12h4"/></Icon>,
  sort:      () => <Icon><path d="M4 3v10M4 13l-2-2M4 13l2-2M12 13V3M12 3l-2 2M12 3l2 2"/></Icon>,
  plus:      () => <Icon><path d="M8 3v10M3 8h10"/></Icon>,
  more:      () => <Icon><circle cx="3" cy="8" r=".7" fill="currentColor"/><circle cx="8" cy="8" r=".7" fill="currentColor"/><circle cx="13" cy="8" r=".7" fill="currentColor"/></Icon>,
  chev:      () => <Icon><path d="M6 4l4 4-4 4"/></Icon>,
  chevDown:  () => <Icon><path d="M4 6l4 4 4-4"/></Icon>,
  link:      () => <Icon><path d="M7 9a3 3 0 0 0 4 0l2-2a3 3 0 1 0-4-4l-1 1M9 7a3 3 0 0 0-4 0L3 9a3 3 0 1 0 4 4l1-1"/></Icon>,
  user:      () => <Icon><circle cx="8" cy="6" r="2.5"/><path d="M3 14a5 5 0 0 1 10 0"/></Icon>,
  team:      () => <Icon><circle cx="6" cy="6" r="2"/><circle cx="11" cy="6.5" r="1.5"/><path d="M2 13a4 4 0 0 1 8 0M9 13a4 4 0 0 1 5 0"/></Icon>,
  alert:     () => <Icon><path d="M8 2l6 11H2zM8 6v3M8 11h.01"/></Icon>,
  fire:      () => <Icon><path d="M8 14a4 4 0 0 1-3-6.5C7 6 6 4 8 2c0 2 4 3 4 7.5A4 4 0 0 1 8 14"/></Icon>,
  pin:       () => <Icon><path d="M11 3l2 2-3 1-1 4-2-2-4 4 1-4-2-2 4-1 1-3z"/></Icon>,
  star:      () => <Icon><path d="M8 2l1.7 3.7L13.5 6l-2.8 2.6.7 3.9L8 10.7 4.6 12.5l.7-3.9L2.5 6l3.8-.3z"/></Icon>,
  bell:      () => <Icon><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3zM6.5 13.5a1.5 1.5 0 0 0 3 0"/></Icon>,
  flow:      () => <Icon><circle cx="3" cy="3" r="1.5"/><circle cx="13" cy="13" r="1.5"/><circle cx="13" cy="3" r="1.5"/><circle cx="3" cy="13" r="1.5"/><path d="M4.5 4.5L11.5 11.5M4.5 11.5L11.5 4.5"/></Icon>,
  arrowUp:   () => <Icon><path d="M8 13V3M4 7l4-4 4 4"/></Icon>,
  arrowDn:   () => <Icon><path d="M8 3v10M4 9l4 4 4-4"/></Icon>,
  command:   () => <Icon><path d="M5 5h6v6H5zM5 5V3.5A1.5 1.5 0 1 0 3.5 5zM11 5h1.5A1.5 1.5 0 1 0 11 3.5zM5 11v1.5A1.5 1.5 0 1 1 3.5 11zM11 11v1.5A1.5 1.5 0 1 0 12.5 11z"/></Icon>,
  close:     () => <Icon><path d="M3 3l10 10M13 3L3 13"/></Icon>,
  check:     () => <Icon><path d="M3 8l3.5 3.5L13 5"/></Icon>,
  spark:     () => <Icon><path d="M2 11l3-4 3 2 3-5 3 4"/></Icon>,
  doc:       () => <Icon><path d="M4 2h5l3 3v9H4zM9 2v3h3"/></Icon>,
  chat:      () => <Icon><path d="M2 4h12v7H8l-3 2v-2H2z"/></Icon>,
  globe:     () => <Icon><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12"/></Icon>,
  mobile:    () => <Icon><rect x="5" y="2" width="6" height="12" rx="1"/><path d="M7 12h2"/></Icon>,
  monitor:   () => <Icon><rect x="2" y="3" width="12" height="8" rx="1"/><path d="M5 13h6M8 11v2"/></Icon>,
  server:    () => <Icon><rect x="2" y="3" width="12" height="4" rx="1"/><rect x="2" y="9" width="12" height="4" rx="1"/><circle cx="4.5" cy="5" r=".5" fill="currentColor"/><circle cx="4.5" cy="11" r=".5" fill="currentColor"/></Icon>,
  ai:        () => <Icon><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M4 12l2-2M10 6l2-2"/><circle cx="8" cy="8" r="1.5"/></Icon>,
  clock:     () => <Icon><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5"/></Icon>,
  shield:    () => <Icon><path d="M8 2L3 4v4c0 3 2 5 5 6 3-1 5-3 5-6V4z"/></Icon>,
  arrowRt:   () => <Icon><path d="M3 8h10M9 4l4 4-4 4"/></Icon>,
  paperclip: () => <Icon><path d="M11 5L5.5 10.5a2.5 2.5 0 0 0 3.5 3.5L14 8.5a4 4 0 0 0-5.5-5.5L4 7"/></Icon>,
};

/* ─── Avatar ─── */
const Avatar = ({ user, size }) => {
  if (!user) return <span className={`av empty ${size||""}`}>·</span>;
  const u = typeof user === "string" ? userById(user) : user;
  if (!u) return <span className={`av empty ${size||""}`}>·</span>;
  return <span className={`av ${size||""}`} style={{ background: u.color, color: "oklch(0.18 0.02 250)" }}>{u.init}</span>;
};
const AvatarStack = ({ ids = [], max = 3 }) => {
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  return (
    <span className="av-stack">
      {shown.map(id => <Avatar key={id} user={id} size="sm" />)}
      {extra > 0 && <span className="av sm" style={{ background: "var(--bg-elev-2)", color: "var(--fg-mute)" }}>+{extra}</span>}
    </span>
  );
};

/* ─── Badge ─── */
const Badge = ({ tone = "mute", dot, children }) => (
  <span className={`bdg bdg-${tone}`}>
    {dot && <span className="dot"/>}
    {children}
  </span>
);
const StatusBadge = ({ status }) => {
  const s = STATUS_LABELS[status]; if (!s) return null;
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
};
const PriorityBadge = ({ p }) => {
  const v = PRIO_LABELS[p]; if (!v) return null;
  return <Badge tone={v.tone}>{v.label}</Badge>;
};
const SeverityBadge = ({ s }) => {
  const v = SEV_LABELS[s]; if (!v) return null;
  return <Badge tone={v.tone}>{v.label}</Badge>;
};

/* ─── Delta ─── */
const fmtPct = (v) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;
const Delta = ({ value, invert = false }) => {
  const dir = value > 0.01 ? "up" : value < -0.01 ? "down" : "flat";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "—";
  return (
    <span className={`delta ${dir} ${invert ? "invert" : ""}`}>
      <span className="arrow">{arrow}</span>{fmtPct(value)}
    </span>
  );
};

/* ─── Sparkline ─── */
const Sparkline = ({ data = [], w = 100, h = 26, accent, fill = true }) => {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = Math.max(1, max - min);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (w - 2) + 1,
    h - 2 - ((v - min) / span) * (h - 4),
  ]);
  const last = data[data.length - 1], first = data[0];
  const dir = last > first ? "up" : last < first ? "down" : "flat";
  const color = accent || (dir === "up" ? "var(--critical)" : dir === "down" ? "var(--ok)" : "var(--fg-faint)");
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = `${path} L${pts[pts.length-1][0]},${h} L${pts[0][0]},${h} Z`;
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {fill && <path d={area} fill={color} opacity="0.15"/>}
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="1.8" fill={color}/>
    </svg>
  );
};

/* ─── Kbd ─── */
const Kbd = ({ children }) => <span className="kbd">{children}</span>;

/* ─── Btn ─── */
const Btn = ({ icon, primary, ghost, kbd, children, ...p }) => (
  <button className={`btn ${primary?"btn-primary":""} ${ghost?"btn-ghost":""}`} {...p}>
    {icon ? icon : null}
    {children}
    {kbd && <Kbd>{kbd}</Kbd>}
  </button>
);

const IconBtn = ({ icon, ...p }) => (
  <button className="btn btn-ghost btn-icon" {...p}>{icon}</button>
);

/* ─── Product / platform pills ─── */
const ProductPill = ({ p }) => <span className="chip">{p}</span>;
const PlatformIcon = ({ p }) => {
  if (p === "mobile") return <Icons.mobile />;
  if (p === "lk-web" || p === "web") return <Icons.monitor />;
  if (p === "backend") return <Icons.server />;
  return <Icons.globe />;
};

/* ─── Health bar ─── */
const HealthBar = ({ value }) => (
  <div className="bar" style={{ width: 60 }}>
    <span style={{ width: `${Math.round(value*100)}%`, background: value < 0.7 ? "var(--critical)" : value < 0.9 ? "var(--high)" : "var(--ok)" }}/>
  </div>
);

Object.assign(window, {
  Icon, Icons, Avatar, AvatarStack, Badge, StatusBadge, PriorityBadge, SeverityBadge,
  Delta, Sparkline, Kbd, Btn, IconBtn, ProductPill, PlatformIcon, HealthBar, fmtPct,
});
