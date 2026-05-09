/* VECTOR — bugs + tickets mock */

const BUGS = [
  {
    id: "BUG-9182", problemId: "PRB-218", title: "3DS callback теряется при возврате из ACS",
    status: "in-progress", severity: "critical", priority: "P0",
    team: "Payments", owner: "u4", jira: "PAY-3318",
    workaround: "Попросить клиента переоткрыть приложение и нажать «Проверить статус оплаты» через 60 сек.",
    rootCause: "Race condition между ACS callback и polling-эндпоинтом /payments/state.",
    recommendation: "Не выпускать новый платёж до проверки статуса; помочь восстановить полис, если деньги списаны.",
    fixDate: null, environments: ["prod"], tickets: 612,
    created: "2026-04-29",
  },
  {
    id: "BUG-9170", problemId: "PRB-218", title: "Платёжный спиннер не отваливается по таймауту",
    status: "review", severity: "high", priority: "P1",
    team: "Mobile Core", owner: "u1", jira: "MOB-7741",
    workaround: "Принудительный таймаут 90 сек добавлен в hotfix 5.18.4 (на ревью).",
    rootCause: "Нет обработчика onTimeout в PaymentProgressViewModel.",
    recommendation: "Сообщить клиенту, что после 90 сек спиннера можно безопасно перезайти.",
    fixDate: null, environments: ["prod","staging"], tickets: 287,
    created: "2026-04-30",
  },
  {
    id: "BUG-9163", problemId: "PRB-218", title: "ACS-домен заблокирован у части ISP",
    status: "blocked", severity: "high", priority: "P1",
    team: "Payments", owner: "u4", jira: "PAY-3322",
    workaround: "Перевыпустить ссылку на 3DS через support tools.",
    rootCause: "Часть ISP блокирует acs.partner.example как фишинг.",
    recommendation: "Эскалировать партнёру; предложить альтернативный способ оплаты.",
    fixDate: null, environments: ["prod"], tickets: 207,
    created: "2026-05-02",
  },
  {
    id: "BUG-9051", problemId: "PRB-204", title: "FCM token не обновляется на Android 14",
    status: "in-progress", severity: "high", priority: "P1",
    team: "Mobile Core", owner: "u1", jira: "MOB-7689",
    workaround: "Попросить клиента переустановить приложение или включить уведомления заново.",
    rootCause: "Изменение поведения FirebaseMessaging.getToken() на Android 14.",
    recommendation: "Исправляется в 5.18.5; вручную обновлять токен через support tools.",
    fixDate: "2026-05-12", environments: ["prod"], tickets: 312,
    created: "2026-04-22",
  },
  {
    id: "BUG-9047", problemId: "PRB-204", title: "Notification channel удаляется при апдейте",
    status: "fixed", severity: "medium", priority: "P2",
    team: "Mobile Core", owner: "u1", jira: "MOB-7691",
    workaround: "Переоткрыть приложение, чтобы канал создался заново.",
    rootCause: "Миграция на новый channel_id без сохранения настроек.",
    recommendation: "Уже исправлено в 5.18.4.",
    fixDate: "2026-05-04", environments: ["prod"], tickets: 72,
    created: "2026-04-23",
  },
  {
    id: "BUG-8990", problemId: "PRB-197", title: "document-service возвращает 500 при PDF > 4 МБ",
    status: "in-progress", severity: "high", priority: "P1",
    team: "Document Hub", owner: "u2", jira: "DOC-1129",
    workaround: "Запросить у саппорта e-mail c PDF.",
    rootCause: "OOM в pdf-generator на крупных шаблонах КАСКО.",
    recommendation: "Эскалация: пока не пофикшено, отправлять полис вручную.",
    fixDate: null, environments: ["prod"], tickets: 254,
    created: "2026-04-19",
  },
  {
    id: "BUG-8902", problemId: "PRB-186", title: "Identity service не инвалидирует старый токен после смены номера",
    status: "blocked", severity: "high", priority: "P1",
    team: "Auth & Identity", owner: "u5", jira: "AUTH-441",
    workaround: "Force logout через support tools, после этого пускает.",
    rootCause: "Кэш сессий по старому номеру, TTL 24ч.",
    recommendation: "Force logout — стандартный обход. Исправляется в Q2.",
    fixDate: null, environments: ["prod"], tickets: 278,
    created: "2026-04-11",
  },
  {
    id: "BUG-8770", problemId: "PRB-172", title: "Geo-фильтр клиник не учитывает регион Казань",
    status: "fixed", severity: "medium", priority: "P2",
    team: "Mobile Core", owner: "u8", jira: "MOB-7510",
    workaround: "Сменить регион на «Татарстан» вручную.",
    rootCause: "Опечатка в маппинге region code KZN → 16.",
    recommendation: "Уже исправлено в 5.18.5 (релиз 06.05).",
    fixDate: "2026-05-06", environments: ["prod"], tickets: 92,
    created: "2026-03-28",
  },
  {
    id: "BUG-8650", problemId: "PRB-165", title: "/policies/list O(N) запрос к user-service",
    status: "in-progress", severity: "high", priority: "P1",
    team: "Web Platform", owner: "u2", jira: "WEB-2204",
    workaround: "Корпоративные клиенты — выгрузка списка через support tools.",
    rootCause: "N+1 запросов в user-service на каждый полис.",
    recommendation: "Переход на batch endpoint, ETA 14.05.",
    fixDate: "2026-05-14", environments: ["prod","staging"], tickets: 64,
    created: "2026-03-21",
  },
  {
    id: "BUG-8412", problemId: "PRB-154", title: "Migration job дублирует строки страховых случаев",
    status: "fixed", severity: "low", priority: "P3",
    team: "Analytics", owner: "u6", jira: "AN-118",
    workaround: "Игнорировать дубликаты с одинаковым case_id.",
    rootCause: "Idempotency key не использовался при ретраях.",
    recommendation: "Дедупликация раскатана; данные подчистятся в течение 24ч.",
    fixDate: "2026-05-01", environments: ["prod"], tickets: 41,
    created: "2026-03-13",
  },
  {
    id: "BUG-8208", problemId: "PRB-140", title: "Upload service отвергает файлы > 8 МБ без ошибки",
    status: "review", severity: "low", priority: "P3",
    team: "Document Hub", owner: "u7", jira: "DOC-1078",
    workaround: "Рекомендовать сжать файл или отправить по e-mail.",
    rootCause: "Лимит nginx 8M, нет 413-ответа клиенту.",
    recommendation: "Поднять лимит до 25 МБ, добавить понятную ошибку.",
    fixDate: null, environments: ["prod"], tickets: 28,
    created: "2026-02-29",
  },
];

