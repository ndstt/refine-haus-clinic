"""
Hybrid Retrieval Service for Refine Haus Clinic AI Chatbot
Intelligently routes queries to SQL (structured) or Vector (semantic) retrieval
"""

from typing import Dict, Any, List
import asyncpg
import re
from app.services.embedding_service import get_embedding_service
from app.agents.tools.database_tools import (
    FinancialAnalysisTool,
    InventoryAnalysisTool,
    ServiceAnalysisTool
)


class HybridRetrievalService:
    """
    Smart retrieval service that determines whether to use:
    1. SQL queries for structured/numerical data (revenue, stock counts, etc.)
    2. Vector search for semantic/recommendation queries
    """

    def __init__(self, pool: asyncpg.Pool):
        """
        Initialize hybrid retrieval service.

        Args:
            pool: AsyncPG database connection pool
        """
        self.pool = pool
        self.embedding_service = get_embedding_service()

        # Initialize database tools
        self.financial_tool = FinancialAnalysisTool(pool=pool)
        self.inventory_tool = InventoryAnalysisTool(pool=pool)
        self.service_tool = ServiceAnalysisTool(pool=pool)

        # Keywords that trigger SQL queries
        self.sql_keywords = {
            "financial": ["revenue", "income", "profit", "loss", "expense", "sales", "total", "how much", "cost"],
            "inventory": ["stock", "inventory", "item", "product", "quantity", "restock", "low stock", "dead stock"],
            "service": ["service", "treatment", "price", "popular", "booking", "appointment"]
        }

    async def retrieve(self, query: str) -> Dict[str, Any]:
        """
        Main retrieval method that intelligently routes queries.

        Args:
            query: User's question

        Returns:
            Dictionary containing retrieved data and metadata
        """
        query_lower = query.lower()

        # Determine query type
        query_type = self._classify_query(query_lower)

        context = {
            "query": query,
            "query_type": query_type,
            "data": {}
        }

        # Route to appropriate retrieval method
        if query_type == "financial":
            context["data"]["financial"] = await self._retrieve_financial(query)

        elif query_type == "inventory":
            context["data"]["inventory"] = await self._retrieve_inventory(query)

        elif query_type == "service":
            context["data"]["services"] = await self._retrieve_services(query)

        elif query_type == "hybrid":
            # Complex query requiring multiple data sources
            context["data"]["financial"] = await self._retrieve_financial(query)
            context["data"]["inventory"] = await self._retrieve_inventory(query)
            context["data"]["services"] = await self._retrieve_services(query)

        elif query_type == "semantic":
            # Use vector search for semantic/recommendation queries
            context["data"]["semantic_results"] = await self._retrieve_semantic(query)

        else:
            # Default: try semantic search
            context["data"]["semantic_results"] = await self._retrieve_semantic(query)

        return context

    def _classify_query(self, query_lower: str) -> str:
        """
        Classify the query type based on keywords.

        Args:
            query_lower: Lowercased query string

        Returns:
            Query type: "financial", "inventory", "service", "hybrid", or "semantic"
        """
        matches = {
            "financial": False,
            "inventory": False,
            "service": False
        }

        # Check for keyword matches
        for category, keywords in self.sql_keywords.items():
            for keyword in keywords:
                if keyword in query_lower:
                    matches[category] = True
                    break

        # Count matches
        match_count = sum(matches.values())

        if match_count == 0:
            # No SQL keywords found, use semantic search
            return "semantic"
        elif match_count == 1:
            # Single category match
            return next(k for k, v in matches.items() if v)
        else:
            # Multiple categories, hybrid approach
            return "hybrid"

    async def _retrieve_financial(self, query: str) -> Any:
        """
        Retrieve financial data using SQL.

        Args:
            query: User query

        Returns:
            Financial data from SQL query
        """
        try:
            # Extract time period from query
            time_period = self._extract_time_period(query)
            result = await self.financial_tool._arun(time_period)
            import json
            return json.loads(result)
        except Exception as e:
            print(f"Error retrieving financial data: {e}")
            return {"error": str(e)}

    async def _retrieve_inventory(self, query: str) -> Any:
        """
        Retrieve inventory data using SQL.

        Args:
            query: User query

        Returns:
            Inventory data from SQL query
        """
        try:
            # Determine inventory query type
            query_lower = query.lower()
            if "low" in query_lower or "restock" in query_lower:
                inventory_query = "low_stock"
            elif "dead" in query_lower or "unused" in query_lower or "stagnant" in query_lower:
                inventory_query = "dead_stock"
            else:
                # Extract item name from query
                inventory_query = self._extract_item_name(query)

            result = await self.inventory_tool._arun(inventory_query)
            import json
            return json.loads(result)
        except Exception as e:
            print(f"Error retrieving inventory data: {e}")
            return {"error": str(e)}

    async def _retrieve_services(self, query: str) -> Any:
        """
        Retrieve service data using SQL.

        Args:
            query: User query

        Returns:
            Service data from SQL query
        """
        try:
            query_lower = query.lower()
            if "popular" in query_lower or "top" in query_lower or "most" in query_lower:
                service_query = "popular"
            elif "all" in query_lower or "list" in query_lower:
                service_query = "all"
            else:
                # Extract service name from query
                service_query = self._extract_service_name(query)

            result = await self.service_tool._arun(service_query)
            import json
            return json.loads(result)
        except Exception as e:
            print(f"Error retrieving service data: {e}")
            return {"error": str(e)}

    async def _retrieve_semantic(self, query: str) -> List[Dict[str, Any]]:
        """
        Retrieve data using vector similarity search.

        Args:
            query: User query

        Returns:
            List of semantically similar documents
        """
        try:
            results = await self.embedding_service.search_similar(
                pool=self.pool,
                query=query,
                match_threshold=0.7,
                match_count=5
            )
            return results
        except Exception as e:
            print(f"Error retrieving semantic data: {e}")
            return []

    def _extract_time_period(self, query: str) -> str:
        """
        Extract time period from query.

        Args:
            query: User query

        Returns:
            Time period string for financial tool
        """
        query_lower = query.lower()

        # Check for common time periods
        if "today" in query_lower:
            return "today"
        elif "this week" in query_lower:
            return "this_week"
        elif "this month" in query_lower:
            return "this_month"
        elif "this year" in query_lower:
            return "this_year"

        # Check for month names
        months = {
            "january": "01", "february": "02", "march": "03", "april": "04",
            "may": "05", "june": "06", "july": "07", "august": "08",
            "september": "09", "october": "10", "november": "11", "december": "12"
        }

        for month_name, month_num in months.items():
            if month_name in query_lower:
                # Extract year if present
                year_match = re.search(r'\b(20\d{2})\b', query)
                year = year_match.group(1) if year_match else "2025"
                return f"{year}-{month_num}-01 to {year}-{month_num}-31"

        # Default to this month
        return "this_month"

    def _extract_item_name(self, query: str) -> str:
        """
        Extract item name from query.

        Args:
            query: User query

        Returns:
            Item name or 'all' as default
        """
        # Remove common words to extract item name
        remove_words = ["stock", "inventory", "item", "product", "check", "show", "get", "what", "is", "the", "of", "level"]
        words = query.lower().split()
        item_words = [w for w in words if w not in remove_words]

        if item_words:
            return " ".join(item_words)
        return "all"

    def _extract_service_name(self, query: str) -> str:
        """
        Extract service name from query.

        Args:
            query: User query

        Returns:
            Service name or 'all' as default
        """
        # Remove common words to extract service name
        remove_words = ["service", "treatment", "about", "tell", "me", "show", "get", "what", "is", "the", "price"]
        words = query.lower().split()
        service_words = [w for w in words if w not in remove_words]

        if service_words:
            return " ".join(service_words)
        return "all"


def get_retrieval_service(pool: asyncpg.Pool) -> HybridRetrievalService:
    """
    Create a hybrid retrieval service instance.

    Args:
        pool: Database connection pool

    Returns:
        HybridRetrievalService instance
    """
    return HybridRetrievalService(pool=pool)
