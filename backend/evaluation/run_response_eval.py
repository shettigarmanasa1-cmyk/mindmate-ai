import json
import statistics
import time
from datetime import datetime
from pathlib import Path

from app import llm_service
from app.config import settings
from app.memory_context import build_memory_message
from app.memory_retrieval import rank_memories
from app.memory_service import extract_keywords

HERE = Path(__file__).parent
REPEATS = 3
PAUSE_SECONDS = 3

# All fictional. Success is a crude text check, see the notes in the README.
SCENARIOS = [
    {
        "id": "s1",
        "what": "Relevant memory shapes the answer",
        "memories": ["User's chatbot project uses SQLite"],
        "question": "How should I design the tables for my chatbot project?",
        "must_contain_any": ["sqlite"],
        "must_not_contain": [],
    },
    {
        "id": "s2",
        "what": "Stated preference is respected",
        "memories": ["User prefers Java for backend work"],
        "question": "Which framework should I use for my backend work?",
        "must_contain_any": ["java", "spring"],
        "must_not_contain": [],
    },
    {
        "id": "s3",
        "what": "Goal memory is used for advice",
        "memories": ["User is preparing for a data engineer interview"],
        "question": "Give me some interview tips",
        "must_contain_any": ["data engineer", "data engineering"],
        "must_not_contain": [],
    },
    {
        "id": "s4",
        "what": "Unrelated memory is ignored",
        "memories": ["User likes spicy food"],
        "question": "Explain how Python decorators work",
        "must_contain_any": ["decorator"],
        "must_not_contain": ["spicy"],
    },
    {
        "id": "s5",
        "what": "No memory: the AI should not invent facts",
        "memories": [],
        "question": "Which programming language do I prefer?",
        "must_contain_any": [
            "don't know", "do not know", "don't have", "not sure", "haven't",
            "tell me", "let me know", "no way to know", "can't know", "cannot know",
            "i don't", "i do not",
        ],
        "must_not_contain": [],
    },
    {
        "id": "s6",
        "what": "Uses the relevant memory, ignores the unrelated one",
        "memories": ["User is learning guitar", "User's chatbot project uses SQLite"],
        "question": "Help me plan the database for my chatbot project",
        "must_contain_any": ["sqlite"],
        "must_not_contain": ["guitar"],
    },
]


def ask(history):
    """One model call. Retries once if the free tier says 'busy'."""
    for attempt in range(2):
        start = time.perf_counter()
        try:
            reply = llm_service.generate_reply(history)
            return reply, time.perf_counter() - start, None
        except llm_service.LLMError as error:
            if error.status_code == 429 and attempt == 0:
                time.sleep(20)
                continue
            return None, None, error.message
    return None, None, "gave up"


def passes(scenario, reply):
    text = reply.lower().replace("\u2019", "'")
    needed = scenario["must_contain_any"]
    if needed and not any(word in text for word in needed):
        return False
    return not any(word in text for word in scenario["must_not_contain"])


def run_once(scenario, mode):
    memories = [
        {
            "id": f"{scenario['id']}-{i}",
            "content": text,
            "keywords": extract_keywords(text),
            "updated_at": "2026-01-01",
        }
        for i, text in enumerate(scenario["memories"])
    ]
    relevant = rank_memories(scenario["question"], memories) if mode == "on" else []
    history = [{"role": "user", "content": scenario["question"]}]
    memory_message = build_memory_message(relevant)
    if memory_message:
        history = [memory_message] + history

    reply, seconds, error = ask(history)
    return {
        "provided": [m["content"] for m in relevant],
        "ok": None if error else passes(scenario, reply),
        "seconds": seconds,
        "error": error,
        "reply": (reply or "")[:400],
    }


def main():
    if settings.openai_api_key in ("", "your-key-here"):
        print("No API key configured in backend/.env. Stopping.")
        return

    total = len(SCENARIOS) * 2 * REPEATS
    print(f"Model: {settings.openai_model}")
    print(f"Running {total} calls with a {PAUSE_SECONDS}s pause. This takes a few minutes.")

    results = {"on": {}, "off": {}}
    done = 0
    for scenario in SCENARIOS:
        for mode in ("on", "off"):
            runs = []
            for _ in range(REPEATS):
                runs.append(run_once(scenario, mode))
                done += 1
                print(f"\r{done}/{total} calls done", end="", flush=True)
                time.sleep(PAUSE_SECONDS)
            results[mode][scenario["id"]] = runs
    print("\n")

    def counts(runs):
        finished = [r for r in runs if r["error"] is None]
        return sum(1 for r in finished if r["ok"]), len(finished)

    print(f"{'ID':<5}{'ON':<8}{'OFF':<8}{'PROVIDED(ON)':<14}WHAT")
    totals = {"on": [0, 0], "off": [0, 0]}
    for scenario in SCENARIOS:
        on_ok, on_done = counts(results["on"][scenario["id"]])
        off_ok, off_done = counts(results["off"][scenario["id"]])
        totals["on"][0] += on_ok
        totals["on"][1] += on_done
        totals["off"][0] += off_ok
        totals["off"][1] += off_done
        provided = len(results["on"][scenario["id"]][0]["provided"])
        print(f"{scenario['id']:<5}{f'{on_ok}/{on_done}':<8}{f'{off_ok}/{off_done}':<8}{provided:<14}{scenario['what']}")

    print()
    summary = {}
    for mode in ("on", "off"):
        ok, finished = totals[mode]
        runs = [r for per in results[mode].values() for r in per]
        times = [r["seconds"] for r in runs if r["seconds"] is not None]
        errors = sum(1 for r in runs if r["error"])
        summary[mode] = {
            "task_success": f"{ok}/{finished}",
            "task_success_rate": round(ok / finished, 3) if finished else None,
            "errors": errors,
            "latency_median_s": round(statistics.median(times), 2) if times else None,
            "latency_max_s": round(max(times), 2) if times else None,
        }
        rate = f"{ok / finished:.1%}" if finished else "n/a"
        median = f"{summary[mode]['latency_median_s']}s" if times else "n/a"
        slowest = f"{summary[mode]['latency_max_s']}s" if times else "n/a"
        print(f"Memory {mode.upper():<4} success {ok}/{finished} ({rate}), errors {errors}, median latency {median}, slowest {slowest}")

    out = {
        "measured_at": datetime.now().isoformat(timespec="seconds"),
        "model": settings.openai_model,
        "provider_url": settings.openai_base_url or "default",
        "repeats": REPEATS,
        "summary": summary,
        "scenarios": SCENARIOS,
        "results": results,
    }
    (HERE / "response_results.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("\nSaved: backend/evaluation/response_results.json")


if __name__ == "__main__":
    main()
