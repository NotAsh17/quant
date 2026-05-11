# Solving questions directly in a Claude chat (no API key)

If you have a Claude Pro / Claude Code subscription but no Anthropic API key,
you (the chat agent) can solve questions **using your own model inference** —
no API call, no key, no extra spending beyond your chat tokens.

This is the alternative to `tools/generate_solutions.py`. Each batch of
5-10 questions costs ~1 chat turn.

## The protocol (every batch)

```bash
# 1. See overall progress
python tools/status.py

# 2. Get the next batch (default 5 questions; pass --limit to change)
python tools/next_questions.py
#   OR
python tools/next_questions.py --topic "Logarithms" --limit 10
```

The JSON output has:
- `write_to`           — the exact file path to write the solutions file to
- `existing_solutions` — dict of already-answered questions (preserve them!)
- `questions[]`        — the unsolved ones in this batch
- `progress`           — counters so you know how much is left

## Your job (the agent)

For each question in `questions[]`:

1. Read `stem` (the question text).
2. If `stem_images` is non-empty: **use your Read tool on each path** to view the image (CloudFront PNG: the question rendered as math). The image IS the question.
3. If any `options[].images` is non-empty: Read each option's image too.
4. Solve the question. Reason briefly (3-7 steps, separator: `→` between steps).
5. Determine the answer:
   - **MCQ** — the option letter (`A` / `B` / `C` / `D`, etc.). The order in the array matches A, B, C, D…
   - **TITA** — the numeric/string value (e.g. `"30"`, `"0.5"`, `"11"`).

After solving the batch, **merge the new answers into `existing_solutions`** and write the combined dict to `write_to`. Format:

```json
{
  "1": { "answer": "B",   "solution": "Total = 8×60 = 480 → after swap sum 400 → new avg ≈ 66.67 → increase 11.11%. Answer: B." },
  "2": { "answer": "30",  "solution": "Setting c=b → 2b=60 → b=30. Answer: 30." }
}
```

Keys are stringified question numbers. Don't overwrite existing keys unless you intentionally re-solved them.

## Loop until the topic is done

```bash
python tools/next_questions.py   # get next batch
# solve, write file
python tools/next_questions.py   # next batch
# …
```

When `next_questions.py` returns `{"done": true, ...}` the topic (or the whole bank, if no --topic was given) is finished.

## End of session — always

```bash
git add docs/data/solutions
git commit -m "solutions: <what you did>, e.g. 'Logarithms 4/4 tests done'"
git push
```

The next agent on any account picks up via `git pull && python tools/status.py`.

## Tips

- **Stay inside one test** until it's done. `next_questions.py` already biases toward this — keeps each commit clean.
- **Don't fabricate.** If a question genuinely needs an image you can't load (path broken), put `"answer": null, "solution": "Cannot solve — image-only stem failed to load: <path>"`. Don't guess answers.
- **Math notation:** keep solutions in plain text. Unicode symbols (≤, ², √, π, →) are fine. Don't use LaTeX.
- **Concise:** 3-7 steps max. Students read these; brevity > prose.
- **Don't worry about the option letter ↔ index mapping.** The JSON already gives you `letter: "A"` etc. — just use whichever letter is correct.

## Comparison with the API path

| | Chat agent (this doc) | API script (`generate_solutions.py`) |
|---|---|---|
| Needs API key? | No — uses your chat session | Yes (`ANTHROPIC_API_KEY`) |
| Cost | Your Claude Pro/Code tokens | ~$10-15 for all 1112 questions |
| Throughput | ~10-30 Q per chat turn | ~30 Q per minute |
| Best for | Solving while you're studying — one topic per chat | Bulk filling at the end |

You can mix the two freely. Both write the same JSON format. The `status.py` script doesn't care which produced what.
