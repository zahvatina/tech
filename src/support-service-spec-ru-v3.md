# Техническая спецификация: Сервис управления обращениями и проблемами

**Версия:** 3.0  
**Дата:** 2026-05-09  
**Область применения:** B2B веб-сервис для команд технической поддержки и продукта

---

## Содержание

1. [Обзор и архитектура](#overview)
2. [Схема базы данных](#database-schema)
3. [API-методы](#api-methods)
4. [Пользовательские пути](#user-paths)
5. [Спецификация AI-агента и очередей](#ai-features)
6. [Управление доступом (RBAC)](#rbac)
7. [Система событий и уведомлений](#events)
8. [Интеграция с Jira и РМО-пространство](#jira-integration)
9. [Поиск и фильтрация](#search)
10. [Нефункциональные требования](#nfr)
11. [Комментарии CPO](#cpo-review)
12. [Комментарии руководителя технической поддержки](#support-lead-review)

---

## 1. Обзор и архитектура <a name="overview"></a>

### 1.1 Описание системы

B2B внутренний инструмент для управления клиентскими проблемами (Problems), задачами и обращениями в поддержку. Рассчитан на высоконагруженные операции поддержки с пропускной способностью 10 000+ тикетов в сутки.

Система работает в двух режимах обработки обращений:

**Автоматический (AI-агент)** — агент анализирует тикет, классифицирует проблему и задачу. При уверенности ≥ 0.9 привязка происходит автоматически. Иначе тикет маршрутизируется в очередь оператору.

**Ручной (оператор)** — оператор разбирает обращения из четырёх специализированных очередей: определение проблемы, определение задачи/бага, контроль отправки рекомендации, ответ клиенту.

### 1.2 Основные сущности и их связи

```
Problem (Глобальная проблема)
  ├── Tasks[] (Задачи: bug | ui_debt | backlog | cjm_debt)
  │     ├── Статус: draft → pending_confirmation → open → ...
  │     └── SupportTickets[] (Обращения, привязанные к задаче)
  └── SupportTickets[] (Обращения без задачи)

SupportTicket (Обращение)
  ├── → Problem (обязательно после разметки)
  ├── → Task (опционально)
  ├── → QueueItem (текущее место в очереди)
  └── Attachments[] (Вложения: скриншоты, логи)

Queue → QueueItems[]
```

### 1.3 Типы задач

| Тип      | Код       | Описание                                      |
|----------|-----------|-----------------------------------------------|
| Баг      | `bug`     | Дефект в коде / функциональности              |
| UI Debt  | `ui_debt` | Проблема интерфейса, UX-долг                  |
| Бэклог   | `backlog` | Пожелание клиента, фича-реквест               |
| CJM Debt |`cjm_debt` | Некорректный процесс, кривой Customer Journey |

### 1.4 Полный жизненный цикл задачи

```
[draft]             — оператор предложил задачу, команда ещё не видела
      ↓
[pending_confirmation] — отправлено команде на рассмотрение
      ↓              ↘
[open]              [rejected_draft]  — команда отклонила (не удаляется)
  (задача создана в Jira)
      ↓
[in_progress] → [in_review] → [fixed]
                             → [wont_fix]
                             → [duplicate]
                             → [closed]
```

### 1.5 Типы очередей операторов

| Очередь                        | Код                        | Триггер                              |
|--------------------------------|----------------------------|--------------------------------------|
| Определение проблемы           | `problem_determination`    | AI confidence по проблеме < 0.9      |
| Определение задачи/бага        | `task_determination`       | AI confidence по задаче < 0.9        |
| Контроль отправки рекомендации | `recommendation_review`    | Найден workaround / рекомендация     |
| Ответ клиенту                  | `client_response`          | Задача есть, workaround отсутствует  |

### 1.6 Полный жизненный цикл обращения

```
Клиент создаёт обращение
       │
[status: new] → AI-агент классифицирует
       │
       ├── confidence ≥ 0.9 → Проблема привязана автоматически
       └── confidence < 0.9 → [in_queue: problem_determination]
                                       │ оператор создаёт/выбирает проблему
                               Проблема привязана
                                       │
                          AI ищет задачу по проблеме
                                       │
                    ├── confidence ≥ 0.9 → Задача привязана автоматически
                    └── confidence < 0.9 → [in_queue: task_determination]
                                                   │ оператор выбирает/предлагает задачу
                                           Задача привязана
                                                   │
                                    ┌──────────────┤
                        workaround есть?           │
                                    │              │
                                   ДА             НЕТ
                                    │              │
                   [in_queue: recommendation_review] [in_queue: client_response]
                   оператор контролирует отправку    оператор пишет ответ
```

### 1.7 Технологический стек

| Слой               | Технология                                           |
|--------------------|------------------------------------------------------|
| Backend API        | Python 3.12, FastAPI                                 |
| ORM / миграции     | SQLAlchemy 2.0 (async), Alembic                      |
| База данных        | PostgreSQL 16 (основная), Redis 7 (кэш/очереди)      |
| Фоновые задачи     | Celery + Redis broker                                |
| Поиск              | Elasticsearch 8 / OpenSearch                         |
| Хранилище файлов   | S3-совместимое (вложения/логи)                       |
| AI/ML              | Anthropic Claude API, pgvector (PostgreSQL extension)|
| Реальное время     | WebSocket (FastAPI + Starlette), Redis pub/sub        |
| Аутентификация     | JWT (PyJWT), OAuth2 / SAML SSO                       |
| Email              | SMTP / SendGrid (smtplib / httpx)                    |
| Интеграция         | Jira REST API v3 (httpx)                             |
| Деплой             | Docker, Kubernetes                                   |
| Мониторинг         | Prometheus + Grafana, Sentry                         |

**Структура Python-проекта (FastAPI):**
```
app/
├── api/
│   ├── v1/
│   │   ├── problems.py
│   │   ├── tasks.py
│   │   ├── tickets.py
│   │   ├── queues.py
│   │   ├── search.py
│   │   ├── dashboard.py
│   │   ├── ai.py
│   │   └── jira.py
├── models/          # SQLAlchemy models
├── schemas/         # Pydantic schemas (request/response)
├── services/        # бизнес-логика
│   ├── ai_service.py
│   ├── queue_service.py
│   ├── jira_service.py
│   ├── notification_service.py
│   └── priority_service.py
├── workers/         # Celery tasks
│   ├── classification.py
│   ├── anomaly_detection.py
│   ├── priority_recalc.py
│   └── sla_checker.py
├── core/
│   ├── config.py    # pydantic-settings
│   ├── database.py  # async engine
│   ├── redis.py
│   └── security.py
└── main.py
```

---

## 2. Схема базы данных <a name="database-schema"></a>

> **Примечание:** организация удалена как сущность. Система является однотенантной; глобальные настройки хранятся в таблице `app_settings`.

### 2.1 Основные таблицы

#### `app_settings` — Глобальные настройки системы
```sql
CREATE TABLE app_settings (
  key           VARCHAR(100) PRIMARY KEY,
  value         JSONB NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Примеры записей:
-- key='ai_confidence_threshold', value={"problem": 0.9, "task": 0.9, "duplicate": 0.9}
-- key='triage_sla_hours',        value={"default": 24}
-- key='priority_recalc',         value={"delta_critical": 200, "delta_high": 100}
```

---

#### `teams` — Команды
```sql
CREATE TABLE teams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  slug             VARCHAR(100) UNIQUE NOT NULL,
  color            VARCHAR(7),
  jira_project_key VARCHAR(50),   -- ключ проекта в Jira (CORE, PAY, ...)
  jira_board_id    INTEGER,
  email_list       TEXT[],        -- адреса для уведомлений команды
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### `users` — Пользователи
```sql
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  name         VARCHAR(255) NOT NULL,
  avatar_url   TEXT,
  role         VARCHAR(50) NOT NULL DEFAULT 'operator',
  -- admin | operator | developer | viewer
  team_id      UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  settings     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_team_id ON users(team_id);
```

---

#### `products` — Продукты
```sql
CREATE TABLE products (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      VARCHAR(255) NOT NULL,
  code      VARCHAR(50) UNIQUE NOT NULL,
  -- осаго | каско | нс | дмс | ...
  is_active BOOLEAN DEFAULT TRUE
);
```

---

#### `problems` — Глобальные проблемы
```sql
CREATE TABLE problems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  short_id    VARCHAR(20) UNIQUE NOT NULL,  -- PROB-1234

  -- Статус
  status      VARCHAR(50) NOT NULL DEFAULT 'new',
  -- new | in_progress | waiting_fix | resolved | closed | monitoring

  -- Приоритет и критичность
  priority    VARCHAR(20) NOT NULL DEFAULT 'medium',
  -- critical | high | medium | low
  severity    VARCHAR(20) NOT NULL DEFAULT 'moderate',
  -- blocker | critical | major | moderate | minor | trivial

  -- Ответственные
  owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,

  -- Затронутые продукты и сервисы
  affected_product_ids UUID[]  DEFAULT '{}',
  affected_services    TEXT[]  DEFAULT '{}',

  -- SLA
  sla_deadline          TIMESTAMPTZ,
  sla_breached          BOOLEAN DEFAULT FALSE,
  triage_sla_deadline   TIMESTAMPTZ,   -- = created_at + 24h (заполняется триггером)
  triage_sla_breached   BOOLEAN DEFAULT FALSE,

  -- Флаги
  has_workaround        BOOLEAN DEFAULT FALSE,
  is_visible_in_jira    BOOLEAN DEFAULT FALSE,
  -- true как только у любой задачи проблемы появляется jira_url

  -- Денормализованные счётчики (обновляются триггерами)
  tickets_count                INTEGER DEFAULT 0,
  tickets_count_prev_week      INTEGER DEFAULT 0,
  tasks_count                  INTEGER DEFAULT 0,
  bugs_count                   INTEGER DEFAULT 0,
  unresearched_count           INTEGER DEFAULT 0,
  unresearched_count_prev_week INTEGER DEFAULT 0,
  tickets_no_task_count        INTEGER DEFAULT 0,

  -- Метаданные
  tags        TEXT[]  DEFAULT '{}',
  extra       JSONB   DEFAULT '{}',

  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at   TIMESTAMPTZ,

  CONSTRAINT chk_problem_priority CHECK (priority IN ('critical','high','medium','low')),
  CONSTRAINT chk_problem_severity CHECK (severity IN ('blocker','critical','major','moderate','minor','trivial'))
);

CREATE INDEX idx_problems_status      ON problems(status);
CREATE INDEX idx_problems_team_id     ON problems(team_id);
CREATE INDEX idx_problems_priority    ON problems(priority);
CREATE INDEX idx_problems_owner_id    ON problems(owner_id);
CREATE INDEX idx_problems_created_at  ON problems(created_at DESC);
CREATE INDEX idx_problems_triage_sla  ON problems(triage_sla_breached) WHERE triage_sla_breached = TRUE;
CREATE INDEX idx_problems_tags        ON problems USING GIN(tags);
CREATE INDEX idx_problems_products    ON problems USING GIN(affected_product_ids);

ALTER TABLE problems ADD COLUMN fts_vector TSVECTOR
  GENERATED ALWAYS AS (
    setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX idx_problems_fts ON problems USING GIN(fts_vector);
```

---

#### `problem_products` — Связь проблем с продуктами
```sql
CREATE TABLE problem_products (
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, product_id)
);
```

---

#### `tasks` — Задачи и баги (все типы, включая черновики)

Черновые предложения оператора — это задачи в статусе `draft` или `pending_confirmation`.
После подтверждения командой задача переходит в `open` и создаётся в Jira.

```sql
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id  UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  short_id    VARCHAR(20) UNIQUE NOT NULL,
  -- BUG-5678, TASK-1234

  -- Тип задачи
  task_type   VARCHAR(20) NOT NULL DEFAULT 'bug',
  -- bug | ui_debt | backlog | cjm_debt

  -- Статус (включает жизненный цикл черновика)
  status      VARCHAR(30) NOT NULL DEFAULT 'draft',
  -- draft              = оператор предложил, команда ещё не рассматривала
  -- pending_confirmation = отправлено команде на рассмотрение
  -- rejected_draft     = команда отклонила (сохраняется, не удаляется)
  -- open               = команда подтвердила, задача создана в Jira
  -- in_progress        = взята в работу
  -- in_review          = на ревью/тестировании
  -- fixed              = исправлена
  -- wont_fix           = не будем исправлять
  -- duplicate          = дубль другой задачи
  -- closed             = закрыта

  title       VARCHAR(500) NOT NULL,
  description TEXT,

  -- Приоритет и критичность
  priority    VARCHAR(20) NOT NULL DEFAULT 'medium',
  severity    VARCHAR(20) NOT NULL DEFAULT 'moderate',

  -- Ответственные
  team_id     UUID REFERENCES teams(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Черновик: кто предложил и когда
  proposed_by   UUID REFERENCES users(id),
  -- заполняется, если задача создана оператором (не командой)
  proposed_at   TIMESTAMPTZ,

  -- Результат рассмотрения командой
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_comment  TEXT,

  -- Jira-интеграция (заполняется после подтверждения командой)
  jira_url        TEXT,
  jira_issue_key  VARCHAR(50),
  jira_issue_id   VARCHAR(50),

  -- Информация для поддержки
  workaround     TEXT,
  has_workaround BOOLEAN DEFAULT FALSE,
  support_notes  TEXT,

  -- Вычисляемый флаг: нужны рекомендации для саппорта
  -- TRUE если support_notes IS NULL И задача не в финальном статусе
  support_notes_required BOOLEAN GENERATED ALWAYS AS (
    support_notes IS NULL
    AND status NOT IN ('draft','pending_confirmation','rejected_draft',
                       'fixed','wont_fix','duplicate','closed')
  ) STORED,

  -- Детали исправления
  root_cause      TEXT,
  fix_date        TIMESTAMPTZ,
  fix_version     VARCHAR(100),
  fix_description TEXT,

  -- Окружения
  environments TEXT[] DEFAULT '{}',
  -- production | staging | ios | android | web | backend

  -- Счётчик привязанных обращений
  tickets_count INTEGER DEFAULT 0,

  -- AI-поля
  ai_summary TEXT,
  embedding  vector(1536),

  tags  TEXT[] DEFAULT '{}',
  extra JSONB  DEFAULT '{}',

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_task_type   CHECK (task_type IN ('bug','ui_debt','backlog','cjm_debt')),
  CONSTRAINT chk_task_status CHECK (status IN (
    'draft','pending_confirmation','rejected_draft',
    'open','in_progress','in_review',
    'fixed','wont_fix','duplicate','closed'
  ))
);

CREATE INDEX idx_tasks_problem_id         ON tasks(problem_id);
CREATE INDEX idx_tasks_task_type          ON tasks(task_type);
CREATE INDEX idx_tasks_status             ON tasks(status);
CREATE INDEX idx_tasks_team_id            ON tasks(team_id);
CREATE INDEX idx_tasks_jira_key           ON tasks(jira_issue_key);
CREATE INDEX idx_tasks_has_workaround     ON tasks(has_workaround);
CREATE INDEX idx_tasks_drafts             ON tasks(team_id, status)
  WHERE status IN ('draft','pending_confirmation');
CREATE INDEX idx_tasks_missing_notes      ON tasks(support_notes_required)
  WHERE support_notes_required = TRUE;

ALTER TABLE tasks ADD COLUMN fts_vector TSVECTOR
  GENERATED ALWAYS AS (
    setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(workaround, '')), 'C') ||
    setweight(to_tsvector('russian', coalesce(support_notes, '')), 'C')
  ) STORED;
CREATE INDEX idx_tasks_fts ON tasks USING GIN(fts_vector);
```

---

#### `support_tickets` — Обращения в поддержку
```sql
CREATE TABLE support_tickets (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id VARCHAR(20) UNIQUE NOT NULL,  -- TKT-91011

  -- Клиент
  user_id        VARCHAR(255) NOT NULL,
  customer_name  VARCHAR(255),
  customer_email VARCHAR(255),
  region         VARCHAR(100),

  -- Продукт и платформа
  product_id UUID REFERENCES products(id),
  platform   VARCHAR(50),
  -- mobile_app | personal_account | web | backend_api

  -- Содержимое
  raw_text    TEXT NOT NULL,
  summary     TEXT,
  ticket_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Канал
  channel VARCHAR(50),
  -- email | chat | phone | api | portal | telegram | whatsapp

  -- Статус
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  -- new | in_queue | processing | linked | researching |
  -- recommendation_sent | awaiting_response | resolved | closed | duplicate

  -- Текущая очередь (NULL если вне очереди)
  current_queue VARCHAR(50),
  -- problem_determination | task_determination |
  -- recommendation_review | client_response

  -- Рекомендация для клиента
  recommendation_text    TEXT,
  recommendation_sent    BOOLEAN   DEFAULT FALSE,
  recommendation_sent_at TIMESTAMPTZ,

  -- Связи
  problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
  task_id    UUID REFERENCES tasks(id)    ON DELETE SET NULL,

  -- AI-классификация
  ai_problem_id         UUID REFERENCES problems(id),
  ai_problem_confidence FLOAT,
  ai_task_id            UUID REFERENCES tasks(id),
  ai_task_confidence    FLOAT,
  ai_category           VARCHAR(100),
  embedding             vector(1536),

  -- Признаки
  is_new_case       BOOLEAN DEFAULT TRUE,
  requires_research BOOLEAN DEFAULT FALSE,
  is_confirmed_task BOOLEAN DEFAULT FALSE,
  is_duplicate      BOOLEAN DEFAULT FALSE,
  duplicate_of      UUID REFERENCES support_tickets(id),

  -- Метаданные
  tags  TEXT[] DEFAULT '{}',
  extra JSONB  DEFAULT '{}',

  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_tickets_problem_id    ON support_tickets(problem_id);
CREATE INDEX idx_tickets_task_id       ON support_tickets(task_id);
CREATE INDEX idx_tickets_status        ON support_tickets(status);
CREATE INDEX idx_tickets_current_queue ON support_tickets(current_queue)
  WHERE current_queue IS NOT NULL;
CREATE INDEX idx_tickets_user_id       ON support_tickets(user_id);
CREATE INDEX idx_tickets_created_at    ON support_tickets(created_at DESC);
CREATE INDEX idx_tickets_product_id    ON support_tickets(product_id);
CREATE INDEX idx_tickets_no_task       ON support_tickets(problem_id)
  WHERE task_id IS NULL AND problem_id IS NOT NULL;

ALTER TABLE support_tickets ADD COLUMN fts_vector TSVECTOR
  GENERATED ALWAYS AS (
    setweight(to_tsvector('russian', coalesce(raw_text, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(summary, '')), 'B')
  ) STORED;
CREATE INDEX idx_tickets_fts ON support_tickets USING GIN(fts_vector);
```

---

#### `attachments` — Вложения
```sql
CREATE TABLE attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  file_name     VARCHAR(500) NOT NULL,
  file_type     VARCHAR(100),
  file_size     BIGINT,
  s3_key        TEXT NOT NULL,
  s3_bucket     VARCHAR(255),
  is_log        BOOLEAN DEFAULT FALSE,
  is_screenshot BOOLEAN DEFAULT FALSE,
  uploaded_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_ticket_id ON attachments(ticket_id);
```

---

#### `queues` — Справочник очередей
```sql
CREATE TABLE queues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  sla_minutes INTEGER,   -- максимальное время нахождения в очереди
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO queues (code, name, sla_minutes) VALUES
  ('problem_determination',  'Определение проблемы',              60),
  ('task_determination',     'Определение задачи/бага',           90),
  ('recommendation_review',  'Контроль отправки рекомендации',    30),
  ('client_response',        'Ответ клиенту',                    120);
```

---

#### `queue_items` — Позиции в очередях
```sql
CREATE TABLE queue_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id    UUID NOT NULL REFERENCES queues(id),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,

  priority_score FLOAT NOT NULL DEFAULT 0.0,

  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | in_progress | completed | skipped

  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,

  sla_deadline TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT FALSE,

  reason       TEXT,
  -- напр.: "AI confidence 0.72 < threshold 0.9"

  resolution   TEXT,
  resolved_by  UUID REFERENCES users(id),
  resolved_at  TIMESTAMPTZ,

  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_items_queue  ON queue_items(queue_id, status, priority_score DESC);
CREATE INDEX idx_queue_items_ticket ON queue_items(ticket_id);
CREATE INDEX idx_queue_items_active ON queue_items(assigned_to)
  WHERE status = 'in_progress';
```

---

#### `activity_log` — Журнал активности
```sql
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  -- problem | task | support_ticket | queue_item
  entity_id   UUID NOT NULL,
  action      VARCHAR(100) NOT NULL,
  -- created | updated | status_changed | assigned | linked | commented |
  -- task_added | ticket_linked | workaround_added | sla_breached |
  -- queue_entered | queue_resolved | draft_proposed | draft_confirmed |
  -- draft_rejected | recommendation_saved | priority_recalculated |
  -- jira_linked | triage_sla_breached | escalated
  actor_id    UUID REFERENCES users(id),
  actor_name  VARCHAR(255),
  old_value   JSONB,
  new_value   JSONB,
  metadata    JSONB DEFAULT '{}',
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_entity     ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_actor      ON activity_log(actor_id);
```

---

#### `comments` — Комментарии
```sql
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  -- problem | task | support_ticket
  entity_id   UUID NOT NULL,
  author_id   UUID NOT NULL REFERENCES users(id),
  parent_id   UUID REFERENCES comments(id),
  body        TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT TRUE,
  is_edited   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
```

---

#### `weekly_snapshots` — Недельные снимки для WoW-метрик
```sql
CREATE TABLE weekly_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type        VARCHAR(20) NOT NULL,  -- problem | task
  entity_id          UUID NOT NULL,
  week_start         DATE NOT NULL,
  tickets_count      INTEGER DEFAULT 0,
  unresearched_count INTEGER DEFAULT 0,
  tasks_count        INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entity_id, week_start)
);

CREATE INDEX idx_snapshots_entity ON weekly_snapshots(entity_type, entity_id, week_start DESC);
```

---

#### `ai_suggestions` — AI-подсказки
```sql
CREATE TABLE ai_suggestions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id             UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  suggestion_type       VARCHAR(50) NOT NULL,
  -- duplicate_of | task_match | problem_match | workaround | category
  suggested_entity_type VARCHAR(50),
  suggested_entity_id   UUID,
  confidence            FLOAT NOT NULL,
  reasoning             TEXT,
  is_accepted           BOOLEAN,
  accepted_by           UUID REFERENCES users(id),
  accepted_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_suggestions_ticket  ON ai_suggestions(ticket_id);
CREATE INDEX idx_ai_suggestions_pending ON ai_suggestions(ticket_id)
  WHERE is_accepted IS NULL;
```

---

#### `notifications` — Уведомления (in-app + email)
```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  -- NULL = командная рассылка
  team_id     UUID REFERENCES teams(id),
  type        VARCHAR(100) NOT NULL,
  -- new_problem | triage_sla_breach | sla_breach | spike_alert |
  -- support_notes_missing | draft_proposal_received |
  -- draft_confirmed | draft_rejected | priority_changed |
  -- status_change | assignment | mention
  title       VARCHAR(500),
  body        TEXT,
  entity_type VARCHAR(50),
  entity_id   UUID,
  send_email  BOOLEAN DEFAULT FALSE,
  email_sent  BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user  ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_team  ON notifications(team_id, created_at DESC)
  WHERE team_id IS NOT NULL;
CREATE INDEX idx_notifications_email ON notifications(send_email, email_sent)
  WHERE send_email = TRUE AND email_sent = FALSE;
```

---

#### `priority_recalculation_log` — Лог динамических пересчётов
```sql
CREATE TABLE priority_recalculation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     VARCHAR(20) NOT NULL,   -- problem | task
  entity_id       UUID NOT NULL,
  old_priority    VARCHAR(20) NOT NULL,
  new_priority    VARCHAR(20) NOT NULL,
  reason          TEXT,
  recalculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_priority_log_entity ON priority_recalculation_log(entity_type, entity_id);
```

---

### 2.2 Материализованное представление `mv_problem_stats`
```sql
CREATE MATERIALIZED VIEW mv_problem_stats AS
SELECT
  p.id, p.title, p.status, p.priority, p.severity,
  p.owner_id, p.team_id,
  p.has_workaround, p.sla_breached,
  p.triage_sla_deadline, p.triage_sla_breached,
  p.tickets_count, p.tasks_count, p.bugs_count,
  p.unresearched_count, p.tickets_no_task_count,
  p.is_visible_in_jira,

  -- WoW-дельты
  CASE WHEN ws.tickets_count > 0
    THEN ROUND((p.tickets_count - ws.tickets_count)::NUMERIC / ws.tickets_count * 100, 1)
  END AS tickets_delta_pct,

  CASE WHEN ws.unresearched_count > 0
    THEN ROUND((p.unresearched_count - ws.unresearched_count)::NUMERIC / ws.unresearched_count * 100, 1)
  END AS unresearched_delta_pct,

  -- Черновики, ожидающие подтверждения
  (SELECT COUNT(*) FROM tasks t
   WHERE t.problem_id = p.id
     AND t.status IN ('draft','pending_confirmation')
  ) AS pending_drafts_count,

  -- Задачи без support_notes
  (SELECT COUNT(*) FROM tasks t
   WHERE t.problem_id = p.id AND t.support_notes_required = TRUE
  ) AS tasks_missing_notes_count,

  p.updated_at, p.created_at

FROM problems p
LEFT JOIN weekly_snapshots ws
  ON ws.entity_id = p.id
  AND ws.week_start = DATE_TRUNC('week', NOW() - INTERVAL '7 days')::DATE;

CREATE UNIQUE INDEX ON mv_problem_stats(id);
-- Обновляется каждые 5 минут через Celery beat:
-- celery -A app.workers beat → задача refresh_problem_stats_view
```

---

### 2.3 Триггеры

```sql
-- Автоматический triage SLA при создании проблемы
CREATE OR REPLACE FUNCTION set_triage_sla()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.triage_sla_deadline := NEW.created_at + INTERVAL '1 day';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_problem_triage_sla
BEFORE INSERT ON problems
FOR EACH ROW EXECUTE FUNCTION set_triage_sla();

-- Обновление счётчиков проблемы при изменении тикета
CREATE OR REPLACE FUNCTION update_problem_counters()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.problem_id IS NOT NULL THEN
    UPDATE problems SET
      tickets_count         = (SELECT COUNT(*) FROM support_tickets WHERE problem_id = NEW.problem_id),
      tickets_no_task_count = (SELECT COUNT(*) FROM support_tickets WHERE problem_id = NEW.problem_id AND task_id IS NULL),
      unresearched_count    = (SELECT COUNT(*) FROM support_tickets WHERE problem_id = NEW.problem_id AND requires_research = TRUE),
      updated_at = NOW()
    WHERE id = NEW.problem_id;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.problem_id IS NOT NULL AND OLD.problem_id IS DISTINCT FROM NEW.problem_id THEN
    UPDATE problems SET
      tickets_count         = (SELECT COUNT(*) FROM support_tickets WHERE problem_id = OLD.problem_id),
      tickets_no_task_count = (SELECT COUNT(*) FROM support_tickets WHERE problem_id = OLD.problem_id AND task_id IS NULL),
      unresearched_count    = (SELECT COUNT(*) FROM support_tickets WHERE problem_id = OLD.problem_id AND requires_research = TRUE),
      updated_at = NOW()
    WHERE id = OLD.problem_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_problem_counters
AFTER INSERT OR UPDATE OF problem_id, task_id, requires_research
ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_problem_counters();

-- Обновление счётчиков задачи
CREATE OR REPLACE FUNCTION update_task_counters()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target_id UUID;
BEGIN
  target_id := COALESCE(NEW.task_id, OLD.task_id);
  IF target_id IS NOT NULL THEN
    UPDATE tasks SET
      tickets_count = (SELECT COUNT(*) FROM support_tickets WHERE task_id = target_id),
      updated_at = NOW()
    WHERE id = target_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_task_counters
AFTER INSERT OR UPDATE OF task_id ON support_tickets
FOR EACH ROW EXECUTE FUNCTION update_task_counters();

-- is_visible_in_jira при привязке Jira к задаче
CREATE OR REPLACE FUNCTION update_problem_jira_flag()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.jira_url IS NOT NULL AND NEW.jira_url <> '' THEN
    UPDATE problems SET is_visible_in_jira = TRUE, updated_at = NOW()
    WHERE id = NEW.problem_id AND is_visible_in_jira = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_jira_flag
AFTER INSERT OR UPDATE OF jira_url ON tasks
FOR EACH ROW EXECUTE FUNCTION update_problem_jira_flag();
```

---

### 2.4 Фоновые задачи Celery

```python
# app/workers/schedule.py (Celery beat)
CELERY_BEAT_SCHEDULE = {
    "refresh-problem-stats":    {"task": "refresh_mv_problem_stats",    "schedule": 300},    # 5 мин
    "check-triage-sla":         {"task": "check_triage_sla_breaches",   "schedule": 300},
    "check-queue-sla":          {"task": "check_queue_sla_breaches",    "schedule": 300},
    "recalculate-priorities":   {"task": "recalculate_all_priorities",  "schedule": 3600},   # 1 час
    "weekly-snapshot":          {"task": "create_weekly_snapshots",     "schedule": "0 0 * * 1"},
    "support-notes-alert":      {"task": "send_support_notes_alerts",   "schedule": "0 9 * * *"},
}
```

---

## 3. API-методы <a name="api-methods"></a>

**Базовый URL:** `/api/v1`  
**Авторизация:** `Authorization: Bearer <jwt>`  
**Content-Type:** `application/json`  
**Пагинация:** `?page=1&limit=25` (макс. 100)

Все списочные эндпоинты поддерживают:
- `?sort_by=<field>&sort_dir=asc|desc`
- `?search=<query>` — полнотекстовый поиск
- `?fields=id,title,status` — sparse fieldsets

**FastAPI — структура роутеров:**
```python
# app/api/v1/__init__.py
from fastapi import APIRouter
from .problems import router as problems_router
from .tasks    import router as tasks_router
from .tickets  import router as tickets_router
from .queues   import router as queues_router
from .search   import router as search_router
from .dashboard import router as dashboard_router
from .ai       import router as ai_router
from .jira     import router as jira_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(problems_router, prefix="/problems",  tags=["problems"])
api_router.include_router(tasks_router,    prefix="/tasks",     tags=["tasks"])
api_router.include_router(tickets_router,  prefix="/tickets",   tags=["tickets"])
api_router.include_router(queues_router,   prefix="/queues",    tags=["queues"])
api_router.include_router(search_router,   prefix="/search",    tags=["search"])
api_router.include_router(dashboard_router,prefix="/dashboard", tags=["dashboard"])
api_router.include_router(ai_router,       prefix="/ai",        tags=["ai"])
api_router.include_router(jira_router,     prefix="/jira",      tags=["jira"])
```

---

### 3.1 API Проблем

#### `GET /problems`

**Параметры запроса:**

| Параметр              | Тип       | Описание                                        |
|-----------------------|-----------|-------------------------------------------------|
| `status`              | str[]     | new, in_progress, resolved, closed              |
| `priority`            | str[]     | critical, high, medium, low                     |
| `severity`            | str[]     | blocker, critical, major, moderate, minor       |
| `owner_id`            | UUID[]    |                                                 |
| `team_id`             | UUID[]    |                                                 |
| `product_id`          | UUID[]    |                                                 |
| `has_workaround`      | bool      |                                                 |
| `sla_breached`        | bool      |                                                 |
| `triage_sla_breached` | bool      |                                                 |
| `has_unresearched`    | bool      |                                                 |
| `has_pending_drafts`  | bool      | есть задачи в статусе draft/pending_confirmation|
| `missing_notes`       | bool      | есть задачи без support_notes                   |
| `is_visible_in_jira`  | bool      |                                                 |
| `tags`                | str[]     |                                                 |
| `created_from`        | date      |                                                 |
| `created_to`          | date      |                                                 |

**Pydantic-схема ответа:**
```python
class ProblemListItem(BaseModel):
    id: UUID
    short_id: str
    title: str
    status: str
    priority: str
    severity: str
    owner: UserShort | None
    team: TeamShort
    affected_products: list[ProductShort]
    tickets_count: int
    tickets_delta_pct: float | None
    tasks_count: int
    bugs_count: int
    tickets_no_task_count: int
    unresearched_count: int
    unresearched_delta_pct: float | None
    pending_drafts_count: int
    tasks_missing_notes_count: int
    has_workaround: bool
    is_visible_in_jira: bool
    triage_sla_deadline: datetime | None
    triage_sla_breached: bool
    sla_deadline: datetime | None
    sla_breached: bool
    tags: list[str]
    created_at: datetime
    updated_at: datetime
```

---

#### `POST /problems`

Создать проблему (оператор, из очереди `problem_determination`).

**Тело:**
```json
{
  "title": "строка",
  "description": "строка",
  "priority": "high",
  "severity": "major",
  "team_id": "UUID",
  "owner_id": "UUID",
  "product_ids": ["UUID"],
  "affected_services": ["pdf-service"],
  "tags": ["payment"],
  "sla_deadline": "2026-05-15T12:00:00Z",
  "source_ticket_id": "UUID"
}
```

**Side effects:**
- `triage_sla_deadline = created_at + 24h` (триггер)
- Email → `team.email_list`, уведомление: `new_problem`
- In-app уведомление: `new_problem` всем разработчикам команды

**Ответ 201:** объект проблемы

---

#### `GET /problems/:id`

**Ответ 200:**
```json
{
  "data": {
    "id": "uuid", "short_id": "PROB-1234", "title": "...",
    "description": "...",
    "status": "in_progress",
    "triage_sla_deadline": "2026-05-10T09:00:00Z",
    "triage_sla_breached": false,
    "tasks": [
      {
        "id": "uuid", "short_id": "BUG-5678",
        "task_type": "bug", "status": "open",
        "title": "...", "has_workaround": true,
        "support_notes_required": false,
        "jira_url": "https://...",
        "tickets_count": 98
      },
      {
        "task_type": "ui_debt", "status": "draft",
        "title": "Кнопка не видна на маленьких экранах",
        "proposed_by": {"name": "Анна Соколова"},
        "support_notes_required": false
      }
    ],
    "recent_tickets": [],
    "activity": [],
    "sparkline_7d": [12, 18, 24, 31, 28, 35, 42],
    "stats": {
      "tickets_today": 18,
      "products_breakdown": {"osago": 85, "kasko": 34},
      "platforms_breakdown": {"mobile_app": 76, "web": 48}
    }
  }
}
```

---

#### `PATCH /problems/:id`

Частичное обновление. При переходе `status: new → in_progress` очищается `triage_sla_breached`.

---

#### `DELETE /problems/:id`

Мягкое удаление (`status = closed`). **Ответ 204**

---

#### `GET /problems/:id/tickets`
#### `GET /problems/:id/tasks`

Параметры — аналогично соответствующим глобальным эндпоинтам.

Для `/tasks`: дополнительно `status` (включая `draft`, `pending_confirmation`), `task_type`, `missing_notes`.

---

#### `GET /problems/:id/activity`
#### `GET /problems/:id/sparkline`
#### `POST /problems/bulk`

Bulk: assign | change_status | add_tag | change_priority.

---

### 3.2 API Задач

#### `GET /tasks`

**Параметры:**

| Параметр       | Тип      | Описание                                                   |
|----------------|----------|------------------------------------------------------------|
| `problem_id`   | UUID     |                                                            |
| `task_type`    | str[]    | bug, ui_debt, backlog, cjm_debt                            |
| `status`       | str[]    | включая draft, pending_confirmation, rejected_draft        |
| `team_id`      | UUID[]   |                                                            |
| `has_workaround`| bool    |                                                            |
| `missing_notes`| bool     | только задачи с `support_notes_required = TRUE`            |
| `is_draft`     | bool     | status IN (draft, pending_confirmation)                    |
| `jira_key`     | str      |                                                            |
| `environment`  | str[]    |                                                            |

---

#### `POST /tasks`

Создать задачу. Если создаёт оператор — статус `draft`; если команда — `open`.

**Тело:**
```json
{
  "problem_id": "UUID",
  "task_type": "bug",
  "title": "строка",
  "description": "строка",
  "priority": "high",
  "severity": "critical",
  "team_id": "UUID",
  "workaround": "строка",
  "support_notes": "строка",
  "environments": ["production", "ios"],
  "tags": ["строка"],
  "proposed_by_operator": true
  // true → status: "draft", proposed_by: current_user
  // false (по умолчанию) → status: "open", created directly by team
}
```

**Side effects при `status = draft`:**
- In-app уведомление команде: `draft_proposal_received`

**Side effects при `support_notes IS NULL AND status = open`:**
- WebSocket: `task:support_notes_missing`
- Email алерт команде (ежедневный job)

**Ответ 201:** созданная задача

---

#### `POST /tasks/:id/submit-for-review`

Оператор отправляет черновик команде на рассмотрение.

**Действие:** `status: draft → pending_confirmation`

**Side effects:**
- In-app + Email → команда-владелец проблемы: `draft_proposal_received`
- Задача появляется в РМО-пространстве команды с маркером «Ожидает подтверждения»

**Ответ 200:** обновлённая задача

---

#### `POST /tasks/:id/confirm`

Команда подтверждает задачу.

**Тело:**
```json
{
  "review_comment": "строка",
  "jira_url": "https://jira.company.com/browse/CORE-4567",
  "jira_issue_key": "CORE-4567",
  "jira_issue_id": "10042",
  "support_notes": "строка"
}
```

**Действие:** `status: pending_confirmation → open`

**Side effects:**
- `reviewed_by = current_user`, `reviewed_at = NOW()`
- `tasks.jira_url`, `jira_issue_key` заполняются
- `problems.is_visible_in_jira → TRUE` (триггер)
- In-app + Email → `proposed_by`: `draft_confirmed`

**Ответ 200:** задача со статусом `open`

---

#### `POST /tasks/:id/reject`

Команда отклоняет задачу.

**Тело:**
```json
{ "review_comment": "строка (обязательно)" }
```

**Действие:** `status: pending_confirmation → rejected_draft`

**Side effects:**
- Задача сохраняется в истории (не удаляется)
- In-app + Email → `proposed_by`: `draft_rejected`

**Ответ 200:** задача со статусом `rejected_draft`

---

#### `GET /tasks/:id`

Детали задачи с тикетами. Используется для навигации Jira → РМО.

**Ответ 200:**
```json
{
  "data": {
    "id": "uuid", "short_id": "BUG-5678",
    "task_type": "bug", "status": "open",
    "problem": {"id": "uuid", "short_id": "PROB-1234", "title": "..."},
    "support_notes_required": false,
    "proposed_by": null,
    "linked_tickets": [
      {
        "id": "uuid", "short_id": "TKT-91011",
        "user_id": "cust_12345",
        "summary": "Не открывается документ после оплаты",
        "platform": "mobile_app",
        "product": {"name": "ОСАГО"},
        "ticket_date": "...",
        "attachments": [
          {"file_name": "crash_log.txt", "is_log": true, "url": "https://s3.../..."}
        ]
      }
    ],
    "tickets_by_product":   {"osago": 78, "kasko": 20},
    "tickets_by_platform":  {"mobile_app": 62, "web": 36},
    "activity": [],
    "ai_summary": "Баг проявляется на iOS 17.4 при..."
  }
}
```

---

#### `PATCH /tasks/:id`

**Типовые операции:**
```json
// Добавить workaround (снимает статус missing_notes)
{ "workaround": "Попросить очистить кэш", "has_workaround": true, "support_notes": "..." }

// Зафиксировать исправление
{ "status": "fixed", "fix_date": "2026-05-08T10:00:00Z", "fix_version": "2.14.0" }

// Привязать Jira (из Ручного создания командой)
{ "jira_url": "https://...", "jira_issue_key": "CORE-4567" }
```

---

#### `POST /tasks/:id/tickets`

Привязать тикет к задаче. `{ "ticket_id": "UUID" }`

---

#### `DELETE /tasks/:id/tickets/:ticket_id`

Отвязать тикет. **Ответ 204**

---

#### `POST /tasks/bulk`

assign | change_status | add_tag | link_to_jira.

---

### 3.3 API Очередей

#### `GET /queues`

Список очередей с live-счётчиками.

**Ответ 200:**
```json
{
  "data": [
    {
      "id": "uuid", "code": "problem_determination",
      "name": "Определение проблемы",
      "pending_count": 34, "in_progress_count": 5,
      "sla_breached_count": 2,
      "avg_wait_minutes": 18,
      "oldest_item_at": "2026-05-09T07:15:00Z"
    }
  ]
}
```

---

#### `GET /queues/:code/items`

Позиции в очереди.

**Параметры:** `status`, `assigned_to`, `sla_breached`, `limit`

**Ответ 200:**
```json
{
  "data": [
    {
      "id": "uuid", "priority_score": 0.94,
      "status": "pending",
      "reason": "AI confidence 0.71 < threshold 0.9",
      "sla_deadline": "2026-05-09T14:00:00Z",
      "ticket": {
        "id": "uuid", "short_id": "TKT-91011",
        "summary": "Не открывается документ после оплаты ОСАГО",
        "product": {"name": "ОСАГО"}, "platform": "mobile_app",
        "ai_problem_confidence": 0.71,
        "problem": null
      }
    }
  ]
}
```

---

#### `POST /queues/:code/items/:id/take`

Взять позицию в работу. **Ответ 200:** `status: in_progress`

---

#### `POST /queues/:code/items/:id/resolve`

Завершить обработку. `{ "resolution": "строка" }` **Ответ 200:** `status: completed`

---

#### `POST /queues/:code/items/:id/skip`

Вернуть в очередь. **Ответ 200:** `status: pending`

---

### 3.4 API Обращений

#### `GET /tickets`

**Параметры:**

| Параметр           | Тип   | Описание                                    |
|--------------------|-------|---------------------------------------------|
| `problem_id`       | UUID  |                                             |
| `task_id`          | UUID  |                                             |
| `status`           | str[] | new, in_queue, linked, resolved, ...        |
| `current_queue`    | str   | problem_determination, task_determination, ...|
| `product_id`       | UUID[]|                                             |
| `platform`         | str[] |                                             |
| `channel`          | str[] |                                             |
| `region`           | str[] |                                             |
| `requires_research`| bool  |                                             |
| `no_task`          | bool  | тикеты без привязанной задачи               |
| `user_id`          | str   | внешний ID клиента                          |
| `assigned_to`      | UUID  |                                             |
| `date_from`        | date  |                                             |
| `date_to`          | date  |                                             |

---

#### `POST /tickets`

```json
{
  "user_id": "строка",
  "product_id": "UUID",
  "platform": "mobile_app",
  "raw_text": "строка",
  "summary": "строка",
  "ticket_date": "ISO datetime",
  "channel": "email",
  "region": "строка",
  "problem_id": "UUID",
  "task_id": "UUID",
  "tags": ["строка"]
}
```

**Side effects:** запускается Celery-задача `classify_ticket.delay(ticket_id)`.

---

#### `GET /tickets/:id`

```json
{
  "data": {
    "current_queue": "task_determination",
    "recommendation_text": null,
    "problem": {"id": "uuid", "short_id": "PROB-1234"},
    "task": {
      "short_id": "BUG-5678", "task_type": "bug",
      "status": "open", "has_workaround": true,
      "workaround": "Попросить очистить кэш",
      "support_notes": "Подтверждён на iOS 17.4+..."
    },
    "attachments": [
      {"file_name": "crash_log.txt", "is_log": true, "url": "..."}
    ],
    "ai_suggestions": [
      {
        "suggestion_type": "task_match",
        "suggested_entity_id": "uuid",
        "confidence": 0.88,
        "reasoning": "Совпадает: iOS, ОСАГО, пустой экран"
      }
    ],
    "queue_item": {
      "queue_code": "task_determination",
      "priority_score": 0.91,
      "sla_deadline": "2026-05-09T14:00:00Z"
    },
    "activity": [], "comments": []
  }
}
```

---

#### `PATCH /tickets/:id`

```json
// Привязать проблему
{ "problem_id": "UUID", "status": "processing" }

// Привязать задачу
{ "task_id": "UUID", "status": "linked" }

// Сохранить рекомендацию
{ "recommendation_text": "...", "recommendation_sent": true, "status": "resolved" }

// На исследование
{ "requires_research": true, "status": "researching" }

// Дубль
{ "is_duplicate": true, "duplicate_of": "UUID", "status": "duplicate" }
```

---

#### `POST /tickets/:id/attachments`

`multipart/form-data`: file, is_log, is_screenshot. **Ответ 201:** вложение + presigned URL.

---

#### `POST /tickets/bulk`

link_to_problem | link_to_task | change_status | assign | mark_research | mark_duplicate.

---

#### `GET /tickets/triage-queue`

```json
{
  "data": {
    "total_by_queue": {
      "problem_determination": 34,
      "task_determination": 12,
      "recommendation_review": 8,
      "client_response": 21
    },
    "critical_spikes": [
      {
        "problem_id": "uuid",
        "problem_title": "Не загружается полис ОСАГО",
        "new_tickets_1h": 34,
        "delta_pct_wow": 280
      }
    ],
    "queue": [
      {
        "triage_score": 0.94,
        "reasons": ["no_similar_tasks", "spike_detected"],
        "recommended_queue": "task_determination"
      }
    ]
  }
}
```

---

### 3.5 API Дашборда и аналитики

#### `GET /dashboard/summary`

```json
{
  "data": {
    "total_open_problems": 24,
    "critical_problems": 3,
    "sla_breached": 2,
    "triage_sla_breached": 4,
    "total_tickets_today": 318,
    "tickets_delta_pct_wow": 12.4,
    "unresearched_total": 156,
    "tasks_missing_support_notes": 7,
    "pending_draft_tasks": 5,
    "queues_summary": {
      "problem_determination": 34,
      "task_determination": 12,
      "recommendation_review": 8,
      "client_response": 21
    },
    "trending_problems": [
      {"id": "uuid", "title": "...", "tickets_delta_pct": 280, "alert_level": "critical"}
    ],
    "tickets_by_product":  {"osago": 145, "kasko": 89},
    "tickets_by_platform": {"mobile_app": 156, "web": 98},
    "tickets_by_hour_today": [{"hour": "09:00", "count": 42}]
  }
}
```

---

#### `GET /dashboard/problems-heatmap`

Параметры: `period` (7d/30d/90d), `group_by` (product/platform/team).

---

#### `GET /analytics/trends`

Параметры: `problem_id`, `period`, `granularity` (hour/day/week).

---

#### `GET /analytics/queue-metrics`

Параметры: `period`, `queue_code`.

---

### 3.6 API Поиска

#### `GET /search`

Параметры: `q`, `type` (all/problem/task/ticket), `limit`.

---

#### `POST /search/semantic`

```json
{ "query": "строка", "type": "ticket|task|problem|all", "limit": 10, "threshold": 0.75 }
```

---

### 3.7 API Комментариев

#### `GET /:entity_type/:entity_id/comments`
#### `POST /:entity_type/:entity_id/comments`

`entity_type`: problems | tasks | tickets

---

### 3.8 AI API

#### `POST /ai/suggest`

```json
// Запрос
{ "ticket_id": "UUID" }

// Ответ
{
  "data": {
    "problem_suggestions":  [{"problem_id": "uuid", "confidence": 0.71}],
    "task_suggestions":     [{"task_id": "uuid", "confidence": 0.88, "has_workaround": true}],
    "duplicate_suggestions":[{"ticket_id": "uuid", "confidence": 0.94}],
    "recommended_queue": "task_determination",
    "auto_linked": false,
    "summary": "Клиент не может открыть полис ОСАГО на iOS 17.4"
  }
}
```

---

#### `POST /ai/detect-anomaly`

```json
// Запрос
{ "problem_id": "UUID", "window_minutes": 60 }

// Ответ
{ "is_spike": true, "severity": "critical", "z_score": 4.2,
  "current_rate": 34, "baseline_rate": 8,
  "message": "Обращения выросли в 4.25x за последний час" }
```

---

#### `POST /ai/recalculate-priority`

```json
// Запрос
{ "entity_type": "problem", "entity_id": "UUID" }

// Ответ
{ "old_priority": "medium", "new_priority": "high",
  "reason": "tickets_count +180% WoW, spike_score=0.87" }
```

---

#### `POST /ai/suggestions/:id/accept`
#### `POST /ai/suggestions/:id/reject`

---

### 3.9 API Jira-интеграции

#### `POST /jira/webhook`

Входящий вебхук при изменении статуса задачи в Jira.

```python
# app/api/v1/jira.py
@router.post("/webhook", status_code=200)
async def jira_webhook(payload: JiraWebhookPayload, db: AsyncSession = Depends(get_db)):
    task = await task_service.get_by_jira_key(db, payload.issue_key)
    if task:
        await task_service.sync_from_jira(db, task, payload.issue)
```

Синхронизирует: `status`, `fix_date`, `fix_version`.

---

#### `GET /jira/task-link/:jira_issue_key`

Глубинная ссылка Jira → РМО. Возвращает задачу + тикеты + вложения.

---

### 3.10 API Уведомлений

#### `GET /notifications`

Параметры: `unread_only`, `limit`.

---

#### `PATCH /notifications/read-all`

**Ответ 204**

---

### 3.11 Аутентификация

#### `POST /auth/login`
#### `POST /auth/refresh`
#### `POST /auth/sso`

---

## 4. Пользовательские пути <a name="user-paths"></a>

### 4.1 Полный AI-пайплайн обработки нового обращения

```
POST /tickets → Celery: classify_ticket.delay(ticket_id)
│
├─── а. Генерация эмбеддинга (OpenAI / local model)
├─── б. pgvector: поиск похожих тикетов
├─── в. pgvector: candidate problems (cosine similarity)
├─── г. pgvector + Claude API: candidate tasks
├─── д. Claude API: генерация summary
├─── е. Детекция дублей (confidence > 0.9)
├─── ж. Вычисление triage_score
│
├─── Проблема: confidence ≥ 0.9
│    → PATCH ticket { problem_id }; продолжаем
│    confidence < 0.9
│    → QueueItem(problem_determination); PATCH ticket { current_queue }; СТОП
│
├─── Задача: confidence ≥ 0.9
│    → PATCH ticket { task_id }; продолжаем
│    confidence < 0.9
│    → QueueItem(task_determination); СТОП
│
├─── task.has_workaround = True
│    → recommendation_text = task.workaround
│    → QueueItem(recommendation_review); СТОП
│
└─── task.has_workaround = False
     → QueueItem(client_response); СТОП
```

---

### 4.2 Оператор — Очередь определения проблемы

```
GET /queues/problem_determination/items
POST /queues/problem_determination/items/:id/take
GET /tickets/:id  (читает ai_suggestions)
│
├─── Существующая проблема подходит
│    PATCH /tickets/:id { problem_id }
│    → Tикет автоматически попадает в очередь task_determination
│
└─── Нужна новая проблема
     POST /problems { title, description, team_id, ... }
     Side effects: triage_sla, email команде
     PATCH /tickets/:id { problem_id }
POST /queues/problem_determination/items/:id/resolve
```

---

### 4.3 Оператор — Очередь определения задачи

```
POST /queues/task_determination/items/:id/take
GET /problems/:id/tasks  (проверяем существующие задачи)
│
├─── Задача найдена
│    PATCH /tickets/:id { task_id }
│
├─── Нужна новая задача → создать черновик
│    POST /tasks { problem_id, task_type, title, ..., proposed_by_operator: true }
│    → status: "draft"
│    POST /tasks/:id/submit-for-review
│    → status: "pending_confirmation", уведомление команде
│    PATCH /tickets/:id { requires_research: true }
│
└─── Нет подходящей задачи, нужно исследование
     PATCH /tickets/:id { requires_research: true, status: "researching" }

POST /queues/task_determination/items/:id/resolve
```

---

### 4.4 Команда — Рассмотрение черновика в РМО-пространстве

```
GET /tasks?is_draft=true&team_id=:my_team
│
├─── Подтвердить
│    POST /tasks/:id/confirm { jira_url, jira_issue_key, support_notes }
│    → status: "open", задача появляется в Jira
│    → Уведомление оператору: draft_confirmed
│
└─── Отклонить
     POST /tasks/:id/reject { review_comment }
     → status: "rejected_draft" (сохраняется в истории)
     → Уведомление оператору: draft_rejected
```

---

### 4.5 Оператор — Контроль рекомендации и ответ клиенту

```
// Очередь recommendation_review
POST /queues/recommendation_review/items/:id/take
GET /tickets/:id  (читаем recommendation_text из task.workaround)
├─── Рекомендация подходит:
│    PATCH /tickets/:id { recommendation_sent: true, status: "resolved" }
└─── Не подходит → переводим в client_response

// Очередь client_response
POST /queues/client_response/items/:id/take
GET /tickets/:id  (изучаем проблему, support_notes)
PATCH /tickets/:id { status: "awaiting_response" }
POST /tickets/:id/comments { body: "Черновик ответа", is_internal: false }
POST /queues/client_response/items/:id/resolve
```

---

### 4.6 Команда — Разбор новой проблемы

```
// Email: "Новая проблема PROB-1234 назначена команде Core Team"
// SLA: 1 день на переход из статуса "new"

GET /problems/:id
GET /problems/:id/tickets?sort_by=created_at&sort_dir=desc

// Создать задачи по корневым причинам
POST /tasks { problem_id, task_type: "bug", title, workaround, support_notes, team_id }
POST /tasks { problem_id, task_type: "ui_debt", ... }
// Задачи создаются командой напрямую → status: "open"
// Затем вручную заводятся в Jira

PATCH /tasks/:id { jira_url, jira_issue_key }
// → problems.is_visible_in_jira = TRUE (триггер)

// Рассмотреть черновики операторов
GET /tasks?is_draft=true&problem_id=:id
POST /tasks/:id/confirm  или  /reject

PATCH /problems/:id { status: "in_progress" }
```

---

### 4.7 Разработчик — Дебаг из Jira

```
// Клик по ссылке в Jira-задаче → РМО
GET /jira/task-link/CORE-1234
// Видит: все тикеты с вложениями, user_ids, платформы, регионы

GET /problems/:id
// Полный контекст проблемы, другие задачи

PATCH /tasks/:id {
  root_cause: "Race condition в PDF-генераторе",
  workaround: "Повторить через 5 минут",
  has_workaround: true,
  support_notes: "Подтверждён на iOS 17.4+. Android не затронут."
}
// → WebSocket: task:workaround_added → все операторы уведомлены
```

---

### 4.8 Руководитель triage — Утренний обзор

```
GET /dashboard/summary?period=today
// Проверить: queues_summary, triage_sla_breached, spike-алерты

GET /tickets/triage-queue
// Назначить операторов:
POST /tickets/bulk { action: "assign", payload: { assigned_to: uuid } }

GET /problems?triage_sla_breached=true
// Эскалировать:
PATCH /problems/:id { priority: "critical" }

GET /tasks?missing_notes=true
// Напомнить командам
```

---

## 5. Спецификация AI-агента и очередей <a name="ai-features"></a>

### 5.1 Пороги уверенности

| Операция               | Порог авто-действия | Ниже порога                       |
|------------------------|---------------------|-----------------------------------|
| Привязка проблемы      | ≥ 0.90              | Очередь `problem_determination`   |
| Привязка задачи        | ≥ 0.90              | Очередь `task_determination`      |
| Детекция дубля         | ≥ 0.90              | Предложение оператору             |
| Рекомендация workaround| ≥ 0.85              | Выбор лучшего совпадения          |

Порог настраивается через `app_settings['ai_confidence_threshold']`.

### 5.2 Обзор AI-задач Celery

```python
# app/workers/classification.py

@celery.task(bind=True, max_retries=3)
def classify_ticket(self, ticket_id: str):
    """
    1. Генерация эмбеддинга (OpenAI text-embedding-3-small)
    2. pgvector: поиск похожих тикетов (cosine)
    3. pgvector: поиск candidate problems
    4. pgvector + Claude: поиск candidate tasks
    5. Claude API: генерация summary (claude-3-5-haiku)
    6. Детекция дублей
    7. Вычисление triage_score
    8. Принятие решений по порогам → авто-привязка или очередь
    9. WebSocket push оператору
    """
```

```python
# app/workers/anomaly_detection.py

@celery.task
def detect_anomalies():
    """
    Каждые 5 минут.
    Z-score по скользящему окну 1 час vs. тот же час прошлой недели.
    При z > 3.0: WebSocket broadcast + Email владельцу проблемы.
    """
```

```python
# app/workers/priority_recalc.py

@celery.task
def recalculate_all_priorities():
    """
    Каждый час. Для всех активных проблем и задач:
    - Вычислить delta_wow
    - Если delta > порога → повысить priority
    - Записать в priority_recalculation_log
    - Уведомить owner + team
    """
```

### 5.3 Формула triage score

```python
def calculate_triage_score(ticket: SupportTicket) -> float:
    weights = {
        "is_new_case":           0.25,  # нет похожих тикетов в системе
        "no_task":               0.20,  # нет привязанной задачи
        "spike":                 0.20,  # проблема в фазе роста
        "product_criticality":   0.15,  # ОСАГО/КАСКО > НС/ДМС
        "platform":              0.10,  # mobile > web (исторически)
        "age_decay":             0.05,  # старые нерешённые важнее
        "low_confidence":        0.05,  # AI uncertainty
    }
    # Итоговый score: 0.0 – 1.0, нормализованный
```

### 5.4 Обнаружение аномалий

```python
def z_score(current: float, baseline: float, std: float) -> float:
    return (current - baseline) / (std + 1e-9)

# z > 3.0 → severity = "critical"
# z > 2.0 → severity = "warning"
```

### 5.5 Динамический пересчёт приоритета

```python
THRESHOLDS = {
    "critical": {"delta_wow_pct": 200, "min_tickets": 50},
    "high":     {"delta_wow_pct": 100, "min_tickets": 20},
    "medium":   {"delta_wow_pct":  50, "min_tickets":  5},
}
```

---

## 6. Управление доступом (RBAC) <a name="rbac"></a>

| Разрешение                                    | admin | operator | developer | viewer |
|-----------------------------------------------|-------|----------|-----------|--------|
| Просмотр проблем / задач / тикетов            | ✓     | ✓        | ✓         | ✓      |
| Создание тикета                               | ✓     | ✓        | ✓         | ✗      |
| Создание / редактирование проблемы            | ✓     | ✓        | ✓         | ✗      |
| Создание задачи (от команды, status=open)     | ✓     | ✗        | ✓         | ✗      |
| Создание черновика задачи (status=draft)      | ✓     | ✓        | ✓         | ✗      |
| Отправить черновик на review                  | ✓     | ✓        | ✓         | ✗      |
| Подтвердить / отклонить черновик              | ✓     | ✗        | ✓         | ✗      |
| Обработка позиций в очередях                  | ✓     | ✓        | ✗         | ✗      |
| Удаление проблемы / задачи                    | ✓     | ✗        | ✗         | ✗      |
| Массовые операции                             | ✓     | ✓        | ✓         | ✗      |
| Управление пользователями / командами         | ✓     | ✗        | ✗         | ✗      |
| Просмотр аналитики и дашборда                 | ✓     | ✓        | ✓         | ✓      |
| Принятие AI-подсказок                         | ✓     | ✓        | ✓         | ✗      |
| Настройка очередей, SLA, ai_threshold         | ✓     | ✗        | ✗         | ✗      |
| Просмотр и управление в РМО-пространстве      | ✓     | ✓        | ✓         | ✓      |

---

## 7. Система событий и уведомлений <a name="events"></a>

### 7.1 WebSocket события

| Событие                      | Полезная нагрузка                 | Получатели               |
|------------------------------|-----------------------------------|--------------------------|
| `ticket:created`             | ticket_id                         | все операторы            |
| `ticket:classified`          | ticket_id, problem_id, task_id    | назначенный оператор     |
| `ticket:queued`              | ticket_id, queue_code, reason     | операторы очереди        |
| `problem:spike_detected`     | problem_id, delta_pct, severity   | все операторы            |
| `problem:triage_sla_breach`  | problem_id, team_id               | команда + triage-лид     |
| `problem:sla_breach`         | problem_id, owner_id              | owner + triage           |
| `task:workaround_added`      | task_id, problem_id               | все операторы            |
| `task:support_notes_missing` | task_id, team_id                  | команда-владелец         |
| `task:draft_for_review`      | task_id, problem_id, team_id      | команда-владелец         |
| `task:draft_confirmed`       | task_id                           | предложивший оператор    |
| `task:draft_rejected`        | task_id, review_comment           | предложивший оператор    |
| `priority:changed`           | entity_type, entity_id, new_prio  | owner + team             |
| `notification:new`           | объект уведомления                | целевой пользователь     |

### 7.2 Email-уведомления

| Триггер                                       | Получатели              | Тип                        |
|-----------------------------------------------|-------------------------|----------------------------|
| Создана новая проблема                        | team.email_list         | `new_problem`              |
| Истёк triage SLA (24ч, статус `new`)          | Команда + triage-лид    | `triage_sla_breach`        |
| Задача без `support_notes` (ежедневно 9:00)   | Команда-владелец задачи | `support_notes_missing`    |
| Черновик задачи отправлен на review           | Команда-владелец проблемы| `draft_proposal_received` |
| Черновик подтверждён / отклонён              | Предложивший оператор   | `draft_confirmed/rejected` |
| Приоритет пересчитан вверх                   | Owner + команда         | `priority_changed`         |
| Spike-алерт (z > 3.0)                        | Владелец проблемы       | `spike_alert`              |

### 7.3 Исходящие вебхуки

| Событие                     | Jira | Slack | PagerDuty |
|-----------------------------|------|-------|-----------|
| Изменение статуса проблемы  | ✓    | ✓     | —         |
| Spike-алерт                 | —    | ✓     | ✓         |
| Нарушение SLA               | ✓    | ✓     | ✓         |
| Задача исправлена           | ✓    | ✓     | —         |
| Черновик подтверждён        | ✓    | ✓     | —         |

---

## 8. Интеграция с Jira и РМО-пространство <a name="jira-integration"></a>

### 8.1 РМО-пространство

РМО — раздел сервиса для команды разработки. Содержит:
- Бэклог проблем команды с triage SLA индикаторами
- Задачи по каждой проблеме, включая черновики от операторов
- Подсветка красным: задачи без `support_notes`
- Черновики: список задач `draft / pending_confirmation` с кнопками «Подтвердить» / «Отклонить»
- Привязанные тикеты с вложениями для дебага

### 8.2 Жизненный цикл задачи относительно Jira

```
tasks.status = draft / pending_confirmation
  → Видна только в РМО, НЕ в Jira

tasks.status = open + jira_url заполнен
  → Связана с Jira-задачей
  → problems.is_visible_in_jira = TRUE

Jira → /jira/webhook
  → Синхронизация status, fix_date, fix_version
```

### 8.3 Глубинная ссылка Jira → РМО

Кастомное поле в Jira: `РМО-ссылка = https://rmo.company.com/tasks/CORE-1234`

При клике разработчик видит `GET /jira/task-link/CORE-1234`:
- Все тикеты с вложениями (логи, скриншоты)
- Breakdown по продуктам, платформам, регионам
- Кнопка «Открыть проблему» → навигация вверх до Problem

### 8.4 Алерт о задачах без `support_notes`

- В интерфейсе бэклога — строка подсвечивается красным
- Ежедневно 9:00 — Email команде (Celery job `send_support_notes_alerts`)
- WebSocket `task:support_notes_missing` при создании задачи без рекомендаций

---

## 9. Поиск и фильтрация <a name="search"></a>

### 9.1 Сохранение фильтров

Фильтры синхронизируются: `localStorage` ↔ `saved_filters`. URL отражает состояние фильтров.

### 9.2 Быстрые фильтры

| Метка                                  | Параметры                                      |
|----------------------------------------|------------------------------------------------|
| 🔴 Критические и незакрытые            | status=open&priority=critical                  |
| ⚠️ Нарушение SLA                      | sla_breached=true                              |
| 🕐 Нарушение triage SLA               | triage_sla_breached=true                       |
| 📈 Растут (>50% WoW)                  | sort_by=tickets_delta_pct&sort_dir=desc        |
| 🔍 Требуют разбора                    | requires_research=true                         |
| 🐛 Без заведённых задач               | no_task=true                                   |
| 🚫 Без workaround                     | has_workaround=false                           |
| 🔴 Задачи без рекомендаций            | missing_notes=true                             |
| 📋 Черновики — ожидают подтверждения  | is_draft=true                                  |
| 👤 Мои проблемы                       | owner_id=me                                    |
| 🏢 Моя команда                        | team_id=my_team                                |

---

## 10. Нефункциональные требования <a name="nfr"></a>

### 10.1 Производительность

| Метрика                          | Цель                       |
|----------------------------------|----------------------------|
| Список проблем (p95)             | < 200 мс                   |
| Детали тикета (p95)              | < 300 мс                   |
| Список позиций очереди (p95)     | < 150 мс                   |
| Глобальный поиск (p95)           | < 500 мс                   |
| Семантический поиск (p95)        | < 1 000 мс                 |
| Сводка дашборда (p95)            | < 400 мс (из кэша)         |
| AI-классификация (async)         | < 10 с сквозная задержка   |
| Маршрутизация в очередь          | < 10 с после создания      |
| Пропускная способность создания  | 100 запр./сек              |
| Одновременных пользователей      | 500                        |

### 10.2 Кэширование

| Данные                        | TTL      | Тип       |
|-------------------------------|----------|-----------|
| Сводка дашборда               | 1 мин    | Redis     |
| Счётчики очередей             | 30 сек   | Redis     |
| Список проблем (без фильтров) | 30 сек   | Redis     |
| Материализованное представление| 5 мин   | PostgreSQL|
| Пользовательская сессия       | 1 час    | Redis     |
| AI-подсказки                  | постоянно| БД        |
| Результаты поиска             | 60 сек   | Redis     |

### 10.3 Rate Limits

| Группа                  | Лимит                  |
|-------------------------|------------------------|
| GET                     | 1 000 запр./мин/польз. |
| POST / PATCH            | 200 запр./мин/польз.   |
| Очереди                 | 100 запр./мин/польз.   |
| Bulk операции           | 20 запр./мин/польз.    |
| AI-эндпоинты            | 60 запр./мин/польз.    |
| Поиск                   | 200 запр./мин/польз.   |

### 10.4 Хранение данных

| Тип данных                  | Срок     |
|-----------------------------|----------|
| Обращения                   | 3 года   |
| Журналы активности          | 2 года   |
| Вложения                    | 1 год    |
| AI-подсказки                | 90 дней  |
| Уведомления                 | 30 дней  |
| Недельные снимки            | 1 год    |
| Лог пересчётов приоритета   | 6 месяцев|
| Задачи (включая rejected)   | 2 года   |

### 10.5 Бизнес-инварианты

| Правило                                                                              |
|--------------------------------------------------------------------------------------|
| Каждый тикет попадает в очередь или автоматически разрешается за ≤ 10 с             |
| Проблема без `team_id` создана быть не может                                         |
| Черновик задачи (draft/pending_confirmation) не создаёт Jira-issue до подтверждения  |
| `rejected_draft` не удаляется — переходит в архив                                    |
| Задача со статусом `open`/`in_progress` и пустым `support_notes` — красная подсветка |
| Triage SLA проблемы = 24 часа с момента создания (конфиг в `app_settings`)           |
| Порог AI авто-привязки настраивается в `app_settings['ai_confidence_threshold']`     |

---

## 11. Комментарии CPO <a name="cpo-review"></a>

*Взгляд на продукт с позиции Chief Product Officer.*

---

### 🔴 Критические пробелы

**1. Нет петли обратной связи от клиента**

Система отслеживает, что мы *сделали* с тикетом, но не знает, *помогло* ли это клиенту. Поле `recommendation_sent = true` — это наша метрика, не клиентская. Без CSAT/rating после закрытия тикета мы слепы к реальному качеству поддержки. Нужно: `ticket.customer_satisfaction` (1–5), `ticket.reopened` (клиент написал снова), механизм re-open.

**2. Нет связи с продуктовым роадмапом**

Задачи типа `backlog` и `cjm_debt` создаются и исчезают в Jira. Продакт-менеджер не видит агрегированной «боли клиентов» в разрезе роадмапа. Нужно: возможность привязать задачу к продуктовой инициативе / OKR, экспорт приоритизированного бэклога с весами по tickets_count.

**3. Нет инструментов для стейкхолдеров**

Руководство и PM не будут заходить в операционный интерфейс ежедневно. Нужны: автоматический еженедельный дайджест (email / Slack) с ТОП-5 проблем, изменениями за неделю, SLA-статусом. Сейчас это невозможно без ручного экспорта.

---

### 🟡 Важные улучшения

**4. Приоритет — только по количеству обращений**

Динамический пересчёт считает только `tickets_count` и `delta_wow`. Но 10 обращений от корпоративных клиентов (B2B enterprise) могут быть важнее 200 от розничных. Нужна: сегментация клиентов (`customer_tier`: free / standard / enterprise), взвешенный приоритет с учётом tier.

**5. Нет публичного статус-пейджа / коммуникации наружу**

Критичные проблемы (severity = blocker/critical) должны отражаться на публичном статус-пейдже или в push-уведомлениях в мобильном приложении. Текущая система — полностью внутренняя. Нужен: механизм «опубликовать инцидент» с автоматическим обновлением статуса при изменении `status` проблемы.

**6. Дублирование проблем не управляется**

Система умеет находить дублирующие *тикеты*, но не дублирующие *проблемы*. Когда два оператора создают схожие проблемы PROB-100 и PROB-200, нет механизма их слияния. Нужно: `POST /problems/:id/merge` с переносом тикетов и задач.

**7. Нет жизненного цикла клиентской коммуникации**

Поле `recommendation_sent` — это бинарный флаг. Не видно: когда именно клиент получил ответ, читал ли, сколько раз мы писали. Для аналитики retention важна полная цепочка коммуникации.

---

### 🟢 Стратегические идеи

**8. База знаний из закрытых кейсов**

Каждый закрытый тикет с `recommendation_text` — это готовая статья для FAQ. При накоплении 50+ похожих тикетов система должна предлагать: «Создать статью в базе знаний?». Это снизит нагрузку на поддержку на горизонте 6–12 месяцев.

**9. Предсказание всплесков заранее**

Текущий детектор аномалий реактивный (z-score по факту). Можно построить простую модель: если в понедельник утром после релиза появляется 5+ тикетов на один продукт — это предиктивный сигнал всплеска. Ранний алерт даст команде 30–60 минут форы.

**10. Метрика «стоимость проблемы»**

Нет оценки, сколько времени сотрудников тратится на одну проблему. Если добавить `time_spent` на очередь — появится возможность считать ROI от каждого исправленного бага: «Баг CORE-1234 занимал 340 человеко-часов в поддержке».

---

## 12. Комментарии руководителя технической поддержки <a name="support-lead-review"></a>

*Взгляд на продукт с позиции Head of Support.*

---

### 🔴 Критические пробелы

**1. Нет управления рабочей нагрузкой операторов**

Система умеет распределять тикеты, но не видит: кто из операторов перегружен, у кого освободилось место. Нет `operator_workload` — счётчика активных позиций в работе. Нужно: ограничение max_concurrent_items на оператора, автоматическая балансировка при взятии позиций из очереди.

**2. Очередь `recommendation_review` — лишнее звено**

Сейчас оператор вручную контролирует отправку каждой рекомендации. При потоке 300+ тикетов в день это узкое место. Если AI уверенность в workaround ≥ 0.9 и `support_notes` заполнены командой — рекомендацию нужно отправлять автоматически, минуя очередь. Ручной контроль оставить только для `confidence < 0.85` или когда `support_notes` не заполнены.

**3. Нет механизма переоткрытия тикета**

Клиент написал снова через день — что произошло? Система создаёт новый тикет. Нет связи со старым. Оператор тратит время на повторный triage. Нужно: детекция re-open (тот же `user_id` + похожий `raw_text` ± 72 часа), автоматическая привязка к предыдущему тикету.

---

### 🟡 Важные улучшения

**4. Нет передачи контекста между сменами**

Ночная смена закрывает рабочий день, утренняя начинает с чистого листа. В позиции очереди нет поля `handoff_note` — краткой заметки «что я уже пробовал». Нужен: блок передачи дежурства с суммари открытых позиций и критичных проблем за смену.

**5. SLA считается только для проблем, не для тикетов**

У тикетов нет времени первого ответа (FRT) и времени полного разрешения (TTR). Это базовые метрики любого call-центра. Без них невозможно отчитываться перед бизнесом об уровне сервиса. Нужно: `ticket.first_response_at`, `ticket.resolved_at`, `ticket.sla_deadline` (индивидуальный, не от проблемы).

**6. Нет шаблонов ответов клиентам**

Операторы в очереди `client_response` каждый раз пишут ответ с нуля. Нужна: библиотека шаблонов (`response_templates`), привязанных к task_type и product, с переменными подстановки (`{{customer_name}}`, `{{workaround}}`). AI может предлагать релевантный шаблон.

**7. Нет эскалационного пути внутри системы**

Если оператор не может разобраться с тикетом, он... что? Нет кнопки «Эскалировать» с выбором уровня (L2 / Team Lead / Head of Support). Нет фиксации в системе, кто принял эскалацию. Нужно: `ticket.escalation_level` (l1/l2/l3), `ticket.escalated_to`, история эскалаций в `activity_log`.

**8. Производительность операторов невидима**

Руководитель поддержки не может в один клик посмотреть: сколько тикетов обработал каждый оператор сегодня, каковы средние FRT и TTR по агентам, кто систематически пропускает (`skip`) позиции. Нужен: раздел «Аналитика команды» с метриками по агентам.

---

### 🟢 Улучшения процесса

**9. Автоматическая отправка рекомендации при высокой уверенности**

При `ai_task_confidence ≥ 0.9` + `task.has_workaround = true` + `support_notes` заполнен — система может сразу записывать `recommendation_text` и переводить тикет в `recommendation_sent`, минуя обе очереди. Оператору остаётся только контроль исключений.

**10. «Горячая клавиша» быстрого triage**

Для массовых инцидентов (20+ тикетов за час по одной проблеме) нужен режим «быстрого закрытия»: оператор открывает очередь, видит 30 тикетов с одним bagом, одним кликом выбирает все → «Привязать к BUG-5678 и закрыть». Bulk action уже есть, но нужен специальный UI-режим с предзаполненными данными проблемы.

**11. Интеграция с CRM / системой тикетов клиента**

Сейчас система получает тикеты через API. Но агент поддержки работает и в CRM. Нужны: двусторонняя синхронизация статуса (resolved в РМО → resolved в CRM), возможность открыть карточку клиента из тикета одним кликом.

---

*Конец технической спецификации v3.0*
