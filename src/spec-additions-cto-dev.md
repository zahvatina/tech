# Технический аудит спецификации: что необходимо до начала разработки

**Документ:** Дополнение к спецификации v3.0  
**Роли:** CTO + Senior Developer  
**Статус:** Обязательно к закрытию до старта разработки

---

## Итоговый список блокеров

| # | Категория              | Проблема                                           | Приоритет |
|---|------------------------|----------------------------------------------------|-----------|
| 1 | Безопасность           | Нет секретов, HTTPS, CORS, OWASP-политики          | 🔴 BLOCKER |
| 2 | БД                     | Нет механизма генерации short_id (PROB-1234)       | 🔴 BLOCKER |
| 3 | API-контракт           | Нет формата ошибок и HTTP-кодов                    | 🔴 BLOCKER |
| 4 | Очереди                | Нет защиты от race condition при взятии позиции    | 🔴 BLOCKER |
| 5 | Auth                   | Нет структуры JWT и SSO-флоу                       | 🔴 BLOCKER |
| 6 | AI-пайплайн            | Нет стратегии отказа и retry при сбоях             | 🔴 BLOCKER |
| 7 | Среды                  | Нет env-переменных и стратегии окружений           | 🔴 BLOCKER |
| 8 | Инфраструктура         | Нет CI/CD, локальной разработки, миграций          | 🔴 BLOCKER |
| 9 | Данные                 | Нет обработки PII и compliance-требований          | 🟡 HIGH    |
| 10| API-контракт           | Нет правил пагинации, idempotency, атомарности bulk| 🟡 HIGH    |
| 11| WebSocket              | Нет протокола (auth, формат сообщений, reconnect)  | 🟡 HIGH    |
| 12| Файлы                  | Нет ограничений загрузки и TTL presigned URL        | 🟡 HIGH    |
| 13| Наблюдаемость          | Нет логирования, метрик, трейсинга                 | 🟡 HIGH    |
| 14| Тестирование           | Нет стратегии тестов и coverage-требований         | 🟡 HIGH    |
| 15| Резервирование         | Нет DR/backup-стратегии                            | 🟡 HIGH    |
| 16| Внешние зависимости    | Нет circuit breaker для Anthropic API, Jira        | 🟡 HIGH    |
| 17| БД                     | Нет типа индекса pgvector, нет reconcile счётчиков | 🟠 MEDIUM  |
| 18| Миграции               | Нет zero-downtime стратегии Alembic                | 🟠 MEDIUM  |

---

## 1. Безопасность <a name="security"></a>

### 1.1 Secrets Management

**Проблема:** спецификация называет внешние сервисы (Anthropic API, Jira, S3, SendGrid), но нет ни слова о том, как хранятся и ротируются секреты.

**Решение:**

```
Источники секретов:
  Production: HashiCorp Vault / AWS Secrets Manager / K8s Secrets (encrypted at rest)
  Staging:    Те же, отдельные секреты
  Dev:        .env файл (в .gitignore), пример в .env.example

Никаких секретов в:
  - коде
  - docker-compose.yml в репозитории
  - environment variables в Dockerfile
  - логах (маскировать: Authorization header, api_key, password)
```

**Полный список секретов (`.env.example`):**
```bash
# База данных
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/rmo

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=<min 32 символа, случайные>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# AI
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...           # для эмбеддингов
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# S3
S3_ENDPOINT_URL=https://s3.amazonaws.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=rmo-attachments
S3_PRESIGNED_URL_TTL_SECONDS=3600

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=SG....
EMAIL_FROM=noreply@company.com

# Jira
JIRA_BASE_URL=https://company.atlassian.net
JIRA_API_TOKEN=...
JIRA_USER_EMAIL=bot@company.com
JIRA_WEBHOOK_SECRET=<случайная строка для HMAC>

# SSO (если используется)
SAML_IDP_METADATA_URL=https://sso.company.com/metadata
OAUTH_CLIENT_ID=...
OAUTH_CLIENT_SECRET=...

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_API_KEY=...

# Sentry
SENTRY_DSN=https://...@sentry.io/...

# App
APP_ENV=development   # development | staging | production
APP_DEBUG=false
APP_BASE_URL=https://rmo.company.com
ALLOWED_ORIGINS=https://rmo.company.com,https://app.company.com
```

---

### 1.2 HTTPS и сетевая изоляция

```
Требования:
  - TLS 1.2+ обязателен для всех входящих соединений
  - Сертификат: Let's Encrypt (автообновление) или корпоративный CA
  - HSTS заголовок: Strict-Transport-Security: max-age=31536000
  - Внутренние сервисы (БД, Redis) не доступны снаружи K8s-кластера
  - Jira webhook endpoint: дополнительная HMAC-валидация (см. раздел Jira)
  - S3 bucket: private, доступ только через presigned URL
```

---

### 1.3 CORS

