from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: int


class ConversationSummary(BaseModel):
    conversation_id: int
    title: Optional[str] = None
    updated_at: datetime


class MessageItem(BaseModel):
    message_id: int
    role: str
    content: str
    created_at: datetime
