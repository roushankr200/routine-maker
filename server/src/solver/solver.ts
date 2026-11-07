/**
 * Routine Maker — Solver Engine (TypeScript port)
 * ===============================================
 * The interview centrepiece. A custom constraint solver: no OR-Tools, no
 * external library — just greedy placement, hardest-first ordering and
 * backtracking, written to be read.
 *
 * Problem
 * -------
 * We must assign every required period ("job") for every class to a
 * (day, period, teacher) such that no hard rule is broken:
 *
 *     H1  One teacher, one class per slot.
 *     H2  One class, one subject per slot.
 *     H3  A teacher never exceeds max classes per day.
 *     H4  A teacher's weekly assigned periods never exceed weeklyHours.
 *     H5  Every class gets *exactly* its required hours per subject
 *         (guaranteed by construction: we expand hours into jobs and
 *         only claim success when every job is placed).
 *     H6  A teacher teaches only subjects they are eligible for
 *         (guaranteed by construction: candidates come from the
 *         eligible-teacher list of the job's subject).
 *     H7  A teacher is never placed in an unavailable slot.
 *     H8  A lab occupies 2 consecutive periods on the same day, and
 *         never spans the lunch break.
 *
 * Soft preferences (used only to *rank* candidates, never to reject one):
 *
 *     S1  Spread a subject across days for a class.
 *     S2  Balance a teacher's load across the week.
 *     S3  Avoid empty periods stuck between two classes (middle gaps).
 *
 * Algorithm
 * ---------
 * 1. EXPAND   — each classSubject row becomes individual jobs.
 *               A theory subject needing 4 hrs -> 4 jobs of length 1.
 *               A lab needing 4 hrs -> 2 jobs of length 2.
 * 2. ORDER    — hardest first: labs before theory (longer = harder),
 *               then fewest eligible teachers, then most hours.
 *               Placing constrained jobs early leaves easy jobs to fill
 *               the gaps — the classic "fail-first" heuristic.
 * 3. PLACE    — depth-first search. For the next job, generate every
 *               (day, start, teacher) that passes all hard checks,
 *               sort by soft score, try them in that order.
 * 4. BACKTRACK— if a job has no legal candidate, undo the previous
 *               placement and try its next candidate. A time limit and
 *               a node budget keep this bounded; the best partial
 *               placement found is remembered.
 * 5. REPORT   — if not everything placed, return the unplaced jobs
 *               with a human reason. We NEVER return a routine that
 *               breaks a hard rule to pretend we succeeded.
 */

import {
  ClassSubjectData,
  Job,
  Placement,
  ScheduleConfig,
  SolveResult,
  SubjectData,
  TeacherData,
  unavailableKey,
} from "./types.js";

// ---------------------------------------------------------------------------
// Step 1 + 2: expand hours into jobs, ordered hardest-first
// ---------------------------------------------------------------------------

