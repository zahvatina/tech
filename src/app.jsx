/* VECTOR — App entry, route state, tweaks panel wiring */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "density": "regular",
  "accentHue": 78,
  "showAi": true,
  "showShortcuts": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState({ view: "dashboard", detailId: null, tab: null, focus: null });
  const [cmdOpen, setCmdOpen] = React.useState(false);

  const go = React.useCallback((next) => {
    setRoute(r => ({ ...r, ...next, tab: next.tab !== undefined ? next.tab : null, focus: next.focus !== undefined ? next.focus : null }));
  }, []);

  // keyboard shortcuts
  React.useEffect(() => {
    const handler = (e) => {
      const inField = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA");
      if (!inField) {
        if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setCmdOpen(true); return; }
        if (e.key === "/") { e.preventDefault(); setCmdOpen(true); return; }
        if (e.key === "Escape") { setCmdOpen(false); }
        if (e.key === "g" || e.key === "G") { window.__lastG = Date.now(); return; }
        const recent = window.__lastG && (Date.now() - window.__lastG < 1200);
        if (recent) {
          if (e.key === "d") { go({ view: "dashboard", detailId: null }); window.__lastG = 0; }
          if (e.key === "p") { go({ view: "problems", detailId: null }); window.__lastG = 0; }
          if (e.key === "t") { go({ view: "triage", detailId: null }); window.__lastG = 0; }
          if (e.key === "b") { go({ view: "bugs", detailId: null }); window.__lastG = 0; }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go]);

  // apply theme/density
  React.useEffect(() => {
    document.documentElement.dataset.theme = t.theme;
    document.documentElement.dataset.density = t.density;
    document.documentElement.style.setProperty("--accent-h", String(t.accentHue));
  }, [t]);

  let content;
  if (route.view === "dashboard") content = <Dashboard go={go}/>;
  else if (route.view === "problems") content = route.detailId
    ? <ProblemDetail problemId={route.detailId} route={route} go={go}/>
    : <ProblemList go={go}/>;
  else if (route.view === "triage") content = <Triage go={go}/>;
  else if (route.view === "bugs") content = <BugsList go={go}/>;
  else if (route.view === "tickets") content = <TicketsList go={go}/>;
  else content = <Stub title={route.view} sub="Скелет раздела"/>;

  return (
    <div className="app">
      <Sidebar route={route} go={go} openCmd={() => setCmdOpen(true)}/>
      <div className="main">
        <Topbar route={route} go={go} openCmd={() => setCmdOpen(true)}/>
        {content}
      </div>
      <CmdPalette open={cmdOpen} onClose={() => setCmdOpen(false)} go={go}/>

      <TweaksPanel>
        <TweakSection label="Внешний вид" />
        <TweakRadio  label="Тема" value={t.theme}
                     options={["dark","light"]}
                     onChange={(v) => setTweak("theme", v)} />
        <TweakRadio  label="Плотность" value={t.density}
                     options={["compact","regular","comfy"]}
                     onChange={(v) => setTweak("density", v)} />
        <TweakSlider label="Акцент (hue)" value={t.accentHue} min={20} max={320} step={5}
                     onChange={(v) => setTweak("accentHue", v)} />
        <TweakSection label="Поведение" />
        <TweakToggle label="Показывать AI-подсказки" value={t.showAi}
                     onChange={(v) => setTweak("showAi", v)} />
        <TweakToggle label="Хинты горячих клавиш" value={t.showShortcuts}
                     onChange={(v) => setTweak("showShortcuts", v)} />
        <TweakSection label="Навигация" />
        <TweakButton label="Открыть Triage queue" onClick={() => go({ view: "triage", detailId: null })}>→</TweakButton>
        <TweakButton label="Открыть PRB-218" onClick={() => go({ view: "problems", detailId: "PRB-218" })}>→</TweakButton>
        <TweakButton label="Открыть Cmd palette" onClick={() => setCmdOpen(true)}>⌘K</TweakButton>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
