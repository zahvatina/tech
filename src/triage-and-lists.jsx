/* VECTOR — Triage queue, Bugs list, Tickets list, light routes

   Компоненты:
     Triage      — очередь problem_determination: карточка тикета + детализация справа.
                   Кнопки: Взять в работу → Take; Пропустить → Skip; Решено → Resolve.
                   После resolve тикет уходит из очереди и детализация закрывается.

     BugsList    — таблица задач/багов со статусами. Фильтры отправляются на сервер (status[],
                   has_workaround, missing_notes). Значок «blocked» = rejected_draft.

     TicketsList — таблица тикетов. Сортировка и фильтры server-side через API.tickets.list().

   Экспортируется через Object.assign(window, {...}) — компоненты доступны глобально. */

/* ─── Triage Queue (list-detail split) ─── */

// Fallback mock clusters shown when API clusters unavailable
const MOCK_CLUSTERS = [
  { id: "C-001", title: "Invalid VIN при оформлении ОСАГО", count: 198, growth: 0.74, severity: "high", suggestedBug: false },
  { id: "C-002", title: "Платёж зависает после ввода 3DS",  count: 86,  growth: 0.34, severity: "critical", suggestedBug: "BUG-9170" },
  { id: "C-003", title: "Нет клиник в малых городах ДМС",   count: 24,  growth: 0.18, severity: "medium", suggestedBug: false },
  { id: "C-004", title: "Не открывается PDF полиса",         count: 41,  growth: 0.28, severity: "high",   suggestedBug: "BUG-8990" },
];

const TRIAGE_QUEUE_CODE = "problem_determination";

