from langchain_openai import ChatOpenAI

from config import OPENAI_API_KEY


def _require_api_key() -> str:
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is required")
    return OPENAI_API_KEY


def get_chat_llm(model: str = "gpt-4o", temperature: float = 0.0) -> ChatOpenAI:
    return ChatOpenAI(
        model=model,
        temperature=temperature,
        openai_api_key=_require_api_key(),
    )


class OpenAILLM:
    def __init__(self, model: str = "gpt-4o", temperature: float = 0.0) -> None:
        self._client = get_chat_llm(model=model, temperature=temperature)

    def invoke(self, prompt: str) -> str:
        response = self._client.invoke(prompt)
        content = getattr(response, "content", None)
        return content if content is not None else str(response)


# Backwards compatibility: code that still imports MockLLM will now use OpenAI.
MockLLM = OpenAILLM
