import re

from app import memory_service

MAX_CANDIDATES = 3
MAX_TAIL = 100
MAX_REMEMBER = 200

# Text matching any of these is never proposed as a memory.
SENSITIVE = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"[\w.+-]+@[\w-]+\.[\w.]+",   # email address
        r"\d{6,}",                     # long numbers (cards, ids, phones)
        r"\b\d(?:[\s-]?\d){8,}\b",    # numbers split by spaces or hyphens
        r"\b(password|passcode|otp|pin|cvv|ssn|aadhaar|aadhar|passport|"
        r"credit card|debit card|bank account|api key|secret key|token|secret)\b",
        r"\b(diagnosed|diagnosis|depress\w*|anxiety|medication|prescription|"
        r"therapy|religion|religious|salary|pregnan\w*)\b",
    )
]

CHANGE_WORDS = re.compile(
    r"\b(now|instead|switched|switching|no longer|anymore|any more|changed|changing)\b",
    re.IGNORECASE,
)

REMEMBER = re.compile(
    r"^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?"
    r"(?:remember|keep in mind)\s+(?:that\s+)?(.+)$",
    re.IGNORECASE,
)
PREFER = re.compile(r"\bi\s+(?:now\s+|really\s+|actually\s+)?prefer\s+(.+)", re.IGNORECASE)
LEARNING = re.compile(
    r"\bi(?:['’]m|\s+am)\s+(?:currently\s+)?"
    r"(learning|working on|building|developing)\s+(.+)",
    re.IGNORECASE,
)
WANT_LEARN = re.compile(r"\bi\s+want\s+to\s+learn\s+(.+)", re.IGNORECASE)
GOAL = re.compile(r"\bmy\s+goal\s+is\s+(.+)", re.IGNORECASE)


def is_sensitive(text: str) -> bool:
    return any(pattern.search(text) for pattern in SENSITIVE)


def _split_sentences(message: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", message.strip())
    return [part.strip() for part in parts if part.strip()]


def _strip_time_words(text: str) -> str:
    return re.sub(r"\s+(now|instead|anymore|these days)$", "", text.strip(), flags=re.IGNORECASE)


def _tail(text: str) -> str:
    """The useful part of a phrase: cut at punctuation, 'but' or 'because'."""
    cut = re.split(r"[.,;!?]|\s+but\s+|\s+because\s+", text, maxsplit=1, flags=re.IGNORECASE)[0]
    return _strip_time_words(cut).strip(" \"'")


def _valid(text: str, longest: int = MAX_TAIL) -> bool:
    return 2 <= len(text) <= longest


def _third_person(text: str) -> str:
    """'I prefer short answers' -> 'User prefers short answers'."""
    t = text.strip()
    t = re.sub(r"\bI['’]m\b", "User is", t, flags=re.IGNORECASE)
    t = re.sub(r"\bI am\b", "User is", t, flags=re.IGNORECASE)
    t = re.sub(r"\bI['’]ve\b", "User has", t, flags=re.IGNORECASE)
    t = re.sub(r"\bI\b", "User", t, flags=re.IGNORECASE)
    t = re.sub(r"\bmy\b", "the user's", t, flags=re.IGNORECASE)
    t = re.sub(r"\bme\b", "the user", t, flags=re.IGNORECASE)
    t = t[0].upper() + t[1:]
    t = re.sub(
        r"^User (prefer|like|love|want|use|need|work|study|play)\b",
        lambda m: f"User {m.group(1)}s",
        t,
    )
    return re.sub(r"^User have\b", "User has", t)


def _candidate(content: str, category: str) -> dict:
    return {"content": content, "category": category, "replaces_memory_id": None}


def _from_sentence(sentence: str) -> dict | None:
    match = REMEMBER.match(sentence)
    if match:
        body = _strip_time_words(match.group(1).strip(" .!?\"'"))
        if not _valid(body, MAX_REMEMBER):
            return None
        category = "preference" if re.search(r"\bprefer", body, re.IGNORECASE) else "general"
        return _candidate(_third_person(body), category)

    if "?" in sentence:  # a question is not a statement about the user
        return None

    match = PREFER.search(sentence)
    if match:
        tail = _tail(match.group(1))
        if _valid(tail):
            return _candidate(f"User prefers {tail}", "preference")

    match = LEARNING.search(sentence)
    if match:
        verb = match.group(1).lower()
        tail = _tail(match.group(2))
        if _valid(tail):
            category = "skill" if verb == "learning" else "project"
            return _candidate(f"User is {verb} {tail}", category)

    match = WANT_LEARN.search(sentence)
    if match:
        tail = _tail(match.group(1))
        if _valid(tail):
            return _candidate(f"User wants to learn {tail}", "goal")

    match = GOAL.search(sentence)
    if match:
        tail = _tail(match.group(1))
        if _valid(tail):
            return _candidate(f"User's goal is {tail}", "goal")

    return None


def _mark_replacement(candidate: dict, sentence: str, existing: list[dict]) -> None:
    """If the user seems to change a preference, point at the memory to replace."""
    if not candidate["content"].lower().startswith("user prefers"):
        return
    if not CHANGE_WORDS.search(sentence):
        return
    same_kind = [m for m in existing if m["content"].lower().startswith("user prefers")]
    if len(same_kind) == 1:  # more than one: too uncertain, let the user decide
        candidate["replaces_memory_id"] = same_kind[0]["id"]


def detect_candidates(message: str, existing_memories=()) -> list[dict]:
    """Rule-based: find statements worth proposing as memories."""
    existing = list(existing_memories)
    candidates: list[dict] = []
    for sentence in _split_sentences(message):
        if is_sensitive(sentence):
            continue
        candidate = _from_sentence(sentence)
        if candidate is None or is_sensitive(candidate["content"]):
            continue
        _mark_replacement(candidate, sentence, existing)
        if all(c["content"].lower() != candidate["content"].lower() for c in candidates):
            candidates.append(candidate)
        if len(candidates) >= MAX_CANDIDATES:
            break
    return candidates


def create_proposals_from_message(message: str, conversation_id: str) -> list[dict]:
    """Turn candidates into pending proposals. Nothing is saved as a memory."""
    proposals = []
    for candidate in detect_candidates(message, memory_service.list_memories()):
        try:
            proposals.append(
                memory_service.propose_memory(
                    candidate["content"],
                    candidate["category"],
                    candidate["replaces_memory_id"],
                    conversation_id,
                )
            )
        except memory_service.MemoryServiceError:
            # Already saved, already pending, or rejected before: do not nag.
            continue
    return proposals