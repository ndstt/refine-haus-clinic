"""
Database Tools for Refine Haus Clinic AI Chatbot
LangChain tools for structured data retrieval (SQL queries)
"""

from langchain.tools import BaseTool
from pydantic import Field
from typing import Optional, Dict, Any
import asyncpg
from datetime import datetime, timedelta
import json


class FinancialAnalysisTool(BaseTool):
    """Tool for analyzing financial data (revenue, expenses, profit)."""

    name: str = "financial_analysis"
    description: str = """
    Use this tool to get financial data for the clinic.
    Input should be a time period: 'today', 'this_week', 'this_month', 'this_year',
    or specific dates in format 'YYYY-MM-DD to YYYY-MM-DD'.
    Returns revenue, expenses, and profit/loss calculations.
    """

    pool: asyncpg.Pool = Field(exclude=True)

    class Config:
        arbitrary_types_allowed = True

    async def _arun(self, query: str) -> str:
        """Execute financial analysis query asynchronously."""
        # Parse time period
        start_date, end_date = self._parse_time_period(query)

        async with self.pool.acquire() as conn:
            # Get revenue from sell invoices
            revenue = await conn.fetchval(
                """
                SELECT COALESCE(SUM(grand_total), 0)::numeric(10,2)
                FROM sell_invoice
                WHERE invoice_date >= $1 AND invoice_date <= $2
                AND status = 'COMPLETED'
                """,
                start_date,
                end_date
            )

            # Get expenses from stock imports and waste
            expenses = await conn.fetchval(
                """
                SELECT COALESCE(SUM(sm.unit_price * sm.quantity), 0)::numeric(10,2)
                FROM stock_movement sm
                WHERE sm.movement_date >= $1 AND sm.movement_date <= $2
                AND sm.movement_type IN ('IMPORT', 'WASTE')
                """,
                start_date,
                end_date
            )

            # Get top services by revenue
            top_services = await conn.fetch(
                """
                SELECT
                    t.treatment_name,
                    COUNT(*) as service_count,
                    COALESCE(SUM(sil.total_price), 0)::numeric(10,2) as total_revenue
                FROM sell_invoice_line sil
                JOIN treatment t ON sil.treatment_id = t.treatment_id
                JOIN sell_invoice si ON sil.invoice_id = si.invoice_id
                WHERE si.invoice_date >= $1 AND si.invoice_date <= $2
                AND si.status = 'COMPLETED'
                GROUP BY t.treatment_name
                ORDER BY total_revenue DESC
                LIMIT 5
                """,
                start_date,
                end_date
            )

            # Calculate profit
            profit = float(revenue or 0) - float(expenses or 0)

            # Format result
            result = {
                "period": f"{start_date} to {end_date}",
                "revenue": f"${revenue:,.2f}" if revenue else "$0.00",
                "expenses": f"${expenses:,.2f}" if expenses else "$0.00",
                "profit": f"${profit:,.2f}",
                "profit_margin": f"{(profit / float(revenue) * 100) if revenue and revenue > 0 else 0:.2f}%",
                "top_services": [
                    {
                        "service": row["treatment_name"],
                        "count": row["service_count"],
                        "revenue": f"${row['total_revenue']:,.2f}"
                    }
                    for row in top_services
                ]
            }

            return json.dumps(result, indent=2)

    def _run(self, query: str) -> str:
        """Synchronous version (not used in async context)."""
        raise NotImplementedError("Use async version _arun instead")

    def _parse_time_period(self, query: str) -> tuple:
        """Parse time period from query string."""
        query_lower = query.lower().strip()
        today = datetime.now().date()

        if "today" in query_lower:
            return today, today
        elif "this week" in query_lower or "this_week" in query_lower:
            start = today - timedelta(days=today.weekday())
            return start, today
        elif "this month" in query_lower or "this_month" in query_lower:
            start = today.replace(day=1)
            return start, today
        elif "this year" in query_lower or "this_year" in query_lower:
            start = today.replace(month=1, day=1)
            return start, today
        elif " to " in query_lower:
            # Format: YYYY-MM-DD to YYYY-MM-DD
            try:
                parts = query_lower.split(" to ")
                start = datetime.strptime(parts[0].strip(), "%Y-%m-%d").date()
                end = datetime.strptime(parts[1].strip(), "%Y-%m-%d").date()
                return start, end
            except:
                pass

        # Default to this month
        start = today.replace(day=1)
        return start, today


