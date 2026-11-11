# Routine Maker — CSE Department, NIT Agartala (MERN + TypeScript)

Automatic master routine / timetable generator built **specifically for
the CSE Department, National Institute of Technology Agartala (NITA)**:
enter teachers, subjects, classes and time structure once, press
**Generate**, and get a conflict-free weekly routine in the exact format
of the department's real master sheet — modelled on the actual
**CSE DEPARTMENT CLASS ROUTINE (NITA), ODD 2026, w.e.f. 27/07/2026**
(see `reference/NITA-CSE-ROUTINE-ODD-2026-REFERENCE.md`).

This is the MERN rebuild of the original Flask version — same solver
algorithm, same behaviour, in the stack the author actually works in:
**MongoDB, Express, React, Node.js, TypeScript throughout.**

**Product constants vs. per-department content.** One institute —
**NIT Agartala** — and one **fixed time grid** for every department:
Mon–Fri, an hourly grid of 7 slots/day from 9:00 AM, lunch 1:00–2:00
after P4, day ends 5:00 PM. Teaching happens in **block sessions
merged across the hourly grid** — theory 1–2 consecutive hours, labs
2–3 consecutive hours, exactly as on the real sheet (see "Session
model" below). Those never change. What varies
per department is only its content: the **department name**, session /
w.e.f. date, **classes/sections, teachers** (codes, eligibility,
limits, off-days), **courses/subjects**, and the **per-class weekly
hours**. Every department plugs in its own classes, teachers and
courses, and gets its routine in the same master format. The
preloaded department is NITA CSE — the **full department**: B.Tech,
MCA and M.Tech classes with the real subjects, faculty and faculty
codes from the ODD 2026 sheet.

**Multi-department storage.** Departments **coexist**: every teacher,
subject, class, mapping, availability block and routine entry is
stored against its own department, and every screen works on the
**active** department only (switcher in the sidebar, or the
Departments card on the Dashboard). Creating a department **never
deletes or replaces** an existing one; re-loading the CSE demo
refreshes only CSE's own data. A department is removed only by the
explicit **Delete** action on the Dashboard (the last remaining
department cannot be deleted). If the wizard is given a department
name that already exists, the API answers `409 Department already
exists` with the existing department's id and the UI offers to switch
to it — it never overwrites.

## Setting up a new department — the wizard

CSE is the **preloaded** department, but the product is for the whole
institute. Any other NITA department (ECE, Civil, ME, …) sets itself up
through the **question-first wizard** at `/setup/wizard` (linked from
the Dashboard and from Setup → "Set up a new department"):

1. **Department** — "Which department?" Full name, short name
   (masthead), session, w.e.f. date. The institute (NIT Agartala) and
   the time grid are shown as the fixed constants they are — they are
   never inputs.
2. **Classes** — "How many classes/sections?" A count generates that
   many rows (program, semester/year, section); rows can be added or
   removed freely.
3. **Courses** — "How many courses?" Rows of code, full name, type
   (Theory/Lab) and session length (theory 1–2h, lab 2–3h).
4. **Teachers** — "How many teachers?" Name, faculty code
   (auto-suggested from initials), max hours/day, max hours/week, the
   courses they can teach (tick boxes — solver rule H6), and an
   optional day off.
5. **Mapping** — for each class, a compact grid of its courses with
   weekly hours (prefilled suggestions: theory 4h, lab 3h; 0 = not
   taken), with running totals per class (must fit the 35h grid) and
   per-course demand vs teacher capacity.
6. **Review & Create** — the same validation the Validation page uses
   (demand vs eligible-teacher capacity, grid overflow, courses with
   no eligible teacher) in plain words. On confirm, **one call**
   (`POST /api/setup/department`) creates a **new department alongside
   the existing ones — nothing is deleted or replaced** — and makes it
   active. The payload is fully validated *before* anything is
   written, so a bad payload changes nothing. "Generate Routine" then
   runs the normal solver + master sheet flow, with the new
   department's name in the masthead.

Verified end-to-end (integration tests + production build,
in-memory Mongo): a sample ECE setup (2 classes, 5 courses incl. 1
lab, 4 teachers) validates clean, generates with **0 unplaced**, and
the master API carries the ECE masthead data — while the NITA CSE
department, including its generated 346-entry routine, stays fully
intact next to it (346/346 hours, 180/180 sessions). Switching back
and forth loses nothing; re-seeding CSE refreshes CSE only.

## Setting up from the syllabus — the guided flow

Departments whose syllabus is in the built-in **catalogue** don't
type subjects in at all. The catalogue (`server/src/catalog/`) holds
the official course structure extracted from the institute's
published syllabus PDFs — every programme, semester and subject with
its **syllabus code, L-T-P, credits** and elective pools (sources and
caveats: `reference/CATALOGUE-PROVENANCE.md`; for CSE it covers
B.Tech Sem 1–8, MCA Sem 1–6 and M.Tech Sem 1–4 × AI / Cyber Security
/ Data Science & Engineering).

The **guided setup** at `/setup/guided` (linked from the Dashboard
and Setup) walks it semester by semester:

1. **Department & session** — name, session label, Odd/Even, the
   programmes to include and sections per year (B.Tech Year 1 is the
   syllabus's Group I + Group II). Semesters with nothing timetabled
   (M.Tech Sem 3/4, MCA Sem 6 — project/viva only) are auto-skipped.
2. **One screen per semester** — every preloaded subject is listed
   per class with its code, syllabus code, weekly hours and
   **credits** (the semester's credit total is shown at the top, and
   project/viva items are listed greyed as not-timetabled). For each
   subject you pick the section's elective (for elective slots) and
   a **teacher**, or **XX** — "no teacher yet", exactly as the real
   sheet prints unassigned slots. **Next stays disabled until every
   subject of the semester is assigned.**
3. **Teacher pool** — teachers are added once and carry across all
   semesters (never re-typed); a live side panel accumulates each
   teacher's assigned weekly hours against their weekly max.
4. **Review & create** — per-semester coverage (subjects, credits,
   teachers used, XX count) and the teacher load table. One call
   (`POST /api/setup/guided`) creates the department: the server
   **re-resolves every subject from the catalogue** (client-sent
   hours/credits are never trusted), rejects incomplete or over-max
   assignments with a problems list, and answers 409 on a duplicate
   name. XX subjects are assigned to one internal placeholder teacher
   (code `XX`, hidden from teacher lists and counts) so generation
   succeeds and the slots print as `XX` on the master sheet.

Eligibility is exactly the assignment: a teacher can teach the
subjects they were assigned, in the classes they were assigned them.

The **CSE seed itself is built from the same catalogue** — classes,
subjects, hours and credits are derived from it (see
`server/src/demoData.ts`), so the one-click department and the
guided flow can never drift apart.

## Coverage & balance — hours left, and who is getting less

While teachers are being added, two questions matter: *how many of a
course's required hours are still uncovered?* and *which teachers are
getting less work than the others?* A greedy **suggested
distribution** answers both (`server/src/solver/balance.ts`):
requirements are processed most-constrained first (fewest eligible
teachers, then most hours), each requirement's hours go to the
least-loaded eligible teacher who still has weekly capacity, and a
requirement splits across teachers when the first one fills up.
Weekly caps are never exceeded.

- **In the wizard** (Teachers and Mapping steps) a live *Coverage &
  balance* panel shows, per course, required / covered / **hours
  left** (red badge until it reaches zero, then "Covered") and, per
  teacher, the suggested load as `9 / 20 h` with a bar. Teachers below
  60% of the average suggested load are flagged **Under-loaded — can
  take more subjects**, so you can tick extra courses for them and
  watch the distribution even out before creating the department.
- **On the Validation page**, a *Load balance* section shows the same
  computation for the saved data: subjects with hours still left to
  cover appear first as warnings, then a teacher table (suggested
  hours, weekly max, subjects with hours, status badge).
- Endpoints: `GET /api/balance` (saved data) and
  `POST /api/balance/preview` (wizard state, code-based payload,
  read-only — bad payloads get a 400 with a problems list).

The suggestion is a planning aid, not the timetable: it ignores days,
periods and availability — the solver still makes the real placement
under all the hard rules.

## Why MERN?

The constraint solver is the product; the stack around it should be the
one the author can defend line-by-line in an interview. TypeScript runs
end to end — the solver, the REST API and the React UI share the same
language and the same data shapes.

## Stack

| Layer    | Choice |
|----------|--------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS, React Router, Axios + TanStack React Query, Lucide icons |
| Backend  | Node.js + Express 4 + TypeScript, Zod validation on every input |
| Database | MongoDB via Mongoose (Atlas in production; in-memory locally) |
| Solver   | Custom constraint solver in `server/src/solver/` — no external library |
| Tests    | Vitest — 49 tests: solver invariants + block-session model, catalogue integrity, multi-department storage and guided setup (integration ones use in-memory Mongo) |

## Quick start (zero setup)

Requires Node 18+. No database account needed for a local run: when
`MONGODB_URI` is unset the server starts an **in-memory MongoDB**
(`mongodb-memory-server`) automatically. Data resets on restart in
that mode.

```bash
npm install          # installs both workspaces (server + client)
npm run build        # builds client (client/dist) and server (server/dist)
npm start            # one process, one URL: http://localhost:4000
```

Development (hot reload, two processes):

```bash
npm run dev          # API on :4000 (tsx watch, in-memory Mongo)
npm run dev:client   # Vite on :5173, /api proxied to :4000
```

With a real database (MongoDB Atlas):

```bash
MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/routine-maker" npm start
```

Tests:

```bash
npm test             # vitest: 49 tests
```

## Demo walkthrough (5 steps)

1. Open the app → **Load NIT Agartala CSE Data** (the real NITA CSE
   department dataset: 42 faculty with their sheet codes — DJB, PB,
   MKDB, TP, … (32 from the sheet + 10 generic first-year
   placeholders) — 69 subjects, 14 classes: B.Tech Sem 1 (Group I +
   Group II) / 3 / 5 / 7 (A + B), MCA Sem 1 / 3 / 5, M.Tech Sem 1
   CYSEC / DSE / AI; Mon–Fri, hourly grid from 9:00, lunch 1:00–2:00
   after P4; theory subjects run 2h sessions, labs single 3h blocks,
   syllabus-derived hours and credits throughout). Assignments
   follow the ones printed on the real sheet wherever it names a
   teacher: MCA Sem 5 AI / AI Lab = DJB, CD / CD Lab = PB,
   WCN = MKDB, DIP = TP; B.Tech DBMS = SN, OS = SDB,
   ML 7A = KC / 7B = AJ, M.Tech CRYPTO = NK, …
2. Open **Validation** — demand vs eligible-teacher capacity per subject.
3. Click **Generate Routine**.
4. View the **Master sheet** (NITA format, below) / By Class / By
   Teacher routines (teacher load totals included), export CSV from
   any view, or **Print** the master sheet for the notice board.
5. On the Master view, click any cell to select its session, then try
   a manual **Move** — the whole block moves together, and an illegal
   move is rejected instantly with the exact reason (e.g. *"Move
   rejected: A 3h session starting at Monday P3 would cross the lunch
   break."*).

**Measured on the NITA demo data** (actual runs of this codebase):
the full CSE department solves to **346/346 hours (180/180
sessions), 0 unplaced**, search **182 nodes** (no backtracking
needed), **≈0.03 s**. All **49/49 tests pass**.

## Session model (the real sheet's blocks, not single periods)

The grid is hourly, but nobody at NITA teaches in single hours. Every
subject carries a **session length** (`sessionHours` on the Subject,
editable on the Subjects page):

- **Theory: 1–2 consecutive hours, default 2** (the sheet's common
  pattern: `DMS` Mon 9:00–11:00; 1h singles like `NM` 11–12 exist).
- **Lab: 2–3 consecutive hours, default 3** (3h blocks sit 9–12 or
  2–5 on the real sheet; 2h labs like `AI Lab` 11–1 exist too).

A class-subject's weekly hours split into sessions of that length,
plus **one shorter remainder session** when they don't divide evenly
(theory 4h @2 → 2+2; theory 3h @2 → 2+1; lab 3h @3 → one block).
A session must sit entirely inside the morning segment (P1–P4) or the
afternoon segment (P5–P7) — **no session ever crosses lunch**, so a
3h block can only start at P1, P2 or P5. In the demo seed the MCA
classes each run 14 sessions/week (Sem 1 = 31h, Sem 3 = 31h,
Sem 5 = 28h); the B.Tech and M.Tech classes follow the same pattern
at their own loads (B.Tech Sem 1 = 25/26h, Sem 3 = 26h, Sem 5 = 28h,
Sem 7 = 11h — the real 7th-sem sheet carries only ML + electives,
the rest is project work; M.Tech Sem 1 = 25h).

## The master sheet (NITA format)

The Master Routine page reproduces the department's real sheet:

- **Masthead** — "NATIONAL INSTITUTE OF TECHNOLOGY AGARTALA"
  (institute: fixed, always) / "**CSE** DEPARTMENT CLASS ROUTINE
  (NITA)" — only the department line varies, taken from the **active
  Department** document (another department reads e.g. "ECE
  DEPARTMENT CLASS ROUTINE (NITA)") — + session line
  (`ODD 2026, w.e.f. 27/07/2026`; the active department's session and
  w.e.f. date, editable in Setup).
- **One table per day** — rows = classes/sections, columns = periods
  headed by **clock times** computed from Config's day start +
  period duration (lunch occupies one period-length slot in the
  clock, exactly like the real sheet: P1 9:00–10:00 … P4 12:00–1:00,
  **LUNCH 1:00–2:00**, P5 2:00–3:00 … P7 4:00–5:00).
- **Sheet notation in cells** — `SUBJECT - TEACHERCODE`
  (`AI - DJB`, `WCN - MKDB`), with every session **merged across
  its hours** (colSpan = session length): a 2h theory block reads as
  one cell over 9:00–11:00, a 3h lab as one cell over 2:00–5:00 —
  exactly the real sheet's rendering. Faculty codes live on the
  Teacher record (the Teachers form auto-suggests initials); codes
  fall back to name initials when unset.
- **Legends below the sheet**, like the real sheet's footer —
  Faculty: `DJB = Dr. Dhrubajyoti Bhowmik`, … · Subjects:
  `AI = Artificial Intelligence`, … (only codes the routine uses).
- **Print** — a print stylesheet renders just the masthead, grids and
  legends, black-on-white, landscape: the notice-board output.

## The solver

`server/src/solver/solver.ts` is the centrepiece — read it top to bottom;
the header comment is the design doc. In short:

1. **Expand** — each class–subject requirement becomes session jobs:
   weekly hours split into blocks of the subject's session length
   (+ one remainder session), each block placed whole, never spanning
   lunch or a segment boundary.
2. **Order hardest-first** (fail-first): longest sessions → fewest
   eligible teachers → most total hours. Constrained blocks placed
   early leave easy sessions to fill the gaps.
3. **Place** — depth-first search; every legal (day, start, teacher)
   candidate is ranked by soft score and tried best-first.
4. **Backtrack** — a job with no legal candidate undoes the previous
   placement. A 10 s time limit and node budget bound the search; the
   best partial result is kept.
5. **Report honestly** — if data is impossible, unplaced jobs come back
   with human reasons. A routine that breaks a hard rule is never
   returned to fake success.

Hard rules: **H1** teacher one class/slot · **H2** class one subject/slot ·
**H3** teacher max/day · **H4** teacher weekly cap (H3/H4 count HOURS,
since sessions are blocks) · **H5** exact subject hours per class ·
**H6** teacher–subject eligibility · **H7** availability ·
**H8** lab sessions are single unbroken blocks of their session
length, never across lunch (no session of any kind crosses lunch).
Soft preferences (ranking only): **S1** spread a subject's sessions
across days · **S2** balance teacher load · **S3** avoid middle gaps
in a class's day · **S4** avoid creating orphan free slots (a lone
free period with no free neighbour in its segment — 3h labs prefer
the exact-fit afternoon over orphaning a morning slot). Identical
twin sessions are symmetry-broken onto non-decreasing days.

The same checks re-validate every manual Move/Swap instantly
(`server/src/routineCheck.ts`): moving an entry moves its **whole
session block**, and the full span is clash-checked before applying.

## API (all under `/api`, JSON, Zod-validated)

- `GET /dashboard` — counts, issues, warnings
- `POST /seed` — load the built-in NITA CSE department dataset
- `POST /setup/department` — the New Department wizard's single commit
  endpoint: full department payload (identity + classes + courses +
  teachers + hours mapping, cross-referenced by course code),
  validated before anything is written; returns counts + the
  validation summary (creates a NEW department alongside existing
  ones; nothing is ever replaced)
- `GET /catalog`, `GET /catalog/:deptId` — the built-in syllabus
  catalogue (departments → programmes → semesters → subjects with
  credits, syllabus codes, L-T-P and elective pools)
- `POST /setup/guided` — the guided setup's single commit endpoint:
  catalogue id + department fields + teachers + per-class
  {key → teacher | XX, electivePick} assignments; the server
  re-resolves subjects from the catalogue, validates completeness /
  teacher weekly max / duplicate name (409) and creates the new
  department scoped alongside the existing ones
- Teachers: `GET/POST /teachers`, `PUT/DELETE /teachers/:id`,
  `GET/PUT /teachers/:id/availability`
- Subjects: `GET/POST /subjects`, `PUT/DELETE /subjects/:id`
- Classes: `GET/POST /classes`, `PUT/DELETE /classes/:id`,
  `POST /classes/:id/subjects`, `DELETE /classes/:id/subjects/:subjectId`
- `GET/PUT /config` — department name + short name, session + w.e.f.
  header texts, and the (institute-fixed) time grid: days, periods/day,
  lunch position, period duration, day start time (saving clears the routine)
- Routine: `GET /routine`, `GET /routine/class/:id`, `GET /routine/teacher/:id`,
  `POST /routine/generate`, `POST /routine/move`, `POST /routine/swap`,
  `POST /routine/clear`
- `GET /validation` — demand vs capacity report
- `GET /balance` — coverage & balance for the saved data: per subject
  required / assigned / remaining hours, per teacher the suggested
  load vs weekly max with an under / full / balanced status
- `POST /balance/preview` — the same greedy distribution for
  not-yet-saved wizard state (teachers + courses + hours mapping by
  course code); read-only, 400 with a problems list on bad payloads

## Deployment (Render, one service, one URL)

`render.yaml` is included: a single Node web service builds both
workspaces and Express serves the built client as static files.

```text
Build:  npm install && npm run build
Start:  npm start            (PORT comes from the environment)
```

Set **`MONGODB_URI`** in the Render dashboard to your MongoDB Atlas
connection string. Without it the service still runs, but on in-memory
MongoDB — fine for a demo, but data (and the generated routine) resets
on every restart/redeploy. For a persistent demo, create a free Atlas
cluster, allow network access, and paste its connection string.

## Design

UI follows the **UI/UX Pro Max** design system generated for this
project ("Minimalism & Swiss Style"): teal primary `#0D9488`, orange
accent `#EA580C` reserved for the primary CTA, Fira Sans for UI +
Fira Code for codes/numbers, dense dashboard spacing, visible focus
rings, SVG icons only (Lucide), hover transitions 150–300 ms, and
`prefers-reduced-motion` respected.

## Known limitations

- **Deploy persistence needs Atlas.** Render's free tier has no
  persistent disk and MongoDB must live somewhere: set `MONGODB_URI`
  (free Atlas M0 cluster is enough). Unset = in-memory demo mode.
- Swap is restricted to sessions of the same class (cross-class
  changes go through Move). Move/Swap always operate on whole session
  blocks; a swap is rejected when either block cannot legally sit at
  the other's start (e.g. a 3h lab into a 2h gap).
- Single active routine, no login/accounts — same out-of-scope list
  as the original spec (Phase 2/3 items).

## Roadmap — v3 (from the real sheet, reference §8)

The ODD 2026 sheet contains structures the current model deliberately
does not fake yet:

- **Rooms** as typed data (theory vs lab rooms) — cells become
  `DBMS - 5A-SN-G07`, with room clash-checking added to H-rules.
- **Lab groups** — sections split into A1/A2 halves running different
  labs in parallel in the same block. (Single-cohort block sessions —
  theory 1–2h, labs 2–3h — are already implemented; this is about the
  parallel split-cohort variant.)
- **Multi-staff labs** — faculty + technical assistant + scholar
  placeholder (`DBMS Lab - 5A1 - RD, VD, Sch - 215`).
- **Combined cohorts for electives** — one class, two programmes
  (DIP: MCA 5th + BTMT 7th), and parallel elective groups.
- **Teacher-code aliases** — the real sheet itself lists one person
  under two codes (AS / ABC); identity must dedupe by person.

*(Done since: **unassigned slots** — the guided setup accepts `XX`
for any subject; those slots generate under a hidden placeholder
teacher and print as `XX` on the master sheet, as the real sheet
prints them.)*

## Project layout

```text
server/src/
  solver/     types.ts (plain data shapes) + solver.ts (the engine)
              + balance.ts (coverage & balance suggestion engine)
  catalog/    the syllabus catalogue: types.ts + cse.ts + index.ts
              (official structures; see reference/CATALOGUE-PROVENANCE.md)
  models.ts   Mongoose models        routes.ts   REST API
  data.ts     DB -> solver data + validation report
  seed.ts     demo loader            schemas.ts  Zod input schemas
  departments.ts  multi-department storage (scoping, counts, backfill)
  routineCheck.ts  move/swap validation (H1–H7)
  demoData.ts CSE seed, derived from the catalogue (shared by seed + tests)
client/src/
  pages/      Dashboard, Teachers, Availability, Subjects, Classes,
              Setup, DepartmentWizard (the New Department wizard),
              GuidedSetup (the syllabus-guided setup),
              MasterRoutine, ByClass, ByTeacher, Validation
  components/ Layout + shared UI (grid, banners, chips)
  utils/csv.ts  client-side CSV export
```