```python
# app/core/config.py
ALLOWED_ORIGINS: list[str] = [
    "https://rmo.company.com",
    "https://app.company.com",
]
# В development добавляется http://localhost:3000

# app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Idempotency-Key"],
)
```

---

### 1.4 OWASP Top-10 минимум

| Угроза          | Меры                                                                   |
|-----------------|------------------------------------------------------------------------|
| Injection       | SQLAlchemy parameterized queries, Pydantic validation на всём input    |
| Broken Auth     | JWT expiry, refresh rotation, invalidation при logout                  |
| Sensitive Data  | PII в тикетах — логи маскируются, БД шифруется at rest                |
| IDOR            | Все запросы проверяют права доступа (зависимость `get_current_user`)   |
| Security Logging| Все 401/403/500 логируются в Sentry + structured log                   |
| File Upload     | MIME-type validation, max size, сканирование (ClamAV или S3 scan)     |

---

## 2. Генерация Short ID <a name="short-id"></a>

**Проблема:** PROB-1234, BUG-5678, TKT-91011 упоминаются везде, но механизм генерации не описан. Это блокирует разработку слоя БД.

**Решение: таблица счётчиков + SEQUENCE**

```sql
-- Таблица счётчиков для каждого типа сущности
CREATE TABLE id_sequences (
  entity_type  VARCHAR(20) PRIMARY KEY,
  -- problem | task | ticket
  last_value   BIGINT NOT NULL DEFAULT 0
);

INSERT INTO id_sequences (entity_type) VALUES ('problem'), ('task'), ('ticket');

-- Функция атомарного получения следующего ID
CREATE OR REPLACE FUNCTION next_short_id(p_entity_type VARCHAR)
RETURNS VARCHAR LANGUAGE plpgsql AS $$
DECLARE
  next_val BIGINT;
  prefix   VARCHAR(10);
BEGIN
  UPDATE id_sequences
  SET last_value = last_value + 1
  WHERE entity_type = p_entity_type
  RETURNING last_value INTO next_val;

  prefix := CASE p_entity_type
    WHEN 'problem' THEN 'PROB'
    WHEN 'task'    THEN 'TASK'
    WHEN 'ticket'  THEN 'TKT'
    ELSE UPPER(p_entity_type)
  END;

  RETURN prefix || '-' || next_val::TEXT;
END;
$$;

-- Использование в триггере:
CREATE OR REPLACE FUNCTION set_short_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.short_id IS NULL OR NEW.short_id = '' THEN
    NEW.short_id := next_short_id(TG_ARGV[0]);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_problems_short_id
BEFORE INSERT ON problems
FOR EACH ROW EXECUTE FUNCTION set_short_id('problem');

CREATE TRIGGER trg_tasks_short_id
BEFORE INSERT ON tasks
FOR EACH ROW EXECUTE FUNCTION set_short_id('task');

CREATE TRIGGER trg_tickets_short_id
BEFORE INSERT ON support_tickets
FOR EACH ROW EXECUTE FUNCTION set_short_id('ticket');
```

**Примечание:** `UPDATE ... RETURNING` атомарен в PostgreSQL — race condition при конкурентных вставках исключён.

---

## 3. Контракт ошибок API <a name="error-contract"></a>

**Проблема:** нет единого формата ошибок. Фронтенд и интеграции не могут обрабатывать ошибки предсказуемо.

### 3.1 Стандартный формат ответа

**Успех:**
```json
{
  "data": { ... },
  "meta": {
    "page": 1, "limit": 25, "total": 87, "total_pages": 4
  }
}
```

**Ошибка:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные запроса",
    "details": [
      { "field": "team_id", "message": "Команда с таким ID не найдена" },
      { "field": "title",   "message": "Длина не может превышать 500 символов" }
    ],
    "request_id": "req_01HX..."
  }
}
```

### 3.2 Таблица HTTP-кодов и error codes

| HTTP | Code                    | Когда                                                     |
|------|-------------------------|-----------------------------------------------------------|
| 400  | `VALIDATION_ERROR`      | Некорректные поля запроса (Pydantic)                      |
| 400  | `INVALID_STATUS_TRANSITION` | Недопустимый переход статуса (напр. open → draft)    |
| 400  | `DUPLICATE_JIRA_KEY`    | jira_issue_key уже привязан к другой задаче               |
| 401  | `UNAUTHORIZED`          | Токен отсутствует или истёк                               |
| 403  | `FORBIDDEN`             | Недостаточно прав для действия                            |
| 404  | `NOT_FOUND`             | Сущность не найдена                                       |
| 409  | `CONFLICT`              | Конфликт (напр. тикет уже в этой очереди)                 |
| 409  | `ALREADY_TAKEN`         | Queue item уже взят другим оператором                     |
| 422  | `BUSINESS_RULE_VIOLATION` | Нарушение бизнес-правила (напр. проблема без team_id)   |
| 429  | `RATE_LIMIT_EXCEEDED`   | Превышен rate limit                                       |
| 503  | `AI_SERVICE_UNAVAILABLE`| Anthropic API недоступен                                  |
| 503  | `JIRA_SERVICE_UNAVAILABLE`| Jira недоступна                                         |
| 500  | `INTERNAL_ERROR`        | Непредвиденная ошибка (логируется в Sentry)               |

```python
# app/core/exceptions.py
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400,
                 details: list[dict] | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []

