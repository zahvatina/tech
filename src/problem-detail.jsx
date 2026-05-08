/* VECTOR — Problem detail page */

const ProblemDetail = ({ problemId, route, go }) => {
  const p = PROBLEMS.find(p => p.id === problemId);
  const [tab, setTab] = React.useState(route.tab || "overview");
  React.useEffect(() => { if (route.tab) setTab(route.tab); }, [route.tab]);

  if (!p) return <div className="empty">Проблема не найдена</div>;

  const bugs = BUGS.filter(b => b.problemId === p.id);
  const tickets = TICKETS.filter(t => t.problemId === p.id);
  const noBugTickets = tickets.filter(t => !t.bugId);

  const TABS = [
    { id: "overview", label: "Обзор", ct: null },
    { id: "bugs",     label: "Баги", ct: bugs.length },
    { id: "tickets",  label: "Обращения", ct: tickets.length },
    { id: "activity", label: "Активность", ct: 28 },
    { id: "linked",   label: "Связи", ct: bugs.length + 2 },
  ];

  return (
    <div className="det">
      <div className="det-main">
        <div className="det-hd">
          <div className="id">{p.id} · создано {p.created}</div>
          <h1>{p.title}</h1>
          <div className="meta">
            <StatusBadge status={p.status}/>
            <PriorityBadge p={p.priority}/>
            <SeverityBadge s={p.severity}/>
            {p.products.map(pr => <ProductPill key={pr} p={pr}/>)}
            <span className="faint" style={{ fontSize: 12 }}>·</span>
            {p.tags.map(t => <span key={t} className="chip">{t}</span>)}
            <div style={{ flex: 1 }}/>
            <Btn ghost icon={<Icons.pin/>}>Pin</Btn>
            <Btn ghost icon={<Icons.bell/>}>Подписаться</Btn>
            <Btn primary icon={<Icons.flow/>}>Сменить статус</Btn>
          </div>
        </div>

        <div className="det-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`det-tab ${tab===t.id?"active":""}`} onClick={() => setTab(t.id)}>
              <span>{t.label}</span>
              {t.ct != null && <span className="ct">{t.ct}</span>}
            </button>
          ))}
        </div>

        <div className="det-pane">
          {tab === "overview" && <ProblemOverview problem={p} bugs={bugs} tickets={tickets} go={go}/>}
          {tab === "bugs"     && <ProblemBugs problem={p} bugs={bugs} go={go} focus={route.focus}/>}
          {tab === "tickets"  && <ProblemTickets problem={p} tickets={tickets} bugs={bugs}/>}
          {tab === "activity" && <ProblemActivity problem={p} bugs={bugs}/>}
          {tab === "linked"   && <ProblemLinked problem={p} bugs={bugs} tickets={tickets}/>}
        </div>
      </div>

      {/* RIGHT META PANEL */}
      <aside className="det-side">
        <h3>Свойства</h3>
        <div className="kv">
          <div className="k">Статус</div><div className="v"><StatusBadge status={p.status}/></div>
          <div className="k">Приоритет</div><div className="v"><PriorityBadge p={p.priority}/></div>
          <div className="k">Severity</div><div className="v"><SeverityBadge s={p.severity}/></div>
          <div className="k">Owner</div><div className="v">{p.owner ? <><Avatar user={p.owner} size="sm"/> <span>{userById(p.owner).name}</span></> : <span className="bdg bdg-mute">не назначен</span>}</div>
          <div className="k">Watchers</div><div className="v"><AvatarStack ids={["u1","u2","u3","u5","u6","u8"]} max={5}/></div>
          <div className="k">Создано</div><div className="v faint">{p.created}</div>
          <div className="k">Обновлено</div><div className="v faint">{relTime(p.lastUpdate)}</div>
        </div>

        <h3>Скоуп</h3>
        <div className="kv">
          <div className="k">Продукты</div><div className="v">{p.products.map(pr => <ProductPill key={pr} p={pr}/>)}</div>
          <div className="k">Платформы</div>
          <div className="v">
            {p.platforms.map(pl => (
              <span key={pl} className="row chip" style={{ gap: 4, padding: "1px 6px" }}>
                <PlatformIcon p={pl}/> <span style={{ font: "500 11px var(--mono)" }}>{pl}</span>
              </span>
            ))}
          </div>
          <div className="k">Регионы</div><div className="v"><span className="chip">8 регионов</span><span className="faint" style={{fontSize:11}}>MSK · SPB · ещё 6</span></div>
        </div>

        <h3>Метрики</h3>
        <div className="kv">
          <div className="k">Тикетов / 7д</div><div className="v"><strong>{p.tickets.toLocaleString("ru-RU")}</strong> <Delta value={p.ticketsDelta}/></div>
          <div className="k">Untriaged</div><div className="v"><strong>{p.untriaged}</strong> <Delta value={p.untriagedDelta}/></div>
          <div className="k">Без бага</div><div className="v"><strong>{p.ticketsNoBug}</strong></div>
          <div className="k">SLA</div><div className="v"><HealthBar value={p.sla}/> <span className="faint" style={{fontSize:11}}>{Math.round(p.sla*100)}%</span></div>
        </div>

        <h3>Тренд / 28 дней</h3>
        <div style={{ padding: "4px 16px 14px" }}>
          <Sparkline data={p.trend} w={328} h={56}/>
          <div className="row" style={{ marginTop: 6, fontSize: 11.5 }}>
            <span className="faint">Тикеты</span>
            <span className="grow"/>
            <Delta value={p.ticketsDelta}/>
          </div>
          <Sparkline data={p.untriagedTrend} w={328} h={42} accent="var(--high)"/>
          <div className="row" style={{ marginTop: 6, fontSize: 11.5 }}>
            <span className="faint">Untriaged</span>
            <span className="grow"/>
            <Delta value={p.untriagedDelta}/>
          </div>
        </div>
      </aside>
    </div>
  );
};

