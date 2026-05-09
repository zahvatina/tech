-- Mock data for dev (run after 01_schema.sql)
SET client_min_messages = WARNING;

-- ---------------------------------------------------------------------------
INSERT INTO app_settings (key, value) VALUES
  ('ai_confidence_threshold', '{"problem": 0.9, "task": 0.9, "duplicate": 0.9}'::jsonb),
  ('triage_sla_hours', '{"default": 24}'::jsonb),
  ('priority_recalc', '{"delta_critical": 200, "delta_high": 100, "delta_medium": 50, "min_tickets_critical": 50, "min_tickets_high": 20}'::jsonb),
  ('file_upload', '{"max_size_mb": 50, "allowed_mime_types": ["image/png","application/pdf"]}'::jsonb);

INSERT INTO teams (id, name, slug, color, jira_project_key, email_list) VALUES
  ('10000000-0000-4000-8000-000001000001', 'Mobile Core', 'mobile-core', '#3B82F6', 'MOB', ARRAY['mobile@example.com']),
  ('10000000-0000-4000-8000-000001000002', 'Payments', 'payments', '#10B981', 'PAY', ARRAY['payments@example.com']);

INSERT INTO products (id, name, code) VALUES
  ('20000000-0000-4000-8000-000002000001', 'ОСАГО', 'osago'),
  ('20000000-0000-4000-8000-000002000002', 'КАСКО', 'kasko'),
  ('20000000-0000-4000-8000-000002000003', 'НС', 'ns'),
  ('20000000-0000-4000-8000-000002000004', 'ДМС', 'dms');

INSERT INTO users (id, email, name, role, team_id) VALUES
  ('30000000-0000-4000-8000-000003000001', 'anna.ops@example.com', 'Анна Котова', 'operator', '10000000-0000-4000-8000-000001000001'),
  ('30000000-0000-4000-8000-000003000002', 'dmitry.dev@example.com', 'Дмитрий Орлов', 'developer', '10000000-0000-4000-8000-000001000001'),
  ('30000000-0000-4000-8000-000003000003', 'maria.ops@example.com', 'Мария Зайцева', 'operator', '10000000-0000-4000-8000-000001000002'),
  ('30000000-0000-4000-8000-000003000004', 'ilya.dev@example.com', 'Илья Громов', 'developer', '10000000-0000-4000-8000-000001000002'),
  ('30000000-0000-4000-8000-000003000005', 'admin@example.com', 'Администратор', 'admin', NULL),
  ('30000000-0000-4000-8000-000003000006', 'viewer@example.com', 'Только просмотр', 'viewer', NULL);

INSERT INTO queues (id, code, name, sla_minutes) VALUES
  ('70000000-0000-4000-8000-000007000001', 'problem_determination', 'Определение проблемы', 60),
  ('70000000-0000-4000-8000-000007000002', 'task_determination', 'Определение задачи/бага', 90),
  ('70000000-0000-4000-8000-000007000003', 'recommendation_review', 'Контроль отправки рекомендации', 30),
  ('70000000-0000-4000-8000-000007000004', 'client_response', 'Ответ клиенту', 120);

INSERT INTO problems (
  id, short_id, title, description, status, priority, severity,
  owner_id, team_id, affected_product_ids, affected_services,
  has_workaround, tags, created_by,
  sla_breached, triage_sla_breached
) VALUES
  ('40000000-0000-4000-8000-000004000001', 'PROB-218',
   'Оплата полиса ОСАГО зависает на шаге 3DS',
   'После ввода 3DS-кода клиент видит спиннер, статус не обновляется.',
   'in_progress'::varchar, 'critical'::varchar, 'critical'::varchar,
   '30000000-0000-4000-8000-000003000002',
   '10000000-0000-4000-8000-000001000002',
   ARRAY['20000000-0000-4000-8000-000002000001']::uuid[],
   ARRAY['payments-gateway','mobile-api'],
   TRUE, ARRAY['payments','3ds','mobile'],
   '30000000-0000-4000-8000-000003000004',
   FALSE, FALSE),
  ('40000000-0000-4000-8000-000004000002', 'PROB-204',
   'Не приходят push-уведомления о статусе обращения (Android 14+)',
   'Пуши не доставляются после обновления приложения.',
   'in_progress'::varchar, 'high'::varchar, 'major'::varchar,
   '30000000-0000-4000-8000-000003000002',
   '10000000-0000-4000-8000-000001000001',
   ARRAY['20000000-0000-4000-8000-000002000001','20000000-0000-4000-8000-000002000004']::uuid[],
   ARRAY['notifications'],
   FALSE, ARRAY['push','android','firebase'],
   '30000000-0000-4000-8000-000003000001',
   FALSE, FALSE),
  ('40000000-0000-4000-8000-000004000003', 'PROB-099',
   'Ошибка PDF полиса в личном кабинете',
   '500 при генерации PDF на части аккаунтов.',
   'new'::varchar, 'medium'::varchar, 'moderate'::varchar,
   '30000000-0000-4000-8000-000003000004',
   '10000000-0000-4000-8000-000001000001',
   ARRAY['20000000-0000-4000-8000-000002000002']::uuid[],
   ARRAY['pdf-service'],
   TRUE, ARRAY['pdf','web'],
   '30000000-0000-4000-8000-000003000002',
   FALSE, FALSE);

