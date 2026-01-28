from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: int


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    created_at: datetime


class Conversation(BaseModel):
    conversation_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: Optional[List[Message]] = None


class ConversationListResponse(BaseModel):
    conversations: List[Conversation]
