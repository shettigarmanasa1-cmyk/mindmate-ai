from typing import Annotated

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, StringConstraints

from app import conversation_service as service
from app import llm_service

MAX_HISTORY_MESSAGES = 20  # only the latest messages are sent to the AI

Message = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


class ChatRequest(BaseModel):
    message: Message
    conversation_id: str | None = None  # empty = start a new conversation


router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
def chat(body: ChatRequest):
    if body.conversation_id:
        conversation = service.get_conversation(body.conversation_id)
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        earlier = conversation["messages"]
    else:
        conversation = service.create_conversation(title=body.message[:40])
        earlier = []

    # Save the user's message first, so it is never lost if the AI fails.
    user_message = service.add_message(conversation["id"], "user", body.message)

    history = [{"role": m["role"], "content": m["content"]} for m in earlier]
    history.append({"role": "user", "content": body.message})
    history = history[-MAX_HISTORY_MESSAGES:]

    try:
        reply = llm_service.generate_reply(history)
    except llm_service.LLMError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message)

    assistant_message = service.add_message(conversation["id"], "assistant", reply)
    return {
        "conversation_id": conversation["id"],
        "title": conversation["title"],
        "user_message": user_message,
        "assistant_message": assistant_message,
    }