INSERT INTO problem_products (problem_id, product_id) VALUES
  ('40000000-0000-4000-8000-000004000001', '20000000-0000-4000-8000-000002000001'),
  ('40000000-0000-4000-8000-000004000002', '20000000-0000-4000-8000-000002000001'),
  ('40000000-0000-4000-8000-000004000002', '20000000-0000-4000-8000-000002000004'),
  ('40000000-0000-4000-8000-000004000003', '20000000-0000-4000-8000-000002000002');

INSERT INTO tasks (
  id, problem_id, short_id, task_type, status, title, description,
  priority, severity, team_id, assignee_id,
  proposed_by, proposed_at, reviewed_by, reviewed_at,
  jira_url, jira_issue_key, workaround, has_workaround, support_notes,
  ai_summary, created_by,
  environments, tags
) VALUES
  ('50000000-0000-4000-8000-000005000001',
   '40000000-0000-4000-8000-000004000001', 'BUG-301', 'bug', 'open',
   'Зависание 3DS на iOS/Android после таймаута банка',
   'Повторяемый кейс после релиза 2.13.',
   'critical', 'critical',
   '10000000-0000-4000-8000-000001000002', '30000000-0000-4000-8000-000003000004',
   NULL, NULL, NULL, NULL,
   'https://jira.example.com/browse/PAY-1201', 'PAY-1201',
   'Попросите клиента оплатить с другого устройства или очистить кэш приложения.',
   TRUE,
   'Подтверждено на iOS 17.4 и Android 14. Временный обход через веб ЛК.',
   'Клиенты застревают на экране 3DS; часть платежей проходит дважды.',
   '30000000-0000-4000-8000-000003000004',
   ARRAY['production','ios','android'], ARRAY['3ds','payments']),

  ('50000000-0000-4000-8000-000005000002',
   '40000000-0000-4000-8000-000004000001', 'UI-092', 'ui_debt', 'pending_confirmation',
   'Неочевидный текст ошибки при отказе банка',
   'На шаге 3DS текст «Что-то пошло не так» без кода ошибки.',
   'medium', 'moderate',
   '10000000-0000-4000-8000-000001000002', NULL,
   '30000000-0000-4000-8000-000003000003', NOW() - INTERVAL '6 hours',
   NULL, NULL,
   NULL, NULL, NULL, FALSE, NULL, NULL,
   NULL,
   ARRAY['production','mobile'], ARRAY['ux']),

  ('50000000-0000-4000-8000-000005000003',
   '40000000-0000-4000-8000-000004000002', 'BUG-204', 'bug', 'in_progress',
   'Push token не регистрируется на Android 14+',
   'FCM topic subscription падает тихо.',
   'high', 'major',
   '10000000-0000-4000-8000-000001000001', '30000000-0000-4000-8000-000003000002',
   NULL, NULL, NULL, NULL,
   'https://jira.example.com/browse/MOB-889', 'MOB-889',
   NULL, FALSE,
   NULL,
   'Частота выросла после 5.18.x.',
   '30000000-0000-4000-8000-000003000002',
   ARRAY['production','android'], ARRAY['push','fcm']),

  ('50000000-0000-4000-8000-000005000004',
   '40000000-0000-4000-8000-000004000002', 'BK-045', 'backlog', 'draft',
   'Показывать статус пушей в приложении',
   'Пользователь не видит, что уведомления отключены на уровне ОС.',
   'low', 'minor',
   '10000000-0000-4000-8000-000001000001', NULL,
   '30000000-0000-4000-8000-000003000001', NOW() - INTERVAL '1 day',
   NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL, NULL,
   ARRAY['mobile'], ARRAY['backlog']),

  ('50000000-0000-4000-8000-000005000005',
   '40000000-0000-4000-8000-000004000003', 'BUG-099', 'bug', 'fixed',
   '500 при рендере PDF после миграции шрифтов',
   NULL,
   'medium', 'major',
   '10000000-0000-4000-8000-000001000001', NULL,
   NULL, NULL, NULL, NULL,
   'https://jira.example.com/browse/MOB-441', 'MOB-441',
   'Открыть полис через «Скачать ещё раз».',
   TRUE,
   'Фикс в 5.17.2',
   NULL, '30000000-0000-4000-8000-000003000002',
   ARRAY['web','staging'], ARRAY['pdf']),

  ('50000000-0000-4000-8000-000005000006',
   '40000000-0000-4000-8000-000004000003', 'CJM-012', 'cjm_debt', 'draft',
   'Дублирующее письмо после покупки КАСКО',
   'Два одинаковых email за 30 сек.',
   'medium', 'moderate',
   '10000000-0000-4000-8000-000001000001', NULL,
   '30000000-0000-4000-8000-000003000001', NOW() - INTERVAL '3 hours',
   NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL, NULL,
   ARRAY['backend'], ARRAY['email','duplicate']);

