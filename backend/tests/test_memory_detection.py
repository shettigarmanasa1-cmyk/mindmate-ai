from app.memory_detection import detect_candidates


def contents(message, existing=()):
    return [c["content"] for c in detect_candidates(message, existing)]


def test_detects_preference():
    result = detect_candidates("I prefer Java for backend work")
    assert [c["content"] for c in result] == ["User prefers Java for backend work"]
    assert result[0]["category"] == "preference"


def test_detects_learning_and_project():
    assert contents("I'm learning FastAPI.") == ["User is learning FastAPI"]
    assert contents("I am building a chatbot, and it is fun") == ["User is building a chatbot"]


def test_detects_goal():
    result = detect_candidates("My goal is to get an AI job.")
    assert [c["content"] for c in result] == ["User's goal is to get an AI job"]
    assert result[0]["category"] == "goal"


def test_detects_explicit_remember_request():
    result = detect_candidates("Please remember that I prefer short answers.")
    assert [c["content"] for c in result] == ["User prefers short answers"]
    assert result[0]["category"] == "preference"
    assert contents("Remember that my favorite editor is VS Code") == [
        "The user's favorite editor is VS Code"
    ]


def test_questions_are_ignored():
    assert contents("Do I prefer Python or Java?") == []
    assert contents("Should I prefer Java?") == []


def test_sensitive_sentences_are_ignored():
    assert contents("Remember that my password is hunter2") == []
    assert contents("I prefer Java, my email is a@b.com") == []
    assert contents("Remember my phone number is 98765 43210") == []


def test_ordinary_messages_have_no_candidates():
    assert contents("What is a Python list?") == []
    assert contents("Thanks, that helps!") == []


def test_change_words_propose_replacing_a_single_old_preference():
    old = [{"id": "m1", "content": "User prefers Python"}]
    changed = detect_candidates("I now prefer Java", old)[0]
    assert changed["content"] == "User prefers Java"
    assert changed["replaces_memory_id"] == "m1"

    # No change word: it is proposed as a new memory, not a replacement.
    assert detect_candidates("I prefer Java", old)[0]["replaces_memory_id"] is None

    # Two possible old memories: too uncertain to pick one.
    two = old + [{"id": "m2", "content": "User prefers dark mode"}]
    assert detect_candidates("I now prefer Java", two)[0]["replaces_memory_id"] is None