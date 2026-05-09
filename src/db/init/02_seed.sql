-- Generated seed: VECTOR / RMO — all mock data from frontend prototype
-- teams=8  products=4  users=8  problems=10  tasks/bugs=11  tickets≈180
SET client_min_messages = WARNING;

INSERT INTO app_settings (key, value) VALUES
  ('ai_confidence_threshold', '{"problem":0.9,"task":0.9,"duplicate":0.9}'::jsonb),
  ('triage_sla_hours',        '{"default":24}'::jsonb),
  ('priority_recalc',         '{"delta_critical":200,"delta_high":100,"delta_medium":50,"min_tickets_critical":50,"min_tickets_high":20}'::jsonb),
  ('file_upload',             '{"max_size_mb":50,"allowed_mime_types":["image/png","image/jpeg","application/pdf","text/plain","application/zip"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO teams (id, name, slug, color, jira_project_key, email_list) VALUES
  ('10000000-0000-4000-8000-000000000001','Mobile Core','mobile-core','#3B82F6','MOB',ARRAY['mobile-core@sbr.example']),
  ('10000000-0000-4000-8000-000000000002','Web Platform','web-platform','#8B5CF6','WEB',ARRAY['web@sbr.example']),
  ('10000000-0000-4000-8000-000000000003','Payments','payments','#10B981','PAY',ARRAY['payments@sbr.example']),
  ('10000000-0000-4000-8000-000000000004','Auth & Identity','auth-identity','#F59E0B','AUTH',ARRAY['auth@sbr.example']),
  ('10000000-0000-4000-8000-000000000005','Policy Service','policy-service','#EF4444','POL',ARRAY['policy@sbr.example']),
  ('10000000-0000-4000-8000-000000000006','Document Hub','document-hub','#6366F1','DOC',ARRAY['docs@sbr.example']),
  ('10000000-0000-4000-8000-000000000007','Analytics','analytics','#14B8A6','AN',ARRAY['analytics@sbr.example']),
  ('10000000-0000-4000-8000-000000000008','Notifications','notifications','#F97316','NTF',ARRAY['ntf@sbr.example']);

INSERT INTO products (id, name, code) VALUES
  ('20000000-0000-4000-8000-000000000001','ОСАГО','osago'),
  ('20000000-0000-4000-8000-000000000002','КАСКО','kasko'),
  ('20000000-0000-4000-8000-000000000003','НС','ns'),
  ('20000000-0000-4000-8000-000000000004','ДМС','dms');

INSERT INTO users (id, email, name, role, team_id) VALUES
  ('30000000-0000-4000-8000-000000000001','anna.kotova@sbr.example','Анна Котова','operator','10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002','dmitry.orlov@sbr.example','Дмитрий Орлов','developer','10000000-0000-4000-8000-000000000006'),
  ('30000000-0000-4000-8000-000000000003','maria.zaitseva@sbr.example','Мария Зайцева','operator','10000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000004','ilya.gromov@sbr.example','Илья Громов','developer','10000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000005','olga.petrova@sbr.example','Ольга Петрова','operator','10000000-0000-4000-8000-000000000004'),
  ('30000000-0000-4000-8000-000000000006','sergei.belov@sbr.example','Сергей Белов','developer','10000000-0000-4000-8000-000000000007'),
  ('30000000-0000-4000-8000-000000000007','nikita.volkov@sbr.example','Никита Волков','operator','10000000-0000-4000-8000-000000000006'),
  ('30000000-0000-4000-8000-000000000008','elena.sokolova@sbr.example','Елена Соколова','operator','10000000-0000-4000-8000-000000000001');

INSERT INTO queues (id, code, name, sla_minutes) VALUES
  ('70000000-0000-4000-8000-000000000001','problem_determination','Определение проблемы',60),
  ('70000000-0000-4000-8000-000000000002','task_determination','Определение задачи/бага',90),
  ('70000000-0000-4000-8000-000000000003','recommendation_review','Контроль отправки рекомендации',30),
  ('70000000-0000-4000-8000-000000000004','client_response','Ответ клиенту',120);

INSERT INTO problems (
  id, short_id, title, description, status, priority, severity,
  owner_id, team_id, affected_product_ids, affected_services,
  has_workaround, tags, sla_breached, triage_sla_breached,
  created_by, created_at, updated_at
) VALUES
  ('40000000-0000-4000-8000-000000000001','PRB-218','Оплата полиса ОСАГО зависает на шаге 3DS','После ввода 3DS-кода клиент видит спиннер, статус не обновляется. Полис не выпускается, деньги списываются у части пользователей.',
   'waiting_fix','critical','critical',
   '30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003',
   ARRAY['20000000-0000-4000-8000-000000000001'::uuid],ARRAY['payments-gateway','mobile-api'],
   TRUE,ARRAY['payments','3ds','ios','android'],
   FALSE,FALSE,
   '30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'10 days',NOW()-INTERVAL'1 hours'),
  ('40000000-0000-4000-8000-000000000002','PRB-204','Не приходят push-уведомления о статусе обращения (Android 14+)','Клиенты не получают пуши о смене статуса. Воспроизводится после установки обновления приложения 5.18.x на Android 14/15.',
   'in_progress','high','major',
   '30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
   ARRAY['20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000004'::uuid],ARRAY['mobile-api','notifications'],
   TRUE,ARRAY['push','fcm','android'],
   FALSE,FALSE,
   '30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'17 days',NOW()-INTERVAL'2 hours'),
  ('40000000-0000-4000-8000-000000000003','PRB-197','Документы КАСКО не открываются в личном кабинете','При попытке открыть PDF полиса КАСКО получается 500 от document-service.',
   'in_progress','high','major',
   '30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006',
   ARRAY['20000000-0000-4000-8000-000000000002'::uuid],ARRAY['document-service','pdf-renderer'],
   TRUE,ARRAY['pdf','document-hub','backend'],
   FALSE,FALSE,
   '30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'21 days',NOW()-INTERVAL'2 hours'),
  ('40000000-0000-4000-8000-000000000004','PRB-186','Ошибка авторизации по СМС после смены номера','Если пользователь сменил номер телефона за последние 24 часа, повторная авторизация падает с 401.',
   'monitoring','high','major',
   '30000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000004',
   ARRAY['20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000003'::uuid,'20000000-0000-4000-8000-000000000004'::uuid],ARRAY['auth-service','sms-gateway'],
   TRUE,ARRAY['auth','sms','identity'],
   FALSE,FALSE,
   '30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'29 days',NOW()-INTERVAL'3 hours'),
  ('40000000-0000-4000-8000-000000000005','PRB-179','Расчёт стоимости НС не учитывает скидку постоянного клиента','При расчёте полиса НС не применяется скидка для клиентов с историей > 2 лет.',
   'new','medium','moderate',
   '30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000005',
   ARRAY['20000000-0000-4000-8000-000000000003'::uuid],ARRAY['policy-service','pricing-engine'],
   FALSE,ARRAY['pricing','ns','new'],
   FALSE,FALSE,
   '30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'37 days',NOW()-INTERVAL'4 hours'),
  ('40000000-0000-4000-8000-000000000006','PRB-172','ДМС: не отображается список клиник в Казани','В мобильном приложении после релиза 5.18 список клиник для региона Казань пустой.',
   'in_progress','medium','moderate',
   '30000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001',
   ARRAY['20000000-0000-4000-8000-000000000004'::uuid],ARRAY['mobile-api','clinics-api'],
   TRUE,ARRAY['clinics','kzn','mobile'],
   FALSE,FALSE,
   '30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'43 days',NOW()-INTERVAL'5 hours'),
  ('40000000-0000-4000-8000-000000000007','PRB-165','Backend API возвращает 504 на /policies/list при > 100 полисах','Корпоративные клиенты с большим числом полисов получают тайм-аут.',
   'in_progress','high','major',
   '30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',
   ARRAY['20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid],ARRAY['backend-api','user-service'],
   TRUE,ARRAY['backend','timeout','api'],
   FALSE,FALSE,
   '30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'50 days',NOW()-INTERVAL'2 hours'),
  ('40000000-0000-4000-8000-000000000008','PRB-154','Дубль страховых случаев в истории клиента','В истории отображаются дублирующиеся записи о страховых случаях после миграции данных.',
   'monitoring','low','minor',
   '30000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000007',
   ARRAY['20000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000003'::uuid],ARRAY['analytics','migration-job'],
   TRUE,ARRAY['data','migration'],
   FALSE,FALSE,
   '30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'57 days',NOW()-INTERVAL'8 hours'),
  ('40000000-0000-4000-8000-000000000009','PRB-148','Ошибка "Invalid VIN" при оформлении ОСАГО для редких марок','Для VIN некоторых китайских и корейских моделей валидатор возвращает ошибку.',
   'new','medium','moderate',
   NULL,'10000000-0000-4000-8000-000000000005',
   ARRAY['20000000-0000-4000-8000-000000000001'::uuid],ARRAY['policy-service','vin-validator'],
   FALSE,ARRAY['vin','validation','new'],
   FALSE,FALSE,
   '30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'64 days',NOW()-INTERVAL'1 hours'),
  ('40000000-0000-4000-8000-000000000010','PRB-140','Не сохраняется вложение к обращению > 8 МБ','Файлы крупнее 8 МБ не загружаются и не возвращают понятную ошибку.',
   'monitoring','low','minor',
   '30000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000006',
   ARRAY['20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000003'::uuid,'20000000-0000-4000-8000-000000000004'::uuid],ARRAY['upload-service','nginx'],
   TRUE,ARRAY['upload','limits'],
   FALSE,FALSE,
   '30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'70 days',NOW()-INTERVAL'9 hours');

INSERT INTO problem_products (problem_id, product_id) VALUES
  ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004'),
  ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000004'),
  ('40000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000004'),
  ('40000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000004');

INSERT INTO tasks (
  id, problem_id, short_id, task_type, status, title,
  priority, severity, team_id, assignee_id,
  jira_url, jira_issue_key, workaround, has_workaround,
  support_notes, root_cause, fix_date, fix_version,
  environments, tickets_count, created_by, created_at, updated_at
) VALUES
  ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','BUG-9182','bug','in_progress','3DS callback теряется при возврате из ACS',
   'critical','critical','10000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004',
   'https://jira.sbr.example/browse/PAY-3318','PAY-3318','Попросить клиента переоткрыть приложение и нажать «Проверить статус оплаты» через 60 сек.',TRUE,
   'Не выпускать новый платёж до проверки статуса; помочь восстановить полис.','Race condition между ACS callback и polling-эндпоинтом /payments/state.',NULL,NULL,
   ARRAY['prod'],612,'30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'8 days',NOW()-INTERVAL'1 hours'),
  ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','BUG-9170','bug','in_review','Платёжный спиннер не отваливается по таймауту',
   'critical','major','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
   'https://jira.sbr.example/browse/MOB-7741','MOB-7741','Принудительный таймаут 90 сек добавлен в hotfix 5.18.4 (на ревью).',TRUE,
   'Сообщить клиенту, что после 90 сек спиннера можно безопасно перезайти.','Нет обработчика onTimeout в PaymentProgressViewModel.',NULL,NULL,
   ARRAY['prod','staging'],287,'30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'11 days',NOW()-INTERVAL'2 hours'),
  ('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','BUG-9163','bug','in_progress','ACS-домен заблокирован у части ISP',
   'critical','major','10000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004',
   'https://jira.sbr.example/browse/PAY-3322','PAY-3322','Перевыпустить ссылку на 3DS через support tools.',TRUE,
   'Эскалировать партнёру; предложить альтернативный способ оплаты.','Часть ISP блокирует acs.partner.example как фишинг.',NULL,NULL,
   ARRAY['prod'],207,'30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'14 days',NOW()-INTERVAL'3 hours'),
  ('50000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000002','BUG-9051','bug','in_progress','FCM token не обновляется на Android 14',
   'high','major','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
   'https://jira.sbr.example/browse/MOB-7689','MOB-7689','Попросить клиента переустановить приложение или включить уведомления заново.',TRUE,
   'Исправляется в 5.18.5; вручную обновлять токен через support tools.','Изменение поведения FirebaseMessaging.getToken() на Android 14.','2026-05-12','5.18.3',
   ARRAY['prod'],312,'30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'17 days',NOW()-INTERVAL'4 hours'),
  ('50000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000002','BUG-9047','bug','fixed','Notification channel удаляется при апдейте',
   'high','moderate','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
   'https://jira.sbr.example/browse/MOB-7691','MOB-7691','Переоткрыть приложение, чтобы канал создался заново.',TRUE,
   'Уже исправлено в 5.18.4.','Миграция на новый channel_id без сохранения настроек.','2026-05-04','5.18.4',
   ARRAY['prod'],72,'30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'20 days',NOW()-INTERVAL'5 hours'),
  ('50000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000003','BUG-8990','bug','in_progress','document-service возвращает 500 при PDF > 4 МБ',
   'high','major','10000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000002',
   'https://jira.sbr.example/browse/DOC-1129','DOC-1129','Запросить у саппорта e-mail c PDF.',TRUE,
   'Эскалация: пока не пофикшено, отправлять полис вручную.','OOM в pdf-generator на крупных шаблонах КАСКО.',NULL,NULL,
   ARRAY['prod'],254,'30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'23 days',NOW()-INTERVAL'6 hours'),
  ('50000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000004','BUG-8902','bug','in_progress','Identity service не инвалидирует старый токен после смены номера',
   'high','major','10000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000005',
   'https://jira.sbr.example/browse/AUTH-441','AUTH-441','Force logout через support tools, после этого пускает.',TRUE,
   'Force logout — стандартный обход. Исправляется в Q2.','Кэш сессий по старому номеру, TTL 24ч.',NULL,NULL,
   ARRAY['prod'],278,'30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'26 days',NOW()-INTERVAL'7 hours'),
  ('50000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000006','BUG-8770','bug','fixed','Geo-фильтр клиник не учитывает регион Казань',
   'medium','moderate','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000008',
   'https://jira.sbr.example/browse/MOB-7510','MOB-7510','Сменить регион на «Татарстан» вручную.',TRUE,
   'Уже исправлено в 5.18.5 (релиз 06.05).','Опечатка в маппинге region code KZN → 16.','2026-05-06','5.19.7',
   ARRAY['prod'],92,'30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'29 days',NOW()-INTERVAL'8 hours'),
  ('50000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000007','BUG-8650','bug','in_progress','/policies/list O(N) запрос к user-service',
   'high','major','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',
   'https://jira.sbr.example/browse/WEB-2204','WEB-2204','Корпоративные клиенты — выгрузка списка через support tools.',TRUE,
   'Переход на batch endpoint, ETA 14.05.','N+1 запросов в user-service на каждый полис.','2026-05-14','5.19.8',
   ARRAY['prod','staging'],64,'30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'32 days',NOW()-INTERVAL'9 hours'),
  ('50000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000008','BUG-8412','bug','fixed','Migration job дублирует строки страховых случаев',
   'low','minor','10000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000006',
   'https://jira.sbr.example/browse/AN-118','AN-118','Игнорировать дубликаты с одинаковым case_id.',TRUE,
   'Дедупликация раскатана; данные подчистятся в течение 24ч.','Idempotency key не использовался при ретраях.','2026-05-01','5.20.9',
   ARRAY['prod'],41,'30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'35 days',NOW()-INTERVAL'10 hours'),
  ('50000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000010','BUG-8208','bug','in_review','Upload service отвергает файлы > 8 МБ без ошибки',
   'low','minor','10000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000007',
   'https://jira.sbr.example/browse/DOC-1078','DOC-1078','Рекомендовать сжать файл или отправить по e-mail.',TRUE,
   'Поднять лимит до 25 МБ, добавить понятную ошибку.','Лимит nginx 8M, нет 413-ответа клиенту.',NULL,NULL,
   ARRAY['prod'],28,'30000000-0000-4000-8000-000000000001',NOW()-INTERVAL'38 days',NOW()-INTERVAL'11 hours');

DO $$
DECLARE
  _prob UUID; _task UUID; _prod UUID;
  _plats TEXT[]; _prods TEXT[]; _texts TEXT[];
  _n INT; _n_res INT;
  _plat TEXT; _reg TEXT; _ch TEXT; _txt TEXT;
  _stat TEXT; _is_res BOOL; _q TEXT;
  _regions  TEXT[] := ARRAY['MSK','SPB','EKB','NSK','KZN','RND','VLG','CHE'];
  _channels TEXT[] := ARRAY['chat','phone','email','social','in-app'];
  i INT;
BEGIN
  -- PR01: 50 tickets, 8 research
  _prob  := '40000000-0000-4000-8000-000000000001';
  _task  := '50000000-0000-4000-8000-000000000001';
  _plats := ARRAY['mobile_app','web'];
  _prods := ARRAY['20000000-0000-4000-8000-000000000001'];
  _texts := ARRAY['Не могу оплатить полис — после ввода кода висит загрузка минут пять, потом просто экран белый. Деньги списались.','Платёж завис на шаге 3DS, статус не обновляется уже 20 минут.','Оплата ОСАГО через мобильное приложение не завершается, вижу спиннер.','После ввода 3DS-кода ничего не происходит. Деньги с карты ушли.'];
  _n := 50; _n_res := 8;
  FOR i IN 1.._n LOOP
    _plat := _plats[1+((i-1) % array_length(_plats,1))];
    _prod := _prods[1+((i-1) % array_length(_prods,1))];
    _reg  := _regions[1+((i-1) % 8)];
    _ch   := _channels[1+((i-1) % 5)];
    _txt  := _texts[1+((i-1) % array_length(_texts,1))];
    _is_res := (i <= _n_res);
    _stat := CASE WHEN i % 3 = 0 THEN 'answered' WHEN _is_res THEN 'researching' ELSE 'linked' END;
    _q := CASE WHEN _is_res THEN 'task_determination' ELSE NULL END;
    INSERT INTO support_tickets
      (user_id,region,product_id,platform,raw_text,summary,
       ticket_date,channel,status,current_queue,
       problem_id,task_id,requires_research,is_new_case)
    VALUES
      ('client-8919-' || i::text,
       _reg,_prod::UUID,_plat,_txt,left(_txt,80),
       NOW()-(INTERVAL'1 hour'*((i*7)%336)),
       _ch,_stat,_q,
       _prob,_task,_is_res,FALSE);
  END LOOP;
  -- PR02: 25 tickets, 3 research
  _prob  := '40000000-0000-4000-8000-000000000002';
  _task  := '50000000-0000-4000-8000-000000000004';
  _plats := ARRAY['mobile_app'];
  _prods := ARRAY['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004'];
  _texts := ARRAY['Здравствуйте! Не приходят пуши о статусе обращения, хотя в настройках всё включено.','Push-уведомления перестали приходить после обновления приложения на Android.'];
  _n := 25; _n_res := 3;
  FOR i IN 1.._n LOOP
    _plat := _plats[1+((i-1) % array_length(_plats,1))];
    _prod := _prods[1+((i-1) % array_length(_prods,1))];
    _reg  := _regions[1+((i-1) % 8)];
    _ch   := _channels[1+((i-1) % 5)];
    _txt  := _texts[1+((i-1) % array_length(_texts,1))];
    _is_res := (i <= _n_res);
    _stat := CASE WHEN i % 3 = 0 THEN 'answered' WHEN _is_res THEN 'researching' ELSE 'linked' END;
    _q := CASE WHEN _is_res THEN 'task_determination' ELSE NULL END;
    INSERT INTO support_tickets
      (user_id,region,product_id,platform,raw_text,summary,
       ticket_date,channel,status,current_queue,
       problem_id,task_id,requires_research,is_new_case)
    VALUES
      ('client-8849-' || i::text,
       _reg,_prod::UUID,_plat,_txt,left(_txt,80),
       NOW()-(INTERVAL'1 hour'*((i*7)%336)),
       _ch,_stat,_q,
       _prob,_task,_is_res,FALSE);
  END LOOP;
  -- PR03: 20 tickets, 4 research
  _prob  := '40000000-0000-4000-8000-000000000003';
  _task  := '50000000-0000-4000-8000-000000000006';
  _plats := ARRAY['personal_account','mobile_app'];
  _prods := ARRAY['20000000-0000-4000-8000-000000000002'];
  _texts := ARRAY['При попытке скачать полис КАСКО получаю ошибку 500.','Документ КАСКО не открывается в личном кабинете.'];
  _n := 20; _n_res := 4;
  FOR i IN 1.._n LOOP
    _plat := _plats[1+((i-1) % array_length(_plats,1))];
    _prod := _prods[1+((i-1) % array_length(_prods,1))];
    _reg  := _regions[1+((i-1) % 8)];
    _ch   := _channels[1+((i-1) % 5)];
    _txt  := _texts[1+((i-1) % array_length(_texts,1))];
    _is_res := (i <= _n_res);
    _stat := CASE WHEN i % 3 = 0 THEN 'answered' WHEN _is_res THEN 'researching' ELSE 'linked' END;
    _q := CASE WHEN _is_res THEN 'task_determination' ELSE NULL END;
    INSERT INTO support_tickets
      (user_id,region,product_id,platform,raw_text,summary,
       ticket_date,channel,status,current_queue,
       problem_id,task_id,requires_research,is_new_case)
    VALUES
      ('client-4022-' || i::text,
       _reg,_prod::UUID,_plat,_txt,left(_txt,80),
       NOW()-(INTERVAL'1 hour'*((i*7)%336)),
       _ch,_stat,_q,
       _prob,_task,_is_res,FALSE);
  END LOOP;
  -- PR04: 18 tickets, 2 research
  _prob  := '40000000-0000-4000-8000-000000000004';
  _task  := '50000000-0000-4000-8000-000000000007';
  _plats := ARRAY['mobile_app','personal_account'];
  _prods := ARRAY['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004'];
  _texts := ARRAY['Сменил номер вчера, сегодня не могу зайти. Пишет неверный код.','После смены номера телефона авторизация по СМС не работает.'];
  _n := 18; _n_res := 2;
  FOR i IN 1.._n LOOP
    _plat := _plats[1+((i-1) % array_length(_plats,1))];
    _prod := _prods[1+((i-1) % array_length(_prods,1))];
    _reg  := _regions[1+((i-1) % 8)];
    _ch   := _channels[1+((i-1) % 5)];
    _txt  := _texts[1+((i-1) % array_length(_texts,1))];
    _is_res := (i <= _n_res);
    _stat := CASE WHEN i % 3 = 0 THEN 'answered' WHEN _is_res THEN 'researching' ELSE 'linked' END;
    _q := CASE WHEN _is_res THEN 'task_determination' ELSE NULL END;
    INSERT INTO support_tickets
      (user_id,region,product_id,platform,raw_text,summary,
       ticket_date,channel,status,current_queue,
       problem_id,task_id,requires_research,is_new_case)
    VALUES
      ('client-4477-' || i::text,
       _reg,_prod::UUID,_plat,_txt,left(_txt,80),
       NOW()-(INTERVAL'1 hour'*((i*7)%336)),
       _ch,_stat,_q,
       _prob,_task,_is_res,FALSE);
  END LOOP;
  -- PR05: 10 tickets, 5 research
  _prob  := '40000000-0000-4000-8000-000000000005';
  _task  := NULL;
  _plats := ARRAY['mobile_app','web','personal_account'];
  _prods := ARRAY['20000000-0000-4000-8000-000000000003'];
  _texts := ARRAY['Хочу оформить НС. Скидка постоянного клиента не применяется.','При расчёте НС система не учитывает мою историю как постоянного клиента.'];
  _n := 10; _n_res := 5;
  FOR i IN 1.._n LOOP
    _plat := _plats[1+((i-1) % array_length(_plats,1))];
    _prod := _prods[1+((i-1) % array_length(_prods,1))];
    _reg  := _regions[1+((i-1) % 8)];
    _ch   := _channels[1+((i-1) % 5)];
    _txt  := _texts[1+((i-1) % array_length(_texts,1))];
    _is_res := (i <= _n_res);
    _stat := CASE WHEN _is_res THEN 'researching' WHEN i % 4 = 0 THEN 'duplicate' ELSE 'new' END;
    _q := CASE WHEN (_is_res OR _stat = 'new') THEN 'problem_determination' ELSE NULL END;
    INSERT INTO support_tickets
      (user_id,region,product_id,platform,raw_text,summary,
       ticket_date,channel,status,current_queue,
       problem_id,task_id,requires_research,is_new_case)
    VALUES
      ('client-8847-' || i::text,
       _reg,_prod::UUID,_plat,_txt,left(_txt,80),
       NOW()-(INTERVAL'1 hour'*((i*7)%336)),
       _ch,_stat,_q,
       _prob,_task,_is_res,FALSE);
  END LOOP;
  -- PR06: 10 tickets, 1 research
  _prob  := '40000000-0000-4000-8000-000000000006';
  _task  := '50000000-0000-4000-8000-000000000008';
  _plats := ARRAY['mobile_app'];
  _prods := ARRAY['20000000-0000-4000-8000-000000000004'];
  _texts := ARRAY['В мобильном приложении нет ни одной клиники в Казани.','Список клиник ДМС для Казани пустой.'];
  _n := 10; _n_res := 1;
  FOR i IN 1.._n LOOP
    _plat := _plats[1+((i-1) % array_length(_plats,1))];
    _prod := _prods[1+((i-1) % array_length(_prods,1))];
    _reg  := _regions[1+((i-1) % 8)];
    _ch   := _channels[1+((i-1) % 5)];
    _txt  := _texts[1+((i-1) % array_length(_texts,1))];
    _is_res := (i <= _n_res);
    _stat := CASE WHEN i % 3 = 0 THEN 'answered' WHEN _is_res THEN 'researching' ELSE 'linked' END;
    _q := CASE WHEN _is_res THEN 'task_determination' ELSE NULL END;
    INSERT INTO support_tickets
      (user_id,region,product_id,platform,raw_text,summary,
       ticket_date,channel,status,current_queue,
       problem_id,task_id,requires_research,is_new_case)
    VALUES
      ('client-8243-' || i::text,
       _reg,_prod::UUID,_plat,_txt,left(_txt,80),
       NOW()-(INTERVAL'1 hour'*((i*7)%336)),
       _ch,_stat,_q,
       _prob,_task,_is_res,FALSE);
  END LOOP;
  -- PR07: 10 tickets, 1 research
  _prob  := '40000000-0000-4000-8000-000000000007';
  _task  := '50000000-0000-4000-8000-000000000009';
  _plats := ARRAY['backend_api','personal_account'];
  _prods := ARRAY['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002'];
  _texts := ARRAY['Список полисов вообще не открывается, бесконечная загрузка.','Корпоративный аккаунт — страница /policies/list зависает.'];
  _n := 10; _n_res := 1;
  FOR i IN 1.._n LOOP
    _plat := _plats[1+((i-1) % array_length(_plats,1))];
    _prod := _prods[1+((i-1) % array_length(_prods,1))];
    _reg  := _regions[1+((i-1) % 8)];
    _ch   := _channels[1+((i-1) % 5)];
    _txt  := _texts[1+((i-1) % array_length(_texts,1))];
    _is_res := (i <= _n_res);
    _stat := CASE WHEN i % 3 = 0 THEN 'answered' WHEN _is_res THEN 'researching' ELSE 'linked' END;
    _q := CASE WHEN _is_res THEN 'task_determination' ELSE NULL END;
    INSERT INTO support_tickets
      (user_id,region,product_id,platform,raw_text,summary,
       ticket_date,channel,status,current_queue,
       problem_id,task_id,requires_research,is_new_case)
    VALUES
      ('client-1764-' || i::text,
       _reg,_prod::UUID,_plat,_txt,left(_txt,80),
       NOW()-(INTERVAL'1 hour'*((i*7)%336)),
       _ch,_stat,_q,
       _prob,_task,_is_res,FALSE);
  END LOOP;
  -- PR08: 10 tickets, 1 research
  _prob  := '40000000-0000-4000-8000-000000000008';
  _task  := '50000000-0000-4000-8000-000000000010';
  _plats := ARRAY['personal_account'];
  _prods := ARRAY['20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003'];
  _texts := ARRAY['В истории два одинаковых страховых случая с одной и той же датой.','Дублирующиеся записи о страховых случаях после обновления.'];
  _n := 10; _n_res := 1;
  FOR i IN 1.._n LOOP
    _plat := _plats[1+((i-1) % array_length(_plats,1))];
    _prod := _prods[1+((i-1) % array_length(_prods,1))];
    _reg  := _regions[1+((i-1) % 8)];
    _ch   := _channels[1+((i-1) % 5)];
    _txt  := _texts[1+((i-1) % array_length(_texts,1))];
    _is_res := (i <= _n_res);
    _stat := CASE WHEN i % 3 = 0 THEN 'answered' WHEN _is_res THEN 'researching' ELSE 'linked' END;
    _q := CASE WHEN _is_res THEN 'task_determination' ELSE NULL END;
    INSERT INTO support_tickets
      (user_id,region,product_id,platform,raw_text,summary,
       ticket_date,channel,status,current_queue,
       problem_id,task_id,requires_research,is_new_case)
    VALUES
      ('client-6690-' || i::text,
       _reg,_prod::UUID,_plat,_txt,left(_txt,80),
       NOW()-(INTERVAL'1 hour'*((i*7)%336)),
       _ch,_stat,_q,
       _prob,_task,_is_res,FALSE);
  END LOOP;
  -- PR09: 15 tickets, 8 research
  _prob  := '40000000-0000-4000-8000-000000000009';
  _task  := NULL;
  _plats := ARRAY['mobile_app','web'];
  _prods := ARRAY['20000000-0000-4000-8000-000000000001'];
  _texts := ARRAY['Пытаюсь оформить ОСАГО на BYD — пишет неверный VIN.','При вводе VIN китайского автомобиля система выдаёт ошибку валидации.','Ошибка «Invalid VIN» на Haval F7 — всё верно ввёл.'];
  _n := 15; _n_res := 8;
  FOR i IN 1.._n LOOP
    _plat := _plats[1+((i-1) % array_length(_plats,1))];
    _prod := _prods[1+((i-1) % array_length(_prods,1))];
    _reg  := _regions[1+((i-1) % 8)];
    _ch   := _channels[1+((i-1) % 5)];
    _txt  := _texts[1+((i-1) % array_length(_texts,1))];
    _is_res := (i <= _n_res);
    _stat := CASE WHEN _is_res THEN 'researching' WHEN i % 4 = 0 THEN 'duplicate' ELSE 'new' END;
    _q := CASE WHEN (_is_res OR _stat = 'new') THEN 'problem_determination' ELSE NULL END;
    INSERT INTO support_tickets
      (user_id,region,product_id,platform,raw_text,summary,
       ticket_date,channel,status,current_queue,
       problem_id,task_id,requires_research,is_new_case)
    VALUES
      ('client-1778-' || i::text,
       _reg,_prod::UUID,_plat,_txt,left(_txt,80),
       NOW()-(INTERVAL'1 hour'*((i*7)%336)),
       _ch,_stat,_q,
       _prob,_task,_is_res,FALSE);
  END LOOP;
  -- PR10: 10 tickets, 1 research
  _prob  := '40000000-0000-4000-8000-000000000010';
  _task  := '50000000-0000-4000-8000-000000000011';
  _plats := ARRAY['personal_account','web'];
  _prods := ARRAY['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004'];
  _texts := ARRAY['Не могу прикрепить скан паспорта (12 МБ) к обращению.','Файл больше 8 МБ не загружается и не показывает понятную ошибку.'];
  _n := 10; _n_res := 1;
  FOR i IN 1.._n LOOP
    _plat := _plats[1+((i-1) % array_length(_plats,1))];
    _prod := _prods[1+((i-1) % array_length(_prods,1))];
    _reg  := _regions[1+((i-1) % 8)];
    _ch   := _channels[1+((i-1) % 5)];
    _txt  := _texts[1+((i-1) % array_length(_texts,1))];
    _is_res := (i <= _n_res);
    _stat := CASE WHEN i % 3 = 0 THEN 'answered' WHEN _is_res THEN 'researching' ELSE 'linked' END;
    _q := CASE WHEN _is_res THEN 'task_determination' ELSE NULL END;
    INSERT INTO support_tickets
      (user_id,region,product_id,platform,raw_text,summary,
       ticket_date,channel,status,current_queue,
       problem_id,task_id,requires_research,is_new_case)
    VALUES
      ('client-8385-' || i::text,
       _reg,_prod::UUID,_plat,_txt,left(_txt,80),
       NOW()-(INTERVAL'1 hour'*((i*7)%336)),
       _ch,_stat,_q,
       _prob,_task,_is_res,FALSE);
  END LOOP;
END;
$$;

-- Override denormalised counters to match frontend mock values
UPDATE problems AS p SET
  tickets_count              = v.tc,
  tickets_count_prev_week    = v.tcp,
  unresearched_count         = v.uc,
  unresearched_count_prev_week = v.ucp,
  tickets_no_task_count      = v.nob,
  tasks_count                = v.tskc,
  bugs_count                 = v.bc,
  sla_breached               = v.slabr,
  updated_at                 = NOW()
FROM (VALUES
  ('40000000-0000-4000-8000-000000000001',1248,931,86,98,142,3,3,TRUE),
  ('40000000-0000-4000-8000-000000000002',412,349,22,21,28,2,2,TRUE),
  ('40000000-0000-4000-8000-000000000003',318,224,41,32,64,1,1,TRUE),
  ('40000000-0000-4000-8000-000000000004',287,312,12,20,9,1,1,FALSE),
  ('40000000-0000-4000-8000-000000000005',154,138,38,25,154,0,0,FALSE),
  ('40000000-0000-4000-8000-000000000006',96,101,4,8,6,1,1,FALSE),
  ('40000000-0000-4000-8000-000000000007',73,60,6,6,4,1,1,TRUE),
  ('40000000-0000-4000-8000-000000000008',42,51,2,5,1,1,1,FALSE),
  ('40000000-0000-4000-8000-000000000009',211,131,198,114,211,0,0,FALSE),
  ('40000000-0000-4000-8000-000000000010',28,28,1,1,0,1,1,FALSE)
) AS v(id,tc,tcp,uc,ucp,nob,tskc,bc,slabr)
WHERE p.id = v.id::UUID;

INSERT INTO weekly_snapshots (entity_type, entity_id, week_start, tickets_count, unresearched_count, tasks_count)
VALUES
  ('problem','40000000-0000-4000-8000-000000000001',DATE_TRUNC('week',NOW()-INTERVAL'7 days')::DATE,931,98,3),
  ('problem','40000000-0000-4000-8000-000000000002',DATE_TRUNC('week',NOW()-INTERVAL'7 days')::DATE,349,21,2),
  ('problem','40000000-0000-4000-8000-000000000003',DATE_TRUNC('week',NOW()-INTERVAL'7 days')::DATE,224,32,1),
  ('problem','40000000-0000-4000-8000-000000000004',DATE_TRUNC('week',NOW()-INTERVAL'7 days')::DATE,312,20,1),
  ('problem','40000000-0000-4000-8000-000000000005',DATE_TRUNC('week',NOW()-INTERVAL'7 days')::DATE,138,25,0),
  ('problem','40000000-0000-4000-8000-000000000006',DATE_TRUNC('week',NOW()-INTERVAL'7 days')::DATE,101,8,1),
  ('problem','40000000-0000-4000-8000-000000000007',DATE_TRUNC('week',NOW()-INTERVAL'7 days')::DATE,60,6,1),
  ('problem','40000000-0000-4000-8000-000000000008',DATE_TRUNC('week',NOW()-INTERVAL'7 days')::DATE,51,5,1),
  ('problem','40000000-0000-4000-8000-000000000009',DATE_TRUNC('week',NOW()-INTERVAL'7 days')::DATE,131,114,0),
  ('problem','40000000-0000-4000-8000-000000000010',DATE_TRUNC('week',NOW()-INTERVAL'7 days')::DATE,28,1,1);

INSERT INTO attachments (ticket_id,file_name,file_type,file_size,s3_key,s3_bucket,is_log,is_screenshot,uploaded_by)
SELECT st.id,
  CASE ((row_number() OVER (ORDER BY st.created_at))::int % 3)
    WHEN 0 THEN 'payment.log' WHEN 1 THEN 'screenshot.png' ELSE 'console.log' END,
  CASE ((row_number() OVER (ORDER BY st.created_at))::int % 3)
    WHEN 0 THEN 'text/plain'  WHEN 1 THEN 'image/png'      ELSE 'text/plain' END,
  CASE ((row_number() OVER (ORDER BY st.created_at))::int % 3)
    WHEN 0 THEN 10240 WHEN 1 THEN 48219 ELSE 8192 END,
  'tickets/'||st.id::TEXT||'/file',
  'rmo-attachments',
  ((row_number() OVER (ORDER BY st.created_at))::int % 3 <> 1),
  ((row_number() OVER (ORDER BY st.created_at))::int % 3 = 1),
  '30000000-0000-4000-8000-000000000001'
FROM support_tickets st
WHERE (extract(epoch FROM st.created_at)::int % 4) = 0
LIMIT 40;

INSERT INTO queue_items (queue_id,ticket_id,priority_score,status,reason,sla_deadline)
SELECT '70000000-0000-4000-8000-000000000002',st.id,
  0.95-(row_number() OVER (ORDER BY st.created_at DESC))::float*0.002,
  'pending',
  'AI confidence below threshold',
  NOW()+INTERVAL'90 minutes'
FROM support_tickets st
WHERE st.problem_id='40000000-0000-4000-8000-000000000001' AND st.requires_research=TRUE
  AND NOT EXISTS (SELECT 1 FROM queue_items qi WHERE qi.ticket_id=st.id)
LIMIT 12;

INSERT INTO queue_items (queue_id,ticket_id,priority_score,status,reason,sla_deadline)
SELECT '70000000-0000-4000-8000-000000000002',st.id,
  0.85-(row_number() OVER (ORDER BY st.created_at DESC))::float*0.002,
  'pending',
  'AI confidence below threshold',
  NOW()+INTERVAL'90 minutes'
FROM support_tickets st
WHERE st.problem_id='40000000-0000-4000-8000-000000000002' AND st.requires_research=TRUE
  AND NOT EXISTS (SELECT 1 FROM queue_items qi WHERE qi.ticket_id=st.id)
LIMIT 12;

INSERT INTO queue_items (queue_id,ticket_id,priority_score,status,reason,sla_deadline)
SELECT '70000000-0000-4000-8000-000000000002',st.id,
  0.85-(row_number() OVER (ORDER BY st.created_at DESC))::float*0.002,
  'pending',
  'AI confidence below threshold',
  NOW()+INTERVAL'90 minutes'
FROM support_tickets st
WHERE st.problem_id='40000000-0000-4000-8000-000000000003' AND st.requires_research=TRUE
  AND NOT EXISTS (SELECT 1 FROM queue_items qi WHERE qi.ticket_id=st.id)
LIMIT 12;

INSERT INTO queue_items (queue_id,ticket_id,priority_score,status,reason,sla_deadline)
SELECT '70000000-0000-4000-8000-000000000002',st.id,
  0.85-(row_number() OVER (ORDER BY st.created_at DESC))::float*0.002,
  'pending',
  'AI confidence below threshold',
  NOW()+INTERVAL'90 minutes'
FROM support_tickets st
WHERE st.problem_id='40000000-0000-4000-8000-000000000004' AND st.requires_research=TRUE
  AND NOT EXISTS (SELECT 1 FROM queue_items qi WHERE qi.ticket_id=st.id)
LIMIT 12;

INSERT INTO queue_items (queue_id,ticket_id,priority_score,status,reason,sla_deadline)
SELECT '70000000-0000-4000-8000-000000000001',st.id,
  0.7-(row_number() OVER (ORDER BY st.created_at DESC))::float*0.002,
  'pending',
  'AI confidence below threshold',
  NOW()+INTERVAL'60 minutes'
FROM support_tickets st
WHERE st.problem_id='40000000-0000-4000-8000-000000000005' AND st.requires_research=TRUE
  AND NOT EXISTS (SELECT 1 FROM queue_items qi WHERE qi.ticket_id=st.id)
LIMIT 12;

INSERT INTO queue_items (queue_id,ticket_id,priority_score,status,reason,sla_deadline)
SELECT '70000000-0000-4000-8000-000000000002',st.id,
  0.7-(row_number() OVER (ORDER BY st.created_at DESC))::float*0.002,
  'pending',
  'AI confidence below threshold',
  NOW()+INTERVAL'90 minutes'
FROM support_tickets st
WHERE st.problem_id='40000000-0000-4000-8000-000000000006' AND st.requires_research=TRUE
  AND NOT EXISTS (SELECT 1 FROM queue_items qi WHERE qi.ticket_id=st.id)
LIMIT 4;

INSERT INTO queue_items (queue_id,ticket_id,priority_score,status,reason,sla_deadline)
SELECT '70000000-0000-4000-8000-000000000002',st.id,
  0.85-(row_number() OVER (ORDER BY st.created_at DESC))::float*0.002,
  'pending',
  'AI confidence below threshold',
  NOW()+INTERVAL'90 minutes'
FROM support_tickets st
WHERE st.problem_id='40000000-0000-4000-8000-000000000007' AND st.requires_research=TRUE
  AND NOT EXISTS (SELECT 1 FROM queue_items qi WHERE qi.ticket_id=st.id)
LIMIT 6;

INSERT INTO queue_items (queue_id,ticket_id,priority_score,status,reason,sla_deadline)
SELECT '70000000-0000-4000-8000-000000000002',st.id,
  0.55-(row_number() OVER (ORDER BY st.created_at DESC))::float*0.002,
  'pending',
  'AI confidence below threshold',
  NOW()+INTERVAL'90 minutes'
FROM support_tickets st
WHERE st.problem_id='40000000-0000-4000-8000-000000000008' AND st.requires_research=TRUE
  AND NOT EXISTS (SELECT 1 FROM queue_items qi WHERE qi.ticket_id=st.id)
LIMIT 2;

INSERT INTO queue_items (queue_id,ticket_id,priority_score,status,reason,sla_deadline)
SELECT '70000000-0000-4000-8000-000000000001',st.id,
  0.7-(row_number() OVER (ORDER BY st.created_at DESC))::float*0.002,
  'pending',
  'AI confidence below threshold',
  NOW()+INTERVAL'60 minutes'
FROM support_tickets st
WHERE st.problem_id='40000000-0000-4000-8000-000000000009' AND st.requires_research=TRUE
  AND NOT EXISTS (SELECT 1 FROM queue_items qi WHERE qi.ticket_id=st.id)
LIMIT 12;

INSERT INTO queue_items (queue_id,ticket_id,priority_score,status,reason,sla_deadline)
SELECT '70000000-0000-4000-8000-000000000002',st.id,
  0.55-(row_number() OVER (ORDER BY st.created_at DESC))::float*0.002,
  'pending',
  'AI confidence below threshold',
  NOW()+INTERVAL'90 minutes'
FROM support_tickets st
WHERE st.problem_id='40000000-0000-4000-8000-000000000010' AND st.requires_research=TRUE
  AND NOT EXISTS (SELECT 1 FROM queue_items qi WHERE qi.ticket_id=st.id)
LIMIT 1;

INSERT INTO activity_log (entity_type,entity_id,action,actor_id,actor_name,new_value,comment)
VALUES
  ('problem','40000000-0000-4000-8000-000000000001','created','30000000-0000-4000-8000-000000000004',
   'Илья Громов',jsonb_build_object('short_id','PRB-218'),NULL),
  ('problem','40000000-0000-4000-8000-000000000002','created','30000000-0000-4000-8000-000000000001',
   'Анна Котова',jsonb_build_object('short_id','PRB-204'),NULL),
  ('problem','40000000-0000-4000-8000-000000000003','created','30000000-0000-4000-8000-000000000002',
   'Дмитрий Орлов',jsonb_build_object('short_id','PRB-197'),NULL),
  ('problem','40000000-0000-4000-8000-000000000004','created','30000000-0000-4000-8000-000000000005',
   'Ольга Петрова',jsonb_build_object('short_id','PRB-186'),NULL),
  ('problem','40000000-0000-4000-8000-000000000005','created','30000000-0000-4000-8000-000000000003',
   'Мария Зайцева',jsonb_build_object('short_id','PRB-179'),NULL),
  ('problem','40000000-0000-4000-8000-000000000006','created','30000000-0000-4000-8000-000000000008',
   'Елена Соколова',jsonb_build_object('short_id','PRB-172'),NULL),
  ('problem','40000000-0000-4000-8000-000000000007','created','30000000-0000-4000-8000-000000000002',
   'Дмитрий Орлов',jsonb_build_object('short_id','PRB-165'),NULL),
  ('problem','40000000-0000-4000-8000-000000000008','created','30000000-0000-4000-8000-000000000006',
   'Сергей Белов',jsonb_build_object('short_id','PRB-154'),NULL),
  ('problem','40000000-0000-4000-8000-000000000009','created','30000000-0000-4000-8000-000000000001',
   'Анна Котова',jsonb_build_object('short_id','PRB-148'),NULL),
  ('problem','40000000-0000-4000-8000-000000000010','created','30000000-0000-4000-8000-000000000007',
   'Никита Волков',jsonb_build_object('short_id','PRB-140'),NULL),
  ('task','50000000-0000-4000-8000-000000000001','jira_linked','30000000-0000-4000-8000-000000000004',
   'Илья Громов',jsonb_build_object('jira_issue_key','PAY-3318'),NULL),
  ('task','50000000-0000-4000-8000-000000000002','jira_linked','30000000-0000-4000-8000-000000000001',
   'Анна Котова',jsonb_build_object('jira_issue_key','MOB-7741'),NULL),
  ('task','50000000-0000-4000-8000-000000000003','jira_linked','30000000-0000-4000-8000-000000000004',
   'Илья Громов',jsonb_build_object('jira_issue_key','PAY-3322'),NULL),
  ('task','50000000-0000-4000-8000-000000000004','jira_linked','30000000-0000-4000-8000-000000000001',
   'Анна Котова',jsonb_build_object('jira_issue_key','MOB-7689'),NULL),
  ('task','50000000-0000-4000-8000-000000000005','jira_linked','30000000-0000-4000-8000-000000000001',
   'Анна Котова',jsonb_build_object('jira_issue_key','MOB-7691'),NULL),
  ('task','50000000-0000-4000-8000-000000000006','jira_linked','30000000-0000-4000-8000-000000000002',
   'Дмитрий Орлов',jsonb_build_object('jira_issue_key','DOC-1129'),NULL),
  ('task','50000000-0000-4000-8000-000000000007','jira_linked','30000000-0000-4000-8000-000000000005',
   'Ольга Петрова',jsonb_build_object('jira_issue_key','AUTH-441'),NULL),
  ('task','50000000-0000-4000-8000-000000000008','jira_linked','30000000-0000-4000-8000-000000000008',
   'Елена Соколова',jsonb_build_object('jira_issue_key','MOB-7510'),NULL),
  ('task','50000000-0000-4000-8000-000000000009','jira_linked','30000000-0000-4000-8000-000000000002',
   'Дмитрий Орлов',jsonb_build_object('jira_issue_key','WEB-2204'),NULL),
  ('task','50000000-0000-4000-8000-000000000010','jira_linked','30000000-0000-4000-8000-000000000006',
   'Сергей Белов',jsonb_build_object('jira_issue_key','AN-118'),NULL),
  ('task','50000000-0000-4000-8000-000000000011','jira_linked','30000000-0000-4000-8000-000000000007',
   'Никита Волков',jsonb_build_object('jira_issue_key','DOC-1078'),NULL),
  ('support_ticket',
   (SELECT id FROM support_tickets WHERE problem_id='40000000-0000-4000-8000-000000000001' AND task_id IS NOT NULL LIMIT 1),
   'linked','30000000-0000-4000-8000-000000000001','Анна Котова',
   jsonb_build_object('problem_id','40000000-0000-4000-8000-000000000001'),NULL);

INSERT INTO comments (entity_type,entity_id,author_id,body,is_internal) VALUES
  ('problem','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Поток обращений по 3DS растёт, уже 1248 за неделю. Эскалируем в Payments.',TRUE),
  ('problem','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','FCM token rotation на Android 14 — подтверждаем на 4 устройствах из 5.',TRUE),
  ('problem','40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','PDF-генератор падает на файлах > 4 МБ из-за OOM. Hotfix готовится.',TRUE),
  ('problem','40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001','Force logout через support tools помогает. Фикс в Q2.',TRUE),
  ('problem','40000000-0000-4000-8000-000000000009','30000000-0000-4000-8000-000000000001','198 неразобранных тикетов по Invalid VIN. Похоже на новую проблему валидатора.',TRUE);

INSERT INTO ai_suggestions (ticket_id,suggestion_type,suggested_entity_type,suggested_entity_id,confidence,reasoning)
SELECT st.id,'problem_match','problem',st.problem_id,
  0.70+(extract(second FROM st.created_at)/250.0),
  'Совпадение по продукту, платформе и ключевым словам'
FROM support_tickets st
WHERE st.requires_research=TRUE AND st.problem_id IS NOT NULL LIMIT 30;

INSERT INTO notifications (user_id,type,title,body,entity_type,entity_id,send_email)
VALUES
  ('30000000-0000-4000-8000-000000000004','problem_alert',
   'Проблема: PRB-218','Оплата полиса ОСАГО зависает на шаге 3DS',
   'problem','40000000-0000-4000-8000-000000000001',FALSE),
  ('30000000-0000-4000-8000-000000000001','problem_alert',
   'Проблема: PRB-204','Не приходят push-уведомления о статусе обращения (Android 14',
   'problem','40000000-0000-4000-8000-000000000002',FALSE),
  ('30000000-0000-4000-8000-000000000002','problem_alert',
   'Проблема: PRB-197','Документы КАСКО не открываются в личном кабинете',
   'problem','40000000-0000-4000-8000-000000000003',FALSE),
  ('30000000-0000-4000-8000-000000000005','problem_alert',
   'Проблема: PRB-186','Ошибка авторизации по СМС после смены номера',
   'problem','40000000-0000-4000-8000-000000000004',FALSE),
  ('30000000-0000-4000-8000-000000000002','problem_alert',
   'Проблема: PRB-165','Backend API возвращает 504 на /policies/list при > 100 полис',
   'problem','40000000-0000-4000-8000-000000000007',FALSE),
  ('30000000-0000-4000-8000-000000000004','draft_proposal_received',
   'Новый черновик задачи','Оператор предложил задачу по PRB-218',
   'problem','40000000-0000-4000-8000-000000000001',FALSE);

INSERT INTO priority_recalculation_log (entity_type,entity_id,old_priority,new_priority,reason)
VALUES
  ('problem','40000000-0000-4000-8000-000000000001','high','critical','WoW ticket delta exceeded threshold'),
  ('problem','40000000-0000-4000-8000-000000000002','medium','high','WoW ticket delta exceeded threshold'),
  ('problem','40000000-0000-4000-8000-000000000003','medium','high','WoW ticket delta exceeded threshold'),
  ('problem','40000000-0000-4000-8000-000000000004','medium','high','WoW ticket delta exceeded threshold');

UPDATE id_sequences SET last_value = (
  SELECT COALESCE(MAX(CAST(regexp_replace(short_id,'^PROB-','') AS BIGINT)),0)
  FROM problems WHERE short_id ~ '^PROB-[0-9]+$'
) WHERE entity_type = 'problem';

UPDATE id_sequences SET last_value = (
  SELECT COALESCE(MAX(CAST(regexp_replace(short_id,'^[A-Z]+-','') AS BIGINT)),0)
  FROM tasks WHERE short_id ~ '^[A-Z]+-[0-9]+$'
) WHERE entity_type = 'task';

UPDATE id_sequences SET last_value = (
  SELECT COALESCE(MAX(CAST(regexp_replace(short_id,'^TKT-','') AS BIGINT)),0)
  FROM support_tickets WHERE short_id ~ '^TKT-[0-9]+$'
) WHERE entity_type = 'ticket';

REFRESH MATERIALIZED VIEW mv_problem_stats;

DO $$
DECLARE ct INT; cu INT; cp INT; ctk INT; cts INT; cq INT; cws INT;
BEGIN
  SELECT COUNT(*) INTO ct  FROM teams;
  SELECT COUNT(*) INTO cu  FROM users;
  SELECT COUNT(*) INTO cp  FROM problems;
  SELECT COUNT(*) INTO ctk FROM tasks;
  SELECT COUNT(*) INTO cts FROM support_tickets;
  SELECT COUNT(*) INTO cq  FROM queue_items;
  SELECT COUNT(*) INTO cws FROM weekly_snapshots;
  RAISE NOTICE 'Seed OK — teams:% users:% problems:% tasks:% tickets:% queue_items:% snapshots:%',
    ct,cu,cp,ctk,cts,cq,cws;
END;
$$;