-- Initial tickets (622 = base for duplicate chain)
INSERT INTO support_tickets (
  id, short_id, user_id, customer_name, customer_email, region,
  product_id, platform, raw_text, summary, ticket_date, channel, status,
  current_queue, problem_id, task_id,
  ai_problem_confidence, ai_task_confidence, ai_category,
  requires_research, assigned_to
) VALUES
  ('60000000-0000-4000-8000-000006000001', 'TKT-90001', 'cust_10001', 'Иван П.', 'ivan@example.com', 'MSK',
   '20000000-0000-4000-8000-000002000001', 'mobile_app',
   'Не проходит оплата ОСАГО на айфоне, вечная загрузка после банка',
   '3DS загрузка iOS ОСАГО', NOW() - INTERVAL '2 hours', 'chat', 'in_queue',
   'problem_determination', NULL, NULL, 0.71, NULL, 'payments', FALSE, NULL),

  ('60000000-0000-4000-8000-000006000002', 'TKT-90002', 'cust_10002', 'Пётр С.', NULL, 'SPB',
   '20000000-0000-4000-8000-000002000001', 'mobile_app',
   'То же что у друга: оплата ОСАГО зависла',
   'Дубль 3DS?', NOW() - INTERVAL '3 hours', 'phone', 'in_queue',
   'problem_determination', NULL, NULL, 0.68, NULL, 'payments', FALSE, NULL),

  ('60000000-0000-4000-8000-000006000003', 'TKT-90003', 'cust_10003', 'Елена К.', 'elena@example.com', 'EKB',
   '20000000-0000-4000-8000-000002000001', 'web',
   'Оплатил Полис через ЛК но статус висит час',
   'Web ЛК статус платежа', NOW() - INTERVAL '90 minutes', 'portal', 'linked',
   NULL, '40000000-0000-4000-8000-000004000001', '50000000-0000-4000-8000-000005000001',
   0.93, 0.94, 'payments', FALSE, '30000000-0000-4000-8000-000003000001'),

  ('60000000-0000-4000-8000-000006000004', 'TKT-90004', 'cust_10004', 'Олег Р.', NULL, 'NSK',
   '20000000-0000-4000-8000-000002000001', 'personal_account',
   'Нет push о готовности полиса, Android вчера обновился',
   'Нет push Android', NOW() - INTERVAL '4 hours', 'email', 'in_queue',
   'task_determination', '40000000-0000-4000-8000-000004000002', NULL,
   0.88, 0.74, 'notifications', FALSE, NULL),

  ('60000000-0000-4000-8000-000006000005', 'TKT-90005', 'cust_10005', NULL, NULL, 'MSK',
   '20000000-0000-4000-8000-000002000004', 'mobile_app',
   'Подскажите как включить пуш для статусов обращения',
   'Вопрос по пушам ДМС', NOW() - INTERVAL '50 minutes', 'chat', 'in_queue',
   'client_response', '40000000-0000-4000-8000-000004000002', NULL,
   0.92, NULL, NULL, TRUE, NULL),

  ('60000000-0000-4000-8000-000006000006', 'TKT-90006', 'cust_10006', 'Анна В.', NULL, 'RND',
   '20000000-0000-4000-8000-000002000002', 'web',
   'PDF полис не открывается, ошибка 500 в консоли',
   'PDF 500 ЛК КАСКО', NOW() - INTERVAL '8 hours', 'email', 'linked',
   NULL, '40000000-0000-4000-8000-000004000003', '50000000-0000-4000-8000-000005000005',
   0.91, 0.92, NULL, FALSE, '30000000-0000-4000-8000-000003000003'),

  ('60000000-0000-4000-8000-000006000007', 'TKT-90007', 'cust_10007', NULL, NULL, 'MSK',
   '20000000-0000-4000-8000-000002000002', 'web',
   'Два одинаковых письма о полисе КАСКО пришло',
   'Дубль email КАСКО', NOW() - INTERVAL '30 minutes', 'email', 'in_queue',
   'recommendation_review', '40000000-0000-4000-8000-000004000003', '50000000-0000-4000-8000-000005000005',
   0.9, NULL, NULL, FALSE, NULL);

