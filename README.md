# Routine Maker — MERN + TypeScript

Automatic department master routine / timetable generator: enter teachers,
subjects, classes and time structure once, press **Generate**, and get a
conflict-free weekly routine. This is the MERN rebuild of the original
Flask version — same solver algorithm, same demo data, same behaviour,
in the stack the author actually works in: **MongoDB, Express, React,
Node.js, TypeScript throughout.**

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
| Tests    | Vitest — 8 solver invariant tests, no database needed |

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

Tests (pure solver, in-memory data, no DB):

```bash
npm test             # vitest: 8 tests
```

## Demo walkthrough (5 steps)

1. Open the app → **Load MCA Demo Data** (9 teachers, 9 subjects incl.
   DBMS Lab + Java Lab, 3 classes: MCA Sem 1 / 3 / 5, Mon–Sat,
   7 periods/day, lunch after P4).
2. Open **Validation** — demand vs eligible-teacher capacity per subject.
3. Click **Generate Routine**.
4. View **Master / By Class / By Teacher** routines (teacher load
   totals included), export CSV from any view.
5. On the Master view, try a manual **Move** — an illegal move is
   rejected instantly with the exact rule it would break
   (e.g. *"Dr. Anil Sharma already teaches another class at Monday P2 (H1)"*).

**Measured on the demo data** (actual runs of this codebase):
solver places **86/86 periods (78/78 jobs), 0 unplaced**, search
**78 nodes**, ~**0.02 s**; the HTTP generate call reported
**0.014 s** end to end. All **8/8 tests pass**.

## The solver

`server/src/solver/solver.ts` is the centrepiece — read it top to bottom;
the header comment is the design doc. In short:

1. **Expand** — each class–subject requirement becomes individual jobs:
   theory = 1-period jobs, labs = 2-period blocks (never spanning lunch).
2. **Order hardest-first** (fail-first): labs → fewest eligible teachers →
   most total hours. Constrained jobs placed early leave easy jobs to
   fill the gaps.
3. **Place** — depth-first search; every legal (day, start, teacher)
   candidate is ranked by soft score and tried best-first.
4. **Backtrack** — a job with no legal candidate undoes the previous
   placement. A 10 s time limit and node budget bound the search; the
   best partial result is kept.
5. **Report honestly** — if data is impossible, unplaced jobs come back
   with human reasons. A routine that breaks a hard rule is never
   returned to fake success.

Hard rules: **H1** teacher one class/slot · **H2** class one subject/slot ·
**H3** teacher max/day · **H4** teacher weekly cap · **H5** exact subject
hours per class · **H6** teacher–subject eligibility · **H7** availability ·
**H8** lab continuity (2 consecutive periods, never across lunch).
Soft preferences (ranking only): **S1** spread a subject across days ·
**S2** balance teacher load · **S3** avoid middle gaps in a class's day.

The same H1–H7 checks re-validate every manual Move/Swap instantly
(`server/src/routineCheck.ts`).

## API (all under `/api`, JSON, Zod-validated)

- `GET /dashboard` — counts, issues, warnings
- `POST /seed` — load the MCA demo dataset
- Teachers: `GET/POST /teachers`, `PUT/DELETE /teachers/:id`,
  `GET/PUT /teachers/:id/availability`
- Subjects: `GET/POST /subjects`, `PUT/DELETE /subjects/:id`
- Classes: `GET/POST /classes`, `PUT/DELETE /classes/:id`,
  `POST /classes/:id/subjects`, `DELETE /classes/:id/subjects/:subjectId`
- `GET/PUT /config` — days, periods/day, lunch position (saving clears the routine)
- Routine: `GET /routine`, `GET /routine/class/:id`, `GET /routine/teacher/:id`,
  `POST /routine/generate`, `POST /routine/move`, `POST /routine/swap`,
  `POST /routine/clear`
- `GET /validation` — demand vs capacity report

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
- Swap is restricted to entries of the same class (cross-class changes
  go through Move); a lab moved as a single period is treated as one
  entry — move both halves for a full lab block.
- Single active routine, no login/accounts, no room allocation —
  same out-of-scope list as the original spec (Phase 2/3 items).

## Project layout

```text
server/src/
  solver/     types.ts (plain data shapes) + solver.ts (the engine)
  models.ts   Mongoose models        routes.ts   REST API
  data.ts     DB -> solver data + validation report
  seed.ts     demo loader            schemas.ts  Zod input schemas
  routineCheck.ts  move/swap validation (H1–H7)
  demoData.ts demo constants shared by seed + tests
client/src/
  pages/      Dashboard, Teachers, Availability, Subjects, Classes,
              Setup, MasterRoutine, ByClass, ByTeacher, Validation
  components/ Layout + shared UI (grid, banners, chips)
  utils/csv.ts  client-side CSV export
```
