"""Hand a chat agent the next batch of unsolved questions.

The chat agent solves them using its own model inference (no Anthropic API
call needed) and writes the answers back to data/solutions/<test_id>.json.

Usage (run before each batch):
    python tools/next_questions.py                       # next 5 from next-recommended topic
    python tools/next_questions.py --topic "Logarithms"  # next 5 from a specific topic
    python tools/next_questions.py --limit 10            # bigger batch
    python tools/next_questions.py --test ACE-RATIO-TEST---1_msg378

Output: a single JSON object the agent reads, solves, then writes back to:
    data/solutions/<test_id>.json     # one file per test
"""
import argparse, json, sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
QBANK = ROOT / "data" / "questions.json"
SOL = ROOT / "data" / "solutions"
IMG_ROOT = ROOT  # image paths in stem_images are relative to docs/


def iter_tests(data):
    if "sections" in data:
        for section, subtopics in data["sections"].items():
            for topic, tests in subtopics.items():
                for t in tests:
                    yield section, topic, t
    else:
        for topic, tests in data.get("topics", {}).items():
            for t in tests:
                yield None, topic, t


def load_solutions(test_id):
    p = SOL / f"{test_id}.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic")
    ap.add_argument("--section")
    ap.add_argument("--test")
    ap.add_argument("--limit", type=int, default=5)
    args = ap.parse_args()

    if not QBANK.exists():
        print(f"missing {QBANK}", file=sys.stderr)
        sys.exit(1)
    data = json.loads(QBANK.read_text(encoding="utf-8"))

    candidates = []
    for section, topic, t in iter_tests(data):
        if args.section and section != args.section:
            continue
        if args.topic and topic != args.topic:
            continue
        if args.test and t["test_id"] != args.test:
            continue
        sols = load_solutions(t["test_id"])
        unsolved = [
            q for q in t["questions"]
            if str(q["n"]) not in sols or not sols[str(q["n"])].get("answer")
        ]
        if unsolved:
            candidates.append((section, topic, t, unsolved))

    if not candidates:
        print(json.dumps({"done": True, "message": "Everything matching the filter is solved. Run status.py."}))
        return

    section, topic, test, unsolved = candidates[0]
    batch = unsolved[: args.limit]

    def abs_img(p):
        return str((IMG_ROOT / p).resolve()).replace("\\", "/")

    out = {
        "instructions": (
            "Solve each question below. For MCQ, 'answer' is the letter A/B/C/D matching the option you select. "
            "For TITA, 'answer' is the exact value (e.g. '30', '0.5', '11'). 'solution' is a clear 3-7 step "
            "derivation using arrow between steps. Write the solutions JSON to the path in 'write_to'. "
            "Then run `python tools/next_questions.py` again for the next batch. "
            "When the whole topic is done, commit + push."
        ),
        "write_to": str((SOL / f"{test['test_id']}.json").resolve()).replace("\\", "/"),
        "existing_solutions": load_solutions(test["test_id"]),
        "test": {
            "test_id": test["test_id"],
            "title":   test["title"],
            "section": section,
            "topic":   topic,
        },
        "progress": {
            "topic_section":              f"{section} / {topic}",
            "this_test_done":             len(test["questions"]) - len(unsolved),
            "this_test_total":            len(test["questions"]),
            "this_batch":                 len(batch),
            "this_test_remaining_after":  len(unsolved) - len(batch),
            "other_tests_in_topic_with_gaps": sum(1 for c in candidates if c[1] == topic) - 1,
        },
        "questions": [],
    }

    for q in batch:
        out["questions"].append({
            "n":           q["n"],
            "type":        q["type"],
            "stem":        q.get("stem_text", ""),
            "stem_images": [abs_img(p) for p in q.get("stem_images") or []],
            "options": [
                {
                    "letter": chr(65 + i),
                    "text":   o.get("text", ""),
                    "images": [abs_img(p) for p in o.get("images") or []],
                }
                for i, o in enumerate(q.get("options") or [])
            ],
        })

    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