UPDATE support_tickets
SET is_duplicate = TRUE, duplicate_of = '60000000-0000-4000-8000-000006000001', status = 'duplicate'
WHERE id = '60000000-0000-4000-8000-000006000002';

UPDATE support_tickets SET
  recommendation_text = 'Попросите клиента оплатить с другого устройства или очистить кэш приложения.',
  recommendation_sent = FALSE,
  status = 'awaiting_response'
WHERE id = '60000000-0000-4000-8000-000006000007';

INSERT INTO attachments (ticket_id, file_name, file_type, file_size, s3_key, s3_bucket, is_log, uploaded_by) VALUES
  ('60000000-0000-4000-8000-000006000003', 'payment.log', 'text/plain', 10240, 'tickets/6003/payment.log', 'rmo-attachments', TRUE, '30000000-0000-4000-8000-000003000001'),
  ('60000000-0000-4000-8000-000006000006', 'console.png', 'image/png', 48219, 'tickets/6006/console.png', 'rmo-attachments', FALSE, '30000000-0000-4000-8000-000003000003');

INSERT INTO queue_items (queue_id, ticket_id, priority_score, status, reason, sla_deadline)
SELECT '70000000-0000-4000-8000-000007000001', '60000000-0000-4000-8000-000006000001', 0.94, 'pending',
       'AI confidence 0.71 < threshold 0.9', NOW() + INTERVAL '45 minutes'
UNION ALL
SELECT '70000000-0000-4000-8000-000007000001', '60000000-0000-4000-8000-000006000002', 0.87, 'pending',
       'Duplicate candidate + low confidence', NOW() + INTERVAL '30 minutes'
UNION ALL
SELECT '70000000-0000-4000-8000-000007000002', '60000000-0000-4000-8000-000006000004', 0.91, 'in_progress',
       'AI task confidence 0.74 < threshold 0.9', NOW() + INTERVAL '1 hour'
UNION ALL
SELECT '70000000-0000-4000-8000-000007000004', '60000000-0000-4000-8000-000006000005', 0.62, 'pending',
       'No workaround on linked problem scope', NOW() + INTERVAL '2 hours'
UNION ALL
SELECT '70000000-0000-4000-8000-000007000003', '60000000-0000-4000-8000-000006000007', 0.55, 'pending',
       'Workaround available; human review', NOW() + INTERVAL '20 minutes';

UPDATE queue_items SET assigned_to = '30000000-0000-4000-8000-000003000001', assigned_at = NOW() - INTERVAL '10 minutes'
WHERE ticket_id = '60000000-0000-4000-8000-000006000004';

