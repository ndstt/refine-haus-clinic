from app.services.llm.mock import MockLLM

_llm = MockLLM()


def run_agent(message: str) -> str:
    return _llm.invoke(message)
