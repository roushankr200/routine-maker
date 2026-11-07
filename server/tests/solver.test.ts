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
import { SolveResult, unavailableKey } from "../src/solver/types.js";
import { buildDemoSolverData } from "../src/demoData.js";

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
    const total = classSubjects.reduce((s, c) => s + c.hours, 0);
    expect(result.entries.length).toBe(total);
    // NITA MCA seed (block model): Sem 1 = 25h + Sem 3 = 24h + Sem 5 = 23h
    // = 72 hours; each class runs 12 sessions (5 theory subjects split
    // 2+2 or 2+1, 2 labs as single 3h blocks) = 36 sessions.
    expect(total).toBe(72);
    expect(result.totalJobs).toBe(36);
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
      expect(got.get(`${cs.classId}|${cs.subjectId}`)).toBe(cs.hours);
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
      const expected = splitSessions(cs.hours, subject.sessionHours).sort((a, b) => a - b);
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
    for (const p of labs) {
      const subject = subjects.get(p.job.subjectId)!;
      // Demo labs: 3h/week at sessionHours 3 -> exactly one 3h block each.
      expect(p.job.duration).toBe(subject.sessionHours);
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