class InventoryAnalysisTool(BaseTool):
    """Tool for analyzing inventory levels and stock status."""

    name: str = "inventory_analysis"
    description: str = """
    Use this tool to check inventory status.
    Input can be:
    - 'all' to get overview of all inventory
    - 'low_stock' to find items running low
    - 'dead_stock' to find items not used recently
    - Specific item name to search for
    Returns current stock levels and relevant information.
    """

    pool: asyncpg.Pool = Field(exclude=True)

    class Config:
        arbitrary_types_allowed = True

    async def _arun(self, query: str) -> str:
        """Execute inventory analysis query asynchronously."""
        query_lower = query.lower().strip()

        async with self.pool.acquire() as conn:
            if query_lower == "all":
                # Get overview of all inventory
                items = await conn.fetch(
                    """
                    SELECT
                        ic.item_name,
                        ig.group_name,
                        ic.current_stock,
                        ic.min_stock_level,
                        ic.unit,
                        ic.unit_price
                    FROM item_catalog ic
                    JOIN item_group ig ON ic.group_id = ig.group_id
                    ORDER BY ic.current_stock ASC
                    LIMIT 20
                    """
                )

            elif query_lower == "low_stock":
                # Find items below minimum stock level
                items = await conn.fetch(
                    """
                    SELECT
                        ic.item_name,
                        ig.group_name,
                        ic.current_stock,
                        ic.min_stock_level,
                        ic.unit,
                        ic.unit_price
                    FROM item_catalog ic
                    JOIN item_group ig ON ic.group_id = ig.group_id
                    WHERE ic.current_stock <= ic.min_stock_level
                    ORDER BY (ic.current_stock - ic.min_stock_level) ASC
                    """
                )

            elif query_lower == "dead_stock":
                # Find items not used in last 30 days
                items = await conn.fetch(
                    """
                    SELECT
                        ic.item_name,
                        ig.group_name,
                        ic.current_stock,
                        ic.unit,
                        COALESCE(MAX(sm.movement_date), ic.created_at) as last_movement
                    FROM item_catalog ic
                    JOIN item_group ig ON ic.group_id = ig.group_id
                    LEFT JOIN stock_movement sm ON ic.catalog_id = sm.catalog_id
                    WHERE sm.movement_type IN ('USE_FOR_TREATMENT', 'USE_FOR_PROMOTION')
                    GROUP BY ic.catalog_id, ic.item_name, ig.group_name, ic.current_stock, ic.unit, ic.created_at
                    HAVING COALESCE(MAX(sm.movement_date), ic.created_at) < NOW() - INTERVAL '30 days'
                    AND ic.current_stock > 0
                    ORDER BY last_movement ASC
                    LIMIT 10
                    """
                )

            else:
                # Search for specific item
                items = await conn.fetch(
                    """
                    SELECT
                        ic.item_name,
                        ig.group_name,
                        ic.current_stock,
                        ic.min_stock_level,
                        ic.unit,
                        ic.unit_price,
                        ic.description
                    FROM item_catalog ic
                    JOIN item_group ig ON ic.group_id = ig.group_id
                    WHERE LOWER(ic.item_name) LIKE $1
                    OR LOWER(ic.description) LIKE $1
                    LIMIT 10
                    """,
                    f"%{query_lower}%"
                )

            # Format results
            result = {
                "query": query,
                "total_items": len(items),
                "items": [
                    {
                        "name": row["item_name"],
                        "category": row["group_name"],
                        "current_stock": f"{row['current_stock']} {row['unit']}",
                        "min_level": f"{row.get('min_stock_level', 'N/A')}",
                        "status": "LOW" if row.get("min_stock_level") and row["current_stock"] <= row["min_stock_level"] else "OK"
                    }
                    for row in items
                ]
            }

            return json.dumps(result, indent=2)

    def _run(self, query: str) -> str:
        """Synchronous version (not used in async context)."""
        raise NotImplementedError("Use async version _arun instead")


