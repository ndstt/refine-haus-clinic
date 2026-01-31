import logging

from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits import create_sql_agent

from config import POSTGRES
from app.agents.prompts.system import SYSTEM_PROMPT
from app.services.llm.open_ai import get_chat_llm

logger = logging.getLogger(__name__)

_sql_agent = None


def _build_database_url() -> str:
    missing = [key for key, value in POSTGRES.items() if not value]
    if missing:
        missing_keys = ", ".join(missing)
        raise ValueError(f"Missing database config values: {missing_keys}")

    return (
        "postgresql://"
        f"{POSTGRES['user']}:{POSTGRES['password']}"
        f"@{POSTGRES['host']}:{POSTGRES['port']}/{POSTGRES['database']}"
    )


def create_sql_agent_executor():
    logger.info("Initializing LangChain SQL Agent...")
    llm = get_chat_llm()

    db = SQLDatabase.from_uri(
        _build_database_url(),
        include_tables=["customer", "item_catalog", "sell_invoice", "sell_invoice_item", "treatment"],
        sample_rows_in_table_info=3,
    )

    return create_sql_agent(
        llm=llm,
        db=db,
        verbose=True,
        prefix=SYSTEM_PROMPT,
        agent_executor_kwargs={
            "handle_parsing_errors": True,
            "return_intermediate_steps": True,
        },
    )


def get_sql_agent_executor():
    global _sql_agent
    if _sql_agent is None:
        _sql_agent = create_sql_agent_executor()
    return _sql_agent