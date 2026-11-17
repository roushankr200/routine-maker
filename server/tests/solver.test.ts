/**
 * Solver tests — the rule invariants (H1–H8) plus the BLOCK SESSION
 * model of the real NITA sheet: weekly hours split into sessions
 * (theory 1–2h, labs 2–3h, remainder = one shorter session), sessions
 * are contiguous, and no session ever crosses the lunch break.
 * Pure solver on in-memory data: NO database needed.
 * Run: npm test  (vitest)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { solve, splitSessions } from "../src/solver/solver.js";
import { SolveResult, scheduledWeeklyHours, unavailableKey } from "../src/solver/types.js";
import { buildDemoSolverData } from "../src/demoData.js";
import { checkBlockPlacement, savedFacultyWorkloadIssues } from "../src/routineCheck.js";

const { teachers, subjects, classSubjects, config } = buildDemoSolverData();
let result: SolveResult;

beforeAll(() => {
  result = solve(teachers, subjects, classSubjects, config, 10);
});

function counter<T extends string>(keys: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

/** A placement sits inside the morning segment or the afternoon one. */
function insideOneSegment(start: number, duration: number, lunchAfter: number | null): boolean {
  if (lunchAfter === null) return true;
  const end = start + duration - 1;
  return end <= lunchAfter || start > lunchAfter;
}

describe("demo dataset solves clean", () => {
  it("places every session: full placement, success = true", () => {
    expect(result.success, `unplaced: ${JSON.stringify(result.unplaced)}`).toBe(true);
    const total = classSubjects.reduce((s, c) => s + scheduledWeeklyHours(c.hours, subjects.get(c.subjectId)), 0);
    expect(result.entries.length).toBe(total);
    expect(total).toBe(400);
    expect(result.totalJobs).toBe(208);
  });

  it("H1: no teacher teaches two classes in the same slot", () => {
    const seen = counter(result.entries.map((e) => `${e.teacherId}|${e.day}|${e.period}`));
    for (const v of seen.values()) expect(v).toBe(1);
  });

  it("H2: no class has two subjects in the same slot", () => {
    const seen = counter(result.entries.map((e) => `${e.classId}|${e.day}|${e.period}`));
    for (const v of seen.values()) expect(v).toBe(1);
  });

  it("H3/H4: teacher daily and weekly caps respected (counted in hours)", () => {
    const day = counter(result.entries.map((e) => `${e.teacherId}|${e.day}`));
    const week = counter(result.entries.map((e) => e.teacherId));
    for (const t of teachers.values()) {
      expect(week.get(t.id) ?? 0).toBeLessThanOrEqual(t.weeklyHours);
      for (const d of config.days) {
        expect(day.get(`${t.id}|${d}`) ?? 0).toBeLessThanOrEqual(t.maxPerDay);
      }
    }
  });

  it("H5: every class gets exactly its required hours per subject", () => {
    const got = counter(result.entries.map((e) => `${e.classId}|${e.subjectId}`));
    for (const cs of classSubjects) {
      expect(got.get(`${cs.classId}|${cs.subjectId}`)).toBe(scheduledWeeklyHours(cs.hours, subjects.get(cs.subjectId)));
    }
  });

  it("H6/H7: only eligible teachers, never in an unavailable slot", () => {
    for (const e of result.entries) {
      const t = teachers.get(e.teacherId)!;
      expect(t.subjects.has(e.subjectId)).toBe(true);
      expect(t.unavailable.has(unavailableKey(e.day, e.period))).toBe(false);
      expect(t.unavailable.has(unavailableKey(e.day, null))).toBe(false);
    }
  });

  it("H9: no teacher teaches two consecutive classes on any day", () => {
    const byTeacherDay = new Map<string, Array<{ start: number; end: number }>>();
    for (const p of result.placements) {
      const key = `${p.teacherId}|${p.day}`;
      if (!byTeacherDay.has(key)) byTeacherDay.set(key, []);
      byTeacherDay.get(key)!.push({ start: p.period, end: p.period + p.job.duration - 1 });
    }
    for (const [key, sessions] of byTeacherDay.entries()) {
      sessions.sort((a, b) => a.start - b.start);
      for (let i = 0; i < sessions.length - 1; i++) {
        const curr = sessions[i];
        const next = sessions[i + 1];
        const isLunchGap = config.lunchAfter !== null && curr.end === config.lunchAfter && next.start === config.lunchAfter + 1;
        if (!isLunchGap) {
          expect(
            next.start,
            `Teacher ${key} has consecutive classes: P${curr.start}-${curr.end} and P${next.start}-${next.end}`,
          ).toBeGreaterThan(curr.end + 1);
        }
      }
    }
  });
});

