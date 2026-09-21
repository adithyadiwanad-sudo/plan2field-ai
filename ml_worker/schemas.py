from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
class Event(BaseModel):
    model_config = ConfigDict(extra='forbid')
    event_type: Literal['START','FINISH','PROGRESS','BLOCKER','PLAN','CORRECTION','UNKNOWN']
    event_date: date | None = None
    date_basis: str = 'EXPLICIT'
    action: str | None = None
    line_number: str | None = None
    asset_tag: str | None = None
    area: str | None = None
    discipline: str | None = None
    physical_percent: float | None = Field(default=None, ge=0, le=100)
    quantity: float | None = Field(default=None, ge=0)
    unit: str | None = None
    quantity_mode: Literal['INCREMENTAL','CUMULATIVE','COMPONENT_SET'] | None = None
    component_ids: list[str] = Field(default_factory=list)
    negated: bool = False
    future_intent: bool = False
    evidence: dict = Field(default_factory=dict)
    missing_fields: list[str] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    correction_of_event_id: str | None = None
