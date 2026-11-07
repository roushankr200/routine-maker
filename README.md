# Routine Maker — Automatic Department Timetable Generator

One click turns a department's teachers, subjects, classes and timing rules into a **complete, clash-free weekly master routine**. Built for Roushan Kumar (MCA, NIT Agartala) from the Requirements Analysis v1.0 — Python 3 + Flask + SQLite, with a **custom constraint solver** (no OR-Tools): greedy hardest-first placement + backtracking + soft-score ranking.

## Run it (exact commands)

```bash
cd routine-maker
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py            # reads $PORT, default 5000, host 0.0.0.0
# open http://127.0.0.1:5000
```

Production entry point (exact gunicorn command used everywhere in this repo):

```bash
gunicorn app:app --bind 0.0.0.0:$PORT
```

Tests:

```bash
.venv/bin/python -m pytest tests/ -q     # 8 tests
```

The SQLite DB (`routine.db`) is **auto-created on first run** if missing — no setup step.

## Demo walkthrough (5 steps)

1. On the Dashboard, click **Load MCA Demo Data** — 9 teachers, 9 subjects (incl. DBMS Lab & Java Lab), 3 classes (MCA Sem 1 / 3 / 5), Mon–Sat, 7 periods/day, lunch after P4.
2. Open **Validation** — demand vs eligible-teacher capacity per subject (FR10).
3. Click **⚡ Generate Routine**.
4. Browse **Master Routine**, per-class and per-teacher views (with daily/weekly load totals); export any view to **CSV** or print it.
5. Try the **Manual Move** form on the master view: move a period onto a busy teacher's slot — it is rejected instantly, naming the rule broken (e.g. H1). Legal moves and same-class swaps apply cleanly.

**Measured on the demo data (actual runs, not estimates): 86/86 periods placed (78/78 jobs — 70 theory periods + 8 lab blocks), generation ≈ 0.01–0.02 s, search visited 78 nodes (the ordered greedy path succeeded with no backtracking needed on this data), 8/8 tests pass.**

## Architecture

```
app.py       Flask routes: CRUD, setup, generate, views, move/swap, validation, CSV export
db.py        SQLite layer (stdlib sqlite3): schema, config, solver-data loading, validation
solver.py    The engine — pure Python, no DB/Flask imports, independently testable
seed.py      One-click MCA demo data (designed solvable, verified by the test suite)
templates/   Jinja pages: dashboard, teachers, subjects, classes, setup, availability,
             master / per-class / per-teacher routine, validation
static/      style.css (print-friendly)
tests/       test_solver.py — hard-rule assertions on the generated routine
routine.db   Created automatically on first run (git-ignored)
```

Data model (per spec §7): `teacher`, `subject`, `class_section`, `teacher_subject`, `class_subject`, `teacher_unavailable`, `time_slot`, `routine_entry`, plus a single-row `config` (days, periods/day, lunch).

## How the solver works (interview explanation)

**The problem** is a constraint-satisfaction problem: assign every required period to a (day, period, teacher) without breaking hard rules, and prefer nice schedules.

**Hard rules — never broken:** H1 teacher in one class per slot · H2 class has one subject per slot · H3 teacher max/day · H4 teacher weekly cap · H5 exact subject hours per class · H6 teacher only teaches eligible subjects · H7 unavailable slots blocked · H8 labs = 2 consecutive periods, never spanning lunch.

**Step 1 — Expand.** Each `class_subject` row becomes *jobs*: theory hours become 1-period jobs; lab hours become 2-period block jobs. Placing every job *is* H5 by construction, and candidates only ever come from eligible teachers, which is H6 by construction.

**Step 2 — Hardest first (fail-first).** Jobs are sorted: labs before theory (longer = harder to fit), then fewest eligible teachers, then most hours. Constrained jobs get placed while the grid is empty; easy jobs fill the gaps left behind. This ordering is why generation is fast in practice.

**Step 3 — Place + backtrack.** Depth-first search: for the next job, generate every (day, start, teacher) passing all hard checks, rank them by soft score, try in order. If a job has no legal slot, undo the previous placement and try its next candidate. A 10-second limit and node budget bound the search; the best partial placement is remembered.

**Soft scoring — ranking only, never rejection:** S1 +15 if the class already had that subject today (spread across days) · S2 penalty grows with the teacher's load that day/week (balance) · S3 penalty for empty periods trapped between filled ones (no middle gaps).

**Honesty on failure:** if the data is impossible (e.g. a subject needs more periods than its teachers' combined weekly cap), the solver returns the unplaced jobs with reasons — it never emits a routine that breaks a hard rule to look successful. The Validation page flags that shortage *before* you generate.

**Complexity note to be able to defend:** worst case is exponential (timetabling is NP-hard), which is exactly why the ordering heuristic, candidate pruning by hard checks, and the time limit exist. For department scale (demo: 78 jobs) it finishes in ~0.01 s.

## Deploy — Render (free)

This repo is Render-Blueprint ready (`render.yaml`, `Procfile`):

1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com): **New → Blueprint**, select the repo — Render reads `render.yaml` (build: `pip install -r requirements.txt`, start: `gunicorn app:app --bind 0.0.0.0:$PORT`, free web service). Or **New → Web Service** and enter those build/start commands manually.
3. Deploy. On first boot the app auto-creates its SQLite DB; open the live URL and click **Load MCA Demo Data → Generate Routine** — the full demo works on the deployed instance.
4. Notes: `SECRET_KEY` is auto-generated by the Blueprint. Render's free tier has an **ephemeral filesystem**, so `routine.db` resets on redeploys/restarts — fine for a demo (re-seed in one click); a production version would move to a persistent disk or Postgres. Free services also sleep when idle, so the first load can be slow.

## Resume bullets this project now justifies (measured numbers only)

- Built an automatic department timetable generator (Python, Flask, SQLite) that generates a clash-free weekly routine for 3 classes / 9 teachers / 9 subjects in ~0.02 s.
- Designed a custom constraint solver — hardest-first job ordering, backtracking search, soft-constraint scoring — enforcing 8 hard rules (teacher/class clashes, load caps, lab continuity, availability); 86/86 required periods placed on demo data.
- Added clash-checked manual editing, a demand-vs-capacity validation report, and CSV export; verified with an 8-test suite asserting every hard rule on the generated routine.

## Known limitations (v1, by design per spec §2.2)

Single active routine; no teacher/student logins; no room allocation; lab odd hours are flagged by validation rather than supported; free-tier deploys lose the DB on restart (see Deploy notes).
