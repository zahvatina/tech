/* VECTOR — Dashboard view.
   Operational overview: hot stats, fastest-growing problems, triage queue,
   bugs missing workaround, anomaly detection card, weekly heatmap. */

const sumBy = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

const Dashboard = ({ go }) => {
  const [problems, setProblems] = React.useState(PROBLEMS);
  React.useEffect(() => {
    API.problems.list({ limit: 100 })
      .then(res => setProblems(res.data))
      .catch(() => setProblems(PROBLEMS));
  }, []);
  const total = problems;
  const totalTickets = sumBy(total, p => p.tickets);
  const totalUntriaged = sumBy(total, p => p.untriaged);
  const totalNoBug = sumBy(total, p => p.ticketsNoBug);
  const open = total.filter(p => p.status !== "resolved").length;
  const hot = [...total].sort((a, b) => b.ticketsDelta - a.ticketsDelta).slice(0, 5);
  const queue = [...total].sort((a, b) => b.untriaged - a.untriaged).slice(0, 5);
  const noBugLeaders = [...total].filter(p => p.ticketsNoBug > 0).sort((a,b) => b.ticketsNoBug - a.ticketsNoBug).slice(0,4);
  const noWorkaround = BUGS.filter(b => !b.workaround || b.workaround.length < 5).slice(0,4); // none in mock; fall back below

  // Build heat data 7d × 24h based on PROBLEMS.trend
  const heat = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 28; c++) {
      const v = (Math.sin(c*0.6 + r) + Math.cos(r*0.9 + c*0.2)) * 0.5 + 0.5;
      const lvl = v > 0.85 ? 4 : v > 0.7 ? 3 : v > 0.55 ? 2 : v > 0.4 ? 1 : 0;
      heat.push(lvl);
    }
  }

  return (
    <div className="page">
      <div className="page-hd">
        <div className="row">
          <div className="grow">
            <h1>Operations overview</h1>
            <div className="desc">SBR Insurance · последние 7 дней · обновлено {new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</div>
          </div>
          <div className="row">
            <Btn ghost icon={<Icons.clock/>}>7 дней</Btn>
            <Btn ghost icon={<Icons.filter/>}>Все продукты</Btn>
            <Btn icon={<Icons.flow/>}>Открыть incident view</Btn>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Hot KPIs */}
        <div className="grid-4">
          <KpiCard label="Открытых проблем" value={open} delta={+0.06} sub={`${total.length} всего`}
                   spark={[12,14,12,15,17,19,21,22,24,26,27,28]} />
          <KpiCard label="Обращений / 7д"   value={totalTickets.toLocaleString("ru-RU")} delta={+0.21}
                   sub="vs прошлая неделя" critical
                   spark={[180,210,260,310,290,330,360,420,460,510,560,610]} />
          <KpiCard label="Неразобранных"    value={totalUntriaged}  delta={+0.34} sub="требуют triage" critical
                   spark={[18,22,28,30,34,40,46,52,60,68,72,78]} />
          <KpiCard label="Без привязки к багу" value={totalNoBug} delta={+0.18} sub={`в ${noBugLeaders.length} проблемах`}
                   spark={[24,28,30,34,38,42,40,44,48,52,56,60]} />
        </div>

        <div style={{ height: 14 }}/>

        {/* AI strip */}
        <div className="ai">
          <span className="icn">AI</span>
          <div className="body">
            <div><b>Кластер обнаружен:</b> 198 неразобранных тикетов про «Invalid VIN при оформлении ОСАГО» — похоже на новую проблему.</div>
            <div className="sub">86% похожих формулировок · 12 регионов · рост +74% WoW · бага ещё нет</div>
          </div>
          <div className="actions">
            <Btn ghost>Посмотреть кластер</Btn>
            <Btn primary onClick={() => go({ view: "problems", detailId: "PRB-148" })}>
              Создать проблему
            </Btn>
          </div>
        </div>

        <div className="grid-2">
          {/* Fastest growing */}
          <div className="card">
            <div className="card-hd">
              <div className="ttl"><Icons.fire/>Растут быстрее всего</div>
              <button className="btn btn-ghost" onClick={() => go({ view: "problems" })}>
                Все проблемы<Icons.chev/>
              </button>
            </div>
            <table className="tbl">
              <thead>
                <tr><th>Проблема</th><th className="num">Тикетов / 7д</th><th>Δ WoW</th><th style={{width:120}}></th></tr>
              </thead>
              <tbody>
                {hot.map(p => (
                  <tr key={p.id} className="row-link" onClick={() => go({ view: "problems", detailId: p.id })}>
                    <td>
                      <span className={`indicator ${SEV_LABELS[p.severity].tone}`}/>
                      <span className="ttl">{p.title.slice(0, 56)}</span>
                    </td>
                    <td className="num"><strong>{p.tickets.toLocaleString("ru-RU")}</strong></td>
                    <td><Delta value={p.ticketsDelta}/></td>
                    <td><Sparkline data={p.trend} w={110} h={22} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Triage queue */}
          <div className="card">
            <div className="card-hd">
              <div className="ttl"><Icons.triage/>Очередь triage</div>
              <button className="btn btn-ghost" onClick={() => go({ view: "triage" })}>
                Открыть очередь<Icons.chev/>
              </button>
            </div>
            <table className="tbl">
              <thead>
                <tr><th>Проблема</th><th className="num">Untriaged</th><th>Δ WoW</th><th>Owner</th></tr>
              </thead>
              <tbody>
                {queue.map(p => (
                  <tr key={p.id} className="row-link" onClick={() => go({ view: "problems", detailId: p.id, tab: "tickets" })}>
                    <td>
                      <span className={`indicator ${PRIO_LABELS[p.priority].tone}`}/>
                      <span className="ttl">{p.title.slice(0, 50)}</span>
                    </td>
                    <td className="num"><strong>{p.untriaged}</strong></td>
                    <td><Delta value={p.untriagedDelta}/></td>
                    <td>{p.owner ? <Avatar user={p.owner} size="sm"/> : <span className="bdg bdg-mute">не назначен</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ height: 14 }}/>

        <div className="grid-3">
          {/* Tickets-without-bug */}
          <div className="card">
            <div className="card-hd">
              <div className="ttl">
                <Icons.alert/>Обращения без бага
                <span className="lbl">{totalNoBug} / 7d</span>
              </div>
            </div>
            <div className="card-bd col" style={{ gap: 8 }}>
              {noBugLeaders.map(p => (
                <div key={p.id} className="row" style={{ padding: "4px 0" }}>
                  <span className={`indicator ${SEV_LABELS[p.severity].tone}`}/>
                  <span className="grow" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title.slice(0, 44)}
                  </span>
                  <strong style={{ font: "500 12px var(--mono)" }}>{p.ticketsNoBug}</strong>
                  <Delta value={p.ticketsDelta}/>
                </div>
              ))}
              <div className="divider"/>
              <div className="row faint" style={{ fontSize: 12 }}>
                <Icons.ai/><span>AI предлагает 3 потенциальных бага</span>
              </div>
            </div>
          </div>

          {/* SLA / breach */}
          <div className="card">
            <div className="card-hd">
              <div className="ttl"><Icons.shield/>SLA здоровье<span className="lbl">7 дней</span></div>
            </div>
            <div className="card-bd">
              <div className="row" style={{ alignItems: "baseline" }}>
                <div className="stat" style={{ padding: 0 }}>
                  <div className="v" style={{ fontSize: 32 }}>87%</div>
                  <div className="delta down invert"><span className="arrow">▼</span>−4%</div>
                </div>
                <div className="grow"/>
                <div style={{ textAlign: "right" }}>
                  <div className="faint" style={{ font: "500 10px var(--mono)", textTransform: "uppercase", letterSpacing: ".08em" }}>В рисках</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "var(--high)" }}>{sumBy(total, p => p.slaBreach)}</div>
                </div>
              </div>
              <div className="divider"/>
              <div className="col" style={{ gap: 6 }}>
                {total.filter(p => p.slaBreach > 0).slice(0, 4).map(p => (
                  <div key={p.id} className="row" style={{ fontSize: 12 }}>
                    <span className="grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title.slice(0,38)}</span>
                    <Badge tone="critical">{p.slaBreach} breach</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* By product */}
          <div className="card">
            <div className="card-hd">
              <div className="ttl"><Icons.product/>По продуктам<span className="lbl">7 дней</span></div>
            </div>
            <div className="card-bd col" style={{ gap: 10 }}>
              {PRODUCTS.map(prod => {
                const ps = total.filter(p => p.products.includes(prod));
                const cnt = sumBy(ps, p => p.tickets);
                const max = Math.max(1, ...PRODUCTS.map(pp => sumBy(total.filter(p=>p.products.includes(pp)), p=>p.tickets)));
                return (
                  <div key={prod}>
                    <div className="row" style={{ marginBottom: 4 }}>
                      <span className="grow" style={{ fontSize: 12.5 }}>{prod}</span>
                      <span style={{ font: "500 12px var(--mono)" }}>{cnt.toLocaleString("ru-RU")}</span>
                      <span className="faint" style={{ fontSize: 11 }}>· {ps.length} probl.</span>
                    </div>
                    <div className="bar" style={{ width: "100%" }}>
                      <span style={{ width: `${(cnt/max)*100}%` }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ height: 14 }}/>

        {/* Activity heatmap + by team */}
        <div className="grid-2">
          <div className="card">
            <div className="card-hd">
              <div className="ttl"><Icons.spark/>Поток обращений<span className="lbl">7д × 4ч</span></div>
              <div className="row faint" style={{ fontSize: 11 }}>
                Меньше
                <span className="row" style={{ gap: 2 }}>
                  {[0,1,2,3,4].map(l => <span key={l} className={`heat`} style={{display:"inline-block"}}><span className={`cell l${l}`} style={{ display:"inline-block", width:10, height:10, borderRadius:2 }}/></span>)}
                </span>
                Больше
              </div>
            </div>
            <div className="card-bd">
              <div className="heat">
                {heat.map((l, i) => <div key={i} className={`cell l${l}`}/>)}
              </div>
              <div className="row faint" style={{ fontSize: 11, marginTop: 8, justifyContent: "space-between" }}>
                <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <div className="ttl"><Icons.team/>Нагрузка по командам</div>
            </div>
            <div className="card-bd col" style={{ gap: 10 }}>
              {[
                { team: "Payments", load: 0.92, prob: 1, bugs: 3, owner: "u4" },
                { team: "Mobile Core", load: 0.78, prob: 2, bugs: 4, owner: "u1" },
                { team: "Document Hub", load: 0.61, prob: 2, bugs: 2, owner: "u2" },
                { team: "Auth & Identity", load: 0.55, prob: 1, bugs: 1, owner: "u5" },
                { team: "Web Platform", load: 0.42, prob: 1, bugs: 1, owner: "u2" },
              ].map(t => (
                <div key={t.team} className="row" style={{ alignItems: "center" }}>
                  <span style={{ width: 130, fontSize: 12.5 }}>{t.team}</span>
                  <div className="bar grow"><span style={{ width: `${t.load*100}%`, background: t.load>0.85?"var(--critical)":t.load>0.7?"var(--high)":"var(--accent)" }}/></div>
                  <span className="faint" style={{ font: "500 11px var(--mono)", width: 50, textAlign: "right" }}>{t.prob}p · {t.bugs}b</span>
                  <Avatar user={t.owner} size="sm"/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ label, value, delta, sub, spark, critical }) => (
  <div className="card">
    <div className="card-bd" style={{ padding: 0 }}>
      <div className="stat">
        <div className="lbl">{label}</div>
        <div className="row" style={{ alignItems: "flex-end", gap: 12 }}>
          <div className="v">{value}</div>
          <div className="grow"/>
          {spark && <Sparkline data={spark} w={84} h={28} accent={critical?"var(--critical)":undefined}/>}
        </div>
        <div className="row" style={{ marginTop: 2 }}>
          <Delta value={delta}/>
          <span className="faint" style={{ fontSize: 11.5 }}>· {sub}</span>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { Dashboard });