async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "request_id": request.state.request_id,
            }
        }
    )
```

---

## 4. Race Condition в очередях <a name="queue-race"></a>

**Проблема:** два оператора одновременно нажимают «Взять» на одну позицию. Без блокировки оба получат `status: in_progress`. Это критический баг для операционного сервиса.

**Решение: `SELECT FOR UPDATE SKIP LOCKED`**

```python
# app/services/queue_service.py

async def take_queue_item(
    db: AsyncSession,
    queue_code: str,
    item_id: UUID,
    user_id: UUID
) -> QueueItem:
    # Атомарный захват позиции — SKIP LOCKED гарантирует,
    # что если другой оператор уже взял эту строку, мы получим ошибку немедленно
    result = await db.execute(
        select(QueueItem)
        .where(
            QueueItem.id == item_id,
            QueueItem.status == "pending"
        )
        .with_for_update(skip_locked=True)  # KEY LINE
    )
    item = result.scalar_one_or_none()

    if item is None:
        # Либо не найден, либо уже захвачен другим оператором
        raise AppError(
            code="ALREADY_TAKEN",
            message="Позиция уже взята другим оператором или не существует",
            status_code=409
        )

    item.status = "in_progress"
    item.assigned_to = user_id
    item.assigned_at = datetime.utcnow()
    await db.commit()
    return item
```

---

## 5. JWT — структура токена и Auth-флоу <a name="auth"></a>

### 5.1 JWT claims

```json
// Access token payload
{
  "sub": "uuid-пользователя",
  "email": "user@company.com",
  "role": "operator",
  "team_id": "uuid-команды-или-null",
  "iat": 1715000000,
  "exp": 1715003600,
  "jti": "уникальный-id-токена",
  "type": "access"
}

// Refresh token payload
{
  "sub": "uuid-пользователя",
  "jti": "уникальный-id-токена",
  "exp": 1717595600,
  "type": "refresh"
}
```

### 5.2 Refresh token rotation

```
POST /auth/refresh
  → Принимает refresh_token
  → Проверяет jti в Redis (не в blacklist)
  → Добавляет старый jti в Redis blacklist (TTL = оставшееся время жизни)
  → Возвращает новый access_token + новый refresh_token
  → Одноразовое использование: повторный запрос с тем же refresh_token → 401
```

### 5.3 WebSocket Auth

```
WS /ws?token=<access_token>

Или через заголовок при handshake:
  GET /ws HTTP/1.1
  Authorization: Bearer <access_token>

При истечении access_token → WS-соединение закрывается с кодом 4001
Клиент должен получить новый токен через REST /auth/refresh и переподключиться
```

### 5.4 SSO-флоу (если включён)

```
1. GET /auth/sso → redirect на IdP (SAML/OAuth2)
2. IdP аутентифицирует пользователя
3. Callback: POST /auth/sso/callback { code, state }
4. Backend обменивает code на user info у IdP
5. Находит или создаёт пользователя в БД
6. Возвращает JWT (access + refresh)
```

---

## 6. AI-пайплайн: отказы и retry <a name="ai-failures"></a>

**Проблема:** Anthropic API падает → тикет создан, но никогда не классифицирован и не попадёт ни в одну очередь. Пользователь не получит ответа.

### 6.1 Celery retry-стратегия

```python
# app/workers/classification.py

@celery.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,       # 1 минута между попытками
    autoretry_for=(Exception,),
    retry_backoff=True,           # 60s, 120s, 240s
    retry_backoff_max=600,
    retry_jitter=True,
)
def classify_ticket(self, ticket_id: str):
    try:
        # ... классификация ...
    except AnthropicRateLimitError as exc:
        raise self.retry(exc=exc, countdown=300)  # 5 минут при rate limit
    except AnthropicAPIError as exc:
        raise self.retry(exc=exc)
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            # Все попытки исчерпаны → Dead Letter Queue
            handle_classification_failure(ticket_id, str(exc))
        raise self.retry(exc=exc)


def handle_classification_failure(ticket_id: str, error: str):
    """
    Вызывается когда все retry исчерпаны.
    Тикет не попал в очередь — нужно это исправить вручную или через fallback.
    """
    # 1. Записать в activity_log: action="classification_failed"
    # 2. Поместить тикет в очередь problem_determination (ручной разбор)
    # 3. Уведомить triage-лида
    # 4. Отправить в Sentry
    fallback_to_manual_queue(ticket_id, reason=f"AI classification failed: {error}")
```

### 6.2 Dead Letter Queue

```python
# app/workers/celery_config.py

CELERY_TASK_ROUTES = {
    "classify_ticket": {"queue": "classification"},
}