/* ─── Tabs ─── */

const ProblemOverview = ({ problem: p, bugs, tickets, go }) => {
  const noBug = tickets.filter(t => !t.bugId).length;
  const fix = bugs.find(b => b.workaround);
  return (
    <>
      {p.untriaged > 50 && (
        <div className="ai">
          <span className="icn">AI</span>
          <div className="body">
            <div><b>Срочное:</b> {p.untriaged} неразобранных кейсов · рост <Delta value={p.untriagedDelta}/></div>
            <div className="sub">86 кейсов кластеризуются как «{p.tags[0]} / {p.tags[1] || ""}» — возможно, новый сценарий бага</div>
          </div>
          <div className="actions">
            <Btn ghost>Кластер</Btn>
            <Btn primary>Создать новый баг</Btn>
          </div>
        </div>
      )}

      <h3 style={{ font: "600 13px var(--sans)", margin: "0 0 8px" }}>Описание</h3>
      <p style={{ margin: 0, color: "var(--fg-mute)", fontSize: 13.5, lineHeight: 1.6 }}>
        {p.desc}
      </p>

      <div className="divider"/>

      <div className="grid-3">
        <KpiMini label="Тикеты / 7д" value={p.tickets} delta={p.ticketsDelta}/>
        <KpiMini label="Untriaged"  value={p.untriaged} delta={p.untriagedDelta} critical={p.untriaged > 50}/>
        <KpiMini label="Без бага"   value={p.ticketsNoBug} delta={p.ticketsDelta} sub={`${Math.round(noBug/Math.max(1,tickets.length)*100)}% выборки`}/>
      </div>

      <div style={{ height: 16 }}/>

      {fix && (
        <div className="card">
          <div className="card-hd">
            <div className="ttl"><Icons.shield/>Текущий workaround</div>
            <span className="bdg bdg-ok"><span className="dot"/>Доступен саппорту</span>
          </div>
          <div className="card-bd">
            <div style={{ fontSize: 13.5, color: "var(--fg)" }}>{fix.workaround}</div>
            <div className="row faint" style={{ fontSize: 11.5, marginTop: 8 }}>
              <Icons.bug/><span>Из бага {fix.id}</span>
              <span>·</span>
              <span>Команда {fix.team}</span>
              <span>·</span>
              <span>Обновлён {fix.created}</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 16 }}/>

      <div className="grid-2">
        <div className="card">
          <div className="card-hd">
            <div className="ttl"><Icons.bug/>Связанные баги<span className="lbl">{bugs.length}</span></div>
            <button className="btn btn-ghost" onClick={() => go({ ...{view:"problems", detailId: p.id}, tab: "bugs" })}>Все<Icons.chev/></button>
          </div>
          {bugs.slice(0,3).map(b => <BugRow key={b.id} bug={b}/>)}
          {bugs.length === 0 && <div className="empty"><h4>Пока нет багов</h4><div>Привяжите существующий или заведите новый</div><div style={{marginTop:12}}><Btn primary icon={<Icons.plus/>}>Завести баг</Btn></div></div>}
        </div>

        <div className="card">
          <div className="card-hd">
            <div className="ttl"><Icons.ticket/>Последние обращения<span className="lbl">{tickets.length}</span></div>
            <button className="btn btn-ghost" onClick={() => go({ view:"problems", detailId: p.id, tab: "tickets" })}>Все<Icons.chev/></button>
          </div>
          {tickets.slice(0,3).map(t => <TicketRow key={t.id} ticket={t}/>)}
        </div>
      </div>

      <div style={{ height: 16 }}/>

      <div className="card">
        <div className="card-hd">
          <div className="ttl"><Icons.flow/>Граф связей</div>
          <span className="faint" style={{fontSize:11}}>Проблема · {bugs.length} бага · {tickets.length} обращений</span>
        </div>
        <div className="card-bd">
          <RelationGraph problem={p} bugs={bugs} tickets={tickets}/>
        </div>
      </div>
    </>
  );
};

