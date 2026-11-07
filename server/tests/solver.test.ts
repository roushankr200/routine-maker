/**
 * Solver tests — ported from the Python suite (same 8 invariants).
 * Pure solver on in-memory data: NO database needed.
 * Run: npm test  (vitest)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { solve } from "../src/solver/solver.js";
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

describe("demo dataset solves clean", () => {
  it("places every job: full placement, success = true", () => {
    expect(result.success, `unplaced: ${JSON.stringify(result.unplaced)}`).toBe(true);
    const total = classSubjects.reduce((s, c) => s + c.hours, 0);
    expect(result.entries.length).toBe(total);
    expect(total).toBe(86);
    expect(result.totalJobs).toBe(78);
  });

  it("H1: no teacher teaches two classes in the same slot", () => {
    const seen = counter(result.entries.map((e) => `${e.teacherId}|${e.day}|${e.period}`));
    for (const v of seen.values()) expect(v).toBe(1);
  });

  it("H2: no class has two subjects in the same slot", () => {
    const seen = counter(result.entries.map((e) => `${e.classId}|${e.day}|${e.period}`));
    for (const v of seen.values()) expect(v).toBe(1);
  });

  it("H3/H4: teacher daily and weekly caps respected", () => {
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

  it("H8: labs are consecutive pairs, same teacher, never spanning lunch", () => {
    const labIds = new Set(
      [...subjects.values()].filter((s) => s.type === "lab").map((s) => s.id),
    );
    const groups = new Map<string, typeof result.entries>();
    for (const e of result.entries) {
      if (!labIds.has(e.subjectId)) continue;
      const key = `${e.classId}|${e.subjectId}|${e.day}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    const lunch = config.lunchAfter;
    for (const [key, es] of groups) {
      expect(es.length % 2, `odd lab periods ${key}`).toBe(0);
      const used = new Set<number>();
      for (const e of [...es].sort((a, b) => a.period - b.period)) {
        if (used.has(e.period)) continue;
        const partner = es.find(
          (x) => x.period === e.period + 1 && x.teacherId === e.teacherId,
        );
        expect(partner, `lab period ${JSON.stringify(e)} has no consecutive partner`).toBeTruthy();
        if (lunch !== null) expect(e.period, "lab spans lunch").not.toBe(lunch);
        used.add(e.period);
        used.add(e.period + 1);
      }
    }
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
    const s = new Map([["S1", { id: "S1", name: "X", code: "X1", type: "theory" as const }]]);
    const cs = [{ classId: "C1", subjectId: "S1", hours: 10 }];
    const cfg = { days: ["Monday", "Tuesday"], periodsPerDay: 3, lunchAfter: null };
    const r = solve(t, s, cs, cfg, 5);
    expect(r.success).toBe(false);
    expect(r.unplaced.length).toBeGreaterThan(0);
    expect(r.unplaced[0].reason.length).toBeGreaterThan(0);
  });
});
