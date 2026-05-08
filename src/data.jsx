/* VECTOR — mock data for prototype */

const USERS = [
  { id: "u1", name: "Анна Котова",     init: "АК", color: "oklch(0.78 0.16 80)" },
  { id: "u2", name: "Дмитрий Орлов",   init: "ДО", color: "oklch(0.75 0.14 220)" },
  { id: "u3", name: "Мария Зайцева",   init: "МЗ", color: "oklch(0.78 0.14 150)" },
  { id: "u4", name: "Илья Громов",     init: "ИГ", color: "oklch(0.72 0.18 25)" },
  { id: "u5", name: "Ольга Петрова",   init: "ОП", color: "oklch(0.78 0.10 270)" },
  { id: "u6", name: "Сергей Белов",    init: "СБ", color: "oklch(0.78 0.16 50)" },
  { id: "u7", name: "Никита Волков",   init: "НВ", color: "oklch(0.78 0.10 200)" },
  { id: "u8", name: "Елена Соколова",  init: "ЕС", color: "oklch(0.78 0.16 95)" },
];
const userById = (id) => USERS.find(u => u.id === id);

const PRODUCTS = ["ОСАГО", "КАСКО", "НС", "ДМС"];
const PLATFORMS = ["mobile", "lk-web", "web", "backend"];
const REGIONS = ["MSK", "SPB", "EKB", "NSK", "KZN", "RND", "VLG", "CHE"];
const CHANNELS = ["chat", "phone", "email", "social", "in-app"];

const TEAMS = [
  "Mobile Core", "Web Platform", "Payments", "Auth & Identity",
  "Policy Service", "Document Hub", "Analytics", "Notifications",
];

// helpers for sparklines + heat
const seed = (s) => { let x = s; return () => (x = (x*9301+49297) % 233280) / 233280; };
const series = (n, base, vol, rnd) => {
  const a = []; let v = base;
  for (let i = 0; i < n; i++) { v += (rnd()-0.5)*vol; v = Math.max(0, v); a.push(Math.round(v)); }
  return a;
};

