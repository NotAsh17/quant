# Handoff — Resuming work on this repo

This file gives a new chat full context so you don't lose anything. Last update: after the data layer was restructured from 7 flat topics to 4 sections → subtopics → tests, with Geometry's 15 OCR'd tests added.

## What's in this repo right now

```
docs/
  index.html                  SPA shell
  css/style.css               design system (Inter + IBM Plex Serif/Mono, off-white + true-dark themes)
  js/app.js                   main SPA — currently still consumes the OLD flat schema (see "What's next")
  js/storage.js               localStorage wrapper
  data/
    questions.json            110 tests / 1112 questions / 4 sections / hierarchical (NEW)
    solutions/<test_id>.json  per-test answer keys (only 1 file so far, more to come)
  tools/
    generate_solutions.py     Anthropic-API script — already updated for the new schema
  images/                     386 question figures (math equations, diagrams)
```

## Question bank — current state

**110 tests, 1112 questions, 4 sections**:

```
Arithmetic    53 tests / 541 Q / 6 subtopics
Algebra       29 tests / 290 Q / 7 subtopics
Numbers       13 tests / 135 Q / 1 subtopic  (OCR'd from videos)
Geometry      15 tests / 146 Q / 1 subtopic  (OCR'd from videos)
```

Schema (`docs/data/questions.json`):
```json
{
  "meta": { "total_tests": 110, "total_questions": 1112, ... },
  "sections": {
    "Arithmetic": {
      "Percentages & Profit-Loss": [ <test>, <test>, ... ],
      "Ratios & Partnerships":     [ ... ],
      ...
    },
    "Algebra":  { ... },
    "Numbers":  { "Numbers": [ ... ] },
    "Geometry": { "Geometry": [ ... ] }
  }
}
```

Per test:
```json
{
  "test_id":    "ACE-AVERAGES-TEST---1_msg414",
  "title":      "AIM 99+ IN CAT 2025 | ACE AVERAGES TEST - 1",
  "topic":      "Averages & Alligations",
  "subtopic_id":"Averages-Alligations",
  "section":    "Arithmetic",
  "n_questions":10,
  "timer_min":  30,
  "source":     "html" | "ocr",
  "questions":  [ { "n":1, "type":"mcq"|"tita", "stem_text":"...",
                    "stem_images":[...], "options":[...], "marks_correct":3, "marks_negative":1 } ]
}
```

## Solutions — where we are

- One sample solution file lives in `docs/data/solutions/` to validate format
- Format: `{ "1": {"answer": "B", "solution": "Step 1...\nStep 2..." }, ... }`
- For MCQ, `answer` is the letter A/B/C/D; for TITA, the exact value
- Solver script (`docs/tools/generate_solutions.py`) is ready to fill in the rest

## How to generate solutions

```bash
cd docs
export ANTHROPIC_API_KEY=sk-ant-...

# Optionally bump model (Sonnet 4.5 is the default — Sonnet 4.7 is the latest stable):
export CLAUDE_MODEL=claude-sonnet-4-7

# Run topic-by-topic, in your study order. Each topic ≈ $1.50-4 with --vision.
python tools/generate_solutions.py --topic "Percentages & Profit-Loss" --vision
python tools/generate_solutions.py --topic "Ratios & Partnerships"     --vision
python tools/generate_solutions.py --topic "SI & CI"                   --vision
# ... etc

# Or by section:
python tools/generate_solutions.py --section Arithmetic --vision

# Or everything in one go (~$10-15 total):
python tools/generate_solutions.py --all --vision

# Resume safely — already-solved questions are skipped automatically.
python tools/generate_solutions.py --missing --vision
```

Subtopic names (use these with `--topic`):

Arithmetic:
- `Percentages & Profit-Loss`
- `Ratios & Partnerships`
- `SI & CI`
- `Time, Speed & Distance`
- `Time & Work`
- `Averages & Alligations`

Algebra:
- `Basics of Algebra & Inequalities`
- `Modulus`
- `Logarithms`
- `Sequences & Series`
- `Quadratic & Higher Degree`
- `Functions & Graphs`
- `Linear & Special Equations`

Numbers:
- `Numbers`

Geometry:
- `Geometry`

## What's next (priority order)

### 1. Run solutions for the topics you're studying (highest priority)
The user is preparing topic-by-topic. As each topic's solutions land, they can practice with full answer keys.

### 2. Update `docs/js/app.js` to consume the new hierarchical schema
**Current state:** app.js iterates `DATA.topics` (legacy schema). The new questions.json doesn't have `.topics` — it has `.sections`. So **the site is currently broken until app.js is updated**.

Minimum changes needed:
- `renderDashboard()` — iterate `DATA.sections` instead of `DATA.topics`. Render 4 section cards, OR group subtopic cards under section headers.
- `renderTopic()` — `state.topicId` should look up by `subtopic_id`. Walk `DATA.sections.<section>.<topic>` to find tests.
- `getTestById()` — walk `Object.values(DATA.sections).flatMap(s => Object.values(s)).flat()` instead of `DATA.topics`.
- `TOPIC_IDS` and `ICONS` constants need expansion to cover the new subtopics (currently has 7, we now have 15).

### 3. Fix dark mode text visibility
CSS in `docs/css/style.css` has `[data-theme="dark"]` overrides for some selectors but misses others. Audit every text-color use and add a dark-mode rule. Specifically:
- Question stem in modal
- Palette legend
- Results-screen rows
- Solution text

### 4. (Maybe) Add answer review on results screen
After solutions land, the results screen should show:
- The user's selected answer
- The correct answer
- The step-by-step solution (collapsed by default)
This data is already in `data/solutions/<test_id>.json`, just no UI yet.

## How the local pipeline works (for reference)

Source data lives at `C:\Users\Not Ash\Downloads\cat-course\` with these tools:

- `tools/parse_test.py` — HTML test files → canonical JSON
- `tools/ocr_video_tests.py` — small mp4 question videos → canonical JSON (for Numbers + Geometry where no HTML exists)
- `tools/build_question_bank.py` — combine HTML + OCR JSONs → `question_bank.json` (canonical, 4-section)
- `tools/export_site_questions.py` — `question_bank.json` → `question_bank_site.json` (site-shape, hierarchical) → push to repo as `docs/data/questions.json`

If new tests are added later or OCR is re-run, regenerate the site bank with:
```bash
cd C:\Users\Not Ash\Downloads\cat-course\tools
py build_question_bank.py
py export_site_questions.py
cp ../question_bank_site.json /path/to/quant/docs/data/questions.json
```

## Known gaps / quirks

- **Numbers OCR has no TITA detection**: All 135 Numbers questions are tagged `mcq` because the OCR couldn't distinguish typed-input from option-click in screenshots. Real distribution is probably ~60% MCQ / 40% TITA based on the HTML topics. A short manual pass through the rendered PDFs could reclassify if needed.
- **Geometry OCR has the same gap** but most Geometry questions in this set ARE MCQ (we hit 27 TITAs which is unusually high for OCR — those came from frames where no options were visible, not actual TITAs). Treat the auto-tag with some skepticism.
- **Image-only questions**: For 247 questions, the stem is purely a CloudFront-hosted PNG (math expression or figure). Solving these requires `--vision` mode, which is more expensive than text-only.
- **31% of all questions have at least one image** (in stem or options).
