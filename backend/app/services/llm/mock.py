from itertools import cycle
from typing import Iterable


class MockLLM:
    def __init__(self, responses: Iterable[str] | None = None) -> None:
        if responses is None:
            responses = [
                "Mock response: I received '{prompt}'.",
                "Mock response: This is a placeholder reply.",
                "Mock response: Replace me with a real LLM later.",
            ]
        self._responses = cycle(list(responses))

    def invoke(self, prompt: str) -> str:
        return next(self._responses).format(prompt=prompt)
