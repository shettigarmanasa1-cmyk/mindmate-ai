from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, StringConstraints

from app import memory_retrieval
from app import memory_service as service

Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
Category = Literal["preference", "goal", "project", "skill", "general"]


class MemoryCreate(BaseModel):
    content: Content
    category: Category = "general"


class MemoryUpdate(BaseModel):
    content: Content
    category: Category = "general"


class ProposalCreate(BaseModel):
    content: Content
    category: Category = "general"
    replaces_memory_id: str | None = None
    source_conversation_id: str | None = None


router = APIRouter(prefix="/api/memories", tags=["memories"])


@router.get("")
def list_memories():
    return service.list_memories()

@router.get("/relevant")
def relevant_memories(q: Annotated[str, Query(min_length=1, max_length=500)]):
    """Show which saved memories would be used for this question."""
    return memory_retrieval.find_relevant_memories(q)

@router.post("", status_code=201)
def create_memory(body: MemoryCreate):
    return service.create_memory(body.content, body.category)


@router.delete("")
def clear_memories(confirm: bool = False):
    # The server itself refuses to clear everything without confirmation.
    if not confirm:
        raise HTTPException(status_code=400, detail="Confirmation required: add ?confirm=true")
    return {"deleted": service.clear_memories()}


# The "/proposals" routes come BEFORE "/{memory_id}" so the word
# "proposals" is never mistaken for a memory id.
@router.get("/proposals")
def list_proposals(status: Literal["pending", "approved", "rejected"] = "pending"):
    return service.list_proposals(status)


@router.post("/proposals", status_code=201)
def propose_memory(body: ProposalCreate):
    return service.propose_memory(
        body.content, body.category, body.replaces_memory_id, body.source_conversation_id
    )


@router.post("/proposals/{proposal_id}/approve")
def approve_proposal(proposal_id: str):
    return service.approve_proposal(proposal_id)


@router.post("/proposals/{proposal_id}/reject")
def reject_proposal(proposal_id: str):
    return service.reject_proposal(proposal_id)


@router.patch("/{memory_id}")
def update_memory(memory_id: str, body: MemoryUpdate):
    return service.update_memory(memory_id, body.content, body.category)


@router.delete("/{memory_id}", status_code=204)
def delete_memory(memory_id: str):
    service.delete_memory(memory_id)
    return Response(status_code=204)