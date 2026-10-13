from typing import Annotated

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, StringConstraints

from app import conversation_service as service
from app import llm_service, memory_detection, memory_retrieval, settings_service
from app.memory_context import build_memory_message

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

    memory_on = settings_service.is_memory_enabled()
    relevant = memory_retrieval.find_relevant_memories(body.message) if memory_on else []

    history = [{"role": m["role"], "content": m["content"]} for m in earlier]
    history.append({"role": "user", "content": body.message})
    history = history[-MAX_HISTORY_MESSAGES:]

    memory_message = build_memory_message(relevant)
    if memory_message:
        history = [memory_message] + history

    try:
        reply = llm_service.generate_reply(history)
    except llm_service.LLMError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message)

    assistant_message = service.add_message(conversation["id"], "assistant", reply)

    proposals = []
    if memory_on:
        proposals = memory_detection.create_proposals_from_message(
            body.message, conversation["id"]
        )

    return {
        "conversation_id": conversation["id"],
        "title": conversation["title"],
        "user_message": user_message,
        "assistant_message": assistant_message,
        # Memories that were sent to the model with this question.
        "memories_provided": [
            {
                "id": m["id"],
                "content": m["content"],
                "matched_terms": m["matched_terms"],
                "score": m["score"],
            }
            for m in relevant
        ],
        # New suggestions waiting for the user's decision (not saved yet).
        "proposed_memories": proposals,
    }