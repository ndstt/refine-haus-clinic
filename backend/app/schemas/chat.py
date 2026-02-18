from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    visualize: bool = False


class ChartDataset(BaseModel):
    label: str
    data: list[Any]


class ChartPayload(BaseModel):
    chart_type: str
    labels: list[str] = Field(default_factory=list)
    datasets: list[ChartDataset] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str
    conversation_id: int
    sql_query: Optional[str] = None
    chart: Optional[ChartPayload] = None
    records: list[dict[str, Any]] = Field(default_factory=list)


class SqlChatResponse(BaseModel):
    response: str
    conversation_id: int
    sql_query: Optional[str] = None


class ConversationSummary(BaseModel):
    conversation_id: int
    title: Optional[str] = None
    updated_at: datetime


class MessageItem(BaseModel):
    message_id: int
    role: str
    content: str
    payload_json: Optional[dict[str, Any]] = None
    created_at: datetime
