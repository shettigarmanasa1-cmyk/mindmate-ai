import openai
from openai import OpenAI

from app.config import settings

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
    except openai.RateLimitError:
        raise LLMError("The AI is busy right now. Please try again shortly.", 429)
    except openai.AuthenticationError:
        raise LLMError("The AI provider rejected the API key.", 503)
    except openai.APIConnectionError:  # also covers timeouts
        raise LLMError("Could not reach the AI provider. Check your connection.", 503)
    except openai.APIError:
        raise LLMError("The AI provider returned an error. Please try again.", 502)

    text = response.choices[0].message.content
    if not text:
        raise LLMError("The AI returned an empty reply. Please try again.", 502)
    return text.strip()