const KpiMini = ({ label, value, delta, sub, critical }) => (
  <div style={{ padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--panel)" }}>
    <div className="lbl" style={{ font: "500 10px var(--mono)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
    <div className="row" style={{ alignItems: "baseline", gap: 8, marginTop: 4 }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: critical?"var(--critical)":"var(--fg)" }}>{value.toLocaleString("ru-RU")}</div>
      <Delta value={delta}/>
    </div>
    {sub && <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{sub}</div>}
  </div>
);

const ProblemBugs = ({ problem: p, bugs, focus, go }) => (
  <>
    <div className="row" style={{ marginBottom: 12 }}>
      <h3 style={{ margin: 0, font: "600 13px var(--sans)" }}>Баги в этой проблеме</h3>
      <span className="faint" style={{ fontSize: 12 }}>· {bugs.filter(b => b.workaround).length} с workaround · {bugs.filter(b => !b.fixDate).length} в работе</span>
      <div className="grow"/>
      <Btn primary icon={<Icons.plus/>}>Завести баг</Btn>
    </div>
    {bugs.length === 0 && <div className="empty"><h4>Пока нет багов</h4><div>Похоже, проблема ещё на стадии исследования. Привяжите баг или создайте новый.</div></div>}
    <div className="col" style={{ gap: 12 }}>
      {bugs.map(b => <BugCard key={b.id} bug={b} highlight={focus===b.id}/>)}
    </div>
  </>
);

const BugRow = ({ bug }) => (
  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line-soft)" }}>
    <div className="row" style={{ alignItems: "flex-start" }}>
      <span className={`indicator ${SEV_LABELS[bug.severity].tone}`} style={{ marginTop: 4 }}/>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{bug.id}</span>
          <span style={{ fontWeight: 500, fontSize: 13 }}>{bug.title}</span>
        </div>
        <div className="row" style={{ marginTop: 4, gap: 6 }}>
          <SeverityBadge s={bug.severity}/>
          <Badge tone={bug.status==="fixed"?"ok":bug.status==="blocked"?"critical":"high"} dot>{bug.status}</Badge>
          <span className="chip"><Icons.team/> {bug.team}</span>
          <span className="chip">{bug.jira}</span>
          {bug.workaround && <span className="bdg bdg-ok"><Icons.shield/>workaround</span>}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ font: "500 12px var(--mono)" }}>{bug.tickets}</div>
        <div className="faint" style={{ fontSize: 11 }}>тикетов</div>
      </div>
    </div>
  </div>
);