const Triage = ({ go }) => {
  const [queueItems, setQueueItems] = React.useState([]);
  const [clusters, setClusters]     = React.useState(MOCK_CLUSTERS);
  const [sel, setSel]               = React.useState(null);
  const [loading, setLoading]       = React.useState(false);
  const [actionPending, setActionPending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    API.queues.items(TRIAGE_QUEUE_CODE, { status: "pending", limit: 50 })
      .then(items => { if (!cancelled) { setQueueItems(items); if (items[0]) setSel(items[0].id); } })
      .catch(() => {
        if (!cancelled) {
          // Fallback: use mock tickets that need research
          const fallback = TICKETS.filter(t => t.flags.isNew || t.flags.needsResearch || (!t.bugId && t.status !== "duplicate")).slice(0, 30);
          setQueueItems(fallback.map(t => ({ id: t.id, _mockTicket: t, ticket: { id: t.id, summary: t.summary, product: t.product, platform: t.platform, status_ui: t.status } })));
          if (fallback[0]) setSel(fallback[0].id);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    // Fetch clusters from triage-queue endpoint
    fetch(`${window.VECTOR_API_BASE || "http://localhost:8000"}/api/v1/tickets/triage-queue`)
      .then(r => r.ok ? r.json() : null)
      .then(res => { if (!cancelled && res?.data?.clusters?.length) setClusters(res.data.clusters); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  const queue = queueItems;
  const cur = queue.find(item => item.id === sel) || queue[0];

  return (
    <div className="page" style={{ display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>
      <div className="page-hd">
        <div className="row">
          <div className="grow">
            <h1>Triage queue</h1>
            <div className="desc">{loading ? "загрузка…" : `${queue.length} обращений требуют разбора`} · AI обнаружил {clusters.length} кластера</div>
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
          {queue.slice(0, 30).map(item => {
            const t = item.ticket || item._mockTicket || item;
            const created = item.created || (t.created || "");
            return (
              <div key={item.id} className={`split-item ${cur?.id===item.id?"sel":""}`} onClick={() => setSel(item.id)}>
                <div className="top">
                  <span className="id">{t.id || item.id}</span>
                  <Badge tone="info" dot>triage</Badge>
                  <span className="grow"/>
                  <span className="faint" style={{ fontSize: 11 }}>{(created||"").slice(5,10)}</span>
                </div>
                <div className="ttl">{(t.summary||"").slice(0, 70)}</div>
                <div className="meta">
                  <span>{t.product}</span>
                  <span><PlatformIcon p={t.platform}/> {t.platform}</span>
                  <span>{t.region}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="det-main" style={{ borderRight: "1px solid var(--line)" }}>
          {cur && <TicketDetail queueItem={cur} queueCode={TRIAGE_QUEUE_CODE} go={go}/>}
        </div>
      </div>
    </div>
  );
};

const TicketDetail = ({ queueItem, queueCode, go }) => {
  const [ticket, setTicket] = React.useState(queueItem._mockTicket || queueItem.ticket || queueItem);
  const [aiSuggestions, setAiSuggestions] = React.useState([]);
  const [acting, setActing] = React.useState(false);

  React.useEffect(() => {
    const ticketId = (queueItem.ticket?.id) || (queueItem._mockTicket?.id) || queueItem.id;
    if (!ticketId) return;
    let cancelled = false;
    API.tickets.get(ticketId)
      .then(data => { if (!cancelled) { setTicket(data); setAiSuggestions(data.ai_suggestions || []); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [queueItem.id]);

  const t = ticket;
  const problem = PROBLEMS.find(p => p.id === t.problemId);
  const bug = t.bugId ? BUGS.find(b => b.id === t.bugId) : null;
  // Merge API ai_suggestions with fallback mock suggestions from PROBLEMS
  const suggestions = aiSuggestions.length > 0
    ? aiSuggestions.map(s => ({ p: PROBLEMS.find(p => p.id === s.suggested_entity_id) || { id: s.suggested_entity_id, title: "Проблема", tickets: 0, severity: "medium" }, score: s.confidence }))
    : PROBLEMS.filter(p => p.products?.includes(t.product) && p.platforms?.includes(t.platform)).slice(0, 3).map(p => ({ p, score: 0.6 + Math.random() * 0.35 }));

  const handleTake = async () => {
    setActing(true);
    try { await API.queues.take(queueCode, queueItem.id, "me"); } catch(e) {} finally { setActing(false); }
  };
  const handleSkip = async () => {
    setActing(true);
    try { await API.queues.skip(queueCode, queueItem.id); } catch(e) {} finally { setActing(false); }
  };
  const handleResolve = async () => {
    setActing(true);
    try {
      await API.queues.resolve(queueCode, queueItem.id, "Resolved via triage");
      go({ view: "triage" });
    } catch(e) {} finally { setActing(false); }
  };

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
          <Btn ghost icon={<Icons.user/>} onClick={handleTake} disabled={acting}>На себя</Btn>
          <Btn ghost icon={<Icons.close/>} onClick={handleSkip} disabled={acting}>Вернуть в очередь</Btn>
          <Btn tone="ok" icon={<Icons.check/>} onClick={handleResolve} disabled={acting}>Решено</Btn>
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
  const [bugs, setBugs] = React.useState(BUGS);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = filter === "no-workaround" ? { has_workaround: false, limit: 100 }
                 : filter === "blocked"       ? { status: ["blocked", "rejected_draft"], limit: 100 }
                 : filter === "fixed"         ? { status: ["fixed", "closed"], limit: 100 }
                 : { limit: 100 };
    API.tasks.listAll(params)
      .then(data => { if (!cancelled && data.length) setBugs(data); })
      .catch(() => { if (!cancelled) setBugs(BUGS); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter]);

  const filtered = bugs.filter(b => {
    if (filter === "no-workaround") return !b.workaround;
    if (filter === "blocked") return b.status === "blocked" || b.status === "rejected_draft";
    if (filter === "fixed") return b.status === "fixed" || b.status === "closed";
    return true;
  });
  return (
    <div className="page">
      <div className="page-hd">
        <div className="row">
          <div className="grow">
            <h1>Баги</h1>
            <div className="desc">{loading ? "загрузка…" : `${bugs.length} всего · ${bugs.filter(b => !b.workaround).length} без workaround · ${bugs.filter(b => b.status === "fixed" || b.status === "closed").length} исправлено`}</div>
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
  const [tickets, setTickets] = React.useState(TICKETS);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const params = filter === "no-bug" ? { no_task: true }
                 : filter === "research" ? { requires_research: true }
                 : filter === "new" ? { status: "new" }
                 : {};
    setLoading(true);
    API.tickets.list({ ...params, limit: 100 })
      .then(res => { if (!cancelled) setTickets(res.data); })
      .catch(() => { if (!cancelled) setTickets(TICKETS); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter]);

  const filtered = tickets.filter(t => {
    // local fallback filtering when using mock data
    if (filter === "no-bug") return !t.bugId;
    if (filter === "new") return t.flags?.isNew || t.status === "new";
    if (filter === "research") return t.flags?.needsResearch || t.requires_research;
    return true;
  }).slice(0, 80);
  return (
    <div className="page">
      <div className="page-hd">
        <div className="row">
          <div className="grow">
            <h1>Обращения</h1>
            <div className="desc">{loading ? "загрузка…" : `${tickets.length} всего · ${tickets.filter(t => !t.bugId).length} без бага`}</div>
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
              const problemId = t.problemId || t.problem_uuid;
              const p = PROBLEMS.find(x => x.id === problemId);
              const status = t.ui_status || t.status || "new";
              const statusInfo = TICKET_STATUS?.[status] || { tone: "mute", label: status };
              const created = t.created || t.created_at || "";
              return (
                <tr key={t.id} className="row-link" onClick={() => go({ view: "problems", detailId: problemId, tab: "tickets" })}>
                  <td className="id">{t.id}</td>
                  <td className="ttl"><span style={{display:"inline-block", maxWidth: 360, overflow:"hidden", textOverflow:"ellipsis"}}>{t.summary}</span></td>
                  <td className="muted" style={{ font: "500 11.5px var(--mono)" }}>{t.userId || t.user_id}</td>
                  <td>{t.product}</td>
                  <td><PlatformIcon p={t.platform}/> <span style={{font:"500 11px var(--mono)"}}>{t.platform}</span></td>
                  <td className="muted">{t.region}</td>
                  <td><Badge tone={statusInfo.tone} dot>{statusInfo.label}</Badge></td>
                  <td className="muted"><span style={{ font: "500 11px var(--mono)", marginRight: 6 }}>{p?.id || t.problemId}</span></td>
                  <td>{(t.bugId || t.task_short_id) ? <span className="chip">{t.bugId || t.task_short_id}</span> : <span className="bdg bdg-mute">—</span>}</td>
                  <td className="muted" style={{ fontSize: 11.5 }}>{created.slice(5,10)} {created.slice(11,16)}</td>
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