# Все упавшие задачи с исчерпанными retry → очередь DLQ
CELERY_DEAD_LETTER_QUEUE = "dlq"

# Celery beat: мониторинг DLQ каждые 5 минут
# При наличии задач в DLQ → алерт в Sentry + Slack
```

### 6.3 Circuit Breaker для внешних сервисов

```python
# app/core/circuit_breaker.py
# Используем: tenacity или pybreaker

from pybreaker import CircuitBreaker

anthropic_breaker = CircuitBreaker(
    fail_max=5,           # 5 ошибок подряд → открыть circuit
    reset_timeout=60,     # через 60 сек попробовать снова
    name="anthropic_api",
)

jira_breaker = CircuitBreaker(
    fail_max=3,
    reset_timeout=30,
    name="jira_api",
)

# При открытом circuit breaker:
# - classify_ticket → сразу в manual queue (без попытки вызова AI)
# - jira create → откладывается в Celery retry queue
```

### 6.4 Таймауты для внешних запросов

```python
# app/core/http_client.py
import httpx

TIMEOUTS = {
    "anthropic": httpx.Timeout(connect=5.0, read=30.0, write=5.0, pool=2.0),
    "jira":      httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=2.0),
    "s3":        httpx.Timeout(connect=5.0, read=60.0, write=60.0, pool=2.0),
}
```

---

## 7. Стратегия окружений и CI/CD <a name="environments"></a>

### 7.1 Окружения

| Окружение | Назначение                        | БД               | AI-ключи     |
|-----------|-----------------------------------|------------------|--------------|
| `local`   | Разработка на машине              | Docker Postgres  | Личный ключ  |
| `dev`     | Автодеплой из `develop`-ветки     | Shared dev БД    | Dev-ключи    |
| `staging` | QA, демо, финальное тестирование  | Изолированная БД | Staging-ключи|
| `prod`    | Продакшн                          | Реплики + PG HA  | Prod-ключи   |

### 7.2 Локальная разработка

```yaml
# docker-compose.yml
version: "3.9"
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: rmo
      POSTGRES_USER: rmo
      POSTGRES_PASSWORD: rmo
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  elasticsearch:
    image: elasticsearch:8.12.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports: ["9200:9200"]

  celery_worker:
    build: .
    command: celery -A app.workers.celery_app worker --loglevel=info -Q classification,default
    depends_on: [postgres, redis]
    env_file: .env

  celery_beat:
    build: .
    command: celery -A app.workers.celery_app beat --loglevel=info
    depends_on: [redis]
    env_file: .env

volumes:
  pgdata:
```

```bash
# Makefile — команды для разработчиков
make install      # pip install -r requirements.txt
make migrate      # alembic upgrade head
make seed         # python scripts/seed.py
make run          # uvicorn app.main:app --reload --port 8000
make test         # pytest tests/ -v --cov=app
make lint         # ruff check app/ && mypy app/
make docker-up    # docker-compose up -d
make docker-down  # docker-compose down
```

### 7.3 Seed-данные

```python
# scripts/seed.py
"""
Начальные данные для запуска системы в dev/staging.
"""

SEED_PRODUCTS = [
    {"name": "ОСАГО", "code": "osago"},
    {"name": "КАСКО", "code": "kasko"},
    {"name": "НС",    "code": "ns"},
    {"name": "ДМС",   "code": "dms"},
]

SEED_QUEUES = [
    {"code": "problem_determination",  "name": "Определение проблемы",              "sla_minutes": 60},
    {"code": "task_determination",     "name": "Определение задачи/бага",           "sla_minutes": 90},
    {"code": "recommendation_review",  "name": "Контроль отправки рекомендации",    "sla_minutes": 30},
    {"code": "client_response",        "name": "Ответ клиенту",                    "sla_minutes": 120},
]

SEED_APP_SETTINGS = [
    {"key": "ai_confidence_threshold",
     "value": {"problem": 0.9, "task": 0.9, "duplicate": 0.9}},
    {"key": "triage_sla_hours",
     "value": {"default": 24}},
    {"key": "priority_recalc",
     "value": {"delta_critical": 200, "delta_high": 100, "delta_medium": 50,
                "min_tickets_critical": 50, "min_tickets_high": 20}},
    {"key": "file_upload",
     "value": {"max_size_mb": 50, "allowed_mime_types": [
        "image/png", "image/jpeg", "image/gif", "image/webp",
        "text/plain", "application/json", "application/pdf",
        "application/zip", "application/x-gzip",
        "application/octet-stream"
     ]}},
]

SEED_ADMIN_USER = {
    "email": "admin@company.com",
    "name": "Administrator",
    "role": "admin",
    "password": "changeme123!"  # обязательно сменить при деплое
}
```

### 7.4 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
stages:
  lint:         ruff check + mypy --strict
  test:         pytest --cov=app --cov-fail-under=80
  build:        docker build
  security:     trivy image scan + bandit (SAST)
  migration:    alembic check (нет pending миграций без файла)
  deploy_dev:   auto (push to develop)
  deploy_staging: auto (push to main)
  deploy_prod:  manual approval required
```

