# CAT Quant

A static practice site for the RODHA CAT 2025 quant test bank — 95 timed tests, 966 questions, 7 topics. Designed for two users (you + your friend) on a free GitHub Pages + Supabase stack.

## Run locally

The site is pure static — no build step. Just serve the `site/` folder.

```bash
# Python
python -m http.server 8000 --directory site

# Or Node
npx http-server site -p 8000
```

Open http://localhost:8000.

## Deploy to GitHub Pages

1. Push the `site/` folder contents (or the whole repo) to GitHub.
2. Repo → Settings → Pages → set source to the `main` branch (root), or to `/site/` if you keep it as a subfolder.
3. After a minute, your site is live at `https://<user>.github.io/<repo>/`.

## Folder layout

```
site/
  index.html         single-page app entry
  css/style.css      design system
  js/
    app.js           main SPA logic
    storage.js       localStorage wrapper
  data/
    questions.json   all 966 questions (parsed from the source PDF)
    solutions/       per-test answer + step-by-step JSON files
  images/            386 question figures (math equations, diagrams)
```

## Data

`data/questions.json` is the source of truth for the test bank. Schema:

```jsonc
{
  "meta": { ... },
  "topics": {
    "Algebra": [
      {
        "test_id": "ALGEBRA-Test-1-Inequalities_msg473",
        "title":   "AIM 99+ IN CAT 2025 | ACE ALGEBRA - Test 1 | Inequalities",
        "n_questions": 10,
        "timer_min": 30,
        "topic": "Algebra",
        "questions": [
          {
            "n": 1,
            "type": "mcq",  // or "tita"
            "stem_text": "...",
            "stem_images": ["images/<hash>/<file>.png"],
            "options": [{"text": "...", "images": []}, ...],
            "marks_correct": 3,
            "marks_negative": 1
          }
        ]
      }
    ]
  }
}
```

## Solutions

Solutions are stored per test in `data/solutions/<test_id>.json`. Schema:

```jsonc
{
  "1": { "answer": "B",     "solution": "Step 1...\nStep 2..." },
  "2": { "answer": "0.5",   "solution": "..." },
  ...
}
```

For MCQ, `answer` is the letter (A, B, C, D) or zero-indexed integer.
For TITA, `answer` is the numeric/string value.

The site loads each test's solutions lazily when the user opens the review screen. Tests without solutions show a "Solution coming" placeholder — the rest of the site still works.

## Generating solutions

Solutions are AI-generated. To re-run:

```bash
python tools/generate_solutions.py --topic Algebra
python tools/generate_solutions.py --all
```

(See `tools/generate_solutions.py` — set your API key as `ANTHROPIC_API_KEY`.)

## Cross-device sync (optional Supabase)

By default everything's stored in `localStorage` — works offline, no account needed.

To sync attempts and bookmarks across devices (you + a friend), see `SUPABASE.md`.

## Two-user setup

This site has no auth flow by default — anyone with the URL can see it. Since it's just for you and one friend:
- Either keep the repo private and share the GitHub Pages link, or
- Add the optional Supabase setup, which gives each user their own progress.

## Tech notes

- No build step, no bundler. Vanilla JS, single CSS file.
- Hash routing (`#/topic/algebra`, `#/test/<id>`, etc.) so it works on plain GitHub Pages.
- Question stems set in IBM Plex Serif for readable math; UI is Inter.
- Default theme is dark; user setting is remembered.