class ServiceAnalysisTool(BaseTool):
    """Tool for analyzing services and treatments."""

    name: str = "service_analysis"
    description: str = """
    Use this tool to get information about clinic services and treatments.
    Input can be:
    - 'all' to list all available services
    - 'popular' to find most booked services
    - Specific service name to search for details
    Returns service information including prices and usage statistics.
    """

    pool: asyncpg.Pool = Field(exclude=True)

    class Config:
        arbitrary_types_allowed = True

    async def _arun(self, query: str) -> str:
        """Execute service analysis query asynchronously."""
        query_lower = query.lower().strip()

        async with self.pool.acquire() as conn:
            if query_lower == "all":
                # Get all services
                services = await conn.fetch(
                    """
                    SELECT
                        treatment_name,
                        price,
                        duration_minutes,
                        description
                    FROM treatment
                    WHERE is_active = TRUE
                    ORDER BY treatment_name
                    """
                )

            elif query_lower == "popular":
                # Get most popular services (last 30 days)
                services = await conn.fetch(
                    """
                    SELECT
                        t.treatment_name,
                        t.price,
                        COUNT(sil.line_id) as booking_count,
                        SUM(sil.total_price)::numeric(10,2) as total_revenue
                    FROM treatment t
                    JOIN sell_invoice_line sil ON t.treatment_id = sil.treatment_id
                    JOIN sell_invoice si ON sil.invoice_id = si.invoice_id
                    WHERE si.invoice_date >= NOW() - INTERVAL '30 days'
                    AND si.status = 'COMPLETED'
                    GROUP BY t.treatment_id, t.treatment_name, t.price
                    ORDER BY booking_count DESC
                    LIMIT 10
                    """
                )

            else:
                # Search for specific service
                services = await conn.fetch(
                    """
                    SELECT
                        t.treatment_name,
                        t.price,
                        t.duration_minutes,
                        t.description,
                        COUNT(sil.line_id) as total_bookings
                    FROM treatment t
                    LEFT JOIN sell_invoice_line sil ON t.treatment_id = sil.treatment_id
                    WHERE LOWER(t.treatment_name) LIKE $1
                    OR LOWER(t.description) LIKE $1
                    GROUP BY t.treatment_id, t.treatment_name, t.price, t.duration_minutes, t.description
                    LIMIT 5
                    """,
                    f"%{query_lower}%"
                )

            # Format results
            result = {
                "query": query,
                "total_services": len(services),
                "services": [
                    {
                        "name": row["treatment_name"],
                        "price": f"${row['price']:,.2f}",
                        "bookings": row.get("booking_count", row.get("total_bookings", 0)),
                        "revenue": f"${row.get('total_revenue', 0):,.2f}" if "total_revenue" in row else "N/A"
                    }
                    for row in services
                ]
            }

            return json.dumps(result, indent=2)

    def _run(self, query: str) -> str:
        """Synchronous version (not used in async context)."""
        raise NotImplementedError("Use async version _arun instead")


def create_database_tools(pool: asyncpg.Pool) -> list:
    """
    Create all database tools with the connection pool.

    Args:
        pool: AsyncPG connection pool

    Returns:
        List of LangChain tools
    """
    return [
        FinancialAnalysisTool(pool=pool),
        InventoryAnalysisTool(pool=pool),
        ServiceAnalysisTool(pool=pool)
    ]
