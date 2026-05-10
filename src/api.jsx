/* VECTOR — API client for FastAPI backend.
   Falls back to mock data gracefully when the backend is unreachable. */

const API_BASE = window.VECTOR_API_BASE || "http://localhost:8000";
const API_KEY  = window.VECTOR_API_KEY  || "dev-key";

const UI_STATUS_TO_DB = {
  "triage":        "new",
  "in-progress":   "in_progress",
  "investigating": "waiting_fix",
  "watching":      "monitoring",
  "resolved":      "resolved",
};

const UI_PRIO_TO_DB = {
  "P0": "critical",
  "P1": "high",
  "P2": "medium",
  "P3": "low",
};

const PRODUCT_TO_CODE = {
  "ОСАГО": "osago",
  "КАСКО": "kasko",
  "НС":    "ns",
  "ДМС":   "dms",
};

const SORT_TO_API = {
  "tickets-delta": "tickets_delta_pct",
  "tickets":       "tickets",
  "untriaged":     "unresearched",
  "priority":      "priority",
  "updated":       "updated",
};

async function apiFetch(path, opts = {}) {
  const resp = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...(opts.headers || {}),
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${path}`);
  return resp.json();
}

async function apiFetchForm(path, formData) {
  const resp = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "X-API-Key": API_KEY },
    body: formData,
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${path}`);
  return resp.json();
}