describe("block sessions (the real sheet's model)", () => {
  it("splitSessions implements the remainder rule", () => {
    expect(splitSessions(4, 2)).toEqual([2, 2]);
    expect(splitSessions(3, 2)).toEqual([2, 1]);
    expect(splitSessions(3, 3)).toEqual([3]);
    expect(splitSessions(2, 2)).toEqual([2]);
    expect(splitSessions(6, 3)).toEqual([3, 3]);
    expect(splitSessions(0, 2)).toEqual([]);
  });

  it("every placed session has the subject's session length (or the remainder)", () => {
    const byKey = new Map<string, number[]>();
    for (const p of result.placements) {
      const key = `${p.job.classId}|${p.job.subjectId}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(p.job.duration);
    }
    for (const cs of classSubjects) {
      const subject = subjects.get(cs.subjectId)!;
      const expected = splitSessions(scheduledWeeklyHours(cs.hours, subject), subject.sessionHours).sort((a, b) => a - b);
      const got = (byKey.get(`${cs.classId}|${cs.subjectId}`) ?? []).sort((a, b) => a - b);
      expect(got, `${subject.code} for ${cs.classId}`).toEqual(expected);
    }
  });

  it("no session crosses the lunch break (all subjects)", () => {
    for (const p of result.placements) {
      expect(
        insideOneSegment(p.period, p.job.duration, config.lunchAfter),
        `${p.job.subjectId} ${p.day} P${p.period} len ${p.job.duration} crosses lunch`,
      ).toBe(true);
    }
  });

  it("every session is contiguous in the flattened hourly entries", () => {
    const entryKeys = new Set(
      result.entries.map((e) => `${e.classId}|${e.subjectId}|${e.teacherId}|${e.day}|${e.period}`),
    );
    for (const p of result.placements) {
      for (let off = 0; off < p.job.duration; off++) {
        expect(
          entryKeys.has(
            `${p.job.classId}|${p.job.subjectId}|${p.teacherId}|${p.day}|${p.period + off}`,
          ),
          `gap inside session ${p.job.subjectId} ${p.day} P${p.period}+${off}`,
        ).toBe(true);
      }
    }
  });

  it("H8: lab sessions are single unbroken blocks of their session length", () => {
    const labIds = new Set([...subjects.values()].filter((s) => s.type === "lab").map((s) => s.id));
    const labs = result.placements.filter((p) => labIds.has(p.job.subjectId));
    expect(labs.length).toBeGreaterThan(0);
    const hoursOf = new Map(classSubjects.map((cs) => [`${cs.classId}|${cs.subjectId}`, cs.hours]));
    for (const p of labs) {
      const subject = subjects.get(p.job.subjectId)!;
      // A lab session is one full block of the subject's session
      // length — or the single shorter remainder when the class's
      // hours don't divide evenly. The one remainder case in the
      // seed: M.Tech's AI Lab (2h/week) shares MCA's AI Lab subject
      // (sessionHours 3), so it places as one unbroken 2h block.
      const hours = hoursOf.get(`${p.job.classId}|${p.job.subjectId}`)!;
      const remainder = hours % subject.sessionHours;
      expect(
        p.job.duration === subject.sessionHours || p.job.duration === remainder,
        `${subject.code} for ${p.job.classId}: duration ${p.job.duration}`,
      ).toBe(true);
      expect(insideOneSegment(p.period, p.job.duration, config.lunchAfter)).toBe(true);
    }
  });

  it("synthetic: theory 3h @ 2h/session splits into a 2h and a 1h session", () => {
    const t = new Map([
      ["T1", { id: "T1", name: "Solo", maxPerDay: 7, weeklyHours: 35, subjects: new Set(["S1"]), unavailable: new Set<string>() }],
    ]);
    const s = new Map([
      ["S1", { id: "S1", name: "Theory", code: "TH", type: "theory" as const, sessionHours: 2 }],
    ]);
    const cfg = { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], periodsPerDay: 7, lunchAfter: 4 };
    const r = solve(t, s, [{ classId: "C1", subjectId: "S1", hours: 3 }], cfg, 5);
    expect(r.success).toBe(true);
    expect(r.placements.map((p) => p.job.duration).sort()).toEqual([1, 2]);
  });

  it("synthetic: a 3h lab block only starts where a full segment fits it", () => {
    const t = new Map([
      ["T1", { id: "T1", name: "Solo", maxPerDay: 7, weeklyHours: 35, subjects: new Set(["L1"]), unavailable: new Set<string>() }],
    ]);
    const s = new Map([
      ["L1", { id: "L1", name: "Lab", code: "LB", type: "lab" as const, sessionHours: 3 }],
    ]);
    const cfg = { days: ["Monday"], periodsPerDay: 7, lunchAfter: 4 };
    const r = solve(t, s, [{ classId: "C1", subjectId: "L1", hours: 3 }], cfg, 5);
    expect(r.success).toBe(true);
    expect(r.placements).toHaveLength(1);
    // Legal starts for 3h with lunch after P4: P1, P2 (morning) or P5 (afternoon).
    expect([1, 2, 5]).toContain(r.placements[0].period);
  });

  it("synthetic: a 2h lab (sessionHours 2) places as one 2h block", () => {
    const t = new Map([
      ["T1", { id: "T1", name: "Solo", maxPerDay: 7, weeklyHours: 35, subjects: new Set(["L1"]), unavailable: new Set<string>() }],
    ]);
    const s = new Map([
      ["L1", { id: "L1", name: "Lab", code: "LB", type: "lab" as const, sessionHours: 2 }],
    ]);
    const cfg = { days: ["Monday", "Tuesday"], periodsPerDay: 7, lunchAfter: 4 };
    const r = solve(t, s, [{ classId: "C1", subjectId: "L1", hours: 2 }], cfg, 5);
    expect(r.success).toBe(true);
    expect(r.placements).toHaveLength(1);
    expect(r.placements[0].job.duration).toBe(2);
    expect(insideOneSegment(r.placements[0].period, 2, cfg.lunchAfter)).toBe(true);
  });
});

describe("impossible data reports unplaced jobs", () => {
  it("overloaded single-teacher subject: success = false, unplaced non-empty", () => {
    const t = new Map([
      [
        "T1",
        {
          id: "T1",
          name: "Solo",
          maxPerDay: 1,
          weeklyHours: 2,
          subjects: new Set(["S1"]),
          unavailable: new Set<string>(),
        },
      ],
    ]);
    const s = new Map([
      ["S1", { id: "S1", name: "X", code: "X1", type: "theory" as const, sessionHours: 1 }],
    ]);
    const cs = [{ classId: "C1", subjectId: "S1", hours: 10 }];
    const cfg = { days: ["Monday", "Tuesday"], periodsPerDay: 3, lunchAfter: null };
    const r = solve(t, s, cs, cfg, 5);
    expect(r.success).toBe(false);
    expect(r.unplaced.length).toBeGreaterThan(0);
    expect(r.unplaced[0].reason.length).toBeGreaterThan(0);
  });
});

describe("saved and manually edited teaching sessions", () => {
  const teacher = { id: "T1", name: "Teacher", maxPerDay: 8, weeklyHours: 80,
    subjects: new Set(["S1"]), unavailable: new Set<string>() };
  const teachers = new Map([[teacher.id, teacher]]);
  const subjects = new Map([["S1", { id: "S1", name: "Theory", code: "TH", type: "theory" as const, sessionHours: 2 }]]);
  const grid = { periodsPerDay: 8, lunchAfter: 4 };
  const block = { classId: "C1", subjectId: "S1", teacherId: "T1", length: 2 };

  it("rejects adjacent blocks on either side and accepts the lunch break", () => {
    const entry = { id: "E1", classId: "C2", subjectId: "S1", teacherId: "T1", day: "Monday", period: 4 };
    expect(checkBlockPlacement([entry], block, "Monday", 2, teachers, subjects, grid)).toContain("H9");
    expect(checkBlockPlacement([{ ...entry, period: 1 }], block, "Monday", 2, teachers, subjects, grid)).toContain("H9");
    expect(checkBlockPlacement([entry], block, "Monday", 5, teachers, subjects, grid)).toBeNull();
    expect(savedFacultyWorkloadIssues([{ ...entry, sessionId: 1 }, { ...entry, id: "E2", period: 3, sessionId: 1 }], teachers, grid)).toEqual([]);
    expect(savedFacultyWorkloadIssues([{ ...entry, sessionId: 1 }, { ...entry, id: "E2", period: 3, sessionId: 2 }], teachers, grid)[0]).toContain("H9");
  });

  it("caps a legacy higher limit at 40 and still honors a lower individual limit", () => {
    const previous = Array.from({ length: 39 }, (_, i) => ({ id: `E${i}`, classId: "C2", subjectId: "S1", teacherId: "T1", day: `Earlier day ${i}`, period: 1 }));
    expect(checkBlockPlacement(previous, block, "Monday", 1, teachers, subjects, grid)).toContain("40 (H4)");
    expect(checkBlockPlacement(previous.slice(1), block, "Monday", 1, teachers, subjects, grid)).toBeNull();
    const lower = new Map([[teacher.id, { ...teacher, weeklyHours: 10 }]]);
    expect(checkBlockPlacement(previous.slice(0, 9), block, "Monday", 1, lower, subjects, grid)).toContain("10 (H4)");
  });
});