export function expandJobs(
  teachers: Map<string, TeacherData>,
  subjects: Map<string, SubjectData>,
  classSubjects: ClassSubjectData[],
): Job[] {
  const raw: Omit<Job, "jobIndex">[] = [];
  for (const cs of classSubjects) {
    const subject = subjects.get(cs.subjectId);
    if (!subject) continue;
    const eligible = [...teachers.values()]
      .filter((t) => t.subjects.has(cs.subjectId))
      .map((t) => t.id);
    const hours = cs.hours;
    if (subject.type === "lab") {
      // H8: labs move in 2-period blocks. An odd hour leaves one
      // single-period job which the caller should treat as a data
      // error (the validation report flags it); we still expand it
      // as a 1-period job so nothing is silently dropped.
      const blocks = Math.floor(hours / 2);
      for (let i = 0; i < blocks; i++) {
        raw.push({ classId: cs.classId, subjectId: cs.subjectId, duration: 2, eligibleTeachers: eligible });
      }
      if (hours % 2 === 1) {
        raw.push({ classId: cs.classId, subjectId: cs.subjectId, duration: 1, eligibleTeachers: eligible });
      }
    } else {
      for (let i = 0; i < hours; i++) {
        raw.push({ classId: cs.classId, subjectId: cs.subjectId, duration: 1, eligibleTeachers: eligible });
      }
    }
  }

  // Hardest first (fail-first):
  //   1. longer duration first (labs before theory)
  //   2. fewer eligible teachers first (most constrained)
  //   3. subject with the most total hours first
  const hoursBySubject = new Map<string, number>();
  for (const cs of classSubjects) {
    hoursBySubject.set(cs.subjectId, (hoursBySubject.get(cs.subjectId) ?? 0) + cs.hours);
  }
  raw.sort((a, b) => {
    if (b.duration !== a.duration) return b.duration - a.duration;
    if (a.eligibleTeachers.length !== b.eligibleTeachers.length)
      return a.eligibleTeachers.length - b.eligibleTeachers.length;
    const byHours = (hoursBySubject.get(b.subjectId) ?? 0) - (hoursBySubject.get(a.subjectId) ?? 0);
    if (byHours !== 0) return byHours;
    if (a.classId !== b.classId) return a.classId < b.classId ? -1 : 1;
    if (a.subjectId !== b.subjectId) return a.subjectId < b.subjectId ? -1 : 1;
    return 0;
  });
  return raw.map((j, i) => ({ ...j, jobIndex: i }));
}

// ---------------------------------------------------------------------------
// The solver
// ---------------------------------------------------------------------------

interface Candidate {
  score: number;
  day: string;
  start: number;
  teacherId: string;
  teacherOrder: number; // index into job.eligibleTeachers (deterministic ties)
}

export class Solver {
  private teachers: Map<string, TeacherData>;
  private subjects: Map<string, SubjectData>;
  private days: string[];
  private dayIndex: Map<string, number>;
  private periods: number;
  private lunchAfter: number | null;
  private timeLimitMs: number;
  private maxNodes: number;
  private jobs: Job[];

  // Mutable search state (all undone on backtrack):
  private classBusy = new Set<string>(); // "class|day|period"        -> H2
  private teacherBusy = new Set<string>(); // "teacher|day|period"    -> H1
  private teacherDay = new Map<string, number>(); // "teacher|day" -> n -> H3
  private teacherWeek = new Map<string, number>(); // teacher -> n      -> H4
  private classSubjectDay = new Map<string, number>(); // -> S1
  private classDayPeriods = new Map<string, Set<number>>(); // -> S3
  private placed: Placement[] = [];

  private nodes = 0;
  private deadline = 0;
  private best: Placement[] = []; // deepest partial placement seen

  constructor(
    teachers: Map<string, TeacherData>,
    subjects: Map<string, SubjectData>,
    classSubjects: ClassSubjectData[],
    config: ScheduleConfig,
    timeLimitSeconds = 10,
    maxNodes = 300_000,
  ) {
    this.teachers = teachers;
    this.subjects = subjects;
    this.days = [...config.days];
    this.dayIndex = new Map(this.days.map((d, i) => [d, i]));
    this.periods = config.periodsPerDay;
    this.lunchAfter = config.lunchAfter;
    this.timeLimitMs = timeLimitSeconds * 1000;
    this.maxNodes = maxNodes;
    this.jobs = expandJobs(teachers, subjects, classSubjects);
  }

