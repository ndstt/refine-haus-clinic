"""
Agent Runner for Refine Haus Clinic AI Chatbot
Orchestrates the hybrid retrieval + LLM response generation
"""

from typing import Optional, List, Dict, Any
import asyncpg
from app.services.llm.openai_service import get_openai_service
from app.services.retrieval_service import get_retrieval_service
from app.db.postgres import DataBasePool


class AgentRunner:
    """
    Main orchestrator for the AI chatbot.
    Combines hybrid retrieval (SQL + Vector) with OpenAI LLM.
    """

    def __init__(self, pool: asyncpg.Pool):
        """
        Initialize agent runner.

        Args:
            pool: Database connection pool
        """
        self.pool = pool
        self.llm_service = get_openai_service()
        self.retrieval_service = get_retrieval_service(pool)

    async def run(
        self,
        message: str,
        conversation_id: Optional[int] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Process a user message and generate a response.

        Args:
            message: User's question/message
            conversation_id: Optional conversation ID for persistence
            history: Optional conversation history

        Returns:
            AI's response
        """
        # Step 1: Retrieve relevant context using hybrid strategy
        context = await self.retrieval_service.retrieve(message)

        # Step 2: Generate response using OpenAI with context
        if history:
            response = self.llm_service.invoke_with_history(
                message=message,
                history=history,
                context=context
            )
        else:
            response = self.llm_service.invoke(
                message=message,
                context=context
            )

        # Step 3: Persist conversation to database (if conversation_id provided)
        if conversation_id:
            await self._save_messages(conversation_id, message, response)

        return response

    async def run_streaming(
        self,
        message: str,
        conversation_id: Optional[int] = None
    ):
        """
        Stream response for real-time UX.

        Args:
            message: User's question
            conversation_id: Optional conversation ID

        Yields:
            Chunks of AI response
        """
        # Retrieve context
        context = await self.retrieval_service.retrieve(message)

        # Stream response
        full_response = ""
        async for chunk in self.llm_service.astream(message, context):
            full_response += chunk
            yield chunk

        # Persist after streaming completes
        if conversation_id:
            await self._save_messages(conversation_id, message, full_response)

    async def _save_messages(
        self,
        conversation_id: int,
        user_message: str,
        assistant_message: str
    ):
        """
        Save user and assistant messages to database.

        Args:
            conversation_id: Conversation ID
            user_message: User's message
            assistant_message: AI's response
        """
        async with self.pool.acquire() as conn:
            # Save user message
            await conn.execute(
                """
                INSERT INTO messages (conversation_id, role, content, model)
                VALUES ($1, 'USER', $2, 'user')
                """,
                conversation_id,
                user_message
            )

            # Save assistant message
            await conn.execute(
                """
                INSERT INTO messages (conversation_id, role, content, model)
                VALUES ($1, 'SYSTEM', $2, $3)
                """,
                conversation_id,
                assistant_message,
                "gpt-4o-mini"
            )

    async def get_conversation_history(
        self,
        conversation_id: int,
        limit: int = 20
    ) -> List[Dict[str, str]]:
        """
        Retrieve conversation history from database.

        Args:
            conversation_id: Conversation ID
            limit: Maximum number of messages to retrieve

        Returns:
            List of messages in format [{"role": "user"|"assistant", "content": "..."}]
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT role, content
                FROM messages
                WHERE conversation_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                conversation_id,
                limit
            )

            # Reverse to chronological order
            history = []
            for row in reversed(rows):
                role = "user" if row["role"] == "USER" else "assistant"
                history.append({
                    "role": role,
                    "content": row["content"]
                })

            return history

    async def create_conversation(self, title: str = "New Conversation") -> int:
        """
        Create a new conversation in the database.

        Args:
            title: Conversation title

        Returns:
            Conversation ID
        """
        async with self.pool.acquire() as conn:
            result = await conn.fetchrow(
                """
                INSERT INTO conversations (title)
                VALUES ($1)
                RETURNING conversation_id
                """,
                title
            )
            return result["conversation_id"]


# Singleton instance (will be initialized with pool from main.py)
_agent_runner_instance: Optional[AgentRunner] = None


def initialize_runner(pool: asyncpg.Pool):
    """
    Initialize the agent runner with database pool.

    Args:
        pool: Database connection pool
    """
    global _agent_runner_instance
    _agent_runner_instance = AgentRunner(pool)


def get_agent_runner() -> AgentRunner:
    """
    Get the initialized agent runner instance.

    Returns:
        AgentRunner instance
    """
    if _agent_runner_instance is None:
        raise RuntimeError("AgentRunner not initialized. Call initialize_runner() first.")
    return _agent_runner_instance


# Legacy function for backward compatibility
async def run_agent(message: str) -> str:
    """
    Legacy function for backward compatibility.
    Uses the singleton runner instance.

    Args:
        message: User message

    Returns:
        AI response
    """
    runner = get_agent_runner()
    return await runner.run(message)
