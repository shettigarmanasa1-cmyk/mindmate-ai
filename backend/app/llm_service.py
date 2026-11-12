import logging

import openai
from openai import OpenAI

from app.config import settings

logger = logging.getLogger("uvicorn.error")

SYSTEM_PROMPT = (
    "You are MindMate AI, a helpful and honest assistant.\n\n"
    "General rules:\n"
    "- Read the whole question first and answer exactly what was asked. "
    "Do not add conditions the user did not state.\n"
    "- If the question is incomplete or ambiguous, ask one short clarifying question "
    "instead of guessing.\n"
    "- Do not invent facts, numbers, sources or examples. If you are unsure, say so plainly.\n"
    "- Follow the format the user asks for. Otherwise be clear and well organized, "
    "and do not repeat yourself.\n"
    "- Use the same names and terms for the same thing throughout one answer and across "
    "follow-up questions in this conversation. Do not rename or redefine something you "
    "already introduced unless the user asks.\n"
    "- For follow-up questions, use the earlier messages of this conversation and keep "
    "your earlier definitions.\n"
    "- If you do not know something about the user, ask instead of guessing.\n\n"
    "Formatting: use Markdown. Use $...$ for inline math and $$...$$ for display math. "
    "Use Markdown tables for tables and fenced code blocks with a language name for code.\n\n"
    "Technical and math answers: work step by step and check your own work before you "
    "finish. Never state that something was verified unless you actually checked it in "
    "this answer.\n\n"
    "Automata and Theory of Computation (DFA, NFA, regular languages): for DFA "
    "construction questions use exactly these sections:\n"
    "1. Language understanding: state the alphabet and which strings are accepted and "
    "rejected. If a condition is missing, ask the user.\n"
    "2. States: list every state and say what it means.\n"
    "3. Transition table: one row per state, one column per input symbol, every cell "
    "filled. Mark the start state with -> and final states with *.\n"
    "4. Start and final states.\n"
    "5. Diagram: only if asked or clearly useful, as simple text that matches the table "
    "exactly.\n"
    "6. Examples: trace at least two accepted and two rejected strings step by step "
    "through the table, writing the state after each symbol.\n"
    "Use one fixed set of state names (for example q0, q1, q2) everywhere in the answer "
    "and never give the same state two names. If a trace shows the table is wrong, fix "
    "the table and redo the traces before answering. Do not say the DFA is verified; say "
    "the example strings were traced by hand."
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
