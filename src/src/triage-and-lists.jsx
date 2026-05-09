/* VECTOR — Triage queue, Bugs list, Tickets list, light routes */

/* ─── Triage Queue (list-detail split) ─── */
const Triage = ({ go }) => {
  const queue = TICKETS.filter(t => t.flags.isNew || t.flags.needsResearch || (!t.bugId && t.status !== "duplicate"));
  const [sel, setSel] = React.useState(queue[0]?.id);
  const cur = queue.find(t => t.id === sel) || queue[0];

  // AI clusters
  const clusters = [
    { id: "C-001", title: "Invalid VIN при оформлении ОСАГО", count: 198, growth: 0.74, products: ["ОСАГО"], suggestedBug: false, severity: "high" },
    { id: "C-002", title: "Платёж зависает после ввода 3DS", count: 86, growth: 0.34, products: ["ОСАГО"], suggestedBug: "BUG-9170", severity: "critical" },
    { id: "C-003", title: "Нет клиник в малых городах ДМС", count: 24, growth: 0.18, products: ["ДМС"], suggestedBug: false, severity: "medium" },
    { id: "C-004", title: "Не открывается PDF полиса", count: 41, growth: 0.28, products: ["КАСКО"], suggestedBug: "BUG-8990", severity: "high" },
  ];

  return (
    <div className="page" style={{ display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>
      <div className="page-hd">
        <div className="row">
          <div className="grow">
            <h1>Triage queue</h1>
            <div className="desc">{queue.length} обращений требуют разбора · AI обнаружил {clusters.length} кластера</div>
          </div>
          <div className="row">
            <Btn ghost icon={<Icons.ai/>}>Авто-кластеризация</Btn>
            <Btn icon={<Icons.flow/>}>Bulk-link к проблеме</Btn>
            <Btn primary icon={<Icons.plus/>}>Создать проблему</Btn>
          </div>
        </div>

        <div className="ai" style={{ marginTop: 14 }}>
          <span className="icn">AI</span>
          <div className="body">
            <div><b>Главный кластер:</b> «Invalid VIN при ОСАГО» — 198 неразобранных, +74% WoW, ни одного бага.</div>
            <div className="sub">Я могу автоматически создать черновик проблемы и переместить туда все 198 тикетов · 12 регионов · 3 платформы</div>
          </div>
          <div className="actions">
            <Btn ghost>Показать кластер</Btn>
            <Btn primary>Создать черновик</Btn>
          </div>
        </div>
      </div>

      <div className="split">
        <div className="split-list">
          <div style={{ padding: 12, borderBottom: "1px solid var(--line)" }}>
            <div className="lbl" style={{ font: "500 10px var(--mono)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>AI-кластеры</div>
            <div className="col" style={{ gap: 6 }}>
              {clusters.map(c => (
                <div key={c.id} className="row" style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-elev)", gap: 8 }}>
                  <span className={`indicator ${SEV_LABELS[c.severity].tone}`}/>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                    <div className="row faint" style={{ fontSize: 11, gap: 6 }}>
                      <span>{c.count} тикетов</span>
                      <Delta value={c.growth}/>
                      {c.suggestedBug && <span className="chip" style={{ font: "500 10px var(--mono)" }}>{c.suggestedBug}</span>}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon"><Icons.arrowRt/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="lbl" style={{ font: "500 10px var(--mono)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: ".08em", padding: "12px 14px 4px" }}>
            Очередь · {queue.length}
          </div>
          {queue.slice(0, 30).map(t => (
            <div key={t.id} className={`split-item ${cur?.id===t.id?"sel":""}`} onClick={() => setSel(t.id)}>
              <div className="top">
                <span className="id">{t.id}</span>
                <Badge tone={t.flags.isNew?"info":"high"} dot>{t.flags.isNew?"новый":"ресерч"}</Badge>
                <span className="grow"/>
                <span className="faint" style={{ fontSize: 11 }}>{t.created.slice(5,10)}</span>
              </div>
              <div className="ttl">{t.summary.slice(0, 70)}</div>
              <div className="meta">
                <span>{t.product}</span>
                <span><PlatformIcon p={t.platform}/> {t.platform}</span>
                <span>{t.region}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="det-main" style={{ borderRight: "1px solid var(--line)" }}>
          {cur && <TicketDetail ticket={cur} go={go}/>}
        </div>
      </div>
    </div>
  );
};

const TicketDetail = ({ ticket: t, go }) => {
  const problem = PROBLEMS.find(p => p.id === t.problemId);
  const bug = t.bugId ? BUGS.find(b => b.id === t.bugId) : null;
  // AI suggestions for matching problems
  const suggestions = PROBLEMS.filter(p => p.products.includes(t.product) && p.platforms.includes(t.platform))
    .slice(0, 3)
    .map(p => ({ p, score: 0.6 + Math.random() * 0.35 }));

  return (
    <div>
      <div className="det-hd">
        <div className="id">{t.id} · {t.created.replace("T", " · ")}</div>
        <h1 style={{ fontSize: 16 }}>{t.summary}</h1>
        <div className="meta">
          <Badge tone={TICKET_STATUS[t.status].tone} dot>{TICKET_STATUS[t.status].label}</Badge>
          <span className="chip">{t.product}</span>
          <span className="chip"><PlatformIcon p={t.platform}/> {t.platform}</span>
          <span className="chip">{t.region}</span>
          <span className="chip">{t.channel}</span>
          <div style={{ flex: 1 }}/>
          <Btn ghost icon={<Icons.user/>}>На себя</Btn>
          <Btn ghost icon={<Icons.close/>}>Закрыть как дубль</Btn>
          <Btn primary icon={<Icons.link/>}>Привязать</Btn>
        </div>
      </div>

      <div style={{ padding: "16px 24px 60px" }}>
        <div className="ai">
          <span className="icn">AI</span>
          <div className="body">
            <div><b>Похоже на:</b> {suggestions[0]?.p.title} <span className="faint">· {Math.round(suggestions[0]?.score*100)}% совпадения</span></div>
            <div className="sub">86 похожих обращений за 7 дней. Workaround доступен.</div>
          </div>
          <div className="actions">
            <Btn ghost>Все похожие</Btn>
            <Btn primary>Привязать</Btn>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-hd"><div className="ttl">Текст обращения</div></div>
            <div className="card-bd">
              <div style={{ padding: 12, background: "var(--bg-elev)", borderRadius: 6, fontSize: 13.5, color: "var(--fg)", lineHeight: 1.6 }}>
                «{t.text}»
              </div>
              {t.attachments.length > 0 && (
                <div className="row faint" style={{ fontSize: 12, marginTop: 8, gap: 6 }}>
                  <Icons.paperclip/>
                  {t.attachments.map(a => <span key={a} className="chip">{a}</span>)}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-hd"><div className="ttl">Контекст для дебага</div></div>
            <div className="kv">
              <div className="k">User ID</div><div className="v" style={{ font: "500 11.5px var(--mono)" }}>{t.userId}</div>
              <div className="k">Продукт</div><div className="v">{t.product}</div>
              <div className="k">Платформа</div><div className="v"><PlatformIcon p={t.platform}/> <span style={{ font: "500 11.5px var(--mono)" }}>{t.platform}</span></div>
              <div className="k">Регион</div><div className="v">{t.region}</div>
              <div className="k">Канал</div><div className="v">{t.channel}</div>
              <div className="k">Создано</div><div className="v faint">{t.created.replace("T", " ")}</div>
              <div className="k">App ver.</div><div className="v" style={{ font: "500 11.5px var(--mono)" }}>5.18.4 (2841)</div>
              <div className="k">Device</div><div className="v" style={{ fontSize: 12 }}>iPhone 14 Pro · iOS 18.4</div>
              <div className="k">Logs</div><div className="v"><Btn ghost icon={<Icons.doc/>}>Открыть</Btn></div>
            </div>
          </div>
        </div>

        <div style={{ height: 16 }}/>

        <div className="card">
          <div className="card-hd">
            <div className="ttl"><Icons.ai/>Совпадения по проблемам</div>
          </div>
          <table className="tbl">
            <thead><tr><th></th><th>Проблема</th><th>Совпадение</th><th>Тикетов</th><th>Workaround</th><th></th></tr></thead>
            <tbody>
              {suggestions.map(({p, score}) => (
                <tr key={p.id}>
                  <td><span className={`indicator ${SEV_LABELS[p.severity].tone}`}/></td>
                  <td className="ttl">
                    <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)", marginRight: 6 }}>{p.id}</span>
                    {p.title.slice(0, 50)}
                  </td>
                  <td>
                    <div className="row">
                      <div className="bar" style={{ width: 70 }}><span style={{ width: `${score*100}%`, background: score>0.85?"var(--ok)":"var(--accent)" }}/></div>
                      <span className="faint" style={{ font: "500 11px var(--mono)" }}>{Math.round(score*100)}%</span>
                    </div>
                  </td>
                  <td className="num">{p.tickets}</td>
                  <td>{BUGS.find(b => b.problemId === p.id && b.workaround)
                      ? <Badge tone="ok" dot>есть</Badge>
                      : <Badge tone="mute">нет</Badge>}</td>
                  <td><Btn primary onClick={() => go({ view: "problems", detailId: p.id })}>Привязать</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ─── Bugs list (cross-problem) ─── */
const BugsList = ({ go }) => {
  const [filter, setFilter] = React.useState("all");
  const filtered = BUGS.filter(b => {
    if (filter === "no-workaround") return !b.workaround;
    if (filter === "blocked") return b.status === "blocked";
    if (filter === "fixed") return b.status === "fixed";
    return true;
  });
  return (
    <div className="page">
      <div className="page-hd">
        <div className="row">
          <div className="grow">
            <h1>Баги</h1>
            <div className="desc">{BUGS.length} всего · {BUGS.filter(b => !b.workaround).length} без workaround · {BUGS.filter(b => b.status === "fixed").length} исправлено</div>
          </div>
          <Btn primary icon={<Icons.plus/>}>Новый баг</Btn>
        </div>
      </div>
      <div className="flt">
        {[["all","Все"],["no-workaround","Без workaround"],["blocked","Blocked"],["fixed","Исправлены"]].map(([k,l]) =>
          <button key={k} className={`flt-chip ${filter===k?"applied":""}`} onClick={() => setFilter(k)}>{l}</button>
        )}
      </div>
      <div className="page-body" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr><th>Баг</th><th>Проблема</th><th>Команда</th><th>Sev</th><th>Статус</th><th>Workaround</th><th>Owner</th><th className="num">Тикетов</th><th>Jira</th><th>Fix</th></tr>
          </thead>
          <tbody>
            {filtered.map(b => {
              const p = PROBLEMS.find(x => x.id === b.problemId);
              return (
                <tr key={b.id} className="row-link" onClick={() => go({ view: "problems", detailId: b.problemId, tab: "bugs", focus: b.id })}>
                  <td>
                    <span className={`indicator ${SEV_LABELS[b.severity].tone}`}/>
                    <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)", marginRight: 6 }}>{b.id}</span>
                    <span className="ttl">{b.title}</span>
                  </td>
                  <td className="muted">
                    <span style={{ font: "500 11px var(--mono)", marginRight: 6 }}>{p?.id}</span>
                    {p?.title.slice(0, 36)}
                  </td>
                  <td><span className="chip">{b.team}</span></td>
                  <td><SeverityBadge s={b.severity}/></td>
                  <td><Badge tone={b.status==="fixed"?"ok":b.status==="blocked"?"critical":"high"} dot>{b.status}</Badge></td>
                  <td>{b.workaround ? <Badge tone="ok"><Icons.shield/>есть</Badge> : <Badge tone="critical">нет</Badge>}</td>
                  <td><Avatar user={b.owner} size="sm"/></td>
                  <td className="num"><strong>{b.tickets}</strong></td>
                  <td className="muted" style={{ font: "500 11px var(--mono)" }}>{b.jira}</td>
                  <td className="muted" style={{ fontSize: 11.5 }}>{b.fixDate || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─── Tickets list (cross-problem) ─── */
const TicketsList = ({ go }) => {
  const [filter, setFilter] = React.useState("all");
  const filtered = TICKETS.filter(t => {
    if (filter === "no-bug") return !t.bugId;
    if (filter === "new") return t.flags.isNew;
    if (filter === "research") return t.flags.needsResearch;
    return true;
  }).slice(0, 80);
  return (
    <div className="page">
      <div className="page-hd">
        <div className="row">
          <div className="grow">
            <h1>Обращения</h1>
            <div className="desc">{TICKETS.length} всего · {TICKETS.filter(t => !t.bugId).length} без бага</div>
          </div>
          <Btn ghost icon={<Icons.filter/>}>Сохранить вид</Btn>
          <Btn primary icon={<Icons.plus/>}>Новое обращение</Btn>
        </div>
      </div>
      <div className="flt">
        {[["all","Все"],["no-bug","Без бага"],["new","Новые"],["research","Ресерч"]].map(([k,l]) =>
          <button key={k} className={`flt-chip ${filter===k?"applied":""}`} onClick={() => setFilter(k)}>{l}</button>
        )}
      </div>
      <div className="page-body" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr><th>ID</th><th>Кратко</th><th>User</th><th>Продукт</th><th>Платформа</th><th>Регион</th><th>Статус</th><th>Проблема</th><th>Bug</th><th>Создано</th></tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const p = PROBLEMS.find(x => x.id === t.problemId);
              return (
                <tr key={t.id} className="row-link" onClick={() => go({ view: "problems", detailId: t.problemId, tab: "tickets" })}>
                  <td className="id">{t.id}</td>
                  <td className="ttl"><span style={{display:"inline-block", maxWidth: 360, overflow:"hidden", textOverflow:"ellipsis"}}>{t.summary}</span></td>
                  <td className="muted" style={{ font: "500 11.5px var(--mono)" }}>{t.userId}</td>
                  <td>{t.product}</td>
                  <td><PlatformIcon p={t.platform}/> <span style={{font:"500 11px var(--mono)"}}>{t.platform}</span></td>
                  <td className="muted">{t.region}</td>
                  <td><Badge tone={TICKET_STATUS[t.status].tone} dot>{TICKET_STATUS[t.status].label}</Badge></td>
                  <td className="muted"><span style={{ font: "500 11px var(--mono)", marginRight: 6 }}>{p?.id}</span></td>
                  <td>{t.bugId ? <span className="chip">{t.bugId}</span> : <span className="bdg bdg-mute">—</span>}</td>
                  <td className="muted" style={{ fontSize: 11.5 }}>{t.created.slice(5,10)} {t.created.slice(11,16)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─── Stub for empty routes ─── */
const Stub = ({ title, sub }) => (
  <div className="page">
    <div className="page-hd"><h1>{title}</h1><div className="desc">{sub}</div></div>
    <div className="page-body">
      <div className="empty">
        <h4>Раздел в разработке</h4>
        <div>Здесь появится {title.toLowerCase()} — структура повторяет паттерны Problems.</div>
      </div>
    </div>
  </div>
);

Object.assign(window, { Triage, TicketDetail, BugsList, TicketsList, Stub });
