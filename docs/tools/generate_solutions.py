"""
generate_solutions.py
=====================
Generate AI-authored solutions for the CAT-quant question bank using the
Anthropic API. Writes one JSON file per test into ../data/solutions/.

Usage
-----
    export ANTHROPIC_API_KEY=sk-ant-...
    python tools/generate_solutions.py --topic "Averages & Alligations"
    python tools/generate_solutions.py --test "Numbers Test 1_msg498"
    python tools/generate_solutions.py --all          # all 95 tests
    python tools/generate_solutions.py --missing      # only tests without solutions

Each solution file looks like:
    {
      "1": { "answer": "B",     "solution": "Step 1...\nStep 2..." },
      "2": { "answer": "0.5",   "solution": "..." }
    }

For MCQ, `answer` is the letter (A/B/C/D).
For TITA, `answer` is the numeric/string answer.

Image-only questions are skipped; they need a vision-capable run, which is
also supported when --vision is passed.
"""

import argparse, base64, json, os, sys, time
from pathlib import Path

try:
    from anthropic import Anthropic
except ImportError:
    print("Install: pip install anthropic", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "questions.json"
SOL_DIR = ROOT / "data" / "solutions"
IMAGE_ROOT = ROOT  # paths in stem_images are like "images/<hash>/<file>"

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
# Bump via:  export CLAUDE_MODEL=claude-sonnet-4-7   (latest as of 2026)

PROMPT = """You are an expert CAT (Common Admission Test) Quantitative Aptitude solver.

For the question below, return a JSON object with exactly two keys:
- "answer":   for MCQ, the option letter "A", "B", "C", or "D"; for TITA, the
              exact numeric/string answer (e.g., "30", "0.5", "11").
- "solution": a clear step-by-step explanation, suitable for a student.
              Use plain text. Use "→" for derivation steps. Keep it concise
              (3-7 short steps).

Return ONLY the JSON, no preamble.

Question type: {qtype}
Marks: +{mp} / -{mn}

Question:
{stem}

{options_block}
"""


def load_data():
    return json.loads(DATA.read_text(encoding="utf-8"))


def iter_tests(data):
    """Yield (section, topic, test) for every test, supporting both schemas:
    new {sections: {Section: {Subtopic: [tests]}}}  and legacy {topics: {...}}.
    """
    if "sections" in data:
        for section_name, subtopics in data["sections"].items():
            for topic_name, tests in subtopics.items():
                for t in tests:
                    yield section_name, topic_name, t
    else:
        for tname, tests in data.get("topics", {}).items():
            for t in tests:
                yield None, tname, t


def find_test(data, test_id=None, topic=None, section=None, subtopic=None):
    """Filter tests by any combination of test_id / topic / section / subtopic.
    Yields (topic_name, test) pairs."""
    for section_name, topic_name, t in iter_tests(data):
        if test_id and t["test_id"] != test_id:
            continue
        if topic and topic_name != topic:
            continue
        if section and section_name != section:
            continue
        if subtopic and topic_name != subtopic and t.get("subtopic_id") != subtopic:
            continue
        yield topic_name, t


def encode_image(rel_path):
    p = IMAGE_ROOT / rel_path
    if not p.exists():
        return None
    return base64.b64encode(p.read_bytes()).decode()


def build_prompt(q, vision=False):
    options_block = ""
    if q["type"] == "mcq":
        opts = []
        for i, o in enumerate(q.get("options", [])):
            letter = chr(65 + i)
            text = o.get("text") or ("[image]" if o.get("images") else "")
            opts.append(f"({letter}) {text}")
        options_block = "Options:\n" + "\n".join(opts)
    return PROMPT.format(
        qtype=q["type"].upper(),
        mp=q["marks_correct"],
        mn=q["marks_negative"],
        stem=q.get("stem_text") or "[See image]",
        options_block=options_block,
    )


def solve_one(client, q, vision=False):
    """Returns dict with answer + solution, or None on error."""
    text_prompt = build_prompt(q)

    # Build content blocks: text + any images if vision enabled
    content = [{"type": "text", "text": text_prompt}]
    if vision:
        for img_path in q.get("stem_images", []):
            data = encode_image(img_path)
            if data is None:
                continue
            ext = Path(img_path).suffix.lstrip(".").lower()
            mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(ext, "image/png")
            content.insert(0, {
                "type": "image",
                "source": {"type": "base64", "media_type": mime, "data": data},
            })
        for o in q.get("options", []):
            for img_path in o.get("images", []):
                data = encode_image(img_path)
                if data is None: continue
                ext = Path(img_path).suffix.lstrip(".").lower()
                mime = {"png":"image/png","jpg":"image/jpeg","jpeg":"image/jpeg"}.get(ext, "image/png")
                content.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": mime, "data": data},
                })

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": content}],
        )
        text = resp.content[0].text.strip()
        # Strip markdown code fence if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            if text.startswith("json"):
                text = text[4:].lstrip()
        return json.loads(text)
    except Exception as e:
        print(f"  ERROR: {e}", file=sys.stderr)
        return None