INSERT INTO activity_log (entity_type, entity_id, action, actor_id, actor_name, new_value, comment) VALUES
  ('support_ticket', '60000000-0000-4000-8000-000006000003', 'linked', '30000000-0000-4000-8000-000003000001', 'Анна Котова',
   '{"problem_id":"40000000-0000-4000-8000-000004000001","task_id":"50000000-0000-4000-8000-000005000001"}'::jsonb, NULL),
  ('problem', '40000000-0000-4000-8000-000004000001', 'created', '30000000-0000-4000-8000-000003000004', 'Илья Громов',
   '{"short_id":"PROB-218"}'::jsonb, NULL),
  ('task', '50000000-0000-4000-8000-000005000001', 'jira_linked', '30000000-0000-4000-8000-000003000004', 'Илья Громов',
   '{"jira_issue_key":"PAY-1201"}'::jsonb, NULL),
  ('support_ticket', '60000000-0000-4000-8000-000006000004', 'queue_entered', NULL, 'system',
   '{"queue_code":"task_determination"}'::jsonb, NULL);

INSERT INTO comments (entity_type, entity_id, author_id, body, is_internal) VALUES
  ('support_ticket', '60000000-0000-4000-8000-000006000005', '30000000-0000-4000-8000-000003000001',
   'Нужен текст ответа: проверили настройки уведомлений на Android 13+.', TRUE),
  ('problem', '40000000-0000-4000-8000-000004000001', '30000000-0000-4000-8000-000003000002',
   'Регламентируем коммуникацию с банками по кодам ошибок.', TRUE);

INSERT INTO ai_suggestions (ticket_id, suggestion_type, suggested_entity_type, suggested_entity_id, confidence, reasoning, is_accepted) VALUES
  ('60000000-0000-4000-8000-000006000001', 'problem_match', 'problem', '40000000-0000-4000-8000-000004000001', 0.71,
   'Совпадают продукт ОСАГО, платформа mobile_app и паттерн 3DS после оплаты', NULL),
  ('60000000-0000-4000-8000-000006000004', 'task_match', 'task', '50000000-0000-4000-8000-000005000003', 0.74,
   'Android + push + задача BUG-204', NULL);

INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, is_read, send_email) VALUES
  ('30000000-0000-4000-8000-000003000004', 'draft_proposal_received', 'Новый черновик задачи',
   'Оператор предложил UI-092 по PROB-218', 'task', '50000000-0000-4000-8000-000005000002', FALSE, FALSE),
  ('30000000-0000-4000-8000-000003000003', 'assignment', 'Взята позиция в очереди',
   'Вы взяли TKT-90004 в task_determination', 'support_ticket', '60000000-0000-4000-8000-000006000004', TRUE, FALSE);

INSERT INTO notifications (team_id, type, title, body, entity_type, entity_id)
VALUES
  ('10000000-0000-4000-8000-000001000002', 'new_problem',
   'Критическая проблема PROB-218', 'Высокий поток платежных обращений', 'problem',
   '40000000-0000-4000-8000-000004000001');

INSERT INTO priority_recalculation_log (entity_type, entity_id, old_priority, new_priority, reason) VALUES
  ('problem', '40000000-0000-4000-8000-000004000001', 'high', 'critical', 'WoW ticket delta + SLA risk');

INSERT INTO weekly_snapshots (entity_type, entity_id, week_start, tickets_count, unresearched_count, tasks_count)
SELECT 'problem', id, DATE_TRUNC('week', NOW() - INTERVAL '7 days')::DATE,
       CASE short_id WHEN 'PROB-218' THEN 80 WHEN 'PROB-204' THEN 210 WHEN 'PROB-099' THEN 40 END,
       CASE short_id WHEN 'PROB-218' THEN 10 WHEN 'PROB-204' THEN 55 WHEN 'PROB-099' THEN 8 END,
       CASE short_id WHEN 'PROB-218' THEN 2 WHEN 'PROB-204' THEN 4 WHEN 'PROB-099' THEN 2 END
FROM problems;

UPDATE problems p
SET
  tasks_count = s.t,
  bugs_count = s.b,
  updated_at = NOW()
FROM (
  SELECT
    problem_id,
    COUNT(*)::int AS t,
    COUNT(*) FILTER (WHERE task_type = 'bug')::int AS b
  FROM tasks
  GROUP BY problem_id
) s
WHERE p.id = s.problem_id;

REFRESH MATERIALIZED VIEW mv_problem_stats;
