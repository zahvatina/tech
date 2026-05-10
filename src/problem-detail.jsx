/* VECTOR — Problem detail page */

/* ─── Task status maps ─── */
const TASK_STATUS_TONE = {
  draft:                "mute",
  review:               "warning",
  pending_confirmation: "warning",
  blocked:              "critical",
  rejected_draft:       "critical",
  open:                 "high",
  in_progress:          "info",
  waiting_fix:          "warning",
  monitoring:           "ok",
  fixed:                "ok",
  closed:               "mute",
};
const TASK_STATUS_LABEL = {
  draft:                "Черновик",
  review:               "На проверке",
  pending_confirmation: "На проверке",
  blocked:              "Отклонён",
  rejected_draft:       "Отклонён",
  open:                 "Открыт",
  in_progress:          "В работе",
  waiting_fix:          "Ожидает фикса",
  monitoring:           "Мониторинг",
  fixed:                "Исправлен",
  closed:               "Закрыт",
};

/* ─── ProblemDetail (main) ─── */
const ProblemDetail = ({ problemId, route, go }) => {
  const [p, setP] = React.useState(PROBLEMS.find(x => x.id === problemId) || null);
  const [bugs, setBugs] = React.useState(p ? BUGS.filter(b => b.problemId === problemId) : []);
  const [tickets, setTickets] = React.useState([]);
  const [activity, setActivity] = React.useState([]);
  const [tab, setTab] = React.useState(route.tab || "overview");

  React.useEffect(() => { if (route.tab) setTab(route.tab); }, [route.tab]);

  const refreshBugs = React.useCallback(() => {
    API.tasks.list(problemId)
      .then(tasks => setBugs(tasks))
      .catch(() => setBugs(BUGS.filter(b => b.problemId === problemId)));
  }, [problemId]);

  React.useEffect(() => {
    let cancelled = false;
    API.problems.get(problemId)
      .then(data => { if (!cancelled) setP(data); })
      .catch(() => {
        const mock = PROBLEMS.find(x => x.id === problemId);
        if (!cancelled) setP(mock || null);
      });
    API.tasks.list(problemId)
      .then(tasks => { if (!cancelled) setBugs(tasks); })
      .catch(() => {
        if (!cancelled) setBugs(BUGS.filter(b => b.problemId === problemId));
      });
    API.problems.tickets(problemId)
      .then(res => { if (!cancelled) setTickets(res.data || []); })
      .catch(() => { if (!cancelled) setTickets(TICKETS.filter(t => t.problemId === problemId)); });
    API.problems.activity(problemId)
      .then(res => { if (!cancelled) setActivity(res.data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [problemId]);

  if (!p) return <div className="empty">Загрузка…</div>;

  const noBugTickets = tickets.filter(t => !t.bugId && !t.task_id);
  const pendingBugs = bugs.filter(b => b.status === "review" || b.status === "pending_confirmation");

  const TABS = [
    { id: "overview", label: "Обзор",      ct: null },
    { id: "bugs",     label: "Баги",       ct: bugs.length },
    { id: "tickets",  label: "Обращения",  ct: tickets.length },
    { id: "activity", label: "Активность", ct: activity.length || null },
    { id: "team",     label: "Команда",    ct: pendingBugs.length || null },
    { id: "linked",   label: "Связи",      ct: bugs.length + 2 },
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
          {tab === "bugs"     && <ProblemBugs problem={p} bugs={bugs} go={go} focus={route.focus} onRefresh={refreshBugs}/>}
          {tab === "tickets"  && <ProblemTickets problem={p} tickets={tickets} bugs={bugs}/>}
          {tab === "activity" && <ProblemActivity problem={p} bugs={bugs} activity={activity}/>}
          {tab === "team"     && <ProblemTeam problem={p} bugs={bugs} onRefresh={refreshBugs}/>}
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
          <div className="k">Owner</div><div className="v">{(() => {
            const u = p.owner ? userById(p.owner) : null;
            const name = u ? u.name : (p.owner_name || null);
            return name
              ? <><Avatar user={p.owner} size="sm"/> <span>{name}</span></>
              : <span className="bdg bdg-mute">не назначен</span>;
          })()}</div>
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

/* ─── Overview tab ─── */
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

/* ─── Bugs tab ─── */
const ProblemBugs = ({ problem: p, bugs, focus, go, onRefresh }) => {
  const [showForm, setShowForm] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({ title: "", task_type: "bug", workaround: "", support_notes: "" });

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      await API.tasks.create({
        problem_id: p.id,
        title: form.title,
        task_type: form.task_type,
        workaround: form.workaround || null,
        support_notes: form.support_notes || null,
      });
      setShowForm(false);
      setForm({ title: "", task_type: "bug", workaround: "", support_notes: "" });
      onRefresh?.();
    } catch (e) {
      alert("Ошибка создания задачи: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, font: "600 13px var(--sans)" }}>Баги в этой проблеме</h3>
        <span className="faint" style={{ fontSize: 12 }}>
          · {bugs.filter(b => b.workaround).length} с workaround
          · {bugs.filter(b => !b.fixDate && !b.fix_date).length} в работе
        </span>
        <div className="grow"/>
        <Btn primary icon={<Icons.plus/>} onClick={() => setShowForm(f => !f)}>Завести баг</Btn>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16, border: "1px solid var(--accent)" }}>
          <div className="card-hd">
            <div className="ttl"><Icons.bug/>Новый черновик задачи</div>
            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><Icons.close/></button>
          </div>
          <div className="card-bd col" style={{ gap: 10 }}>
            <div>
              <div className="faint" style={{ fontSize: 11, marginBottom: 4 }}>Название *</div>
              <input
                className="inp"
                placeholder="Кратко опишите баг или задачу…"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <div className="faint" style={{ fontSize: 11, marginBottom: 4 }}>Тип задачи</div>
              <select
                className="inp"
                value={form.task_type}
                onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))}
              >
                <option value="bug">Bug</option>
                <option value="ui_debt">UI Debt</option>
                <option value="cjm_debt">CJM Debt</option>
              </select>
            </div>
            <div>
              <div className="faint" style={{ fontSize: 11, marginBottom: 4 }}>Workaround (как помочь клиенту прямо сейчас)</div>
              <textarea
                className="inp"
                rows={2}
                placeholder="Что посоветовать клиенту до исправления…"
                value={form.workaround}
                onChange={e => setForm(f => ({ ...f, workaround: e.target.value }))}
                style={{ resize: "vertical" }}
              />
            </div>
            <div>
              <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                <span className="faint" style={{ fontSize: 11 }}>Рекомендация саппорту (support_notes)</span>
                <span className="bdg bdg-critical" style={{ fontSize: 10 }}>обязательно</span>
              </div>
              <textarea
                className="inp"
                rows={2}
                placeholder="Что именно говорить клиенту, на что ссылаться…"
                value={form.support_notes}
                onChange={e => setForm(f => ({ ...f, support_notes: e.target.value }))}
                style={{ resize: "vertical" }}
              />
            </div>
            <div className="row" style={{ gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <Btn ghost onClick={() => setShowForm(false)} disabled={creating}>Отмена</Btn>
              <Btn primary icon={<Icons.plus/>} onClick={handleCreate} disabled={creating || !form.title.trim()}>
                {creating ? "Создаём…" : "Создать черновик"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {bugs.length === 0 && !showForm && (
        <div className="empty">
          <h4>Пока нет багов</h4>
          <div>Похоже, проблема ещё на стадии исследования. Привяжите баг или создайте новый.</div>
        </div>
      )}
      <div className="col" style={{ gap: 12 }}>
        {bugs.map(b => <BugCard key={b.id} bug={b} highlight={focus===b.id} onRefresh={onRefresh}/>)}
      </div>
    </>
  );
};

/* ─── BugRow (compact, read-only) ─── */
const BugRow = ({ bug }) => {
  const status = bug.status || "open";
  return (
    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line-soft)" }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <span className={`indicator ${SEV_LABELS[bug.severity]?.tone || "mute"}`} style={{ marginTop: 4 }}/>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}>
            <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{bug.id}</span>
            <span style={{ fontWeight: 500, fontSize: 13 }}>{bug.title}</span>
          </div>
          <div className="row" style={{ marginTop: 4, gap: 6 }}>
            <SeverityBadge s={bug.severity}/>
            <Badge tone={TASK_STATUS_TONE[status] || "high"} dot>{TASK_STATUS_LABEL[status] || status}</Badge>
            <span className="chip"><Icons.team/> {bug.team}</span>
            {bug.jira && <span className="chip">{bug.jira}</span>}
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
};

/* ─── BugCard (full, with draft workflow actions) ─── */
const BugCard = ({ bug, highlight, onRefresh }) => {
  const [acting, setActing] = React.useState(false);
  const [showReject, setShowReject] = React.useState(false);
  const [rejectComment, setRejectComment] = React.useState("");

  const status = bug.status || "open";
  const statusTone = TASK_STATUS_TONE[status] || "high";
  const statusLabel = TASK_STATUS_LABEL[status] || status;
  const isDraft    = status === "draft";
  const isReview   = status === "review" || status === "pending_confirmation";
  const isRejected = status === "blocked" || status === "rejected_draft";

  const act = (fn) => async () => {
    setActing(true);
    try { await fn(); onRefresh?.(); }
    catch (e) { alert(e.message); }
    finally { setActing(false); }
  };

  const doSubmit = act(() => API.tasks.submitForReview(bug.id, {}));
  const doConfirm = act(() => API.tasks.confirm(bug.id, {}));

  const doReject = async () => {
    if (!rejectComment.trim()) return;
    setActing(true);
    try {
      await API.tasks.reject(bug.id, { review_comment: rejectComment });
      setShowReject(false);
      setRejectComment("");
      onRefresh?.();
    } catch (e) { alert(e.message); }
    finally { setActing(false); }
  };

  return (
    <div className="card" style={{ outline: highlight ? "1px solid var(--accent)" : "none" }}>
      <div className="card-hd">
        <div className="ttl">
          <span className={`indicator ${SEV_LABELS[bug.severity]?.tone || "mute"}`}/>
          <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{bug.id}</span>
          <span>{bug.title}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <SeverityBadge s={bug.severity}/>
          <Badge tone={statusTone} dot>{statusLabel}</Badge>
          <Avatar user={bug.owner} size="sm"/>
        </div>
      </div>

      <div className="card-bd col" style={{ gap: 8 }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {bug.team && <span className="chip"><Icons.team/> {bug.team}</span>}
          {bug.jira && <span className="chip"><Icons.link/> {bug.jira}</span>}
          {(bug.fixDate || bug.fix_date) && <span className="chip"><Icons.check/> fix {bug.fixDate || bug.fix_date}</span>}
          {(bug.environments || []).map(e => <span key={e} className="chip">{e}</span>)}
          {bug.tickets != null && <span className="chip"><Icons.ticket/> {bug.tickets} обращений</span>}
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

        {bug.rootCause && (
          <div>
            <div style={{ font: "500 10px var(--mono)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Root cause</div>
            <div style={{ fontSize: 13, color: "var(--fg-mute)" }}>{bug.rootCause}</div>
          </div>
        )}

        {bug.recommendation && (
          <div>
            <div style={{ font: "500 10px var(--mono)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Рекомендация саппорту</div>
            <div style={{ fontSize: 13 }}>{bug.recommendation}</div>
          </div>
        )}

        {/* Draft: rejected reason */}
        {isRejected && bug.review_comment && (
          <div className="row" style={{ gap: 8, padding: "8px 10px", background: "var(--critical-bg)", borderRadius: 6 }}>
            <Icons.alert/>
            <span style={{ fontSize: 12.5, color: "var(--critical)" }}>{bug.review_comment}</span>
          </div>
        )}

        {/* Draft workflow action row */}
        {(isDraft || isRejected) && (
          <div className="row" style={{ gap: 8, paddingTop: 8, borderTop: "1px solid var(--line-soft)", marginTop: 4 }}>
            <div className="grow"/>
            <Btn primary icon={<Icons.arrowUp/>} onClick={doSubmit} disabled={acting}>
              {isRejected ? "Отправить повторно" : "На проверку команды"}
            </Btn>
          </div>
        )}

        {isReview && !showReject && (
          <div className="row" style={{ gap: 8, paddingTop: 8, borderTop: "1px solid var(--line-soft)", marginTop: 4 }}>
            <div className="grow"/>
            <Btn ghost onClick={() => setShowReject(true)} disabled={acting}>
              <Icons.close/> Отклонить
            </Btn>
            <Btn tone="ok" icon={<Icons.check/>} onClick={doConfirm} disabled={acting}>
              Подтвердить
            </Btn>
          </div>
        )}

        {isReview && showReject && (
          <div className="col" style={{ gap: 8, paddingTop: 8, borderTop: "1px solid var(--line-soft)", marginTop: 4 }}>
            <div className="faint" style={{ fontSize: 12 }}>Причина отклонения:</div>
            <textarea
              className="inp"
              rows={2}
              placeholder="Что нужно доработать…"
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              style={{ resize: "vertical" }}
            />
            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <Btn ghost onClick={() => { setShowReject(false); setRejectComment(""); }} disabled={acting}>Отмена</Btn>
              <Btn tone="critical" onClick={doReject} disabled={acting || !rejectComment.trim()}>
                Отклонить
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Team tab ─── */
const ProblemTeam = ({ problem: p, bugs, onRefresh }) => {
  const pending   = bugs.filter(b => b.status === "review" || b.status === "pending_confirmation");
  const drafts    = bugs.filter(b => b.status === "draft");
  const rejected  = bugs.filter(b => b.status === "blocked" || b.status === "rejected_draft");
  /* only warn about missing notes for active tasks (not drafts or under review) */
  const activeSt = new Set(["open","in_progress","waiting_fix","monitoring"]);
  const missingNotes = bugs.filter(b => activeSt.has(b.status) && !b.recommendation && !b.workaround);

  /* Triage SLA progress bar */
  const slaDeadline = p.triage_sla_deadline;
  let slaHoursLeft = null, slaProgress = 0;
  if (slaDeadline) {
    const now = Date.now();
    const deadline = new Date(slaDeadline).getTime();
    const created = p.created_at ? new Date(p.created_at).getTime() : now - 24 * 3600_000;
    slaHoursLeft = Math.max(0, Math.round((deadline - now) / 3_600_000));
    slaProgress  = Math.min(1, Math.max(0, (now - created) / (deadline - created)));
  }

  const [acting, setActing] = React.useState({});
  const [showRejectFor, setShowRejectFor] = React.useState(null);
  const [rejectComments, setRejectComments] = React.useState({});

  const doConfirm = async (bug) => {
    setActing(a => ({ ...a, [bug.id]: true }));
    try { await API.tasks.confirm(bug.id, {}); onRefresh?.(); }
    catch (e) { alert(e.message); }
    finally { setActing(a => ({ ...a, [bug.id]: false })); }
  };

  const doReject = async (bug) => {
    const comment = (rejectComments[bug.id] || "").trim();
    if (!comment) return;
    setActing(a => ({ ...a, [bug.id]: true }));
    try {
      await API.tasks.reject(bug.id, { review_comment: comment });
      setShowRejectFor(null);
      onRefresh?.();
    } catch (e) { alert(e.message); }
    finally { setActing(a => ({ ...a, [bug.id]: false })); }
  };

  const allClear = !slaDeadline && pending.length === 0 && missingNotes.length === 0 && drafts.length === 0 && rejected.length === 0;

  return (
    <div className="col" style={{ gap: 20 }}>

      {/* Triage SLA */}
      {slaDeadline && (
        <div className="card" style={{ border: `1px solid ${slaHoursLeft < 4 ? "var(--critical)" : "var(--high)"}` }}>
          <div className="card-hd">
            <div className="ttl"><Icons.clock/>Triage SLA</div>
            <Badge tone={slaHoursLeft < 4 ? "critical" : slaHoursLeft < 12 ? "high" : "warning"} dot>
              {slaHoursLeft} ч осталось
            </Badge>
          </div>
          <div className="card-bd">
            <div style={{ height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
              <div style={{
                height: "100%",
                width: `${Math.round(slaProgress * 100)}%`,
                background: slaHoursLeft < 4 ? "var(--critical)" : slaHoursLeft < 12 ? "var(--high)" : "var(--accent)",
                borderRadius: 3,
              }}/>
            </div>
            <div className="faint" style={{ fontSize: 12 }}>
              Проблема должна перейти из «new» в «in_progress» до истечения SLA (1 день с момента создания)
            </div>
          </div>
        </div>
      )}

      {/* Pending confirmation */}
      <div>
        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <h3 style={{ margin: 0, font: "600 13px var(--sans)" }}>Ожидают подтверждения</h3>
          {pending.length > 0 && <Badge tone="warning" dot>{pending.length}</Badge>}
        </div>
        {pending.length === 0
          ? <div className="empty muted" style={{ padding: "12px 0" }}>Нет задач на подтверждении</div>
          : <div className="col" style={{ gap: 8 }}>
              {pending.map(bug => (
                <div key={bug.id} className="card" style={{ border: "1px solid color-mix(in oklch, var(--high) 40%, transparent)" }}>
                  <div className="card-hd">
                    <div className="ttl">
                      <span className={`indicator ${SEV_LABELS[bug.severity]?.tone || "mute"}`}/>
                      <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{bug.id}</span>
                      <span>{bug.title}</span>
                      {bug.task_type && <span className="chip">{bug.task_type}</span>}
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <Badge tone="warning" dot>На проверке</Badge>
                      {bug.team && <span className="chip"><Icons.team/> {bug.team}</span>}
                    </div>
                  </div>
                  {bug.workaround && (
                    <div className="card-bd" style={{ paddingTop: 0, paddingBottom: 8 }}>
                      <div className="row" style={{ gap: 6, fontSize: 12.5, padding: "6px 10px", background: "var(--ok-bg)", borderRadius: 6 }}>
                        <Icons.shield/><span style={{ color: "var(--fg-mute)" }}>{bug.workaround}</span>
                      </div>
                    </div>
                  )}
                  {showRejectFor !== bug.id
                    ? (
                      <div className="row" style={{ gap: 8, padding: "0 14px 12px", justifyContent: "flex-end" }}>
                        <Btn ghost onClick={() => setShowRejectFor(bug.id)} disabled={acting[bug.id]}>
                          <Icons.close/> Отклонить
                        </Btn>
                        <Btn tone="ok" icon={<Icons.check/>} onClick={() => doConfirm(bug)} disabled={acting[bug.id]}>
                          Подтвердить
                        </Btn>
                      </div>
                    ) : (
                      <div className="col" style={{ gap: 8, padding: "0 14px 12px" }}>
                        <textarea
                          className="inp"
                          rows={2}
                          placeholder="Причина отклонения…"
                          value={rejectComments[bug.id] || ""}
                          onChange={e => setRejectComments(s => ({ ...s, [bug.id]: e.target.value }))}
                          style={{ resize: "vertical" }}
                        />
                        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                          <Btn ghost onClick={() => setShowRejectFor(null)} disabled={acting[bug.id]}>Отмена</Btn>
                          <Btn tone="critical" onClick={() => doReject(bug)} disabled={acting[bug.id] || !(rejectComments[bug.id] || "").trim()}>
                            Отклонить
                          </Btn>
                        </div>
                      </div>
                    )
                  }
                </div>
              ))}
            </div>
        }
      </div>

      {/* Missing support notes */}
      {missingNotes.length > 0 && (
        <div>
          <div className="row" style={{ marginBottom: 10, gap: 8 }}>
            <h3 style={{ margin: 0, font: "600 13px var(--sans)" }}>Задачи без рекомендаций</h3>
            <Badge tone="critical" dot>{missingNotes.length}</Badge>
          </div>
          <div style={{ padding: "12px 14px", background: "var(--critical-bg)", borderRadius: 8, border: "1px solid color-mix(in oklch, var(--critical) 30%, transparent)" }}>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <Icons.alert/>
              <span style={{ fontSize: 13, color: "var(--critical)", fontWeight: 500 }}>
                Саппорт не знает, что отвечать клиентам по этим задачам
              </span>
            </div>
            <div className="col" style={{ gap: 6 }}>
              {missingNotes.map(bug => (
                <div key={bug.id} className="row" style={{ gap: 8, fontSize: 12.5 }}>
                  <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{bug.id}</span>
                  <span className="grow">{bug.title}</span>
                  <Badge tone={TASK_STATUS_TONE[bug.status] || "high"} dot>{TASK_STATUS_LABEL[bug.status] || bug.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Drafts info */}
      {drafts.length > 0 && (
        <div>
          <div className="row" style={{ marginBottom: 10, gap: 8 }}>
            <h3 style={{ margin: 0, font: "600 13px var(--sans)" }}>Черновики операторов</h3>
            <span className="faint" style={{ fontSize: 12 }}>· ожидают отправки на проверку</span>
          </div>
          <div className="col" style={{ gap: 6 }}>
            {drafts.map(bug => (
              <div key={bug.id} className="row" style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8, gap: 8 }}>
                <span className={`indicator ${SEV_LABELS[bug.severity]?.tone || "mute"}`}/>
                <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{bug.id}</span>
                <span className="grow" style={{ fontSize: 13 }}>{bug.title}</span>
                <Badge tone="mute" dot>Черновик</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <div>
          <div className="row" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0, font: "600 13px var(--sans)" }}>Отклонённые</h3>
          </div>
          <div className="col" style={{ gap: 6 }}>
            {rejected.map(bug => (
              <div key={bug.id} className="row" style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8, gap: 8 }}>
                <span className="indicator critical"/>
                <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{bug.id}</span>
                <span className="grow" style={{ fontSize: 13 }}>{bug.title}</span>
                <Badge tone="critical" dot>Отклонён</Badge>
                {bug.review_comment && <span className="faint" style={{ fontSize: 11.5, maxWidth: 240, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{bug.review_comment}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {allClear && (
        <div className="empty">
          <h4>Всё в порядке</h4>
          <div>Нет задач, требующих внимания команды</div>
        </div>
      )}
    </div>
  );
};

/* ─── Tickets tab ─── */
const ProblemTickets = ({ problem: p, tickets, bugs }) => {
  const [filter, setFilter] = React.useState("all");
  const counts = {
    all: tickets.length,
    "no-bug": tickets.filter(t => !t.bugId).length,
    new: tickets.filter(t => t.flags?.isNew).length,
    research: tickets.filter(t => t.flags?.needsResearch).length,
    duplicate: tickets.filter(t => t.flags?.duplicate).length,
  };
  const filtered = tickets.filter(t => {
    if (filter === "all") return true;
    if (filter === "no-bug") return !t.bugId;
    if (filter === "new") return t.flags?.isNew;
    if (filter === "research") return t.flags?.needsResearch;
    if (filter === "duplicate") return t.flags?.duplicate;
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
              <td><Badge tone={TICKET_STATUS[t.status]?.tone || "mute"} dot>{TICKET_STATUS[t.status]?.label || t.status}</Badge></td>
              <td>{t.bugId ? <span className="chip">{t.bugId}</span> : <span className="bdg bdg-mute">—</span>}</td>
              <td className="muted" style={{ fontSize: 11.5 }}>{t.created?.slice(5,10)} {t.created?.slice(11,16)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length > 30 && <div className="empty muted">показано 30 из {filtered.length}</div>}
    </>
  );
};

/* ─── Activity tab ─── */
const ACTIVITY_KIND = {
  "status_change": "evt-status",
  "comment":       "evt-comment",
  "link":          "evt-link",
  "create":        "evt-status",
};

const ProblemActivity = ({ problem: p, bugs, activity }) => {
  if (!activity || activity.length === 0) return (
    <div className="empty muted">Нет данных активности</div>
  );
  return (
    <div className="tl">
      {activity.map((e, i) => {
        const kind = ACTIVITY_KIND[e.action] || "evt-status";
        const when = e.created_at
          ? new Date(e.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
          : "";
        return (
          <div key={e.id || i} className={`tl-item ${kind}`}>
            <div className="pin"><span className="dot"/></div>
            <div className="body">
              <div className="meta">
                <strong style={{ color: "var(--fg)" }}>{e.actor_name || "Система"}</strong> · {when}
              </div>
              <div className="text">{e.action}: {typeof e.new_value === "string" ? e.new_value : JSON.stringify(e.new_value)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ─── Linked tab ─── */
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

/* ─── Shared sub-components ─── */
const TicketRow = ({ ticket: t }) => (
  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line-soft)" }}>
    <div className="row" style={{ alignItems: "flex-start" }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="id" style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{t.id}</span>
          <Badge tone={TICKET_STATUS[t.status]?.tone || "mute"} dot>{TICKET_STATUS[t.status]?.label || t.status}</Badge>
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
      {bugPos.map((b, i) => (
        <line key={`pb${i}`} x1={cx} y1={cy} x2={b[0]} y2={b[1]} stroke="var(--line)" strokeWidth="1.2"/>
      ))}
      {ticketPositions.map((tp, i) => {
        const t = tickets[i];
        const target = t && t.bugId ? bugPos[bugs.findIndex(b => b.id === t.bugId)] : [cx, cy];
        if (!target) return null;
        return <line key={`bt${i}`} x1={target[0]} y1={target[1]} x2={tp[0]} y2={tp[1]} stroke="var(--line-soft)" strokeWidth="1" strokeDasharray={t && !t.bugId ? "2 3" : ""}/>;
      })}
      <circle cx={cx} cy={cy} r="22" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2"/>
      <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontFamily="Geist Mono, monospace" fontWeight="600" fill="var(--accent-ink)">{problem.id}</text>
      {bugs.map((b, i) => {
        const [x, y] = bugPos[i];
        const tone = SEV_LABELS[b.severity]?.tone || "mute";
        const color = `var(--${tone})`;
        return (
          <g key={b.id}>
            <circle cx={x} cy={y} r="14" fill={color} stroke="var(--bg)" strokeWidth="2"/>
            <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontFamily="Geist Mono, monospace" fontWeight="600" fill="var(--accent-ink)">{b.id.replace("BUG-","")}</text>
          </g>
        );
      })}
      {ticketPositions.map((tp, i) => {
        const t = tickets[i];
        return <circle key={i} cx={tp[0]} cy={tp[1]} r="4" fill={t && t.bugId ? "var(--info)" : "var(--high)"} stroke="var(--bg)" strokeWidth="1.5"/>;
      })}
      <g transform={`translate(16, ${H-44})`} fontSize="10" fontFamily="Geist, sans-serif" fill="var(--fg-mute)">
        <circle cx="6" cy="6" r="6" fill="var(--accent)"/><text x="18" y="9">Проблема</text>
        <circle cx="86" cy="6" r="6" fill="var(--critical)"/><text x="98" y="9">Баг</text>
        <circle cx="138" cy="6" r="4" fill="var(--info)"/><text x="148" y="9">Тикет</text>
        <circle cx="200" cy="6" r="4" fill="var(--high)"/><text x="210" y="9">Тикет без бага</text>
      </g>
    </svg>
  );
};

/* ─── RmoSpace — standalone screen, all pending tasks across problems ─── */
const RmoSpace = ({ go }) => {
  const [tasks, setTasks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const loadTasks = React.useCallback(() => {
    setLoading(true);
    API.tasks.listAll({ status: ["pending_confirmation"], limit: 100 })
      .then(data => setTasks(data))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { loadTasks(); }, [loadTasks]);

  const [acting, setActing] = React.useState({});
  const [showRejectFor, setShowRejectFor] = React.useState(null);
  const [rejectComments, setRejectComments] = React.useState({});

  const doConfirm = async (task) => {
    setActing(a => ({ ...a, [task.id]: true }));
    try { await API.tasks.confirm(task.id, {}); loadTasks(); }
    catch (e) { alert(e.message); }
    finally { setActing(a => ({ ...a, [task.id]: false })); }
  };

  const doReject = async (task) => {
    const comment = (rejectComments[task.id] || "").trim();
    if (!comment) return;
    setActing(a => ({ ...a, [task.id]: true }));
    try {
      await API.tasks.reject(task.id, { review_comment: comment });
      setShowRejectFor(null);
      loadTasks();
    } catch (e) { alert(e.message); }
    finally { setActing(a => ({ ...a, [task.id]: false })); }
  };

  /* Group tasks by problem */
  const byProblem = React.useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      const pid = t.problemId || "—";
      (map[pid] = map[pid] || []).push(t);
    });
    return map;
  }, [tasks]);

  return (
    <div className="pane">
      <div className="pane-hd">
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>РМО-пространство</h2>
          <div className="faint" style={{ fontSize: 13, marginTop: 2 }}>Задачи, ожидающие подтверждения командой</div>
        </div>
        <div className="grow"/>
        {!loading && tasks.length > 0 && (
          <Badge tone="warning" dot>{tasks.length} на проверке</Badge>
        )}
        <Btn ghost icon={<Icons.spark/>} onClick={loadTasks}>Обновить</Btn>
      </div>

      {loading && <div className="empty">Загрузка…</div>}

      {!loading && tasks.length === 0 && (
        <div className="empty">
          <h4>Нет задач на проверке</h4>
          <div>Все черновики подтверждены или ещё не отправлены операторами</div>
        </div>
      )}

      {!loading && Object.entries(byProblem).map(([pid, ptasks]) => (
        <div key={pid} style={{ marginBottom: 24 }}>
          <div className="row" style={{ marginBottom: 10, gap: 8, padding: "0 2px" }}>
            <span style={{ font: "600 13px var(--mono)", color: "var(--fg-dim)" }}>{pid}</span>
            <span className="faint" style={{ fontSize: 12 }}>· {ptasks.length} задач на проверке</span>
            <div className="grow"/>
            <Btn ghost icon={<Icons.chev/>} onClick={() => go({ view: "problems", detailId: pid, tab: "team" })}>
              К проблеме
            </Btn>
          </div>
          <div className="col" style={{ gap: 8 }}>
            {ptasks.map(task => (
              <div key={task.id} className="card" style={{ border: "1px solid color-mix(in oklch, var(--high) 40%, transparent)" }}>
                <div className="card-hd">
                  <div className="ttl">
                    <span className={`indicator ${SEV_LABELS[task.severity]?.tone || "mute"}`}/>
                    <span style={{ font: "500 11px var(--mono)", color: "var(--fg-dim)" }}>{task.id}</span>
                    <span>{task.title}</span>
                    {task.task_type && <span className="chip">{task.task_type}</span>}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <Badge tone="warning" dot>На проверке</Badge>
                    {task.team && <span className="chip"><Icons.team/> {task.team}</span>}
                  </div>
                </div>

                {task.workaround && (
                  <div className="card-bd" style={{ paddingTop: 0, paddingBottom: 8 }}>
                    <div className="row" style={{ gap: 6, fontSize: 12.5, padding: "6px 10px", background: "var(--ok-bg)", borderRadius: 6 }}>
                      <Icons.shield/><span style={{ color: "var(--fg-mute)" }}>{task.workaround}</span>
                    </div>
                  </div>
                )}

                {showRejectFor !== task.id
                  ? (
                    <div className="row" style={{ gap: 8, padding: "0 14px 12px", justifyContent: "flex-end" }}>
                      <Btn ghost onClick={() => setShowRejectFor(task.id)} disabled={acting[task.id]}>
                        <Icons.close/> Отклонить
                      </Btn>
                      <Btn tone="ok" icon={<Icons.check/>} onClick={() => doConfirm(task)} disabled={acting[task.id]}>
                        Подтвердить
                      </Btn>
                    </div>
                  ) : (
                    <div className="col" style={{ gap: 8, padding: "0 14px 12px" }}>
                      <textarea
                        className="inp"
                        rows={2}
                        placeholder="Причина отклонения…"
                        value={rejectComments[task.id] || ""}
                        onChange={e => setRejectComments(s => ({ ...s, [task.id]: e.target.value }))}
                        style={{ resize: "vertical" }}
                      />
                      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                        <Btn ghost onClick={() => setShowRejectFor(null)} disabled={acting[task.id]}>Отмена</Btn>
                        <Btn tone="critical" onClick={() => doReject(task)} disabled={acting[task.id] || !(rejectComments[task.id] || "").trim()}>
                          Отклонить
                        </Btn>
                      </div>
                    </div>
                  )
                }
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

Object.assign(window, {
  ProblemDetail, BugRow, BugCard, TicketRow, RelationGraph,
  ProblemTeam, RmoSpace,
  TASK_STATUS_TONE, TASK_STATUS_LABEL,
});
