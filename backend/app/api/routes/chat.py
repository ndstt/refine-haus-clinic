"""
Chat API Routes for Refine Haus Clinic AI Chatbot
Handles conversation management and message exchange
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List

from app.agents.runner import get_agent_runner, AgentRunner
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    Conversation,
    ConversationListResponse,
    Message
)
from app.db.postgres import DataBasePool

router = APIRouter(prefix="/chat", tags=["chat"])


async def get_db_pool():
    """Dependency to get database pool."""
    return DataBasePool.get_pool()


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    runner: AgentRunner = Depends(get_agent_runner)
) -> ChatResponse:
    """
    Send a message to the AI chatbot and get a response.

    Args:
        payload: Chat request with message and optional conversation_id
        runner: Agent runner instance

    Returns:
        AI response with conversation_id
    """
    try:
        # Create new conversation if not provided
        conversation_id = payload.conversation_id
        if not conversation_id:
            conversation_id = await runner.create_conversation(
                title="New Conversation"
            )

        # Get conversation history
        history = await runner.get_conversation_history(conversation_id)

        # Generate response
        response = await runner.run(
            message=payload.message,
            conversation_id=conversation_id,
            history=history
        )

        return ChatResponse(
            response=response,
            conversation_id=conversation_id
        )

    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    pool=Depends(get_db_pool)
) -> ConversationListResponse:
    """
    Get list of all conversations.

    Returns:
        List of conversations with metadata
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT conversation_id, title, created_at, updated_at
                FROM conversations
                ORDER BY updated_at DESC
                LIMIT 50
                """
            )

            conversations = [
                Conversation(
                    conversation_id=row["conversation_id"],
                    title=row["title"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"]
                )
                for row in rows
            ]

            return ConversationListResponse(conversations=conversations)

    except Exception as e:
        print(f"Error fetching conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(
    conversation_id: int,
    pool=Depends(get_db_pool)
) -> Conversation:
    """
    Get a specific conversation with its messages.

    Args:
        conversation_id: Conversation ID

    Returns:
        Conversation with messages
    """
    try:
        async with pool.acquire() as conn:
            # Get conversation metadata
            conv_row = await conn.fetchrow(
                """
                SELECT conversation_id, title, created_at, updated_at
                FROM conversations
                WHERE conversation_id = $1
                """,
                conversation_id
            )

            if not conv_row:
                raise HTTPException(status_code=404, detail="Conversation not found")

            # Get messages
            message_rows = await conn.fetch(
                """
                SELECT role, content, created_at
                FROM messages
                WHERE conversation_id = $1
                ORDER BY created_at ASC
                """,
                conversation_id
            )

            messages = [
                Message(
                    role="user" if row["role"] == "USER" else "assistant",
                    content=row["content"],
                    created_at=row["created_at"]
                )
                for row in message_rows
            ]

            return Conversation(
                conversation_id=conv_row["conversation_id"],
                title=conv_row["title"],
                created_at=conv_row["created_at"],
                updated_at=conv_row["updated_at"],
                messages=messages
            )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    pool=Depends(get_db_pool)
):
    """
    Delete a conversation and all its messages.

    Args:
        conversation_id: Conversation ID
    """
    try:
        async with pool.acquire() as conn:
            result = await conn.execute(
                """
                DELETE FROM conversations
                WHERE conversation_id = $1
                """,
                conversation_id
            )

            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Conversation not found")

            return {"message": "Conversation deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