  // -- hard-rule check ------------------------------------------------------
  /** Returns null if legal, else a short reason string. */
  canPlace(job: Job, day: string, start: number, teacherId: string): string | null {
    const teacher = this.teachers.get(teacherId)!;
    const end = start + job.duration - 1;

    if (end > this.periods) return "outside the day";
    // H8: a 2-period block must not span lunch (e.g. P4+P5 when
    // lunch sits after P4 are not truly consecutive).
    if (job.duration === 2 && this.lunchAfter !== null && start <= this.lunchAfter && this.lunchAfter < start + job.duration) {
      return "lab would span the lunch break";
    }
    // H4: weekly cap (checked once, it covers every period equally)
    if ((this.teacherWeek.get(teacherId) ?? 0) + job.duration > teacher.weeklyHours) {
      return `${teacher.name} would exceed weekly hours (H4)`;
    }
    // H3: daily cap
    if ((this.teacherDay.get(`${teacherId}|${day}`) ?? 0) + job.duration > teacher.maxPerDay) {
      return `${teacher.name} would exceed max/day (H3)`;
    }
    for (let p = start; p <= end; p++) {
      if (this.classBusy.has(`${job.classId}|${day}|${p}`)) {
        return "class already has a period in that slot (H2)";
      }
      if (this.teacherBusy.has(`${teacherId}|${day}|${p}`)) {
        return `${teacher.name} is busy in another class (H1)`;
      }
      if (teacher.unavailable.has(unavailableKey(day, p)) || teacher.unavailable.has(unavailableKey(day, null))) {
        return `${teacher.name} is unavailable then (H7)`;
      }
    }
    return null;
  }

  // -- soft scoring (S1, S2, S3) — lower is better --------------------------
  softScore(job: Job, day: string, start: number, teacherId: string): number {
    let score = 0;
    // S1: same subject already taught to this class today?
    score += 15 * (this.classSubjectDay.get(`${job.classId}|${job.subjectId}|${day}`) ?? 0);
    // S2: prefer the teacher's lighter days / lighter week.
    score += 3 * (this.teacherDay.get(`${teacherId}|${day}`) ?? 0);
    score += 0.5 * (this.teacherWeek.get(teacherId) ?? 0);
    // S3: middle gaps — count empty periods that would end up
    // trapped between the first and last filled period of the class
    // that day after this placement.
    const filled = new Set(this.classDayPeriods.get(`${job.classId}|${day}`) ?? []);
    for (let p = start; p < start + job.duration; p++) filled.add(p);
    if (filled.size > 0) {
      const gaps = Math.max(...filled) - Math.min(...filled) + 1 - filled.size;
      score += 4 * gaps;
    }
    // Mild tie-breakers: earlier day, earlier period (deterministic).
    score += 0.01 * (this.dayIndex.get(day) ?? 0) + 0.01 * start;
    return score;
  }

  candidates(job: Job): Candidate[] {
    const out: Candidate[] = [];
    for (const day of this.days) {
      for (let start = 1; start <= this.periods - job.duration + 1; start++) {
        job.eligibleTeachers.forEach((tid, teacherOrder) => {
          if (this.canPlace(job, day, start, tid) === null) {
            out.push({ score: this.softScore(job, day, start, tid), day, start, teacherId: tid, teacherOrder });
          }
        });
      }
    }
    out.sort(
      (a, b) =>
        a.score - b.score ||
        (this.dayIndex.get(a.day) ?? 0) - (this.dayIndex.get(b.day) ?? 0) ||
        a.start - b.start ||
        a.teacherOrder - b.teacherOrder,
    );
    return out;
  }

  // -- state mutation ---------------------------------------------------------
  private apply(job: Job, day: string, start: number, teacherId: string): void {
    for (let p = start; p < start + job.duration; p++) {
      this.classBusy.add(`${job.classId}|${day}|${p}`);
      this.teacherBusy.add(`${teacherId}|${day}|${p}`);
      const key = `${job.classId}|${day}`;
      if (!this.classDayPeriods.has(key)) this.classDayPeriods.set(key, new Set());
      this.classDayPeriods.get(key)!.add(p);
    }
    const dayKey = `${teacherId}|${day}`;
    this.teacherDay.set(dayKey, (this.teacherDay.get(dayKey) ?? 0) + job.duration);
    this.teacherWeek.set(teacherId, (this.teacherWeek.get(teacherId) ?? 0) + job.duration);
    const csKey = `${job.classId}|${job.subjectId}|${day}`;
    this.classSubjectDay.set(csKey, (this.classSubjectDay.get(csKey) ?? 0) + 1);
    this.placed.push({ job, day, period: start, teacherId });
  }

