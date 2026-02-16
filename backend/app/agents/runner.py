import logging
import pandas as pd

from app.agents.sql_agent import get_sql_agent_executor
from app.agents.pandas_agent import create_pandas_agent_executor

logger = logging.getLogger(__name__)


def run_sql_agent(message: str) -> str:
    sql_agent = get_sql_agent_executor()
    try:
        result = sql_agent.invoke({"input": message})
    except Exception as exc:
        logger.error("SQL Agent error: %s", exc)
        raise
    return result.get("output", "Unable to process your request. Please try again.")

def run_pandas_agent(dataframe: pd.DataFrame, message: str):
    agent_executor = create_pandas_agent_executor(dataframe)
    try:
        result = agent_executor.invoke({"input": message})
    except Exception as exc:
        logger.error("Pandas Agent error: %s", exc)
        raise
    return result.get("output", "Unable to process your request. Please try again.")

