import json
from datetime import datetime
from pathlib import Path

from app.memory_retrieval import rank_memories
from app.memory_service import extract_keywords

HERE = Path(__file__).parent


def ratio(top, bottom):
    return round(top / bottom, 3) if bottom else None


def show(value):
    return "n/a" if value is None else f"{value:.1%}"


def main():
    data = json.loads((HERE / "retrieval_dataset.json").read_text(encoding="utf-8-sig"))
    memories = [
        {
            "id": m["id"],
            "content": m["content"],
            "keywords": extract_keywords(m["content"]),
            "updated_at": "2026-01-01",
        }
        for m in data["memories"]
    ]

    retrieved_total = 0
    relevant_retrieved = 0
    relevant_total = 0
    no_memory_questions = 0
    false_triggers = 0
    cases = []

    print(f"{'ID':<5}{'RESULT':<8}{'EXPECTED':<12}{'GOT':<12}QUESTION")
    for case in data["questions"]:
        expected = set(case["expected"])
        got = [r["id"] for r in rank_memories(case["question"], memories)]
        got_set = set(got)

        retrieved_total += len(got_set)
        relevant_retrieved += len(expected & got_set)
        relevant_total += len(expected)
        if not expected:
            no_memory_questions += 1
            if got_set:
                false_triggers += 1

        result = "ok" if got_set == expected else "DIFF"
        cases.append(
            {
                "id": case["id"],
                "question": case["question"],
                "expected": sorted(expected),
                "got": got,
                "result": result,
            }
        )
        print(
            f"{case['id']:<5}{result:<8}"
            f"{','.join(sorted(expected)) or '-':<12}{','.join(got) or '-':<12}{case['question']}"
        )

    metrics = {
        "precision": ratio(relevant_retrieved, retrieved_total),
        "recall": ratio(relevant_retrieved, relevant_total),
        "false_trigger_rate": ratio(false_triggers, no_memory_questions),
        "questions": len(data["questions"]),
        "memories": len(memories),
        "relevant_retrieved": relevant_retrieved,
        "retrieved_total": retrieved_total,
        "relevant_total": relevant_total,
        "no_memory_questions": no_memory_questions,
        "false_triggers": false_triggers,
    }

    print()
    print(f"Precision:          {show(metrics['precision'])}  ({relevant_retrieved} of {retrieved_total} returned were correct)")
    print(f"Recall:             {show(metrics['recall'])}  ({relevant_retrieved} of {relevant_total} expected were found)")
    print(f"False-trigger rate: {show(metrics['false_trigger_rate'])}  ({false_triggers} of {no_memory_questions} no-memory questions returned something)")

    out = {"measured_at": datetime.now().isoformat(timespec="seconds"), "metrics": metrics, "cases": cases}
    (HERE / "retrieval_results.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("\nSaved: backend/evaluation/retrieval_results.json")


if __name__ == "__main__":
    main()
