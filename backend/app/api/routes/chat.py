from fastapi import APIRouter, HTTPException, Query

from app.agents.runner import run_agent
from app.db.postgres import DataBasePool
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationSummary,
    MessageItem,
)

router = APIRouter(prefix="/chat", tags=["chat"])


def _title_from_message(message: str) -> str:
    cleaned = " ".join(message.strip().split())
    if len(cleaned) <= 60:
        return cleaned
    return f"{cleaned[:57]}..."


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
        rows = await connection.fetch(
            """
            SELECT message_id, role, content, created_at
            FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC, message_id ASC
            """,
            conversation_id,
        )
    return [MessageItem(**dict(row)) for row in rows]


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

        response = run_agent(payload.message)

        await connection.execute(
            """
            INSERT INTO messages (conversation_id, role, content)
            VALUES ($1, 'SYSTEM', $2)
            """,
            conversation_id,
            response,
        )

    return ChatResponse(response=response, conversation_id=conversation_id)
