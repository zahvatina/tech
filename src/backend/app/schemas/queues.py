from __future__ import annotations

from pydantic import BaseModel, Field


class QueueTake(BaseModel):
    assigned_to: str = Field(..., description="User UUID or short id")


class QueueResolve(BaseModel):
    resolution_note: str = Field(..., min_length=1)