---

## 8. Миграции Alembic (zero-downtime) <a name="migrations"></a>

**Проблема:** спецификация упоминает Alembic, но нет правил написания миграций. ADD COLUMN с NOT NULL без default → downtime на большой таблице.

### 8.1 Правила

```python
# Правила zero-downtime миграций:

# ✅ МОЖНО без downtime:
# - ADD COLUMN с DEFAULT или nullable
# - CREATE INDEX CONCURRENTLY
# - CREATE TABLE
# - DROP INDEX

# ❌ НЕЛЬЗЯ без downtime:
# - ADD COLUMN NOT NULL без DEFAULT → сначала nullable, потом backfill, потом constraint
# - DROP COLUMN (добавить ignore в модель, потом удалить)
# - RENAME COLUMN (добавить новый, backfill, переключить, удалить старый)
# - ALTER COLUMN type

# Пример безопасного добавления NOT NULL колонки:
# Миграция 1: ADD COLUMN nullable
# Миграция 2: backfill данных (в Celery задаче или migration script)
# Миграция 3: ADD CONSTRAINT NOT NULL
```

```python
# alembic/env.py — обязательные настройки
def run_migrations_online():
    # Для CREATE INDEX CONCURRENTLY нужен отдельный коннект вне транзакции
    with engine.connect() as connection:
        connection.execute(text("SET lock_timeout = '5s'"))
        connection.execute(text("SET statement_timeout = '60s'"))
```

---

## 9. WebSocket протокол <a name="websocket"></a>

**Проблема:** используется Redis pub/sub для WebSocket, но нет описания формата сообщений и управления соединением.

### 9.1 Подключение

```
ws://api.company.com/ws?token=<access_token>
```

### 9.2 Формат сообщений (JSON)

**Сервер → Клиент:**
```json
{
  "event": "ticket:queued",
  "payload": {
    "ticket_id": "uuid",
    "queue_code": "task_determination",
    "priority_score": 0.91,
    "reason": "AI confidence 0.72 < threshold 0.9"
  },
  "ts": "2026-05-09T09:15:00Z"
}
```

**Клиент → Сервер (heartbeat):**
```json
{ "event": "ping" }
```

**Сервер → Клиент (ответ на ping):**
```json
{ "event": "pong", "ts": "2026-05-09T09:15:30Z" }
```

**Сервер закрывает соединение:**
```
Код 4001 — токен истёк, нужен refresh
Код 4003 — доступ запрещён
Код 1001 — сервер перезапускается (клиент должен переподключиться)
```

### 9.3 Подписка на каналы

```python
# Каналы Redis pub/sub:
# ws:all                    — всем подключённым пользователям
# ws:user:{user_id}         — конкретному пользователю
# ws:queue:{queue_code}     — всем операторам очереди
# ws:team:{team_id}         — всем членам команды
```

### 9.4 Reconnect-стратегия (клиент)

```
Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (max)
После 5 неудачных попыток → показать пользователю "Нет соединения"
При успешном reconnect → запросить missed events через REST API
```

---

## 10. Пагинация <a name="pagination"></a>

**Проблема:** описана только offset-пагинация (`?page=1&limit=25`). При больших объёмах (100k+ тикетов) offset работает медленно.

### 10.1 Правила выбора типа пагинации

| Список                     | Тип            | Причина                                        |
|----------------------------|----------------|------------------------------------------------|
| Очереди (real-time)        | cursor-based   | Данные меняются пока оператор листает          |
| Тикеты, проблемы (поиск)  | offset         | Нужен jump to page, фильтры                    |
| activity_log (timeline)    | cursor-based   | Инкрементальная подгрузка                      |
| linked_tickets в задаче    | offset         | Стабильный набор                               |

### 10.2 Cursor-based пагинация

```python
# Запрос: GET /queues/task_determination/items?cursor=<opaque>&limit=25
# Cursor = base64(json({"id": "uuid", "created_at": "..."}))

# Ответ:
{
  "data": [...],
  "meta": {
    "next_cursor": "eyJpZCI6Ii...",   # NULL если последняя страница
    "has_more": true,
    "limit": 25
  }
}
```

---

## 11. Idempotency и атомарность bulk-операций <a name="idempotency"></a>

### 11.1 Идемпотентность для создания тикетов

**Проблема:** внешние системы могут отправлять один и тот же тикет дважды (сбой сети, retry).

```python
# Заголовок: X-Idempotency-Key: <uuid-v4 от клиента>

# Middleware:
# 1. Проверить Redis: key = f"idempotency:{idempotency_key}"
# 2. Если есть → вернуть кэшированный ответ (200, не 201)
# 3. Если нет → выполнить, сохранить ответ в Redis (TTL: 24h)

# Применяется к: POST /tickets, POST /problems, POST /tasks
```