const TICKET_TEXTS = [
  "Не могу оплатить полис — после ввода кода висит загрузка минут пять, потом просто экран белый. Деньги списались.",
  "Здравствуйте! Не приходят пуши о статусе обращения, хотя в настройках всё включено.",
  "При попытке скачать полис КАСКО получаю ошибку. Делал это вчера — всё работало.",
  "Сменил номер вчера, сегодня не могу зайти. Пишет неверный код, хотя код приходит.",
  "Хочу оформить НС. На прошлый год была скидка как постоянному клиенту, в этом году не применяется.",
  "В мобильном приложении нет ни одной клиники в Казани, в личном кабинете показывает.",
  "Корпоративный аккаунт — список полисов вообще не открывается, бесконечная загрузка.",
  "В истории два одинаковых страховых случая с одной и той же датой.",
  "Пытаюсь оформить ОСАГО на BYD — пишет неверный VIN, хотя VIN правильный.",
  "Не могу прикрепить скан паспорта (12 МБ) к обращению — выдаёт ошибку.",
];

const TICKETS = [];
let ticketCounter = 482100;
const ticketSeed = seed(99);

PROBLEMS.forEach((p, pi) => {
  const cnt = Math.min(40, Math.max(8, Math.round(p.tickets / 25)));
  for (let i = 0; i < cnt; i++) {
    const noBug = i < Math.round(cnt * (p.ticketsNoBug / Math.max(1, p.tickets)) * 5);
    const bug = !noBug && p.bugs > 0
      ? BUGS.filter(b => b.problemId === p.id)[i % Math.max(1, BUGS.filter(b => b.problemId === p.id).length)]
      : null;
    TICKETS.push({
      id: `T-${ticketCounter++}`,
      problemId: p.id,
      bugId: bug ? bug.id : null,
      userId: `client-${100000 + Math.floor(ticketSeed()*900000)}`,
      product: p.products[i % p.products.length],
      platform: p.platforms[i % p.platforms.length],
      summary: TICKET_TEXTS[pi % TICKET_TEXTS.length].slice(0, 90),
      text: TICKET_TEXTS[pi % TICKET_TEXTS.length],
      created: `2026-05-0${(i % 8) + 1}T${String(8 + (i%10)).padStart(2,'0')}:${String((i*7)%60).padStart(2,'0')}`,
      status: bug ? (i%5===0 ? "answered" : "linked") : (i%3===0 ? "new" : (i%3===1 ? "researching" : "duplicate")),
      region: REGIONS[i % REGIONS.length],
      channel: CHANNELS[i % CHANNELS.length],
      flags: {
        isNew:        !bug && (i%3===0),
        needsResearch:!bug && (i%3===1),
        confirmedBug: !!bug,
        duplicate:    !bug && (i%3===2),
      },
      attachments: (i % 4 === 0) ? ["screenshot_01.png","logs.txt"] : (i % 7 === 0 ? ["video.mp4"] : []),
    });
  }
});

const TICKET_STATUS = {
  new:         { label: "Новый",        tone: "info" },
  researching: { label: "Ресерч",       tone: "high" },
  linked:      { label: "Привязан",     tone: "ok" },
  answered:    { label: "Отвечен",      tone: "ok" },
  duplicate:   { label: "Дубль",        tone: "mute" },
};

Object.assign(window, { BUGS, TICKETS, TICKET_STATUS });
