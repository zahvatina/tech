from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

TICKET_STATUS_VALUES = (
    "new", "in_queue", "processing", "linked", "researching",
    "recommendation_sent", "awaiting_response", "resolved", "duplicate", "closed",
)
TicketStatus = Literal[
    "new", "in_queue", "processing", "linked", "researching",
    "recommendation_sent", "awaiting_response", "resolved", "duplicate", "closed",
]

TICKET_PLATFORM_VALUES = ("mobile_app", "personal_account", "web", "backend_api")
TicketPlatform = Literal["mobile_app", "personal_account", "web", "backend_api"]

TICKET_CHANNEL_VALUES = ("chat", "phone", "email", "social", "in-app")
TicketChannel = Literal["chat", "phone", "email", "social", "in-app"]

BulkAction = Literal[
    "link_to_problem", "link_to_task", "change_status",
    "assign", "mark_research", "mark_duplicate",
]


class TicketCreate(BaseModel):
    user_id: str = Field(..., min_length=1)
    raw_text: str = Field(..., min_length=1)
    product_id: str | None = None
    platform: TicketPlatform | None = None
    summary: str | None = None
    ticket_date: str | None = None
    channel: TicketChannel | None = None
    region: str | None = None
    problem_id: str | None = None
    task_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    customer_name: str | None = None
    customer_email: str | None = None


class TicketUpdate(BaseModel):
    status: TicketStatus | None = None
    problem_id: str | None = None
    task_id: str | None = None
    recommendation_text: str | None = None
    recommendation_sent: bool | None = None
    requires_research: bool | None = None
    is_duplicate: bool | None = None
    duplicate_of: str | None = None
    current_queue: str | None = None
    assigned_to: str | None = None
    summary: str | None = None


class TicketBulk(BaseModel):
    ids: list[str] = Field(..., min_length=1)
    action: BulkAction
    problem_id: str | None = None
    task_id: str | None = None
    status: TicketStatus | None = None
    assigned_to: str | None = None
    duplicate_of: str | None = None