### 11.2 Атомарность bulk-операций

**Проблема:** если bulk update упал на 3 из 20 тикетов — что вернуть?

```python
# Поведение: partial success (best-effort)
# НЕ откатывать всё при первой ошибке

# Ответ:
{
  "data": {
    "updated": 17,
    "failed": 3,
    "errors": [
      { "id": "uuid-1", "error": "NOT_FOUND" },
      { "id": "uuid-2", "error": "FORBIDDEN" },
      { "id": "uuid-3", "error": "INVALID_STATUS_TRANSITION" }
    ]
  }
}

# Исключение: bulk create — полностью атомарный (всё или ничего)
```

---

## 12. Загрузка файлов <a name="file-upload"></a>

```python
# Ограничения:
MAX_FILE_SIZE_MB = 50
ALLOWED_MIME_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "text/plain", "text/csv",
    "application/json",
    "application/pdf",
    "application/zip", "application/x-gzip",
    "application/octet-stream",  # для .log файлов
}

# Presigned URL TTL:
S3_PRESIGNED_URL_TTL_SECONDS = 3600  # 1 час
# Клиент должен перезапрашивать URL после истечения
# Эндпоинт: GET /attachments/:id/url → возвращает свежий presigned URL

# Virus scanning:
# При загрузке → объект получает тег S3: scan_status=pending
# Lambda/job сканирует ClamAV → scan_status=clean|infected
# Infected файлы → автоудаление + уведомление
# API не отдаёт presigned URL для scan_status != 'clean'

# Путь в S3:
# s3://rmo-attachments/tickets/{ticket_id}/{attachment_id}/{filename}
```

---

## 13. pgvector: настройка индекса <a name="pgvector"></a>

**Проблема:** pgvector упоминается, но не указан тип индекса. Разработчик не знает, что создавать.

```sql
-- Обязательно сначала:
CREATE EXTENSION IF NOT EXISTS vector;

-- Тип индекса: HNSW (рекомендуется для production)
-- HNSW: быстрый поиск, больше памяти, точнее чем IVFFlat
-- IVFFlat: медленнее строится, подходит для > 1M векторов

-- Для tasks:
CREATE INDEX idx_tasks_embedding ON tasks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Для support_tickets:
CREATE INDEX idx_tickets_embedding ON support_tickets
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Параметры поиска (устанавливать per-session):
SET hnsw.ef_search = 100;  -- выше = точнее, медленнее (дефолт 40)

-- Пример запроса поиска похожих тикетов:
SELECT id, short_id, summary,
       1 - (embedding <=> $1::vector) AS similarity
FROM support_tickets
WHERE 1 - (embedding <=> $1::vector) > 0.75
  AND status != 'closed'
ORDER BY embedding <=> $1::vector
LIMIT 10;
-- $1 — вектор запроса (1536 float32)
```

---

## 14. Reconciliation счётчиков <a name="counters"></a>

**Проблема:** счётчики (tickets_count, bugs_count и др.) обновляются триггерами. Если транзакция упала частично или триггер пропустил событие — счётчики рассинхронизируются с реальными данными.

```python
# app/workers/reconcile.py

@celery.task
def reconcile_problem_counters():
    """
    Еженедельная проверка консистентности счётчиков.
    Запускается в воскресенье 02:00 (низкая нагрузка).
    """
    query = """
    UPDATE problems p SET
      tickets_count = sub.real_count,
      tickets_no_task_count = sub.real_no_task_count,
      unresearched_count = sub.real_unresearched,
      tasks_count = sub.real_tasks,
      bugs_count = sub.real_bugs,
      updated_at = NOW()
    FROM (
      SELECT
        p2.id,
        COUNT(DISTINCT t.id) FILTER (WHERE t.problem_id = p2.id) AS real_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.problem_id = p2.id AND t.task_id IS NULL) AS real_no_task_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.problem_id = p2.id AND t.requires_research = TRUE) AS real_unresearched,
        COUNT(DISTINCT tk.id) FILTER (WHERE tk.problem_id = p2.id) AS real_tasks,
        COUNT(DISTINCT tk.id) FILTER (WHERE tk.problem_id = p2.id AND tk.task_type = 'bug') AS real_bugs
      FROM problems p2
      LEFT JOIN support_tickets t  ON t.problem_id  = p2.id
      LEFT JOIN tasks           tk ON tk.problem_id = p2.id
      GROUP BY p2.id
    ) sub
    WHERE p.id = sub.id
      AND (
        p.tickets_count != sub.real_count
        OR p.tasks_count != sub.real_tasks
      );
    """
    # Логировать количество исправленных строк → alert если > 0
```

---

## 15. Наблюдаемость (Observability) <a name="observability"></a>

### 15.1 Структурированное логирование