const BugCard = ({ bug, highlight }) => (
  <div className="card" style={{ outline: highlight ? "1px solid var(--accent)" : "none" }}>
    <div className="card-hd">
      <div className="ttl">
        <span className={`indicator ${SEV_LABELS[bug.severity].tone}`}/>
        <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{bug.id}</span>
        <span>{bug.title}</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <SeverityBadge s={bug.severity}/>
        <Badge tone={bug.status==="fixed"?"ok":bug.status==="blocked"?"critical":"high"} dot>{bug.status}</Badge>
        <Avatar user={bug.owner} size="sm"/>
      </div>
    </div>
    <div className="card-bd col" style={{ gap: 8 }}>
      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        <span className="chip"><Icons.team/> {bug.team}</span>
        <span className="chip"><Icons.link/> {bug.jira}</span>
        {bug.fixDate && <span className="chip"><Icons.check/> fix {bug.fixDate}</span>}
        {bug.environments.map(e => <span key={e} className="chip">{e}</span>)}
        <span className="chip"><Icons.ticket/> {bug.tickets} обращений</span>
      </div>
      <div>
        <div style={{ font: "500 10px var(--mono)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>
          Workaround
        </div>
        {bug.workaround
          ? <div className="row" style={{ alignItems: "flex-start", gap: 8, padding: 10, background: "var(--ok-bg)", borderRadius: 6 }}>
              <span style={{ color: "var(--ok)", marginTop: 2 }}><Icons.shield/></span>
              <span style={{ fontSize: 13 }}>{bug.workaround}</span>
            </div>
          : <div className="row" style={{ alignItems: "flex-start", gap: 8, padding: 10, background: "var(--critical-bg)", borderRadius: 6 }}>
              <span style={{ color: "var(--critical)", marginTop: 2 }}><Icons.alert/></span>
              <span style={{ fontSize: 13 }}>Workaround не задан — саппорт не знает, что отвечать клиенту</span>
            </div>}
      </div>
      <div>
        <div style={{ font: "500 10px var(--mono)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Root cause</div>
        <div style={{ fontSize: 13, color: "var(--fg-mute)" }}>{bug.rootCause}</div>
      </div>
      <div>
        <div style={{ font: "500 10px var(--mono)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Рекомендация саппорту</div>
        <div style={{ fontSize: 13 }}>{bug.recommendation}</div>
      </div>
    </div>
  </div>
);

const ProblemTickets = ({ problem: p, tickets, bugs }) => {
  const [filter, setFilter] = React.useState("all");
  const counts = {
    all: tickets.length,
    "no-bug": tickets.filter(t => !t.bugId).length,
    new: tickets.filter(t => t.flags.isNew).length,
    research: tickets.filter(t => t.flags.needsResearch).length,
    duplicate: tickets.filter(t => t.flags.duplicate).length,
  };
  const filtered = tickets.filter(t => {
    if (filter === "all") return true;
    if (filter === "no-bug") return !t.bugId;
    if (filter === "new") return t.flags.isNew;
    if (filter === "research") return t.flags.needsResearch;
    if (filter === "duplicate") return t.flags.duplicate;
    return true;
  });
  return (
    <>
      <div className="row" style={{ marginBottom: 10, flexWrap: "wrap" }}>
        {[
          ["all","Все"],["no-bug","Без бага"],["new","Новые"],["research","Ресерч"],["duplicate","Дубли"]
        ].map(([k,l]) => (
          <button key={k} className={`flt-chip ${filter===k?"applied":""}`} onClick={() => setFilter(k)}>
            <span>{l}</span><span className="faint">{counts[k]}</span>
          </button>
        ))}
        <div className="flt-spacer"/>
        <Btn ghost icon={<Icons.ai/>}>Авто-кластер</Btn>
        <Btn ghost icon={<Icons.link/>}>Bulk-link</Btn>
      </div>
      <table className="tbl">
        <thead>
          <tr><th>ID</th><th>Кратко</th><th>User</th><th>Продукт</th><th>Платформа</th><th>Регион</th><th>Статус</th><th>Bug</th><th>Создано</th></tr>
        </thead>
        <tbody>
          {filtered.slice(0, 30).map(t => (
            <tr key={t.id}>
              <td className="id">{t.id}</td>
              <td className="ttl"><span className="clip" style={{display:"inline-block", maxWidth: 360, overflow:"hidden",textOverflow:"ellipsis"}}>{t.summary}</span></td>
              <td className="muted" style={{ font: "500 11.5px var(--mono)" }}>{t.userId}</td>
              <td>{t.product}</td>
              <td><span className="row" style={{ gap: 4 }}><PlatformIcon p={t.platform}/><span style={{font:"500 11px var(--mono)"}}>{t.platform}</span></span></td>
              <td className="muted">{t.region}</td>
              <td><Badge tone={TICKET_STATUS[t.status].tone} dot>{TICKET_STATUS[t.status].label}</Badge></td>
              <td>{t.bugId ? <span className="chip">{t.bugId}</span> : <span className="bdg bdg-mute">—</span>}</td>
              <td className="muted" style={{ fontSize: 11.5 }}>{t.created.slice(5,10)} {t.created.slice(11,16)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length > 30 && <div className="empty muted">показано 30 из {filtered.length}</div>}
    </>
  );
};

const ACTIVITY = (p, bugs) => [
  { t: "2 ч назад", who: "Илья Громов", kind: "evt-status", text: <>Статус изменён на <StatusBadge status={p.status}/></> },
  { t: "3 ч назад", who: "Sentry · webhook", kind: "evt-bug", text: <>Найден spike обращений (+34% за 4ч)</> },
  { t: "5 ч назад", who: "Анна Котова", kind: "evt-link", text: <>Привязано <strong>32</strong> обращения к багу <span className="chip">{bugs[0]?.id || "—"}</span></> },
  { t: "вчера, 18:02", who: "Дмитрий Орлов", kind: "evt-comment", text: "Проверил логи, корреляция со временем релиза подтверждается. Эскалирую партнёру.", quote: "В 18:00 МСК пошёл рост 5xx на ACS-эндпоинте, что совпадает с релизом 5.18.4." },
  { t: "вчера, 14:11", who: "AI · clustering", kind: "evt-bug", text: <>Кластеризовано <strong>86</strong> похожих обращений как новая подгруппа «3DS timeout»</> },
  { t: "вчера, 09:32", who: "Анна Котова", kind: "evt-status", text: <>Приоритет повышен до <PriorityBadge p={p.priority}/></> },
  { t: "2 дня назад", who: "Илья Громов", kind: "evt-link", text: <>Заведён баг <span className="chip">{bugs[0]?.id || "BUG-..."}</span> в Jira</> },
  { t: "3 дня назад", who: "Анна Котова", kind: "evt-status", text: "Создана проблема", quote: p.desc },
];
const ProblemActivity = ({ problem: p, bugs }) => (
  <div className="tl">
    {ACTIVITY(p, bugs).map((e, i) => (
      <div key={i} className={`tl-item ${e.kind}`}>
        <div className="pin"><span className="dot"/></div>
        <div className="body">
          <div className="meta"><strong style={{ color: "var(--fg)" }}>{e.who}</strong> · {e.t}</div>
          <div className="text">{e.text}</div>
          {e.quote && <div className="quote">{e.quote}</div>}
        </div>
      </div>
    ))}
  </div>
);

const ProblemLinked = ({ problem: p, bugs, tickets }) => (
  <>
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-hd">
        <div className="ttl"><Icons.flow/>Граф связей</div>
      </div>
      <div className="card-bd">
        <RelationGraph problem={p} bugs={bugs} tickets={tickets} large/>
      </div>
    </div>

    <h3 style={{ font: "600 13px var(--sans)", margin: "0 0 8px" }}>Баги ({bugs.length})</h3>
    <div className="col" style={{ gap: 6, marginBottom: 16 }}>
      {bugs.map(b => <BugRow key={b.id} bug={b}/>)}
    </div>

    <h3 style={{ font: "600 13px var(--sans)", margin: "0 0 8px" }}>Похожие проблемы</h3>
    <div className="col" style={{ gap: 6 }}>
      {PROBLEMS.filter(o => o.id !== p.id && o.products.some(pp => p.products.includes(pp))).slice(0, 3).map(o => (
        <div key={o.id} className="row" style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8 }}>
          <span className={`indicator ${SEV_LABELS[o.severity].tone}`}/>
          <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{o.id}</span>
          <span className="grow">{o.title}</span>
          <StatusBadge status={o.status}/>
          <span className="muted" style={{ fontSize: 12 }}>{o.tickets.toLocaleString("ru-RU")} тикетов</span>
        </div>
      ))}
    </div>
  </>
);

const TicketRow = ({ ticket: t }) => (
  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line-soft)" }}>
    <div className="row" style={{ alignItems: "flex-start" }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="id" style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{t.id}</span>
          <Badge tone={TICKET_STATUS[t.status].tone} dot>{TICKET_STATUS[t.status].label}</Badge>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--fg)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.summary}
        </div>
        <div className="row faint" style={{ fontSize: 11.5, marginTop: 4, gap: 8 }}>
          <span>{t.product}</span><span>·</span>
          <span><PlatformIcon p={t.platform}/></span>
          <span>·</span><span>{t.region}</span>
          <span>·</span><span>{t.userId}</span>
        </div>
      </div>
    </div>
  </div>
);

/* ─── Relation graph ─── */
const RelationGraph = ({ problem, bugs, tickets, large }) => {
  const W = 720, H = large ? 320 : 240;
  const cx = W/2, cy = H/2;
  const bugCount = bugs.length;
  const ticketSamples = Math.min(tickets.length, 14);
  const bugPos = bugs.map((_, i) => {
    const a = Math.PI/2 + (i - (bugCount-1)/2) * 0.55;
    return [cx + Math.cos(a) * 140, cy + Math.sin(a) * 70];
  });
  const ticketPositions = [];
  for (let i = 0; i < ticketSamples; i++) {
    const a = (i / ticketSamples) * Math.PI * 2;
    ticketPositions.push([cx + Math.cos(a) * 260, cy + Math.sin(a) * (H/2 - 30)]);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      <defs>
        <radialGradient id="prob-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r="60" fill="url(#prob-glow)"/>
      {/* edges problem → bugs */}
      {bugPos.map((b, i) => (
        <line key={`pb${i}`} x1={cx} y1={cy} x2={b[0]} y2={b[1]} stroke="var(--line)" strokeWidth="1.2"/>
      ))}
      {/* edges bug ↔ ticket (only some) */}
      {ticketPositions.map((tp, i) => {
        const t = tickets[i];
        const target = t && t.bugId ? bugPos[bugs.findIndex(b => b.id === t.bugId)] : [cx, cy];
        if (!target) return null;
        return <line key={`bt${i}`} x1={target[0]} y1={target[1]} x2={tp[0]} y2={tp[1]} stroke="var(--line-soft)" strokeWidth="1" strokeDasharray={t && !t.bugId ? "2 3" : ""}/>;
      })}
      {/* problem center */}
      <circle cx={cx} cy={cy} r="22" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2"/>
      <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontFamily="Geist Mono, monospace" fontWeight="600" fill="var(--accent-ink)">{problem.id}</text>
      {/* bugs */}
      {bugs.map((b, i) => {
        const [x, y] = bugPos[i];
        const tone = SEV_LABELS[b.severity].tone;
        const color = `var(--${tone})`;
        return (
          <g key={b.id}>
            <circle cx={x} cy={y} r="14" fill={color} stroke="var(--bg)" strokeWidth="2"/>
            <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontFamily="Geist Mono, monospace" fontWeight="600" fill="var(--accent-ink)">{b.id.replace("BUG-","")}</text>
          </g>
        );
      })}
      {/* tickets */}
      {ticketPositions.map((tp, i) => {
        const t = tickets[i];
        return <circle key={i} cx={tp[0]} cy={tp[1]} r="4" fill={t && t.bugId ? "var(--info)" : "var(--high)"} stroke="var(--bg)" strokeWidth="1.5"/>;
      })}
      {/* legend */}
      <g transform={`translate(16, ${H-44})`} fontSize="10" fontFamily="Geist, sans-serif" fill="var(--fg-mute)">
        <circle cx="6" cy="6" r="6" fill="var(--accent)"/><text x="18" y="9">Проблема</text>
        <circle cx="86" cy="6" r="6" fill="var(--critical)"/><text x="98" y="9">Баг</text>
        <circle cx="138" cy="6" r="4" fill="var(--info)"/><text x="148" y="9">Тикет</text>
        <circle cx="200" cy="6" r="4" fill="var(--high)"/><text x="210" y="9">Тикет без бага</text>
      </g>
    </svg>
  );
};

Object.assign(window, {
  ProblemDetail, BugRow, BugCard, TicketRow, RelationGraph,
});
