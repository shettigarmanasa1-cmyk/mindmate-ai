import logging

import openai
from openai import OpenAI

from app.config import settings

logger = logging.getLogger("uvicorn.error")

SYSTEM_PROMPT = (
    "You are MindMate AI, a friendly and helpful assistant. "
    "Answer clearly and naturally. If you do not know something about the "
    "user, ask them instead of guessing."
)


class LLMError(Exception):
    """An AI-provider problem, with a message that is safe to show users."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _client() -> OpenAI:
    kwargs = {"api_key": settings.openai_api_key, "timeout": 30.0}
    if settings.openai_base_url:
        kwargs["base_url"] = settings.openai_base_url
    return OpenAI(**kwargs)


def _log(error: Exception) -> None:
    """Log only the error type, status and a short message. Never the key or the chat."""
    logger.warning(
        "AI provider error: type=%s status=%s model=%s message=%s",
        type(error).__name__,
        getattr(error, "status_code", None),
        settings.openai_model,
        str(error)[:200],
    )


def generate_reply(history: list[dict]) -> str:
    """Send the conversation to the AI and return its reply text."""
    if settings.openai_api_key in ("", "your-key-here"):
        raise LLMError(
            "The AI provider is not configured. Add a key to backend/.env.", 503
        )

    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history
    try:
        response = _client().chat.completions.create(
            model=settings.openai_model, messages=messages
        )
    except openai.RateLimitError as error:
        _log(error)
        raise LLMError("The AI is busy right now. Please try again shortly.", 429)
    except openai.AuthenticationError as error:
        _log(error)
        raise LLMError("The AI provider rejected the API key.", 503)
    except openai.APIConnectionError as error:  # also covers timeouts
        _log(error)
        raise LLMError("Could not reach the AI provider. Check your connection.", 503)
    except openai.APIError as error:
        _log(error)
        raise LLMError("The AI provider returned an error. Please try again.", 502)

    text = response.choices[0].message.content
    if not text:
        logger.warning("AI provider returned an empty reply (model=%s)", settings.openai_model)
        raise LLMError("The AI returned an empty reply. Please try again.", 502)
    return text.strip()