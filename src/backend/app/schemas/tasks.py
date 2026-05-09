from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

TASK_STATUS_VALUES = (
    "draft", "pending_confirmation", "rejected_draft",
    "open", "in_progress", "in_review",
    "fixed", "wont_fix", "duplicate", "closed",
)
TaskStatus = Literal[
    "draft", "pending_confirmation", "rejected_draft",
    "open", "in_progress", "in_review",
    "fixed", "wont_fix", "duplicate", "closed",
]


class TaskCreate(BaseModel):
    problem_id: str
    title: str = Field(..., min_length=1, max_length=500)
    task_type: Literal["bug", "ui_debt", "backlog", "cjm_debt"] = "bug"
    description: str | None = None
    priority: Literal["critical", "high", "medium", "low"] = "medium"
    severity: str | None = None
    team_id: str | None = None
    assignee_id: str | None = None
    workaround: str | None = None
    has_workaround: bool = False
    support_notes: str | None = None
    tags: list[str] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    priority: Literal["critical", "high", "medium", "low"] | None = None
    severity: str | None = None
    status: TaskStatus | None = None
    team_id: str | None = None
    assignee_id: str | None = None
    workaround: str | None = None
    has_workaround: bool | None = None
    support_notes: str | None = None
    root_cause: str | None = None
    jira_issue_key: str | None = None
    fix_date: str | None = None
    fix_version: str | None = None
    fix_description: str | None = None
    tags: list[str] | None = None


class TaskSubmitForReview(BaseModel):
    proposed_by: str


class TaskConfirm(BaseModel):
    reviewed_by: str
    review_comment: str | None = None


class TaskReject(BaseModel):
    reviewed_by: str
    review_comment: str = Field(..., min_length=1)
