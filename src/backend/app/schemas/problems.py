from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ProblemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    priority: Literal["critical", "high", "medium", "low"] = "medium"
    severity: str | None = None
    owner_id: str | None = None
    affected_product_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class ProblemUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    priority: Literal["critical", "high", "medium", "low"] | None = None
    status: Literal["new", "in_progress", "waiting_fix", "resolved", "closed", "monitoring"] | None = None
    severity: str | None = None
    owner_id: str | None = None
    affected_product_ids: list[str] | None = None
    tags: list[str] | None = None
    jira_issue_key: str | None = None


class BulkStatusChange(BaseModel):
    ids: list[str] = Field(..., min_length=1)
    status: Literal["new", "in_progress", "waiting_fix", "resolved", "closed", "monitoring"]


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1)
    author_id: str
    is_internal: bool = True
    parent_id: str | None = None
