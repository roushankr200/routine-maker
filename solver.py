"""
Routine Maker — Solver Engine
=============================
The interview centrepiece. A custom constraint solver: no OR-Tools, no
external library — just greedy placement, hardest-first ordering and
backtracking, written to be read.

Problem
-------
We must assign every required period ("job") for every class to a
(day, period, teacher) such that no hard rule is broken:

    H1  One teacher, one class per slot.
    H2  One class, one subject per slot.
    H3  A teacher never exceeds max classes per day.
    H4  A teacher's weekly assigned periods never exceed weekly_hours.
    H5  Every class gets *exactly* its required hours per subject
        (guaranteed by construction: we expand hours into jobs and
        only claim success when every job is placed).
    H6  A teacher teaches only subjects they are eligible for
        (guaranteed by construction: candidates come from the
        eligible-teacher list of the job's subject).
    H7  A teacher is never placed in an unavailable slot.
    H8  A lab occupies 2 consecutive periods on the same day, and
        never spans the lunch break.

Soft preferences (used only to *rank* candidates, never to reject one):

    S1  Spread a subject across days for a class.
    S2  Balance a teacher's load across the week.
    S3  Avoid empty periods stuck between two classes (middle gaps).

Algorithm
---------
1. EXPAND   — each class_subject row becomes individual jobs.
              A theory subject needing 4 hrs -> 4 jobs of length 1.
              A lab needing 4 hrs -> 2 jobs of length 2.
2. ORDER    — hardest first: labs before theory (longer = harder),
              then fewest eligible teachers, then most hours.
              Placing constrained jobs early leaves easy jobs to fill
              the gaps — the classic "fail-first" heuristic.
3. PLACE    — depth-first search. For the next job, generate every
              (day, start, teacher) that passes all hard checks,
              sort by soft score, try them in that order.
4. BACKTRACK— if a job has no legal candidate, undo the previous
              placement and try its next candidate. A time limit and
              a node budget keep this bounded; the best partial
              placement found is remembered.
5. REPORT   — if not everything placed, return the unplaced jobs
              with a human reason. We NEVER return a routine that
              breaks a hard rule to pretend we succeeded.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field


# --------------------------------------------------------------------------
# Data shapes (plain dicts — the DB layer converts rows into these)
# --------------------------------------------------------------------------
# teachers: {id: {"id", "name", "max_per_day", "weekly_hours",
#                 "subjects": set[subject_id],
#                 "unavailable": set[(day, period | None)]}}
# subjects: {id: {"id", "name", "code", "type": "theory" | "lab"}}
# class_subjects: [{"class_id", "subject_id", "hours"}]
# config: {"days": [str], "periods_per_day": int, "lunch_after": int | None}


@dataclass
class Job:
    """One placeable unit: 1 period of theory, or one 2-period lab block."""
    class_id: int
    subject_id: int
    duration: int                      # 1 = theory, 2 = lab block
    eligible_teachers: list            # teacher ids allowed by H6
    key: str = ""                      # e.g. "Class 1 · DBMS" for reports


@dataclass
class Placement:
    job: Job
    day: str
    period: int                        # first period of the block
    teacher_id: int


@dataclass
class SolveResult:
    placements: list = field(default_factory=list)   # list[Placement]
    unplaced: list = field(default_factory=list)     # list[dict] job+reason
    success: bool = False
    elapsed_seconds: float = 0.0
    nodes: int = 0                                   # search nodes visited

    @property
    def total_jobs(self) -> int:
        return len(self.placements) + len(self.unplaced)

    def entries(self):
        """Flatten placements to single-period rows (labs -> 2 rows)."""
        rows = []
        for p in self.placements:
            for offset in range(p.job.duration):
                rows.append({
                    "class_id": p.job.class_id,
                    "subject_id": p.job.subject_id,
                    "teacher_id": p.teacher_id,
                    "day": p.day,
                    "period": p.period + offset,
                })
        return rows


# --------------------------------------------------------------------------
# Step 1 + 2: expand hours into jobs, ordered hardest-first
# --------------------------------------------------------------------------

def expand_jobs(teachers, subjects, class_subjects):
    jobs = []
    for cs in class_subjects:
        subject = subjects[cs["subject_id"]]
        eligible = sorted(tid for tid, t in teachers.items()
                          if cs["subject_id"] in t["subjects"])
        hours = cs["hours"]
        if subject["type"] == "lab":
            # H8: labs move in 2-period blocks. An odd hour leaves one
            # single-period job which the caller should treat as a data
            # error (the validation report flags it); we still expand it
            # as a 1-period job so nothing is silently dropped.
            blocks, remainder = divmod(hours, 2)
            for _ in range(blocks):
                jobs.append(Job(cs["class_id"], cs["subject_id"], 2, eligible))
            if remainder:
                jobs.append(Job(cs["class_id"], cs["subject_id"], 1, eligible))
        else:
            for _ in range(hours):
                jobs.append(Job(cs["class_id"], cs["subject_id"], 1, eligible))

    # Hardest first (fail-first):
    #   1. longer duration first (labs before theory)
    #   2. fewer eligible teachers first (most constrained)
    #   3. subject with the most total hours first
    hours_by_subject = {}
    for cs in class_subjects:
        hours_by_subject[cs["subject_id"]] = (
            hours_by_subject.get(cs["subject_id"], 0) + cs["hours"])
    jobs.sort(key=lambda j: (-j.duration,
                             len(j.eligible_teachers),
                             -hours_by_subject.get(j.subject_id, 0),
                             j.class_id, j.subject_id))
    return jobs


# --------------------------------------------------------------------------
# The solver
# --------------------------------------------------------------------------

class Solver:
    def __init__(self, teachers, subjects, class_subjects, config,
                 time_limit=10.0, max_nodes=300_000):
        self.teachers = teachers
        self.subjects = subjects
        self.config = config
        self.days = list(config["days"])
        self.day_index = {d: i for i, d in enumerate(self.days)}
        self.periods = config["periods_per_day"]
        self.lunch_after = config.get("lunch_after")  # period no. or None
        self.time_limit = time_limit
        self.max_nodes = max_nodes
        self.jobs = expand_jobs(teachers, subjects, class_subjects)

        # Mutable search state (all undone on backtrack):
        self.class_busy = set()        # (class_id, day, period)      -> H2
        self.teacher_busy = set()      # (teacher_id, day, period)    -> H1
        self.teacher_day = {}          # (teacher_id, day) -> count   -> H3
        self.teacher_week = {}         # teacher_id -> count          -> H4
        self.class_subject_day = {}    # (class, subject, day) -> n   -> S1
        self.class_day_periods = {}    # (class, day) -> set(periods) -> S3
        self.placed = []               # list[Placement], in job order stack

        self.nodes = 0
        self.deadline = None
        self.best = []                 # deepest partial placement seen

    # -- hard-rule check ---------------------------------------------------
    def can_place(self, job, day, start, teacher_id):
        """Return None if legal, else a short reason string."""
        teacher = self.teachers[teacher_id]
        periods = range(start, start + job.duration)

        if start + job.duration - 1 > self.periods:
            return "outside the day"
        # H8: a 2-period block must not span lunch (e.g. P4+P5 when
        # lunch sits after P4 are not truly consecutive).
        if job.duration == 2 and self.lunch_after is not None \
                and start <= self.lunch_after < start + job.duration:
            return "lab would span the lunch break"
        # H4: weekly cap (checked once, it covers every period equally)
        if self.teacher_week.get(teacher_id, 0) + job.duration \
                > teacher["weekly_hours"]:
            return f"{teacher['name']} would exceed weekly hours (H4)"
        # H3: daily cap
        if self.teacher_day.get((teacher_id, day), 0) + job.duration \
                > teacher["max_per_day"]:
            return f"{teacher['name']} would exceed max/day (H3)"

        for p in periods:
            if (job.class_id, day, p) in self.class_busy:
                return "class already has a period in that slot (H2)"
            if (teacher_id, day, p) in self.teacher_busy:
                return f"{teacher['name']} is busy in another class (H1)"
            if (day, p) in teacher["unavailable"] \
                    or (day, None) in teacher["unavailable"]:
                return f"{teacher['name']} is unavailable then (H7)"
        return None

    # -- soft scoring (S1, S2, S3) — lower is better -----------------------
    def soft_score(self, job, day, start, teacher_id):
        score = 0.0
        # S1: same subject already taught to this class today?
        score += 15 * self.class_subject_day.get(
            (job.class_id, job.subject_id, day), 0)
        # S2: prefer the teacher's lighter days / lighter week.
        score += 3 * self.teacher_day.get((teacher_id, day), 0)
        score += 0.5 * self.teacher_week.get(teacher_id, 0)
        # S3: middle gaps — count empty periods that would end up
        # trapped between the first and last filled period of the class
        # that day after this placement.
        filled = set(self.class_day_periods.get((job.class_id, day), set()))
        filled.update(range(start, start + job.duration))
        if filled:
            gaps = (max(filled) - min(filled) + 1) - len(filled)
            score += 4 * gaps
        # Mild tie-breakers: earlier day, earlier period (deterministic).
        score += 0.01 * self.day_index[day] + 0.01 * start
        return score

    def candidates(self, job):
        """All legal (score, day, start, teacher) tuples, best first."""
        out = []
        starts = range(1, self.periods - job.duration + 2)
        for day in self.days:
            for start in starts:
                for tid in job.eligible_teachers:
                    if self.can_place(job, day, start, tid) is None:
                        out.append((self.soft_score(job, day, start, tid),
                                    day, start, tid))
        out.sort(key=lambda c: (c[0], self.day_index[c[1]], c[2], c[3]))
        return out

    # -- state mutation ------------------------------------------------------
    def _apply(self, job, day, start, teacher_id):
        for p in range(start, start + job.duration):
            self.class_busy.add((job.class_id, day, p))
            self.teacher_busy.add((teacher_id, day, p))
            self.class_day_periods.setdefault(
                (job.class_id, day), set()).add(p)
        self.teacher_day[(teacher_id, day)] = \
            self.teacher_day.get((teacher_id, day), 0) + job.duration
        self.teacher_week[teacher_id] = \
            self.teacher_week.get(teacher_id, 0) + job.duration
        key = (job.class_id, job.subject_id, day)
        self.class_subject_day[key] = self.class_subject_day.get(key, 0) + 1
        self.placed.append(Placement(job, day, start, teacher_id))

    def _undo(self, job, day, start, teacher_id):
        for p in range(start, start + job.duration):
            self.class_busy.discard((job.class_id, day, p))
            self.teacher_busy.discard((teacher_id, day, p))
            self.class_day_periods[(job.class_id, day)].discard(p)
        self.teacher_day[(teacher_id, day)] -= job.duration
        self.teacher_week[teacher_id] -= job.duration
        self.class_subject_day[(job.class_id, job.subject_id, day)] -= 1
        self.placed.pop()

    # -- depth-first search with backtracking --------------------------------
    def _search(self, idx):
        if idx == len(self.jobs):
            return True
        if time.time() > self.deadline or self.nodes > self.max_nodes:
            return False
        self.nodes += 1
        if len(self.placed) > len(self.best):
            self.best = list(self.placed)

        job = self.jobs[idx]
        for _score, day, start, tid in self.candidates(job):
            self._apply(job, day, start, tid)
            if self._search(idx + 1):
                return True
            self._undo(job, day, start, tid)
            if time.time() > self.deadline or self.nodes > self.max_nodes:
                return False
        return False

    def _reason_for(self, job):
        """Explain, against an empty-ish view, why a job is hard to place."""
        if not job.eligible_teachers:
            return "no teacher is eligible for this subject (H6)"
        subject = self.subjects[job.subject_id]
        if subject["type"] == "lab" and self.periods < 2:
            return "lab needs 2 consecutive periods but the day is shorter"
        caps = sum(self.teachers[t]["weekly_hours"]
                   for t in job.eligible_teachers)
        return ("no free slot satisfies all hard rules — class/teacher "
                f"busy, daily/weekly caps or unavailability (eligible "
                f"teachers' combined weekly cap is {caps})")

    def solve(self):
        started = time.time()
        self.deadline = started + self.time_limit
        solved = self._search(0)
        elapsed = time.time() - started

        placements = list(self.placed) if solved else list(self.best)
        placed_jobs = {id(p.job) for p in placements}
        unplaced = [{"class_id": j.class_id, "subject_id": j.subject_id,
                     "duration": j.duration, "reason": self._reason_for(j)}
                    for j in self.jobs if id(j) not in placed_jobs]
        return SolveResult(placements=placements, unplaced=unplaced,
                           success=solved, elapsed_seconds=elapsed,
                           nodes=self.nodes)


def solve(teachers, subjects, class_subjects, config, time_limit=10.0):
    """One-call convenience wrapper used by the web app and the tests."""
    return Solver(teachers, subjects, class_subjects, config,
                  time_limit=time_limit).solve()
