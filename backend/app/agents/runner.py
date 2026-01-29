import logging

from app.agents.sql_agent import get_sql_agent_executor

logger = logging.getLogger(__name__)


def run_agent(message: str) -> str:
    sql_agent = get_sql_agent_executor()
    try:
        result = sql_agent.invoke({"input": message})
    except Exception as exc:
        logger.error("SQL Agent error: %s", exc)
        raise
    return result.get("output", "ขออภัย ไม่สามารถตอบคำถามได้")
