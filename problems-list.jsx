/* VECTOR — Problems list (table view) */

const PROBLEM_FILTERS_DEFAULTS = {
  status: "all", priority: "all", product: "all", owner: "all", search: "",
  sort: "tickets-delta", view: "all",
};

const ProblemList = ({ go }) => {
  const [filters, setFilters] = React.useState(PROBLEM_FILTERS_DEFAULTS);
  const [selected, setSelected] = React.useState(new Set());

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const reset = () => setFilters(PROBLEM_FILTERS_DEFAULTS);

  const filtered = React.useMemo(() => {
    let arr = PROBLEMS.filter(p => {
      if (filters.status !== "all" && p.status !== filters.status) return false;
      if (filters.priority !== "all" && p.priority !== filters.priority) return false;
      if (filters.product !== "all" && !p.products.includes(filters.product)) return false;
      if (filters.owner === "me" && p.owner !== "u1") return false;
      if (filters.owner === "unassigned" && p.owner) return false;
      if (filters.view === "no-bug" && p.ticketsNoBug === 0) return false;
      if (filters.view === "growing" && p.ticketsDelta <= 0.1) return false;
      if (filters.view === "untriaged" && p.untriaged < 10) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.id.toLowerCase().includes(q)
            && !p.tags.some(t => t.includes(q))) return false;
      }
      return true;
    });
    const sortBy = {
      "tickets-delta": (a,b) => b.ticketsDelta - a.ticketsDelta,
      "tickets":       (a,b) => b.tickets - a.tickets,
      "untriaged":     (a,b) => b.untriaged - a.untriaged,
      "priority":      (a,b) => a.priority.localeCompare(b.priority),
      "updated":       (a,b) => b.lastUpdate.localeCompare(a.lastUpdate),
    };
    return [...arr].sort(sortBy[filters.sort] || sortBy["tickets-delta"]);
  }, [filters]);

  const toggleSelect = (id) => {
    setSelected(s => {
      const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns;
    });
  };
  const toggleAll = () => {
    setSelected(s => s.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));
  };

  const VIEWS = [
    { id: "all", label: "Все" },
    { id: "growing", label: "Растущие" },
    { id: "untriaged", label: "Много untriaged" },
    { id: "no-bug", label: "Без багов" },
  ];

  return (
    <div className="page">
      <div className="page-hd">
        <div className="row">
          <div className="grow">
            <h1>Проблемы</h1>
            <div className="desc">{filtered.length} из {PROBLEMS.length} · обновляется в реальном времени</div>
          </div>
          <div className="row">
            <div className="row" style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 6, padding: 2 }}>
              {VIEWS.map(v => (
                <button key={v.id} className={`btn btn-ghost`} style={{
                  background: filters.view===v.id ? "var(--bg-hover)" : "transparent",
                  color: filters.view===v.id ? "var(--fg)" : "var(--fg-mute)",
                  borderRadius: 4,
                }} onClick={() => set("view", v.id)}>{v.label}</button>
              ))}
            </div>
            <Btn ghost icon={<Icons.sort/>}>Сохранить вид</Btn>
            <Btn primary icon={<Icons.plus/>}>Новая проблема</Btn>
          </div>
        </div>
      </div>

      <div className="flt">
        <div className="flt-chip applied">
          <Icons.search/>
          <input value={filters.search} onChange={e => set("search", e.target.value)}
            placeholder="ID, заголовок, тег…" style={{ background: "transparent", border: 0, outline: 0, width: 160 }}/>
          {filters.search && <button className="x" onClick={() => set("search","")}><Icons.close/></button>}
        </div>
        <FilterSelect label="Статус" value={filters.status} onChange={v => set("status", v)}
          options={[["all","Любой"],["triage","Triage"],["investigating","Investigating"],["in-progress","In progress"],["blocked","Blocked"],["watching","Watching"]]}/>
        <FilterSelect label="Приоритет" value={filters.priority} onChange={v => set("priority", v)}
          options={[["all","Любой"],["P0","P0"],["P1","P1"],["P2","P2"],["P3","P3"]]}/>
        <FilterSelect label="Продукт" value={filters.product} onChange={v => set("product", v)}
          options={[["all","Все"], ...PRODUCTS.map(p => [p,p])]}/>
        <FilterSelect label="Owner" value={filters.owner} onChange={v => set("owner", v)}
          options={[["all","Любой"],["me","Я"],["unassigned","Не назначен"]]}/>
        <div className="flt-spacer"/>
        <FilterSelect label="Сорт." value={filters.sort} onChange={v => set("sort", v)}
          options={[["tickets-delta","↑ Δ обращений"],["untriaged","↑ untriaged"],["tickets","↑ обращений"],["priority","Приоритет"],["updated","Обновлено"]]}/>
        <button className="flt-chip" onClick={reset}><Icons.close/>Сбросить</button>
      </div>

      {selected.size > 0 && (
        <div className="flt" style={{ background: "var(--bg-elev)", borderTop: "1px solid var(--accent-soft)" }}>
          <span style={{ fontSize: 12.5 }}><strong>{selected.size}</strong> выбрано</span>
          <Btn ghost icon={<Icons.user/>}>Назначить</Btn>
          <Btn ghost icon={<Icons.flow/>}>Сменить статус</Btn>
          <Btn ghost icon={<Icons.link/>}>Объединить</Btn>
          <Btn ghost icon={<Icons.pin/>}>В наблюдение</Btn>
          <div className="flt-spacer"/>
          <Btn ghost onClick={() => setSelected(new Set())}>Снять</Btn>
        </div>
      )}

      <div className="page-body" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 28, padding: "8px 8px 8px 24px" }}>
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll}/>
              </th>
              <th style={{ minWidth: 360 }}>Проблема</th>
              <th>Статус</th>
              <th>Sev / P</th>
              <th>Owner</th>
              <th>Продукты</th>
              <th className="num">Тикеты / 7д</th>
              <th>Δ</th>
              <th>Тренд</th>
              <th className="num">Untriaged</th>
              <th>Δ</th>
              <th className="num">Без бага</th>
              <th className="num">Багов</th>
              <th>SLA</th>
              <th>Обновлено</th>
              <th style={{ width: 24 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const sel = selected.has(p.id);
              return (
                <tr key={p.id} className={`row-link ${sel?"selected":""}`}
                    onClick={() => go({ view: "problems", detailId: p.id })}>
                  <td style={{ padding: "0 8px 0 24px" }} onClick={e => { e.stopPropagation(); toggleSelect(p.id); }}>
                    <input type="checkbox" checked={sel} readOnly/>
                  </td>
                  <td>
                    <div className="row" style={{ alignItems: "flex-start", gap: 6 }}>
                      <span className={`indicator ${SEV_LABELS[p.severity].tone}`} style={{ marginTop: 4 }}/>
                      <div>
                        <div className="ttl">
                          <span style={{ font: "500 11px var(--mono)", color: "var(--fg-faint)", marginRight: 8 }}>{p.id}</span>
                          {p.title}
                        </div>
                        <div className="row" style={{ marginTop: 2, gap: 4 }}>
                          {p.tags.slice(0,3).map(t => <span key={t} className="chip">{t}</span>)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={p.status}/></td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <PriorityBadge p={p.priority}/><SeverityBadge s={p.severity}/>
                    </div>
                  </td>
                  <td>{p.owner ? <Avatar user={p.owner} size="sm"/> : <span className="bdg bdg-mute">—</span>}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {p.products.slice(0,2).map(pr => <ProductPill key={pr} p={pr}/>)}
                      {p.products.length > 2 && <span className="chip">+{p.products.length-2}</span>}
                    </div>
                  </td>
                  <td className="num"><strong>{p.tickets.toLocaleString("ru-RU")}</strong></td>
                  <td><Delta value={p.ticketsDelta}/></td>
                  <td><Sparkline data={p.trend} w={70} h={20}/></td>
                  <td className="num">
                    {p.untriaged > 50
                      ? <span style={{ color: "var(--critical)", fontWeight: 600 }}>{p.untriaged}</span>
                      : <strong>{p.untriaged}</strong>}
                  </td>
                  <td><Delta value={p.untriagedDelta}/></td>
                  <td className="num">
                    {p.ticketsNoBug > 50
                      ? <span style={{ color: "var(--high)", fontWeight: 600 }}>{p.ticketsNoBug}</span>
                      : <span className="muted">{p.ticketsNoBug}</span>}
                  </td>
                  <td className="num">
                    {p.bugs === 0
                      ? <span className="bdg bdg-mute">нет</span>
                      : <span><Icons.bug/> <strong>{p.bugs}</strong></span>}
                  </td>
                  <td><HealthBar value={p.sla}/></td>
                  <td className="muted" style={{ fontSize: 11.5 }}>{relTime(p.lastUpdate)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <IconBtn icon={<Icons.more/>}/>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty">
            <h4>Нет совпадений</h4>
            <div>Попробуйте сбросить фильтры или изменить запрос</div>
            <div style={{ marginTop: 12 }}><Btn onClick={reset}>Сбросить фильтры</Btn></div>
          </div>
        )}
      </div>
    </div>
  );
};

const FilterSelect = ({ label, value, options, onChange }) => {
  const cur = options.find(o => o[0] === value);
  const def = options[0][0];
  const applied = value !== def;
  return (
    <label className={`flt-chip ${applied?"applied":""}`}>
      <span className="faint" style={{ fontSize: 11 }}>{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ background:"transparent", border:0, outline:0, color:"inherit", fontSize:12, padding:"0 14px 0 0", appearance:"none", cursor:"default" }}>
        {options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Icons.chevDown/>
    </label>
  );
};

const relTime = (iso) => {
  const d = new Date(iso); const now = new Date("2026-05-08T10:00:00");
  const m = Math.round((now - d)/60000);
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m/60);
  if (h < 24) return `${h} ч назад`;
  const days = Math.round(h/24);
  return `${days} д назад`;
};

Object.assign(window, { ProblemList, FilterSelect, relTime });
