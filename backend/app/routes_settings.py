from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app import settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    memory_enabled: bool | None = None
    response_style: Literal["friendly", "professional", "casual"] | None = None
    answer_length: Literal["short", "balanced", "detailed"] | None = None
    beginner_friendly: bool | None = None


@router.get("")
def get_settings():
    return settings_service.get_settings()


@router.patch("")
def update_settings(body: SettingsUpdate):
    return settings_service.update_settings(body.model_dump(exclude_none=True))