  private undo(job: Job, day: string, start: number, teacherId: string): void {
    for (let p = start; p < start + job.duration; p++) {
      this.classBusy.delete(`${job.classId}|${day}|${p}`);
      this.teacherBusy.delete(`${teacherId}|${day}|${p}`);
      this.classDayPeriods.get(`${job.classId}|${day}`)?.delete(p);
    }
    const dayKey = `${teacherId}|${day}`;
    this.teacherDay.set(dayKey, (this.teacherDay.get(dayKey) ?? 0) - job.duration);
    this.teacherWeek.set(teacherId, (this.teacherWeek.get(teacherId) ?? 0) - job.duration);
    const csKey = `${job.classId}|${job.subjectId}|${day}`;
    this.classSubjectDay.set(csKey, (this.classSubjectDay.get(csKey) ?? 0) - 1);
    this.placed.pop();
  }

  // -- depth-first search with backtracking -----------------------------------
  private search(idx: number): boolean {
    if (idx === this.jobs.length) return true;
    if (Date.now() > this.deadline || this.nodes > this.maxNodes) return false;
    this.nodes += 1;
    if (this.placed.length > this.best.length) this.best = [...this.placed];

    const job = this.jobs[idx];
    for (const c of this.candidates(job)) {
      this.apply(job, c.day, c.start, c.teacherId);
      if (this.search(idx + 1)) return true;
      this.undo(job, c.day, c.start, c.teacherId);
      if (Date.now() > this.deadline || this.nodes > this.maxNodes) return false;
    }
    return false;
  }

  private reasonFor(job: Job): string {
    if (job.eligibleTeachers.length === 0) {
      return "no teacher is eligible for this subject (H6)";
    }
    const subject = this.subjects.get(job.subjectId);
    if (subject?.type === "lab" && this.periods < 2) {
      return "lab needs 2 consecutive periods but the day is shorter";
    }
    const caps = job.eligibleTeachers.reduce(
      (sum, t) => sum + (this.teachers.get(t)?.weeklyHours ?? 0),
      0,
    );
    return (
      "no free slot satisfies all hard rules — class/teacher busy, " +
      `daily/weekly caps or unavailability (eligible teachers' combined weekly cap is ${caps})`
    );
  }

  solve(): SolveResult {
    const started = Date.now();
    this.deadline = started + this.timeLimitMs;
    const solved = this.search(0);
    const elapsedSeconds = (Date.now() - started) / 1000;

    const placements = solved ? [...this.placed] : [...this.best];
    const placedJobIdx = new Set(placements.map((p) => p.job.jobIndex));
    const unplaced = this.jobs
      .filter((j) => !placedJobIdx.has(j.jobIndex))
      .map((j) => ({
        classId: j.classId,
        subjectId: j.subjectId,
        duration: j.duration,
        reason: this.reasonFor(j),
      }));

    // Flatten placements to single-period rows (labs -> 2 rows).
    const entries = placements.flatMap((p) =>
      Array.from({ length: p.job.duration }, (_, offset) => ({
        classId: p.job.classId,
        subjectId: p.job.subjectId,
        teacherId: p.teacherId,
        day: p.day,
        period: p.period + offset,
      })),
    );

    return {
      placements,
      unplaced,
      success: solved,
      elapsedSeconds,
      nodes: this.nodes,
      totalJobs: this.jobs.length,
      entries,
    };
  }
}

/** One-call convenience wrapper used by the API and the tests. */
export function solve(
  teachers: Map<string, TeacherData>,
  subjects: Map<string, SubjectData>,
  classSubjects: ClassSubjectData[],
  config: ScheduleConfig,
  timeLimitSeconds = 10,
): SolveResult {
  return new Solver(teachers, subjects, classSubjects, config, timeLimitSeconds).solve();
}