```python
# app/core/logging.py
import structlog

log = structlog.get_logger()

# Каждый лог-запись содержит:
# - request_id (UUID, генерируется в middleware)
# - user_id
# - method, path, status_code, duration_ms
# - entity_type, entity_id (для бизнес-событий)
# - env, version

# Пример:
log.info(
    "ticket.classified",
    ticket_id=str(ticket_id),
    problem_id=str(problem_id),
    confidence=0.93,
    duration_ms=342,
    auto_linked=True,
)

# Уровни:
# INFO  — бизнес-события (создан тикет, привязан баг)
# WARN  — деградация (AI медленный, retry)
# ERROR — ошибки (исключение, внешний сервис упал)
# В логах НИКОГДА: raw_text тикета, email клиента, пароли
```

### 15.2 Метрики (Prometheus)

```python
# app/core/metrics.py
from prometheus_client import Counter, Histogram, Gauge

tickets_created_total = Counter(
    "tickets_created_total", "Всего создано тикетов", ["product", "platform", "channel"]
)
tickets_classified_total = Counter(
    "tickets_classified_total", "Тикеты классифицированы", ["result"]
    # result: auto_linked | queued | failed
)
classification_duration_seconds = Histogram(
    "classification_duration_seconds", "Время классификации AI",
    buckets=[1, 2, 5, 10, 30]
)
queue_size_gauge = Gauge(
    "queue_size", "Размер очереди", ["queue_code", "status"]
)
ai_confidence_histogram = Histogram(
    "ai_confidence", "Распределение уверенности AI",
    ["suggestion_type"],
    buckets=[0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0]
)
```

### 15.3 Distributed Tracing

```python
# Использовать: OpenTelemetry + Jaeger / Tempo

# Обязательные span'ы:
# - HTTP request (автоматически через FastAPI middleware)
# - DB query (SQLAlchemy instrumentation)
# - Celery task
# - Внешний API вызов (Anthropic, Jira, S3)
# - Redis операция

# Correlation ID: propagate через X-Request-ID header
```

### 15.4 Алерты (минимальный набор)

| Условие                                   | Severity | Куда         |
|-------------------------------------------|----------|--------------|
| Error rate > 1% за 5 минут                | critical | PagerDuty    |
| classification_duration p95 > 30s         | warning  | Slack        |
| queue_size{pending} > 200                 | warning  | Slack        |
| DLQ непустой > 5 минут                    | critical | PagerDuty    |
| Anthropic circuit breaker открыт          | critical | PagerDuty    |
| DB connections > 80% pool                 | warning  | Slack        |
| Celery worker упал                        | critical | PagerDuty    |

---

## 16. Обработка PII и соответствие требованиям <a name="pii"></a>

**Проблема:** тикеты содержат персональные данные (user_id, customer_email, raw_text с описанием проблемы клиента). Нет ни слова о GDPR / ФЗ-152.

```
Обязательно до старта разработки выяснить:

□ Является ли raw_text персональными данными?
  → Если да: шифрование at-rest (Transparent Data Encryption)
  → Маскировка в логах: customer_email → "cus***@***.com"

□ Право на удаление (GDPR Art.17 / ФЗ-152):
  → POST /tickets/:id/anonymize
  → Заменяет: user_id → "DELETED", raw_text → "REDACTED",
  →           customer_name → null, customer_email → null
  → НЕ удаляет тикет (нужен для статистики)

□ Данные хранятся в РФ? (ФЗ-152 ст.18)
  → S3 bucket: регион ru-central1 (Yandex Cloud) или on-premise

□ Передача данных в Anthropic API:
  → raw_text тикетов отправляется в Anthropic для классификации
  → Требуется DPA (Data Processing Agreement) с Anthropic
  → Минимизировать: отправлять только summary, не raw_text
  → Настройка: Anthropic Zero Data Retention режим
```

---

## 17. Стратегия тестирования <a name="testing"></a>

```
Минимальные требования для старта разработки:

Coverage: ≥ 80% для services/, ≥ 60% для api/

Типы тестов:
  Unit (pytest):
    - services/queue_service.py: race condition, happy path, errors
    - services/ai_service.py: моки Anthropic/OpenAI
    - workers/classification.py: retry logic, DLQ fallback
    - Все статусные переходы task/ticket/problem

  Integration (pytest + httpx.AsyncClient):
    - Все API endpoints (happy path)
    - Auth middleware (401, 403)
    - Bulk operations (partial success)

  DB (pytest + PostgreSQL в Docker):
    - Триггеры (счётчики)
    - Short ID генерация (concurrent inserts)
    - pgvector similarity queries

  E2E (pytest):
    - Полный флоу AI-классификации (с моком Anthropic)
    - Queue take с race condition (параллельные запросы)
```

