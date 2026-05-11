"""Per-topic / per-test progress for the solution bank.

Run this first when picking up where another agent left off. Prints:
  - tests fully solved
  - tests partially solved (so you can resume them)
  - tests not started
  - the recommended --topic / --section to run next

Pure read — no API calls, no writes.

Usage:
    python tools/status.py
    python tools/status.py --topic "Percentages & Profit-Loss"
    python tools/status.py --json   # machine-readable
"""
import argparse, json, sys
from pathlib import Path
from collections import defaultdict

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
QBANK = ROOT / "data" / "questions.json"
SOL = ROOT / "data" / "solutions"


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic")
    ap.add_argument("--section")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    if not QBANK.exists():
        print(f"bank not found: {QBANK}", file=sys.stderr)
        sys.exit(1)
    data = json.loads(QBANK.read_text(encoding="utf-8"))

    # Aggregate per (section, topic)
    agg = defaultdict(lambda: {
        "tests_total": 0, "tests_full": 0, "tests_partial": 0, "tests_empty": 0,
        "q_total": 0, "q_answered": 0,
        "tests_partial_ids": [], "tests_empty_ids": [],
    })

    total_q = 0
    total_answered = 0
    total_tests = 0
    fully_done_tests = 0

    for section, topic, t in iter_tests(data):
        if args.section and section != args.section: continue
        if args.topic and topic != args.topic: continue
        key = (section or "?", topic)
        n_q = t.get("n_questions") or len(t.get("questions") or [])
        sol_path = SOL / f"{t['test_id']}.json"
        if sol_path.exists():
            try:
                sols = json.loads(sol_path.read_text(encoding="utf-8"))
                n_answered = sum(1 for v in sols.values() if v.get("answer"))
            except Exception:
                n_answered = 0
        else:
            n_answered = 0

        agg[key]["tests_total"] += 1
        agg[key]["q_total"] += n_q
        agg[key]["q_answered"] += n_answered

        if n_answered == 0:
            agg[key]["tests_empty"] += 1
            agg[key]["tests_empty_ids"].append(t["test_id"])
        elif n_answered < n_q:
            agg[key]["tests_partial"] += 1
            agg[key]["tests_partial_ids"].append(f"{t['test_id']} ({n_answered}/{n_q})")
        else:
            agg[key]["tests_full"] += 1

        total_q += n_q
        total_answered += n_answered
        total_tests += 1
        if n_answered >= n_q: fully_done_tests += 1

    if args.json:
        out = {
            "totals": {
                "tests": total_tests, "tests_fully_done": fully_done_tests,
                "questions": total_q, "questions_answered": total_answered,
                "pct_done": round(total_answered/total_q*100, 1) if total_q else 0,
            },
            "by_topic": [
                {
                    "section": k[0], "topic": k[1],
                    **{kk: vv for kk, vv in v.items() if not kk.endswith("_ids")},
                    "next_partial": v["tests_partial_ids"][:3],
                    "next_untouched": v["tests_empty_ids"][:3],
                } for k, v in sorted(agg.items())
            ],
        }
        print(json.dumps(out, indent=2, ensure_ascii=False))
        return

    # Pretty print
    pct = round(total_answered / total_q * 100, 1) if total_q else 0
    print(f"\n{'='*78}")
    print(f"SOLUTION BANK STATUS — {total_answered}/{total_q} questions ({pct}%) · {fully_done_tests}/{total_tests} tests fully solved")
    print(f"{'='*78}\n")

    print(f"{'Section':<13} {'Subtopic':<40} {'Q done/total':>14} {'tests done':>14}")
    print("-" * 78)

    by_section = defaultdict(list)
    for (sec, topic), v in agg.items():
        by_section[sec].append((topic, v))

    next_recommendation = None
    for sec in ["Arithmetic", "Algebra", "Numbers", "Geometry"]:
        if sec not in by_section: continue
        for topic, v in sorted(by_section[sec]):
            qstr = f"{v['q_answered']}/{v['q_total']}"
            tstr = f"{v['tests_full']}/{v['tests_total']}"
            marker = ""
            if v['q_answered'] == 0:
                marker = " ⊘"   # not started
            elif v['q_answered'] < v['q_total']:
                marker = " …"   # partial
            else:
                marker = " ✓"   # done
            print(f"  {sec:<11} {topic:<40} {qstr:>14} {tstr:>14}{marker}")
            # Recommend the first not-fully-done topic as "what to run next"
            if next_recommendation is None and v['q_answered'] < v['q_total']:
                next_recommendation = (sec, topic, v)

    print()
    if next_recommendation:
        sec, topic, v = next_recommendation
        cmd = f'python tools/generate_solutions.py --topic "{topic}" --vision'
        print(f"NEXT — pick up where the previous agent left off:")
        print(f"  cd docs")
        print(f"  export ANTHROPIC_API_KEY=sk-ant-...")
        print(f"  {cmd}")
        if v["tests_partial_ids"]:
            print(f"\n  Partially-solved tests in this topic ({len(v['tests_partial_ids'])}):")
            for tid in v["tests_partial_ids"][:5]:
                print(f"    {tid}")
            if len(v["tests_partial_ids"]) > 5:
                print(f"    ... and {len(v['tests_partial_ids'])-5} more")
            print(f"  (The script auto-skips already-answered questions.)")
    else:
        print("EVERYTHING DONE — every question has an answer. Next step: update app.js to surface them.")

    print()


if __name__ == "__main__":
    main()