function buildQS(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) v.forEach(x => p.append(k, x));
    else p.append(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/* Strip UUID owner so Avatar/userById stays safe; expose display name separately */
function normProblem(p) {
  return { ...p, owner: null };
}

/* Map task ui_status → status field the UI uses */
function normTask(t) {
  return { ...t, status: t.ui_status || t.status };
}

const API = {
  queues: {
    async list() {
      const res = await apiFetch("/api/v1/queues");
      return res.data || [];
    },
    async items(code, params = {}) {
      const res = await apiFetch(`/api/v1/queues/${encodeURIComponent(code)}/items${buildQS(params)}`);
      return res.data || [];
    },
    async take(code, itemId, assignedTo) {
      return apiFetch(
        `/api/v1/queues/${encodeURIComponent(code)}/items/${encodeURIComponent(itemId)}/take`,
        { method: "POST", body: JSON.stringify({ assigned_to: assignedTo }) },
      );
    },
    async resolve(code, itemId, resolutionNote) {
      return apiFetch(
        `/api/v1/queues/${encodeURIComponent(code)}/items/${encodeURIComponent(itemId)}/resolve`,
        { method: "POST", body: JSON.stringify({ resolution_note: resolutionNote }) },
      );
    },
    async skip(code, itemId) {
      return apiFetch(
        `/api/v1/queues/${encodeURIComponent(code)}/items/${encodeURIComponent(itemId)}/skip`,
        { method: "POST", body: JSON.stringify({}) },
      );
    },
  },

  tickets: {
    async list(params = {}) {
      const res = await apiFetch(`/api/v1/tickets${buildQS({ limit: 100, ...params })}`);
      return { data: res.data || [], meta: res.meta || {} };
    },
    async get(id) {
      const res = await apiFetch(`/api/v1/tickets/${encodeURIComponent(id)}`);
      return res.data || res;
    },
    async create(body) {
      return apiFetch("/api/v1/tickets", { method: "POST", body: JSON.stringify(body) });
    },
    async patch(id, body) {
      return apiFetch(`/api/v1/tickets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    async bulk(body) {
      return apiFetch("/api/v1/tickets/bulk", { method: "POST", body: JSON.stringify(body) });
    },
    async uploadAttachment(id, file, opts = {}) {
      const fd = new FormData();
      fd.append("file", file);
      if (opts.is_log != null)        fd.append("is_log", String(opts.is_log));
      if (opts.is_screenshot != null) fd.append("is_screenshot", String(opts.is_screenshot));
      if (opts.uploaded_by)           fd.append("uploaded_by", opts.uploaded_by);
      return apiFetchForm(`/api/v1/tickets/${encodeURIComponent(id)}/attachments`, fd);
    },
  },

  problems: {
    async list(filters = {}) {
      const q = {};
      if (filters.status && filters.status !== "all" && filters.status !== "blocked") {
        const db = UI_STATUS_TO_DB[filters.status];
        if (db) q.status = db;
      }
      if (filters.priority && filters.priority !== "all") {
        const db = UI_PRIO_TO_DB[filters.priority];
        if (db) q.priority = db;
      }
      if (filters.search)  q.search       = filters.search;
      if (filters.product && filters.product !== "all") {
        const code = PRODUCT_TO_CODE[filters.product];
        if (code) q.product_code = code;
      }
      if (filters.view && filters.view !== "all") q.view = filters.view;
      q.sort_by = SORT_TO_API[filters.sort] || "tickets_delta_pct";
      q.limit   = filters.limit  || 100;
      if (filters.page) q.page = filters.page;

      const res = await apiFetch(`/api/v1/problems${buildQS(q)}`);
      return { data: (res.data || []).map(normProblem), meta: res.meta || {} };
    },

    async get(id) {
      const res = await apiFetch(`/api/v1/problems/${encodeURIComponent(id)}`);
      return normProblem(res.data || res);
    },

    async create(body) {
      return apiFetch("/api/v1/problems", { method: "POST", body: JSON.stringify(body) });
    },

    async patch(id, body) {
      return apiFetch(`/api/v1/problems/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
    },

    async tickets(id, params = {}) {
      const res = await apiFetch(`/api/v1/problems/${encodeURIComponent(id)}/tickets${buildQS({ limit: 100, ...params })}`);
      return { data: res.data || [], meta: res.meta || {} };
    },

    async activity(id, params = {}) {
      const res = await apiFetch(`/api/v1/problems/${encodeURIComponent(id)}/activity${buildQS({ limit: 50, ...params })}`);
      return { data: res.data || [], meta: res.meta || {} };
    },

    async comments(id) {
      const res = await apiFetch(`/api/v1/problems/${encodeURIComponent(id)}/comments`);
      return res.data || [];
    },

    async postComment(id, body) {
      return apiFetch(
        `/api/v1/problems/${encodeURIComponent(id)}/comments`,
        { method: "POST", body: JSON.stringify(body) },
      );
    },

    async bulk(body) {
      return apiFetch("/api/v1/problems/bulk", { method: "POST", body: JSON.stringify(body) });
    },
  },

  tasks: {
    async list(problemId, params = {}) {
      const q = { problem_id: problemId, limit: 100, ...params };
      const res = await apiFetch(`/api/v1/tasks${buildQS(q)}`);
      return (res.data || []).map(normTask);
    },
    async listAll(params = {}) {
      const res = await apiFetch(`/api/v1/tasks${buildQS({ limit: 100, ...params })}`);
      return (res.data || []).map(normTask);
    },
    async get(id) {
      const res = await apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}`);
      return normTask(res.data || res);
    },
    async create(body) {
      return apiFetch("/api/v1/tasks", { method: "POST", body: JSON.stringify(body) });
    },
    async patch(id, body) {
      return apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    async linkTicket(taskId, ticketId) {
      return apiFetch(
        `/api/v1/tasks/${encodeURIComponent(taskId)}/tickets`,
        { method: "POST", body: JSON.stringify({ ticket_id: ticketId }) },
      );
    },
    async unlinkTicket(taskId, ticketId) {
      const resp = await fetch(`${API_BASE}/api/v1/tasks/${encodeURIComponent(taskId)}/tickets/${encodeURIComponent(ticketId)}`, {
        method: "DELETE",
        headers: { "X-API-Key": API_KEY },
      });
      if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`);
      return null;
    },
    async bulk(body) {
      return apiFetch("/api/v1/tasks/bulk", { method: "POST", body: JSON.stringify(body) });
    },
    async submitForReview(id, body) {
      return apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}/submit-for-review`, { method: "POST", body: JSON.stringify(body) });
    },
    async confirm(id, body) {
      return apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}/confirm`, { method: "POST", body: JSON.stringify(body) });
    },
    async reject(id, body) {
      return apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}/reject`, { method: "POST", body: JSON.stringify(body) });
    },
    async activity(id, params = {}) {
      const res = await apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}/activity${buildQS({ limit: 50, ...params })}`);
      return { data: res.data || [], meta: res.meta || {} };
    },
    async comments(id) {
      const res = await apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}/comments`);
      return res.data || [];
    },
    async postComment(id, body) {
      return apiFetch(
        `/api/v1/tasks/${encodeURIComponent(id)}/comments`,
        { method: "POST", body: JSON.stringify(body) },
      );
    },
  },

  dashboard: {
    async summary() {
      const res = await apiFetch("/api/v1/dashboard/summary");
      return res.data || {};
    },
    async heatmap() {
      const res = await apiFetch("/api/v1/dashboard/problems-heatmap");
      return res.data || {};
    },
    async teamLoad() {
      const res = await apiFetch("/api/v1/dashboard/team-load");
      return res.data || [];
    },
  },

  analytics: {
    async trends(params = {}) {
      const res = await apiFetch(`/api/v1/analytics/trends${buildQS(params)}`);
      return res.data || {};
    },
    async queueMetrics(params = {}) {
      const res = await apiFetch(`/api/v1/analytics/queue-metrics${buildQS(params)}`);
      return res.data || [];
    },
    async teamPerformance(params = {}) {
      const res = await apiFetch(`/api/v1/analytics/team-performance${buildQS(params)}`);
      return res.data || [];
    },
  },

  search: {
    async query(q, params = {}) {
      const res = await apiFetch(`/api/v1/search${buildQS({ q, limit: 20, ...params })}`);
      return res.data || {};
    },
  },

  meta: {
    async products() {
      const res = await apiFetch("/api/v1/products");
      return res.data || [];
    },
    async teams() {
      const res = await apiFetch("/api/v1/teams");
      return res.data || [];
    },
    async users() {
      const res = await apiFetch("/api/v1/users");
      return res.data || [];
    },
  },

  notifications: {
    async list(params = {}) {
      const res = await apiFetch(`/api/v1/notifications${buildQS(params)}`);
      return { data: res.data || [], meta: res.meta || {} };
    },
    async markAllRead(params = {}) {
      const resp = await fetch(`${API_BASE}/api/v1/notifications/read-all${buildQS(params)}`, {
        method: "PATCH",
        headers: { "X-API-Key": API_KEY },
      });
      if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`);
      return null;
    },
  },
};

Object.assign(window, { API });
