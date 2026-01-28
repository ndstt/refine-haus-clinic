"""
Embedding Service for Refine Haus Clinic AI Chatbot
Handles vector embeddings for RAG (Retrieval-Augmented Generation)
"""

from langchain_openai import OpenAIEmbeddings
from config import OPENAI_API_KEY
from typing import List, Dict, Any
import asyncpg
from app.db.postgres import DataBasePool


class EmbeddingService:
    """
    Service for generating and storing vector embeddings.
    Uses OpenAI's text-embedding-ada-002 (1536 dimensions).
    """

    def __init__(self):
        """Initialize embedding service."""
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment variables")

        # Initialize OpenAI embeddings
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-ada-002",
            openai_api_key=OPENAI_API_KEY
        )

    async def embed_text(self, text: str) -> List[float]:
        """
        Generate embedding vector for a single text.

        Args:
            text: Text to embed

        Returns:
            List of floats representing the embedding vector (1536 dimensions)
        """
        embedding = await self.embeddings.aembed_query(text)
        return embedding

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts (batch processing).

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        embeddings = await self.embeddings.aembed_documents(texts)
        return embeddings

    async def store_embedding(
        self,
        pool: asyncpg.Pool,
        content: str,
        metadata: Dict[str, Any] = None
    ) -> int:
        """
        Store a text embedding in the database.

        Args:
            pool: Database connection pool
            content: The text content to embed and store
            metadata: Optional metadata (e.g., {"type": "promotion", "date": "2025-01"})

        Returns:
            ID of the inserted embedding
        """
        # Generate embedding
        embedding = await self.embed_text(content)

        # Convert to pgvector format (list to string)
        embedding_str = "[" + ",".join(map(str, embedding)) + "]"

        # Store in database
        async with pool.acquire() as conn:
            result = await conn.fetchrow(
                """
                INSERT INTO chat_embeddings (content, embedding, metadata)
                VALUES ($1, $2::vector, $3)
                RETURNING id
                """,
                content,
                embedding_str,
                metadata or {}
            )
            return result["id"]

    async def search_similar(
        self,
        pool: asyncpg.Pool,
        query: str,
        match_threshold: float = 0.7,
        match_count: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for similar embeddings using cosine similarity.

        Args:
            pool: Database connection pool
            query: Search query text
            match_threshold: Minimum similarity score (0.0-1.0)
            match_count: Maximum number of results to return

        Returns:
            List of matching results with content, metadata, and similarity score
        """
        # Generate query embedding
        query_embedding = await self.embed_text(query)
        embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"

        # Search in database using cosine similarity
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    id,
                    content,
                    metadata,
                    1 - (embedding <=> $1::vector) as similarity
                FROM chat_embeddings
                WHERE 1 - (embedding <=> $1::vector) > $2
                ORDER BY embedding <=> $1::vector
                LIMIT $3
                """,
                embedding_str,
                match_threshold,
                match_count
            )

            results = []
            for row in rows:
                results.append({
                    "id": row["id"],
                    "content": row["content"],
                    "metadata": row["metadata"],
                    "similarity": float(row["similarity"])
                })

            return results

    async def batch_store_embeddings(
        self,
        pool: asyncpg.Pool,
        documents: List[Dict[str, Any]]
    ) -> List[int]:
        """
        Store multiple embeddings in batch.

        Args:
            pool: Database connection pool
            documents: List of dicts with "content" and optional "metadata" keys

        Returns:
            List of inserted IDs
        """
        # Generate embeddings for all documents
        contents = [doc["content"] for doc in documents]
        embeddings = await self.embed_documents(contents)

        ids = []
        async with pool.acquire() as conn:
            for i, doc in enumerate(documents):
                embedding_str = "[" + ",".join(map(str, embeddings[i])) + "]"
                result = await conn.fetchrow(
                    """
                    INSERT INTO chat_embeddings (content, embedding, metadata)
                    VALUES ($1, $2::vector, $3)
                    RETURNING id
                    """,
                    doc["content"],
                    embedding_str,
                    doc.get("metadata", {})
                )
                ids.append(result["id"])

        return ids


# Singleton instance
_embedding_service_instance = None


def get_embedding_service() -> EmbeddingService:
    """Get or create singleton embedding service instance."""
    global _embedding_service_instance
    if _embedding_service_instance is None:
        _embedding_service_instance = EmbeddingService()
    return _embedding_service_instance