```python
# Пример теста на race condition в очереди
import asyncio, pytest

@pytest.mark.asyncio
async def test_queue_take_race_condition(client, db_session, test_queue_item):
    """Два оператора берут одну позицию одновременно — только один должен успеть."""
    results = await asyncio.gather(
        client.post(f"/api/v1/queues/task_determination/items/{test_queue_item.id}/take",
                    headers={"Authorization": f"Bearer {operator1_token}"}),
        client.post(f"/api/v1/queues/task_determination/items/{test_queue_item.id}/take",
                    headers={"Authorization": f"Bearer {operator2_token}"}),
        return_exceptions=True
    )
    statuses = [r.status_code for r in results if hasattr(r, "status_code")]
    assert 200 in statuses
    assert 409 in statuses  # ALREADY_TAKEN
```

---

## 18. Безопасность Jira Webhook <a name="jira-webhook-security"></a>

**Проблема:** `POST /jira/webhook` открыт для любого HTTP-запроса.

```python
# app/api/v1/jira.py

import hashlib, hmac
from fastapi import Header, HTTPException

def verify_jira_webhook_signature(
    payload: bytes,
    signature: str = Header(alias="X-Hub-Signature"),
    secret: str = settings.JIRA_WEBHOOK_SECRET
) -> None:
    """
    Jira подписывает тело запроса HMAC-SHA256.
    Заголовок: X-Hub-Signature: sha256=<hex>
    """
    expected = "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

@router.post("/webhook")
async def jira_webhook(
    request: Request,
    _: None = Depends(verify_jira_webhook_signature)
):
    payload = await request.json()
    # ...
```

Дополнительно: IP allowlist для Jira (Atlassian публикует список IP-адресов).

---

## 19. API Versioning <a name="api-versioning"></a>

```
Текущая версия: /api/v1/

Стратегия при изменениях:
  - Backward-compatible изменения (добавить поле) → без версии
  - Breaking changes → новый prefix /api/v2/
  - Поддержка v1 минимум 6 месяцев после выхода v2
  - Заголовок Deprecation: date="2027-01-01" для устаревших эндпоинтов

Версия API в ответе:
  X-API-Version: 1.0.3   (major.minor.patch)
```

---

## 20. Временны́е зоны <a name="timezones"></a>

```
Правило: все timestamps в БД и API — UTC (TIMESTAMPTZ).

В API:
  - Все datetime в формате ISO 8601 с Z суффиксом: "2026-05-09T09:00:00Z"
  - Клиент конвертирует в локальное время самостоятельно
  - Параметры фильтрации (date_from, date_to) принимаются в UTC

В БД:
  - TIMESTAMPTZ — PostgreSQL автоматически хранит в UTC
  - Никаких TIMESTAMP WITHOUT TIME ZONE

Исключение:
  - weekly_snapshots.week_start — DATE (без времени), всегда понедельник UTC
```

---

## 21. Мягкое удаление и каскады <a name="soft-delete"></a>

**Проблема:** описано только мягкое удаление проблем, но нет правил для дочерних сущностей.

```
При DELETE /problems/:id (status → closed):
  - Задачи: НЕ меняются (остаются в своём статусе)
  - Тикеты: НЕ меняются
  - Проблема исчезает из дефолтных списков (фильтр status != 'closed')
  - Доступна через фильтр ?status=closed или по прямому ID

При DELETE /tasks/:id:
  - Задача НЕ удаляется физически → status = 'closed'
  - Тикеты: task_id → NULL (ON DELETE SET NULL в схеме)
  - Счётчики пересчитываются триггером

Физического удаления нет ни для одной сущности.
Для GDPR-удаления используется anonymize (см. раздел PII).
```

---

## Итог: чек-лист до старта разработки

```
Инфраструктура:
  □ docker-compose.yml с pgvector, Redis, Elasticsearch
  □ .env.example со всеми переменными
  □ Makefile с командами
  □ Alembic настроен, начальная миграция готова
  □ Seed-скрипт с products, queues, app_settings, admin user

Безопасность:
  □ CORS настроен
  □ JWT middleware реализован
  □ Jira webhook HMAC-валидация
  □ Secrets manager выбран и настроен
  □ DPA с Anthropic подписан или Zero Data Retention включён

БД:
  □ Таблица id_sequences + триггеры short_id
  □ pgvector установлен, HNSW-индексы созданы
  □ Все CHECK constraints добавлены
  □ Reconcile job запланирован

API:
  □ Единый формат ошибок реализован (AppError + handler)
  □ request_id middleware
  □ Rate limiting middleware
  □ X-Idempotency-Key обработка для POST /tickets

Очереди:
  □ SELECT FOR UPDATE SKIP LOCKED в queue_service.take()
  □ Celery retry + DLQ + fallback_to_manual_queue

AI:
  □ Circuit breaker для Anthropic и Jira
  □ Таймауты на все HTTP-клиенты
  □ handle_classification_failure реализован

Наблюдаемость:
  □ Structured logging (structlog)
  □ Sentry DSN настроен
  □ Prometheus metrics endpoint /metrics
  □ Базовые алерты настроены

Тесты:
  □ pytest + pytest-asyncio установлены
  □ Тест на race condition очереди
  □ Тест на retry при падении Anthropic
  □ Coverage ≥ 80% для services/
```
