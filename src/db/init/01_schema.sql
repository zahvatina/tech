-- VECTOR / RMO schema per support-service-spec-ru-v3.md (PostgreSQL 16 + pgvector)
SET client_min_messages = WARNING;

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
CREATE TABLE app_settings (
  key           VARCHAR(100) PRIMARY KEY,
  value         JSONB NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  slug             VARCHAR(100) UNIQUE NOT NULL,
  color            VARCHAR(7),
  jira_project_key VARCHAR(50),
  jira_board_id    INTEGER,
  email_list       TEXT[],
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      VARCHAR(255) NOT NULL,
  code      VARCHAR(50) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  name         VARCHAR(255) NOT NULL,
  avatar_url   TEXT,
  role         VARCHAR(50) NOT NULL DEFAULT 'operator',
  team_id      UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  settings     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_team_id ON users(team_id);

CREATE TABLE problems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  short_id    VARCHAR(20) UNIQUE NOT NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'new',
  priority    VARCHAR(20) NOT NULL DEFAULT 'medium',
  severity    VARCHAR(20) NOT NULL DEFAULT 'moderate',
  owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  affected_product_ids UUID[]  DEFAULT '{}',
  affected_services    TEXT[]  DEFAULT '{}',
  sla_deadline          TIMESTAMPTZ,
  sla_breached          BOOLEAN DEFAULT FALSE,
  triage_sla_deadline   TIMESTAMPTZ,
  triage_sla_breached   BOOLEAN DEFAULT FALSE,
  has_workaround        BOOLEAN DEFAULT FALSE,
  is_visible_in_jira    BOOLEAN DEFAULT FALSE,
  tickets_count                INTEGER DEFAULT 0,
  tickets_count_prev_week      INTEGER DEFAULT 0,
  tasks_count                  INTEGER DEFAULT 0,
  bugs_count                   INTEGER DEFAULT 0,
  unresearched_count           INTEGER DEFAULT 0,
  unresearched_count_prev_week INTEGER DEFAULT 0,
  tickets_no_task_count        INTEGER DEFAULT 0,
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

CREATE TABLE problem_products (
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, product_id)
);

CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id  UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  short_id    VARCHAR(20) UNIQUE NOT NULL,
  task_type   VARCHAR(20) NOT NULL DEFAULT 'bug',
  status      VARCHAR(30) NOT NULL DEFAULT 'draft',
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  priority    VARCHAR(20) NOT NULL DEFAULT 'medium',
  severity    VARCHAR(20) NOT NULL DEFAULT 'moderate',
  team_id     UUID REFERENCES teams(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  proposed_by   UUID REFERENCES users(id),
  proposed_at   TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_comment  TEXT,
  jira_url        TEXT,
  jira_issue_key  VARCHAR(50),
  jira_issue_id   VARCHAR(50),
  workaround     TEXT,
  has_workaround BOOLEAN DEFAULT FALSE,
  support_notes  TEXT,
  support_notes_required BOOLEAN GENERATED ALWAYS AS (
    support_notes IS NULL
    AND status NOT IN ('draft','pending_confirmation','rejected_draft',
                       'fixed','wont_fix','duplicate','closed')
  ) STORED,
  root_cause      TEXT,
  fix_date        TIMESTAMPTZ,
  fix_version     VARCHAR(100),
  fix_description TEXT,
  environments TEXT[] DEFAULT '{}',
  tickets_count INTEGER DEFAULT 0,
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

CREATE TABLE support_tickets (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id VARCHAR(20) UNIQUE NOT NULL,
  user_id        VARCHAR(255) NOT NULL,
  customer_name  VARCHAR(255),
  customer_email VARCHAR(255),
  region         VARCHAR(100),
  product_id UUID REFERENCES products(id),
  platform   VARCHAR(50),
  raw_text    TEXT NOT NULL,
  summary     TEXT,
  ticket_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channel VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  current_queue VARCHAR(50),
  recommendation_text    TEXT,
  recommendation_sent    BOOLEAN   DEFAULT FALSE,
  recommendation_sent_at TIMESTAMPTZ,
  problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
  task_id    UUID REFERENCES tasks(id)    ON DELETE SET NULL,
  ai_problem_id         UUID REFERENCES problems(id),
  ai_problem_confidence FLOAT,
  ai_task_id            UUID REFERENCES tasks(id),
  ai_task_confidence    FLOAT,
  ai_category           VARCHAR(100),
  embedding             vector(1536),
  is_new_case       BOOLEAN DEFAULT TRUE,
  requires_research BOOLEAN DEFAULT FALSE,
  is_confirmed_task BOOLEAN DEFAULT FALSE,
  is_duplicate      BOOLEAN DEFAULT FALSE,
  duplicate_of      UUID REFERENCES support_tickets(id),
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

CREATE TABLE queues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  sla_minutes INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE queue_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id    UUID NOT NULL REFERENCES queues(id),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  priority_score FLOAT NOT NULL DEFAULT 0.0,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT FALSE,
  reason       TEXT,
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

CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id   UUID NOT NULL,
  action      VARCHAR(100) NOT NULL,
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

CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
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

CREATE TABLE weekly_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type        VARCHAR(20) NOT NULL,
  entity_id          UUID NOT NULL,
  week_start         DATE NOT NULL,
  tickets_count      INTEGER DEFAULT 0,
  unresearched_count INTEGER DEFAULT 0,
  tasks_count        INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entity_id, week_start)
);

