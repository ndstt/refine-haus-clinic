from fastapi import APIRouter

from app.agents.runner import run_agent
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    response = run_agent(payload.message)
    return ChatResponse(response=response)