const PROBLEMS = [
  {
    id: "PRB-218", key: "PRB-218",
    title: "Оплата полиса ОСАГО зависает на шаге 3DS",
    desc: "После ввода 3DS-кода клиент видит спиннер, статус не обновляется. Полис не выпускается, деньги списываются у части пользователей.",
    status: "investigating", priority: "P0", severity: "critical",
    owner: "u4", products: ["ОСАГО"], platforms: ["mobile","web"],
    created: "2026-04-28", lastUpdate: "2026-05-08T09:14",
    tickets: 1248, ticketsDelta: 0.34,
    untriaged: 86, untriagedDelta: -0.12,
    bugs: 3, ticketsNoBug: 142,
    trend: series(28, 30, 8, seed(1)),
    untriagedTrend: series(28, 8, 4, seed(2)),
    sla: 0.62, slaBreach: 4,
    tags: ["payments","3ds","ios","android"],
  },
  {
    id: "PRB-204", key: "PRB-204",
    title: "Не приходят push-уведомления о статусе обращения (Android 14+)",
    desc: "Клиенты не получают пуши о смене статуса. Воспроизводится после установки обновления приложения 5.18.x на Android 14/15.",
    status: "in-progress", priority: "P1", severity: "high",
    owner: "u1", products: ["ОСАГО","КАСКО","ДМС"], platforms: ["mobile"],
    created: "2026-04-21", lastUpdate: "2026-05-07T18:02",
    tickets: 412, ticketsDelta: 0.18,
    untriaged: 22, untriagedDelta: 0.05,
    bugs: 2, ticketsNoBug: 28,
    trend: series(28, 12, 4, seed(3)),
    untriagedTrend: series(28, 3, 2, seed(4)),
    sla: 0.81, slaBreach: 1,
    tags: ["push","fcm","android"],
  },
  {
    id: "PRB-197", key: "PRB-197",
    title: "Документы КАСКО не открываются в личном кабинете",
    desc: "При попытке открыть PDF полиса КАСКО получается 500 от document-service.",
    status: "in-progress", priority: "P1", severity: "high",
    owner: "u2", products: ["КАСКО"], platforms: ["lk-web","mobile"],
    created: "2026-04-18", lastUpdate: "2026-05-08T07:40",
    tickets: 318, ticketsDelta: 0.42,
    untriaged: 41, untriagedDelta: 0.28,
    bugs: 1, ticketsNoBug: 64,
    trend: series(28, 9, 5, seed(5)),
    untriagedTrend: series(28, 5, 2, seed(6)),
    sla: 0.72, slaBreach: 2,
    tags: ["pdf","document-hub","backend"],
  },
  {
    id: "PRB-186", key: "PRB-186",
    title: "Ошибка авторизации по СМС после смены номера",
    desc: "Если пользователь сменил номер телефона за последние 24 часа, повторная авторизация падает с 401.",
    status: "blocked", priority: "P1", severity: "high",
    owner: "u5", products: ["ОСАГО","КАСКО","НС","ДМС"], platforms: ["mobile","lk-web"],
    created: "2026-04-10", lastUpdate: "2026-05-06T12:11",
    tickets: 287, ticketsDelta: -0.08,
    untriaged: 12, untriagedDelta: -0.4,
    bugs: 1, ticketsNoBug: 9,
    trend: series(28, 11, 4, seed(7)),
    untriagedTrend: series(28, 2, 1, seed(8)),
    sla: 0.91, slaBreach: 0,
    tags: ["auth","sms","identity"],
  },
  {
    id: "PRB-179", key: "PRB-179",
    title: "Расчёт стоимости НС не учитывает скидку постоянного клиента",
    desc: "При расчёте полиса НС не применяется скидка для клиентов с историей > 2 лет.",
    status: "triage", priority: "P2", severity: "medium",
    owner: "u3", products: ["НС"], platforms: ["mobile","web","lk-web"],
    created: "2026-04-02", lastUpdate: "2026-05-05T09:00",
    tickets: 154, ticketsDelta: 0.12,
    untriaged: 38, untriagedDelta: 0.55,
    bugs: 0, ticketsNoBug: 154,
    trend: series(28, 5, 3, seed(9)),
    untriagedTrend: series(28, 2, 2, seed(10)),
    sla: 0.95, slaBreach: 0,
    tags: ["pricing","ns","new"],
  },
  {
    id: "PRB-172", key: "PRB-172",
    title: "ДМС: не отображается список клиник в Казани",
    desc: "В мобильном приложении после релиза 5.18 список клиник для региона Казань пустой.",
    status: "in-progress", priority: "P2", severity: "medium",
    owner: "u8", products: ["ДМС"], platforms: ["mobile"],
    created: "2026-03-27", lastUpdate: "2026-05-04T15:32",
    tickets: 96, ticketsDelta: -0.05,
    untriaged: 4, untriagedDelta: -0.5,
    bugs: 1, ticketsNoBug: 6,
    trend: series(28, 3, 2, seed(11)),
    untriagedTrend: series(28, 1, 1, seed(12)),
    sla: 0.97, slaBreach: 0,
    tags: ["clinics","kzn","mobile"],
  },
  {
    id: "PRB-165", key: "PRB-165",
    title: "Backend API возвращает 504 на /policies/list при > 100 полисах",
    desc: "Корпоративные клиенты с большим числом полисов получают тайм-аут.",
    status: "in-progress", priority: "P1", severity: "high",
    owner: "u2", products: ["ОСАГО","КАСКО"], platforms: ["backend","lk-web"],
    created: "2026-03-20", lastUpdate: "2026-05-07T22:10",
    tickets: 73, ticketsDelta: 0.22,
    untriaged: 6, untriagedDelta: 0.0,
    bugs: 2, ticketsNoBug: 4,
    trend: series(28, 2, 2, seed(13)),
    untriagedTrend: series(28, 1, 1, seed(14)),
    sla: 0.83, slaBreach: 1,
    tags: ["backend","timeout","api"],
  },
  {
    id: "PRB-154", key: "PRB-154",
    title: "Дубль страховых случаев в истории клиента",
    desc: "В истории отображаются дублирующиеся записи о страховых случаях после миграции данных.",
    status: "watching", priority: "P3", severity: "low",
    owner: "u6", products: ["КАСКО","НС"], platforms: ["lk-web"],
    created: "2026-03-12", lastUpdate: "2026-05-01T10:00",
    tickets: 42, ticketsDelta: -0.18,
    untriaged: 2, untriagedDelta: -0.6,
    bugs: 1, ticketsNoBug: 1,
    trend: series(28, 1, 1, seed(15)),
    untriagedTrend: series(28, 0, 1, seed(16)),
    sla: 0.99, slaBreach: 0,
    tags: ["data","migration"],
  },
  {
    id: "PRB-148", key: "PRB-148",
    title: "Ошибка \"Invalid VIN\" при оформлении ОСАГО для редких марок",
    desc: "Для VIN некоторых китайских и корейских моделей валидатор возвращает ошибку.",
    status: "triage", priority: "P2", severity: "medium",
    owner: null, products: ["ОСАГО"], platforms: ["mobile","web"],
    created: "2026-03-05", lastUpdate: "2026-05-08T08:21",
    tickets: 211, ticketsDelta: 0.61,
    untriaged: 198, untriagedDelta: 0.74,
    bugs: 0, ticketsNoBug: 211,
    trend: series(28, 6, 3, seed(17)),
    untriagedTrend: series(28, 5, 4, seed(18)),
    sla: 0.78, slaBreach: 0,
    tags: ["vin","validation","new"],
  },
  {
    id: "PRB-140", key: "PRB-140",
    title: "Не сохраняется вложение к обращению > 8 МБ",
    desc: "Файлы крупнее 8 МБ не загружаются и не возвращают понятную ошибку.",
    status: "watching", priority: "P3", severity: "low",
    owner: "u7", products: ["ОСАГО","КАСКО","НС","ДМС"], platforms: ["lk-web","web"],
    created: "2026-02-28", lastUpdate: "2026-04-30T16:45",
    tickets: 28, ticketsDelta: 0.0,
    untriaged: 1, untriagedDelta: 0.0,
    bugs: 1, ticketsNoBug: 0,
    trend: series(28, 1, 1, seed(19)),
    untriagedTrend: series(28, 0, 1, seed(20)),
    sla: 0.99, slaBreach: 0,
    tags: ["upload","limits"],
  },
];

const STATUS_LABELS = {
  triage: { label: "Triage", tone: "info" },
  investigating: { label: "Investigating", tone: "critical" },
  "in-progress": { label: "In progress", tone: "high" },
  blocked: { label: "Blocked", tone: "critical" },
  watching: { label: "Watching", tone: "mute" },
  resolved: { label: "Resolved", tone: "ok" },
};
const SEV_LABELS = {
  critical: { label: "Critical", tone: "critical" },
  high:     { label: "High",     tone: "high" },
  medium:   { label: "Medium",   tone: "med" },
  low:      { label: "Low",      tone: "low" },
};
const PRIO_LABELS = {
  P0: { label: "P0", tone: "critical" },
  P1: { label: "P1", tone: "high" },
  P2: { label: "P2", tone: "med" },
  P3: { label: "P3", tone: "low" },
};

Object.assign(window, {
  USERS, userById, PRODUCTS, PLATFORMS, REGIONS, CHANNELS, TEAMS,
  PROBLEMS, STATUS_LABELS, SEV_LABELS, PRIO_LABELS, series, seed,
});
