import logging
import json
from typing import Any

from fastapi import APIRouter, HTTPException

from app.agents.sql_agent import get_sql_agent_executor
from app.db.postgres import DataBasePool
from app.schemas.chat import ChatRequest, SqlChatResponse

# AI-related endpoints will live under /api/v1/ai/*
router = APIRouter(prefix="/ai", tags=["ai"])

logger = logging.getLogger(__name__)
_messages_payload_json_supported: bool | None = None


def _title_from_message(message: str) -> str:
    cleaned = " ".join(message.strip().split())
    if len(cleaned) <= 60:
        return cleaned
    return f"{cleaned[:57]}..."


def _extract_sql_query(intermediate_steps) -> str | None:
    for step in intermediate_steps or []:
        if len(step) < 2:
            continue
        action = step[0]
        tool_input = getattr(action, "tool_input", None)
        if isinstance(tool_input, dict) and "query" in tool_input:
            return tool_input["query"]
        if isinstance(tool_input, str) and "SELECT" in tool_input.upper():
            return tool_input
    return None


async def _messages_support_payload_json(connection) -> bool:
    global _messages_payload_json_supported
    if _messages_payload_json_supported is not None:
        return _messages_payload_json_supported

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
    return _messages_payload_json_supported


async def _insert_message(
    connection,
    conversation_id: int,
    role: str,
    content: str,
    payload_json: dict[str, Any] | None = None,
) -> None:
    supports_payload_json = await _messages_support_payload_json(connection)
    if supports_payload_json:
        payload_value = json.dumps(payload_json) if payload_json is not None else None
        await connection.execute(
            """
            INSERT INTO messages (conversation_id, role, content, payload_json)
            VALUES ($1, $2::chat_role, $3, $4::jsonb)
            """,
            conversation_id,
            role,
            content,
            payload_value,
        )
        return

    await connection.execute(
        """
        INSERT INTO messages (conversation_id, role, content)
        VALUES ($1, $2::chat_role, $3)
        """,
        conversation_id,
        role,
        content,
    )
    if payload_json is not None:
        logger.warning(
            "payload_json was provided but messages.payload_json column is missing. "
            "Run schema migration before storing payload data."
        )


@router.post("/chat", response_model=SqlChatResponse)
async def sql_chat(payload: ChatRequest) -> SqlChatResponse:
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

        await _insert_message(
            connection=connection,
            conversation_id=conversation_id,
            role="USER",
            content=payload.message,
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

    try:
        sql_agent = get_sql_agent_executor()
        result = sql_agent.invoke({"input": payload.message})
        response = result.get("output", "ขออภัย ไม่สามารถตอบคำถามได้")
        sql_query = _extract_sql_query(result.get("intermediate_steps"))
    except Exception as exc:
        logger.error("SQL Agent error: %s", exc)
        response = "เกิดข้อผิดพลาดในการประมวลผล"
        sql_query = None

    async with pool.acquire() as connection:
        await _insert_message(
            connection=connection,
            conversation_id=conversation_id,
            role="SYSTEM",
            content=response,
            payload_json={"sql_query": sql_query} if sql_query else None,
        )

    return SqlChatResponse(
        response=response,
        conversation_id=conversation_id,
        sql_query=sql_query,
    )
