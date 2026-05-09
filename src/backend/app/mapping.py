"""Maps DB enums ↔ UI labels used by VECTOR prototype (P0/P1, PRB-*, statuses)."""

import uuid


def priority_db_to_ui(p: str | None) -> str:
    m = {"critical": "P0", "high": "P1", "medium": "P2", "low": "P3"}
    return m.get((p or "medium").lower(), "P2")


def problem_status_db_to_ui(s: str | None) -> str:
    s = (s or "new").lower()
    return {
        "new": "triage",
        "in_progress": "in-progress",
        "waiting_fix": "investigating",
        "resolved": "resolved",
        "closed": "resolved",
        "monitoring": "watching",
    }.get(s, "in-progress")


def task_status_db_to_ui(s: str | None) -> str:
    s = (s or "draft").lower()
    return {
        "draft": "draft",
        "pending_confirmation": "review",
        "rejected_draft": "blocked",
        "open": "in-progress",
        "in_progress": "in-progress",
        "in_review": "review",
        "fixed": "fixed",
        "wont_fix": "fixed",
        "duplicate": "fixed",
        "closed": "fixed",
    }.get(s, "in-progress")


def ticket_status_db_to_ui(s: str | None) -> str:
    s = (s or "new").lower()
    if s in {"duplicate"}:
        return "duplicate"
    if s in {"researching"}:
        return "researching"
    if s in {"linked", "processing"}:
        return "linked"
    if s in {"resolved", "recommendation_sent", "closed"}:
        return "answered"
    if s in {"new", "in_queue", "awaiting_response"}:
        return "new"
    return "new"


def is_uuid(val: str) -> bool:
    try:
        uuid.UUID(val)
        return True
    except (ValueError, TypeError):
        return False


def platform_db_to_ui(p: str | None) -> str:
    """DB uses mobile_app / personal_account; UI uses mixed labels."""
    if not p:
        return "web"
    m = {
        "mobile_app": "mobile",
        "personal_account": "lk-web",
        "web": "web",
        "backend_api": "backend",
    }
    return m.get(p.lower(), p)
