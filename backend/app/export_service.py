from app import conversation_service, memory_service, settings_service
from app.config import settings
from app.database import now


def build_export() -> dict:
    """Everything the app stores about the user. Never includes the API key."""
    conversations = []
    for summary in conversation_service.list_conversations():
        full = conversation_service.get_conversation(summary["id"])
        if full:
            conversations.append(full)
    return {
        "exported_at": now(),
        "settings": settings_service.get_settings(),
        "memories": memory_service.list_memories(),
        "suggestions": {
            status: memory_service.list_proposals(status)
            for status in ("pending", "approved", "rejected")
        },
        "conversations": conversations,
    }


def data_info() -> dict:
    """A plain-language description of what is stored and where."""
    return {
        "storage_location": (
            f"One local SQLite file ({settings.database_path}) on the computer "
            "that runs the MindMate backend."
        ),
        "stored": [
            {"what": "Conversations and messages", "table": "conversations, messages"},
            {"what": "Approved long-term memories", "table": "memories"},
            {"what": "Memory suggestions (pending, approved, rejected)", "table": "proposed_memories"},
            {"what": "Your settings", "table": "settings"},
        ],
        "sent_to_ai_provider": [
            "Your latest messages in the current conversation",
            "Saved memories that matched your question (only when memory is on)",
            "Your response settings (only if you changed them from the defaults)",
        ],
        "not_stored_in_database": ["The API key (it lives only in backend/.env)"],
        "your_controls": [
            "View, edit and delete single memories",
            "Clear all memories",
            "Delete one or all conversations",
            "Turn memory off",
            "Export all your data",
        ],
    }