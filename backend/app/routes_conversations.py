from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, StringConstraints

from app import conversation_service as service

# A title: spaces trimmed, 1 to 100 characters.
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class ConversationCreate(BaseModel):
    title: Title = "New conversation"


class ConversationRename(BaseModel):
    title: Title


router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Conversation not found")


@router.post("", status_code=201)
def create_conversation(body: ConversationCreate = ConversationCreate()):
    return service.create_conversation(body.title)


@router.get("")
def list_conversations():
    return service.list_conversations()


# "search" must come BEFORE "/{conversation_id}", or FastAPI would treat
# the word "search" as a conversation id.
@router.get("/search")
def search_conversations(q: Annotated[str, Query(min_length=1, max_length=100)]):
    return service.search_conversations(q)


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str):
    conversation = service.get_conversation(conversation_id)
    if conversation is None:
        raise not_found()
    return conversation


@router.patch("/{conversation_id}")
def rename_conversation(conversation_id: str, body: ConversationRename):
    conversation = service.rename_conversation(conversation_id, body.title)
    if conversation is None:
        raise not_found()
    return conversation


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str):
    if not service.delete_conversation(conversation_id):
        raise not_found()
    return Response(status_code=204)