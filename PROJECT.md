# VECTOR — Система управления проблемами поддержки

## Содержание
1. [Назначение системы](#1-назначение-системы)
2. [Архитектура](#2-архитектура)
3. [Технологический стек](#3-технологический-стек)
4. [База данных](#4-база-данных)
5. [Ключевые сущности и их жизненные циклы](#5-ключевые-сущности-и-их-жизненные-циклы)
6. [Очереди и пользовательские пути](#6-очереди-и-пользовательские-пути)
7. [API бэкенда](#7-api-бэкенда)
8. [Фронтенд](#8-фронтенд)
9. [Тесты](#9-тесты)
10. [Локальный запуск](#10-локальный-запуск)
11. [Конфигурация](#11-конфигурация)
12. [Спецификация](#12-спецификация)

---

## 1. Назначение системы

**VECTOR** (также называется **RMO** — Responsibility Management Operations) — внутренний инструмент службы поддержки страховой компании. Задача системы — сократить время ответа клиентам и упорядочить взаимодействие между операторами поддержки и командами разработки.

### Основные роли

| Роль | Что делает в системе |
|---|---|
| **Оператор** | Разбирает входящие тикеты через очереди, привязывает к проблемам и задачам, отправляет рекомендации клиентам |
| **Команда разработки** | Получает уведомления о новых проблемах, подтверждает/отклоняет черновики задач от операторов, исследует баги |
| **Triage-лид** | Контролирует дашборд, расставляет приоритеты, следит за нарушениями SLA |

### Ключевые концепции

- **Тикет** — входящее обращение клиента (жалоба, вопрос, проблема с продуктом)
- **Проблема** — кластер однотипных тикетов (технический корень: баг, UI-долг, сбой)
- **Задача/Баг** — конкретный технический дефект внутри проблемы; связывается с Jira
- **Очередь** — рабочий инструмент оператора: позиции в очереди ждут обработки

---

## 2. Архитектура

```
┌──────────────────────────────────────────────────────┐
│               Браузер (SPA, без сборки)              │
│  index.html + JSX через Babel Standalone + React 18  │
│  Клиентский роутинг: route = { view, detailId, tab } │
└─────────────────────────┬────────────────────────────┘
                          │ HTTP REST + X-API-Key
                          ▼
┌──────────────────────────────────────────────────────┐
│             FastAPI (Python 3.12, asyncio)            │
│  /api/v1/*  — все эндпоинты через единый роутер      │
│  SQLAlchemy async + asyncpg (raw SQL, без ORM)        │
└─────────────────────────┬────────────────────────────┘
                          │ asyncpg / TCP
                          ▼
┌──────────────────────────────────────────────────────┐
│          PostgreSQL 16 + pgvector (Docker)            │
│  Схема: 18 таблиц, triggers для short_id и SLA       │
└──────────────────────────────────────────────────────┘
```

### Файловая структура

```
tech/
├── PROJECT.md                   ← этот документ
├── src/
│   ├── index.html               ← точка входа (загружает JSX-скрипты)
│   ├── tokens.css               ← дизайн-система: переменные, компоненты CSS
│   │
│   ├── api.jsx                  ← HTTP-клиент: API.tickets/problems/tasks/...
│   ├── app.jsx                  ← роутер, горячие клавиши, TweaksPanel
│   ├── shell.jsx                ← Sidebar, Topbar, CmdPalette (⌘K)
│   ├── ui.jsx                   ← атомарные компоненты: Icons, Badge, Btn, Avatar...
│   │
│   ├── data.jsx                 ← mock-данные: USERS, PROBLEMS, TEAMS
│   ├── data-bugs-tickets.jsx    ← mock-данные: BUGS, TICKETS, TICKET_STATUS
│   │
│   ├── dashboard.jsx            ← экран Dashboard
│   ├── problems-list.jsx        ← экран Problems (таблица + фильтры)
│   ├── problem-detail.jsx       ← экран Problem Detail + RmoSpace
│   ├── triage-and-lists.jsx     ← Triage queue, BugsList, TicketsList
│   ├── tweaks-panel.jsx         ← dev-панель (тема, плотность, акцент)
│   │
│   ├── backend/
│   │   ├── app/
│   │   │   ├── main.py          ← FastAPI app, CORS, /health
│   │   │   ├── core/
│   │   │   │   ├── config.py    ← Settings (env/pydantic-settings)
│   │   │   │   └── database.py  ← async_session_factory (SQLAlchemy)
│   │   │   ├── api/
│   │   │   │   ├── deps.py      ← get_db, require_api_key
│   │   │   │   └── v1/
│   │   │   │       ├── router.py       ← регистрация всех роутеров
│   │   │   │       ├── problems.py     ← /problems/*
│   │   │   │       ├── tasks.py        ← /tasks/*
│   │   │   │       ├── tickets.py      ← /tickets/*
│   │   │   │       ├── queues.py       ← /queues/*
│   │   │   │       ├── notifications.py← /notifications/*
│   │   │   │       ├── dashboard.py    ← /dashboard/*
│   │   │   │       ├── analytics.py    ← /analytics/*
│   │   │   │       ├── search.py       ← /search
│   │   │   │       └── meta.py         ← /products, /teams, /users
│   │   │   ├── mapping.py       ← DB enum ↔ UI label конвертеры
│   │   │   ├── schemas/         ← Pydantic-модели для request body
│   │   │   └── services/
│   │   │       ├── resolve.py   ← UUID/short_id resolver
│   │   │       └── problem_rows.py ← построитель dict из DB-row
│   │   └── tests/               ← юнит-тесты (httpx + mock DB)
│   └── db/
│       └── init/
│           ├── 01_schema.sql    ← DDL: 18 таблиц, индексы, триггеры
│           └── 02_seed.sql      ← начальные данные
│
├── docker-compose.yml           ← PostgreSQL 16 + pgvector
└── vercel.json                  ← деплой фронтенда на Vercel
```

---

## 3. Технологический стек

### Фронтенд

| | |
|---|---|
| **React 18** | UMD-сборка, без Webpack/Vite — JSX компилируется в браузере через Babel Standalone |
| **Babel Standalone 7** | Трансформация JSX в runtime — только для прототипа, не для продакшена |
| **CSS** | `tokens.css` — кастомные CSS-переменные (`--accent`, `--critical`, `--ok`, ...), без CSS-фреймворков |
| **Шрифты** | Geist + Geist Mono (Google Fonts) |
| **Роутинг** | Клиентский state-роутинг без URL (`route = { view, detailId, tab, focus }`) |

### Бэкенд

| | |
|---|---|
| **FastAPI** | `>=0.115` — async routes, dependency injection, OpenAPI из коробки |
| **SQLAlchemy** | `>=2.0` asyncio + asyncpg — только `text()` запросы, без ORM-маппинга |
| **asyncpg** | Нативный async-драйвер PostgreSQL; не поддерживает `::type` cast синтаксис — используется `CAST(:param AS type)` |
| **Pydantic v2** | Валидация request body; `pydantic-settings` для конфигурации из `.env` |
| **python-multipart** | Обязателен для `UploadFile` + `Form` в FastAPI |

### База данных

| | |
|---|---|
| **PostgreSQL 16** | Основная СУБД |
| **pgvector** | Расширение для хранения и поиска эмбеддингов (семантический поиск тикетов) |
| **Docker** | `pgvector/pgvector:pg16` образ через docker-compose |

### Тесты

| | |
|---|---|
| **pytest + pytest-asyncio** | `asyncio_mode = auto` |
| **httpx + ASGITransport** | Тестирование FastAPI без реального сервера |
| **unittest.mock** | `AsyncMock` для SQLAlchemy сессий; `FakeResult` имитирует `CursorResult` |

---

## 4. База данных

### Таблицы

| Таблица | Назначение |
|---|---|
| `problems` | Проблемы — кластеры тикетов. Содержит счётчики (tickets_count, unresearched_count), SLA-поля, short_id (PRB-N) |
| `tasks` | Задачи/баги внутри проблемы. Статусная машина (draft→pending_confirmation→open→...). short_id: BUG-N |
| `support_tickets` | Входящие обращения клиентов. short_id: TKT-N. Связь с problem_id и task_id |
| `queues` | Справочник очередей (problem_determination, task_determination, ...) |
| `queue_items` | Позиции в очередях — тикеты, ожидающие обработки оператором |
| `comments` | Комментарии к любой сущности через `entity_type` + `entity_id` (problems, tasks, tickets) |
| `attachments` | Вложения к тикетам (логи, скриншоты). Файл на диске, метаданные в таблице |
| `notifications` | Уведомления для пользователей и команд |
| `activity_log` | История изменений (status_change, comment, link, ...) |
| `users` | Пользователи (роли: admin, operator, developer, viewer) |
| `teams` | Команды разработки; связаны с Jira project |
| `products` | Страховые продукты: ОСАГО, КАСКО, НС, ДМС |
| `ai_suggestions` | AI-подсказки привязки тикета к проблеме/задаче (confidence, reasoning) |
| `priority_recalculation_log` | История авто-пересчёта приоритетов |
| `weekly_snapshots` | Снимки счётчиков для расчёта delta WoW |

### Ключевые особенности схемы

- **short_id** генерируется триггером через таблицу `id_sequences` (PRB-N, BUG-N, TKT-N)
- **triage_sla_deadline** и **sla_deadline** вычисляются триггером при создании проблемы
- **Счётчики** (`tickets_count`, `unresearched_count`) обновляются через триггеры или refresh materialized view
- **pgvector** используется для хранения эмбеддингов тикетов (`embedding vector(1536)`)

---

## 5. Ключевые сущности и их жизненные циклы

### Тикет (`support_tickets`)

```
new
 ├─→ in_queue       (попал в одну из очередей)
 │    └─→ processing  (оператор взял в работу)
 │         ├─→ linked              (привязан к задаче)
 │         │    ├─→ recommendation_sent → awaiting_response → resolved → closed
 │         │    └─→ awaiting_response → resolved → closed
 │         └─→ researching         (нет подходящей задачи)
 └─→ duplicate      (дубль другого тикета)
```

Ключевые поля: `problem_id`, `task_id`, `current_queue`, `requires_research`, `recommendation_text`

### Проблема (`problems`)

```
new  ──(SLA: 1 день)──→  in_progress  →  waiting_fix  →  monitoring  →  resolved  →  closed
                                      ↗  (любой шаг можно вернуть назад)
```

- `triage_sla_breached = TRUE` если статус `new` не изменился за 1 день
- `sla_breached = TRUE` по общему SLA-дедлайну

### Задача/Баг (`tasks`)

```
draft  →  pending_confirmation  →  open  →  in_progress  →  in_review  →  fixed  →  closed
            ↑ (reject) ↓                                                ↘  wont_fix
         rejected_draft ──(re-submit)──────────────────────────────────→ pending_confirmation
```

Это реализует концепцию **Draft Proposals** из спецификации v2: оператор создаёт черновик задачи (статус `draft`), команда подтверждает (`pending_confirmation → open`) или отклоняет (`→ rejected_draft`).

**Маппинг DB-статус → UI-статус** (`mapping.py → task_status_db_to_ui`):

| DB статус | UI статус (фронтенд) |
|---|---|
| `draft` | `draft` |
| `pending_confirmation` | `review` |
| `rejected_draft` | `blocked` |
| `open`, `in_progress` | `in-progress` |
| `in_review` | `review` |
| `fixed`, `wont_fix`, `closed` | `fixed` |

### Позиция в очереди (`queue_items`)

```
pending → in_progress (take) → resolved / skipped
```

`sla_breached = TRUE` при нарушении triage SLA очереди.

---

## 6. Очереди и пользовательские пути

Система имеет **4 рабочих очереди**, через которые проходят тикеты после AI-классификации:

| Очередь | Код | Что делает оператор |
|---|---|---|
| Определение проблемы | `problem_determination` | Привязывает тикет к существующей проблеме или создаёт новую (`POST /problems`) |
| Определение задачи | `task_determination` | Привязывает к задаче или создаёт черновик (`POST /tasks` → статус `draft`) |
| Контроль рекомендации | `recommendation_review` | Проверяет workaround из задачи перед отправкой клиенту |
| Ответ клиенту | `client_response` | Формирует ответ вручную когда workaround отсутствует |

### Полный путь тикета (Spec §4.1, §4.2–4.5)

```
Клиент создаёт тикет
    │
    ├─── AI: confidence ≥ 0.9 → авто-привязка к проблеме/задаче
    │
    └─── AI: confidence < 0.9 → попадает в очередь
              │
              ├── problem_determination → оператор выбирает/создаёт проблему
              │                        → тикет переходит в task_determination
              │
              ├── task_determination   → оператор выбирает задачу / создаёт черновик
              │                        → если workaround есть → recommendation_review
              │                        → если нет → client_response
              │
              ├── recommendation_review → проверить, одобрить или перенаправить
              │
              └── client_response      → сформировать ответ вручную
```

### Путь команды разработки (Spec §4.6, §4.7)

1. Команда получает уведомление о новой проблеме (email + notification)
2. Открывает проблему, изучает тикеты с вложениями (`GET /problems/:id/tickets`)
3. Создаёт задачи по корневым причинам (`POST /tasks`) — статус `draft`
4. Подтверждает черновики операторов (`POST /tasks/:id/confirm` → статус `open`)
5. Привязывает задачу к Jira (`PATCH /tasks/:id { jira_url, jira_issue_key }`)

Интерфейс для команды — **таб «Команда»** в ProblemDetail и экран **РМО-пространство**.

---

## 7. API бэкенда

Базовый URL: `http://localhost:8000/api/v1`  
Аутентификация: заголовок `X-API-Key: dev-key` (настраивается через `API_KEY` в `.env`)

### Problems `/problems`

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/problems` | Список с фильтрами: `status`, `priority`, `product_code`, `search`, `sla_breached`, `triage_sla_breached`, `view` |
| `GET` | `/problems/:id` | Детальная карточка проблемы |
| `POST` | `/problems` | Создать проблему |
| `PATCH` | `/problems/:id` | Изменить поля (статус, приоритет, теги, ...) |
| `POST` | `/problems/bulk` | Массовое изменение статуса |
| `GET` | `/problems/:id/tickets` | Тикеты проблемы |
| `GET` | `/problems/:id/tasks` | Задачи проблемы |
| `GET` | `/problems/:id/activity` | Лог изменений |
| `GET` | `/problems/:id/comments` | Комментарии |
| `POST` | `/problems/:id/comments` | Добавить комментарий |
| `GET` | `/problems/:id/sparkline` | Ряд тикетов за 28 дней |

### Tasks `/tasks`

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/tasks` | Список: `problem_id`, `status[]`, `has_workaround`, `missing_notes`, `search` |
| `GET` | `/tasks/:id` | Детальная карточка задачи |
| `POST` | `/tasks` | Создать задачу (статус = `draft`) |
| `PATCH` | `/tasks/:id` | Изменить поля; проверяет допустимые переходы статуса |
| `POST` | `/tasks/bulk` | Массовые операции: assign, change_status, add_tag, link_to_jira |
| `POST` | `/tasks/:id/submit-for-review` | `draft` / `rejected_draft` → `pending_confirmation` |
| `POST` | `/tasks/:id/confirm` | `pending_confirmation` → `open` |
| `POST` | `/tasks/:id/reject` | `pending_confirmation` → `rejected_draft` (с комментарием) |
| `POST` | `/tasks/:id/tickets` | Привязать тикет к задаче |
| `DELETE` | `/tasks/:id/tickets/:ticket_id` | Отвязать тикет |
| `GET` | `/tasks/:id/activity` | Лог изменений задачи |
| `GET` | `/tasks/:id/comments` | Комментарии к задаче |
| `POST` | `/tasks/:id/comments` | Добавить комментарий |

### Tickets `/tickets`

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/tickets` | Список тикетов с фильтрами и пагинацией |
| `GET` | `/tickets/triage-queue` | Тикеты для ручного триажа |
| `GET` | `/tickets/:id` | Детальная карточка тикета |
| `POST` | `/tickets` | Создать тикет |
| `PATCH` | `/tickets/:id` | Изменить (статус, problem_id, task_id, recommendation_text, ...) |
| `POST` | `/tickets/bulk` | Массовые операции |
| `GET` | `/tickets/:id/comments` | Комментарии к тикету |
| `POST` | `/tickets/:id/comments` | Добавить комментарий к тикету |
| `POST` | `/tickets/:id/attachments` | Загрузить файл (multipart/form-data) |

### Queues `/queues`

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/queues` | Список очередей с метриками (количество позиций, SLA) |
| `GET` | `/queues/:code/items` | Позиции очереди |
| `POST` | `/queues/:code/items/:id/take` | Взять позицию в работу |
| `POST` | `/queues/:code/items/:id/resolve` | Завершить обработку |
| `POST` | `/queues/:code/items/:id/skip` | Пропустить позицию |

### Dashboard & Analytics

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/dashboard/summary` | Ключевые метрики: открытые проблемы, SLA, тренды, топ проблем |
| `GET` | `/dashboard/problems-heatmap` | Тепловая карта активности |
| `GET` | `/dashboard/team-load` | Нагрузка по командам |
| `GET` | `/analytics/trends` | Тренды тикетов по периоду |
| `GET` | `/analytics/queue-metrics` | Метрики очередей |
| `GET` | `/analytics/team-performance` | Эффективность команд |

### Notifications, Search, Meta

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/notifications` | Список уведомлений (`unread_only`, `user_id`, `team_id`) |
| `PATCH` | `/notifications/read-all` | Отметить все как прочитанные |
| `GET` | `/search` | Полнотекстовый поиск по проблемам, задачам, тикетам |
| `GET` | `/products` | Справочник продуктов |
| `GET` | `/teams` | Справочник команд |
| `GET` | `/users` | Справочник пользователей |

---

## 8. Фронтенд

### Маршруты (view)

| view | Компонент | Описание |
|---|---|---|
| `dashboard` | `Dashboard` | Дашборд: KPI, горячие проблемы, heatmap, нагрузка команды |
| `problems` | `ProblemList` | Таблица проблем с фильтрами и сортировкой |
| `problems` + `detailId` | `ProblemDetail` | Детальная страница проблемы с табами |
| `triage` | `Triage` | Очередь problem_determination: список + детализация тикета |
| `bugs` | `BugsList` | Таблица задач/багов с фильтрами |
| `tickets` | `TicketsList` | Таблица тикетов |
| `rmo` | `RmoSpace` | РМО-пространство: все задачи на подтверждении (pending_confirmation) |

### Табы ProblemDetail

| Таб | Компонент | Содержимое |
|---|---|---|
| Обзор | `ProblemOverview` | KPI, текущий workaround, граф связей, последние тикеты |
| Баги | `ProblemBugs` | Список задач с кнопками draft-workflow; форма создания черновика |
| Обращения | `ProblemTickets` | Таблица тикетов с фильтрами (без бага, новые, ресерч, дубли) |
| Активность | `ProblemActivity` | Таймлайн событий из API |
| Команда | `ProblemTeam` | Triage SLA, задачи на подтверждении, пропущенные support_notes |
| Связи | `ProblemLinked` | Граф связей, список багов, похожие проблемы |

### BugCard — статус-зависимые действия

| Статус задачи | Отображение | Доступные действия |
|---|---|---|
| `draft` | Серый бейдж «Черновик» | Кнопка «На проверку команды» → submit-for-review |
| `review` | Жёлтый «На проверке» | «Подтвердить» (→ open) + «Отклонить» (с комментарием, → blocked) |
| `blocked` | Красный «Отклонён» + причина | «Отправить повторно» → submit-for-review |
| `in-progress`, `fixed`, ... | Соответствующий бейдж | Только просмотр |

### API-клиент (`api.jsx`)

Все запросы к бэкенду инкапсулированы в объект `window.API`. Конфигурация через глобальные переменные:

```javascript
window.VECTOR_API_BASE = "http://localhost:8000";  // по умолчанию
window.VECTOR_API_KEY  = "dev-key";                // по умолчанию
```

Если бэкенд недоступен — компоненты плавно деградируют к mock-данным из `data.jsx` / `data-bugs-tickets.jsx`.

---

## 9. Тесты

Тесты покрывают все endpoint-группы. Запускаются без реальной БД — SQLAlchemy сессия подменяется через `FakeResult`.

```
tests/
├── conftest.py            # fixtures: mock_session, client, client_no_auth
├── test_problems.py
├── test_tasks.py          # включая draft workflow + link/unlink tickets + bulk
├── test_tickets.py
├── test_queues.py
├── test_notifications.py
├── test_dashboard.py
├── test_analytics.py
├── test_search.py
└── test_meta.py
```

**Запуск:**
```bash
cd src/backend
pytest -v
```

---

## 10. Локальный запуск

### База данных

```bash
cd src
docker-compose up -d
# PostgreSQL доступен на localhost:5432
# БД: rmo / user: rmo / password: rmo
# Схема инициализируется автоматически из db/init/
```

### Бэкенд

```bash
cd src/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# API: http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

### Фронтенд

```bash
cd src
python3 -m http.server 3000
# Открыть: http://localhost:3000
```

> Фронтенд обращается к бэкенду на `http://localhost:8000` по умолчанию.  
> Для смены адреса — выполнить в консоли браузера перед загрузкой:  
> `window.VECTOR_API_BASE = "https://..."` (или через Vercel environment).

---

## 11. Конфигурация

### `.env` (backend)

```env
DATABASE_URL=postgresql+asyncpg://rmo:rmo@localhost:5432/rmo
API_KEY=dev-key
CORS_ORIGINS=*
```

### `UPLOAD_DIR` (файловые вложения)

```env
UPLOAD_DIR=/tmp/vector_uploads   # по умолчанию
```

Файлы хранятся локально; `s3_key` в таблице `attachments` — заглушка пути под будущий S3.

---

## 12. Спецификация

Проект разработан по трём итерациям спецификации:

| Файл | Версия | Содержимое |
|---|---|---|
| `src/support-service-spec-ru-v3.md` | **v3 (актуальная)** | Полная спецификация: схема БД, API v1, AI-пайплайн, очереди, SLA, RBAC, события, Jira-интеграция |
| `src/spec-additions-cto-dev.md` | **CTO addendum** | Дополнения: short_id генерация, тонкости asyncpg, дополнительные поля |

### Ключевые разделы спецификации v3

| Раздел | Что описывает |
|---|---|
| §2 — Схема БД | Все таблицы, индексы, триггеры, pgvector |
| §3.1–3.5 — API Problems/Tasks/Tickets/Queues | Эндпоинты, параметры, примеры ответов |
| §3.6 — Dashboard & Analytics API | Метрики, heatmap, team-load |
| §3.7–3.8 — Search & Comments | Полнотекстовый и семантический поиск |
| §3.9 — AI API | suggest, detect-anomaly, recalculate-priority |
| §3.10–3.11 — Notifications & Auth | Уведомления, SSO |
| §4 — Пользовательские пути | Пошаговые flow для каждой роли |
| §5 — AI-агент | Пороги уверенности, triage score, z-score аномалии |
| §6 — RBAC | Матрица прав по ролям |
| §7 — События | WebSocket события, email-уведомления, вебхуки |
| §8 — Jira | РМО-пространство, жизненный цикл задачи, deep link |

### Нереализованные части (вне скоупа прототипа)

| Функциональность | Причина |
|---|---|
| AI-пайплайн (`/ai/*`) | Требует Claude API + pgvector embeddings |
| Jira-интеграция (`/jira/*`) | Внешний сервис |
| WebSocket (real-time события) | Архитектурное решение для следующей фазы |
| Auth/SSO (`/auth/*`) | Упрощён до shared API-key |
| Email-уведомления | Заглушка (записывается в `notifications`, не отправляется) |
| Семантический поиск (`/search/semantic`) | Требует эмбеддинги |
