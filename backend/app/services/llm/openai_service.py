"""
OpenAI Service for Refine Haus Clinic AI Chatbot
Uses LangChain to integrate GPT-4o-mini for cost-effective business insights
"""

from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from config import OPENAI_API_KEY, OPENAI_MODEL
from typing import List, Dict, Any


class OpenAIService:
    """
    Service for interacting with OpenAI's GPT-4o-mini via LangChain.
    Optimized for clinic business intelligence queries.
    """

    def __init__(self, temperature: float = 0.7, max_tokens: int = 1000):
        """
        Initialize OpenAI service with LangChain.

        Args:
            temperature: Controls randomness (0.0-1.0). Lower = more focused.
            max_tokens: Maximum response length.
        """
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment variables")

        # Initialize ChatOpenAI with GPT-4o-mini
        self.llm = ChatOpenAI(
            model=OPENAI_MODEL,
            temperature=temperature,
            max_tokens=max_tokens,
            openai_api_key=OPENAI_API_KEY,
        )

        # System prompt for business consultant behavior
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        """Load system prompt from file or return default."""
        try:
            with open("app/agents/prompts/system.md", "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            # Fallback system prompt
            return """You are LUMINA, an intelligent business consultant AI for Refine Haus Clinic.

Your role:
- Analyze clinic data (financial, inventory, services) and provide actionable insights
- Answer questions about revenue, expenses, profit/loss with precise calculations
- Monitor inventory levels and suggest restock alerts
- Recommend promotions based on sales patterns and dead stock
- Provide strategic advice to optimize clinic operations

Guidelines:
- Always base answers on actual data provided in the context
- For numerical queries, provide exact figures with proper formatting
- When suggesting strategies, explain the reasoning behind recommendations
- Be concise and professional in your responses
- If data is insufficient, clearly state what additional information is needed
"""

    def invoke(self, message: str, context: Dict[str, Any] = None) -> str:
        """
        Send a message to the AI and get a response.

        Args:
            message: User's question or prompt
            context: Optional context data (SQL results, embeddings, etc.)

        Returns:
            AI's response as a string
        """
        messages = [SystemMessage(content=self.system_prompt)]

        # Add context if provided
        if context:
            context_message = self._format_context(context)
            messages.append(SystemMessage(content=context_message))

        # Add user message
        messages.append(HumanMessage(content=message))

        # Get response from LLM
        response = self.llm.invoke(messages)
        return response.content

    def invoke_with_history(
        self,
        message: str,
        history: List[Dict[str, str]],
        context: Dict[str, Any] = None
    ) -> str:
        """
        Send a message with conversation history for context-aware responses.

        Args:
            message: Current user message
            history: List of previous messages [{"role": "user"|"assistant", "content": "..."}]
            context: Optional context data

        Returns:
            AI's response as a string
        """
        messages = [SystemMessage(content=self.system_prompt)]

        # Add context if provided
        if context:
            context_message = self._format_context(context)
            messages.append(SystemMessage(content=context_message))

        # Add conversation history
        for msg in history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))

        # Add current message
        messages.append(HumanMessage(content=message))

        # Get response from LLM
        response = self.llm.invoke(messages)
        return response.content

    def _format_context(self, context: Dict[str, Any]) -> str:
        """
        Format context data into a readable string for the LLM.
        Optimized for GPT-4o-mini to reduce token usage.

        Args:
            context: Dictionary containing SQL results, embeddings, etc.

        Returns:
            Formatted context string
        """
        formatted = "## Data Context\n\n"

        # Financial data
        if "financial" in context:
            formatted += "### Financial Summary\n"
            for key, value in context["financial"].items():
                formatted += f"- {key}: {value}\n"
            formatted += "\n"

        # Inventory data
        if "inventory" in context:
            formatted += "### Inventory Status\n"
            for item in context["inventory"]:
                formatted += f"- {item.get('name', 'N/A')}: {item.get('quantity', 0)} units\n"
            formatted += "\n"

        # Services data
        if "services" in context:
            formatted += "### Service Information\n"
            for service in context["services"]:
                formatted += f"- {service.get('name', 'N/A')}: ${service.get('price', 0)}\n"
            formatted += "\n"

        # Vector search results (for semantic queries)
        if "semantic_results" in context:
            formatted += "### Relevant Information\n"
            for result in context["semantic_results"]:
                formatted += f"- {result.get('content', '')}\n"
            formatted += "\n"

        return formatted

    async def astream(self, message: str, context: Dict[str, Any] = None):
        """
        Stream response for better UX (async generator).
        Useful for frontend to show real-time typing effect.

        Args:
            message: User's question
            context: Optional context data

        Yields:
            Chunks of AI response
        """
        messages = [SystemMessage(content=self.system_prompt)]

        if context:
            context_message = self._format_context(context)
            messages.append(SystemMessage(content=context_message))

        messages.append(HumanMessage(content=message))

        async for chunk in self.llm.astream(messages):
            yield chunk.content


# Singleton instance for reuse across requests
_openai_service_instance = None


def get_openai_service() -> OpenAIService:
    """
    Get or create a singleton OpenAI service instance.
    Avoids recreating the service for every request.
    """
    global _openai_service_instance
    if _openai_service_instance is None:
        _openai_service_instance = OpenAIService()
    return _openai_service_instance