CREATE INDEX idx_snapshots_entity ON weekly_snapshots(entity_type, entity_id, week_start DESC);

CREATE TABLE ai_suggestions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id             UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  suggestion_type       VARCHAR(50) NOT NULL,
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

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id     UUID REFERENCES teams(id),
  type        VARCHAR(100) NOT NULL,
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

CREATE TABLE priority_recalculation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     VARCHAR(20) NOT NULL,
  entity_id       UUID NOT NULL,
  old_priority    VARCHAR(20) NOT NULL,
  new_priority    VARCHAR(20) NOT NULL,
  reason          TEXT,
  recalculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_priority_log_entity ON priority_recalculation_log(entity_type, entity_id);

CREATE MATERIALIZED VIEW mv_problem_stats AS
SELECT
  p.id, p.title, p.status, p.priority, p.severity,
  p.owner_id, p.team_id,
  p.has_workaround, p.sla_breached,
  p.triage_sla_deadline, p.triage_sla_breached,
  p.tickets_count, p.tasks_count, p.bugs_count,
  p.unresearched_count, p.tickets_no_task_count,
  p.is_visible_in_jira,

  CASE WHEN ws.tickets_count IS NOT NULL AND ws.tickets_count > 0
    THEN ROUND((p.tickets_count - ws.tickets_count)::NUMERIC / ws.tickets_count * 100, 1)
  END AS tickets_delta_pct,

  CASE WHEN ws.unresearched_count IS NOT NULL AND ws.unresearched_count > 0
    THEN ROUND((p.unresearched_count - ws.unresearched_count)::NUMERIC / ws.unresearched_count * 100, 1)
  END AS unresearched_delta_pct,

  (SELECT COUNT(*) FROM tasks t
   WHERE t.problem_id = p.id
     AND t.status IN ('draft','pending_confirmation')
  ) AS pending_drafts_count,

  (SELECT COUNT(*) FROM tasks t
   WHERE t.problem_id = p.id AND t.support_notes_required = TRUE
  ) AS tasks_missing_notes_count,

  p.updated_at, p.created_at

FROM problems p
LEFT JOIN weekly_snapshots ws
  ON ws.entity_id = p.id
  AND ws.entity_type = 'problem'
  AND ws.week_start = DATE_TRUNC('week', NOW() - INTERVAL '7 days')::DATE;

CREATE UNIQUE INDEX idx_mv_problem_stats_id ON mv_problem_stats(id);

-- ---------------------------------------------------------------------------
-- Triggers from spec §2.3 (triage SLA: coalesce created_at)

CREATE OR REPLACE FUNCTION set_triage_sla()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.triage_sla_deadline := COALESCE(NEW.created_at, NOW()) + INTERVAL '1 day';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_problem_triage_sla
BEFORE INSERT ON problems
FOR EACH ROW EXECUTE FUNCTION set_triage_sla();

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

-- ---------------------------------------------------------------------------
-- Short ID generation (spec §2, CTO-addendum §2)

CREATE TABLE id_sequences (
  entity_type VARCHAR(20) PRIMARY KEY,
  last_value  BIGINT NOT NULL DEFAULT 0
);
INSERT INTO id_sequences (entity_type) VALUES ('problem'), ('task'), ('ticket');

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
