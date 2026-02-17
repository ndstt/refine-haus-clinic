import inspect
import logging
from typing import Any

import pandas as pd

from app.agents.prompts.pandas_agent import SYSTEM_PROMPT
from app.services.llm.open_ai import get_chat_llm
from langchain_experimental.agents.agent_toolkits import create_pandas_dataframe_agent

logger = logging.getLogger(__name__)
_pandas_agent = None
_pandas_agent_df_id = None



def create_pandas_agent_executor(dataframe: pd.DataFrame):
    """
    Build a LangChain pandas dataframe agent executor from a DataFrame.

    The returned executor can be called with:
    executor.invoke({"input": "your aggregation question"})
    """
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("dataframe must be a pandas.DataFrame")
    if dataframe.empty:
        raise ValueError("dataframe is empty")

    logger.info("Initializing LangChain Pandas DataFrame Agent...")
    llm = get_chat_llm()

    signature = inspect.signature(create_pandas_dataframe_agent)
    kwargs: dict[str, Any] = {
        "llm": llm,
        "df": dataframe,
        "verbose": True,
    }

    if "prefix" in signature.parameters:
        kwargs["prefix"] = SYSTEM_PROMPT
    if "max_iterations" in signature.parameters:
        kwargs["max_iterations"] = 8
    if "agent_executor_kwargs" in signature.parameters:
        kwargs["agent_executor_kwargs"] = {
            "handle_parsing_errors": True,
            "return_intermediate_steps": True,
        }
    if "agent_type" in signature.parameters:
        kwargs["agent_type"] = "tool-calling"
    if "allow_dangerous_code" in signature.parameters:
        kwargs["allow_dangerous_code"] = True

    return create_pandas_dataframe_agent(**kwargs)


def get_pandas_agent_executor(dataframe: pd.DataFrame):
    global _pandas_agent, _pandas_agent_df_id
    dataframe_id = id(dataframe)
    if _pandas_agent is None or _pandas_agent_df_id != dataframe_id:
        _pandas_agent = create_pandas_agent_executor(dataframe)
        _pandas_agent_df_id = dataframe_id
    return _pandas_agent
