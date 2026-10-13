from fastapi import APIRouter
from pydantic import BaseModel

from app import settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    memory_enabled: bool | None = None


@router.get("")
def get_settings():
    return settings_service.get_settings()


@router.patch("")
def update_settings(body: SettingsUpdate):
    return settings_service.update_settings(body.memory_enabled)