def needs_vision(q):
    """Question requires the image to be solvable."""
    has_text = bool(q.get("stem_text") and len(q["stem_text"].strip()) > 8)
    has_image = bool(q.get("stem_images")) or any(o.get("images") for o in q.get("options", []))
    return has_image and not has_text


def solve_test(client, test, vision=False, force=False):
    """Generate solutions for one test."""
    out_path = SOL_DIR / f"{test['test_id']}.json"
    SOL_DIR.mkdir(parents=True, exist_ok=True)
    existing = {}
    if out_path.exists() and not force:
        existing = json.loads(out_path.read_text(encoding="utf-8"))

    print(f"\n→ {test['test_id']} ({len(test['questions'])} q)")
    for q in test["questions"]:
        key = str(q["n"])
        if key in existing and existing[key].get("answer"):
            print(f"  Q{q['n']}: skipped (already have answer)")
            continue
        if needs_vision(q) and not vision:
            print(f"  Q{q['n']}: skipped (vision required, run with --vision)")
            continue
        sol = solve_one(client, q, vision=vision)
        if sol and "answer" in sol:
            existing[key] = sol
            print(f"  Q{q['n']}: {sol.get('answer')!r}")
            # Persist incrementally so we never lose progress
            out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False), encoding="utf-8")
        time.sleep(0.4)  # gentle pacing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--section",  help="One of: Arithmetic | Algebra | Numbers | Geometry")
    ap.add_argument("--topic",    help="Subtopic display name, e.g. 'Percentages & Profit-Loss'")
    ap.add_argument("--subtopic", help="Alias for --topic, or pass folder id like 'Percentages-Profit-Loss'")
    ap.add_argument("--test")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--missing", action="store_true",
                    help="Only tests without an existing solution file")
    ap.add_argument("--vision", action="store_true",
                    help="Send images for image-only questions (more expensive)")
    ap.add_argument("--force", action="store_true",
                    help="Overwrite already-solved questions")
    args = ap.parse_args()

    if not (args.topic or args.test or args.all or args.missing or args.section or args.subtopic):
        ap.print_help()
        return

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Set ANTHROPIC_API_KEY env var first.", file=sys.stderr)
        sys.exit(1)

    client = Anthropic()
    data = load_data()
    tests_to_run = []
    only_filters_active = not (args.all or args.missing)
    for _, t in find_test(
        data,
        test_id=args.test,
        topic=args.topic if only_filters_active else None,
        section=args.section if only_filters_active else None,
        subtopic=args.subtopic if only_filters_active else None,
    ):
        if args.missing:
            sol_path = SOL_DIR / f"{t['test_id']}.json"
            if sol_path.exists():
                continue
        tests_to_run.append(t)

    if not tests_to_run:
        print("Nothing to do.")
        return
    print(f"Running over {len(tests_to_run)} test(s)...")
    for t in tests_to_run:
        solve_test(client, t, vision=args.vision, force=args.force)
    print("\nDone.")


if __name__ == "__main__":
    main()
