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
  },

  tasks: {
    async list(problemId, params = {}) {
      const q = { problem_id: problemId, limit: 100, ...params };
      const res = await apiFetch(`/api/v1/tasks${buildQS(q)}`);
      return (res.data || []).map(normTask);
    },
  },
};

Object.assign(window, { API });
