import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.agents.runner import run_sql_agent
from app.db.postgres import DataBasePool
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationSummary,
    MessageItem,
)

router = APIRouter(prefix="/chat", tags=["chat"])
_messages_payload_json_supported: bool | None = None
logger = logging.getLogger(__name__)


def _title_from_message(message: str) -> str:
    cleaned = " ".join(message.strip().split())
    if len(cleaned) <= 60:
        return cleaned
    return f"{cleaned[:57]}..."


def _coerce_payload_json(value: Any) -> dict[str, Any] | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return value

    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8", errors="ignore")

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            logger.warning("Invalid payload_json string in message row: %s", text[:120])
            return None

        # Handle legacy double-encoded JSON strings.
        if isinstance(parsed, str):
            try:
                parsed = json.loads(parsed)
            except json.JSONDecodeError:
                return None

        return parsed if isinstance(parsed, dict) else None

    return None


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    search: str | None = Query(default=None, min_length=1),
) -> list[ConversationSummary]:
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        if search:
            rows = await connection.fetch(
                """
                SELECT DISTINCT c.conversation_id, c.title, c.updated_at
                FROM conversations c
                JOIN messages m
                  ON m.conversation_id = c.conversation_id
                WHERE m.content ILIKE $1
                ORDER BY c.updated_at DESC
                LIMIT 50
                """,
                f"%{search}%",
            )
        else:
            rows = await connection.fetch(
                """
                SELECT conversation_id, title, updated_at
                FROM conversations
                ORDER BY updated_at DESC
                LIMIT 50
                """
            )
    return [ConversationSummary(**dict(row)) for row in rows]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageItem])
async def list_messages(conversation_id: int) -> list[MessageItem]:
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        global _messages_payload_json_supported
        if _messages_payload_json_supported is None:
            exists = await connection.fetchval(
                """
                SELECT EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_schema = current_schema()
                    AND table_name = 'messages'
                    AND column_name = 'payload_json'
                )
                """
            )
            _messages_payload_json_supported = bool(exists)

        if _messages_payload_json_supported:
            rows = await connection.fetch(
                """
                SELECT message_id, role, content, payload_json, created_at
                FROM messages
                WHERE conversation_id = $1
                ORDER BY created_at ASC, message_id ASC
                """,
                conversation_id,
            )
        else:
            rows = await connection.fetch(
                """
                SELECT message_id, role, content, NULL::jsonb AS payload_json, created_at
                FROM messages
                WHERE conversation_id = $1
                ORDER BY created_at ASC, message_id ASC
                """,
                conversation_id,
            )
    items: list[MessageItem] = []
    for row in rows:
        item = dict(row)
        item["payload_json"] = _coerce_payload_json(item.get("payload_json"))
        items.append(MessageItem(**item))
    return items


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        if payload.conversation_id is None:
            row = await connection.fetchrow(
                "INSERT INTO conversations (title) VALUES (NULL) RETURNING conversation_id"
            )
            if row is None:
                raise HTTPException(status_code=500, detail="Failed to create conversation")
            conversation_id = row["conversation_id"]
        else:
            conversation_id = payload.conversation_id

        await connection.execute(
            """
            INSERT INTO messages (conversation_id, role, content)
            VALUES ($1, 'USER', $2)
            """,
            conversation_id,
            payload.message,
        )

        title = _title_from_message(payload.message)
        await connection.execute(
            """
            UPDATE conversations
            SET title = COALESCE(title, $2), updated_at = now()
            WHERE conversation_id = $1
            """,
            conversation_id,
            title,
        )

        response = run_sql_agent(payload.message)

        await connection.execute(
            """
            INSERT INTO messages (conversation_id, role, content)
            VALUES ($1, 'SYSTEM', $2)
            """,
            conversation_id,
            response,
        )

    return ChatResponse(response=response, conversation_id=conversation_id)
