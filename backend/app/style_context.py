STYLE_TEXT = {
    "professional": "Use a professional, polished tone.",
    "casual": "Use a casual, relaxed tone.",
}
LENGTH_TEXT = {
    "short": "Keep answers short and to the point.",
    "detailed": "Give detailed, thorough answers.",
}
BEGINNER_TEXT = (
    "Explain things in simple, beginner-friendly language and define technical terms."
)


def build_style_message(settings: dict) -> dict | None:
    """Turn the user's chosen settings into an instruction. None if all are default."""
    lines = []
    if settings["response_style"] in STYLE_TEXT:
        lines.append(STYLE_TEXT[settings["response_style"]])
    if settings["answer_length"] in LENGTH_TEXT:
        lines.append(LENGTH_TEXT[settings["answer_length"]])
    if settings["beginner_friendly"]:
        lines.append(BEGINNER_TEXT)
    if not lines:
        return None
    content = "The user chose these response settings. Follow them:\n" + "\n".join(
        f"- {line}" for line in lines
    )
    return {"role": "system", "content": content}