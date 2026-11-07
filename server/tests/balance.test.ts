/**
 * Load-balance / coverage tests — the greedy suggested distribution
 * behind GET /api/balance and POST /api/balance/preview.
 * Pure function on in-memory data: NO database needed.
 * Run: npm test  (vitest)
 */
import { describe, it, expect } from "vitest";
import { computeBalance, BalanceInput } from "../src/solver/balance.js";

const T = (code: string, weeklyMaxHours: number, eligibleSubjectCodes: string[], name = code) => ({
  code,
  name,
  weeklyMaxHours,
  eligibleSubjectCodes,
});

describe("computeBalance — greedy suggested distribution", () => {
  it("never exceeds a teacher's weekly max; the excess stays as remaining hours", () => {
    const input: BalanceInput = {
      teachers: [T("AA", 4, ["X"])],
      subjects: [{ code: "X" }],
      requirements: [{ classLabel: "C1", subjectCode: "X", hours: 10 }],
    };
    const r = computeBalance(input);
    expect(r.perTeacher[0].suggestedHours).toBe(4);
    expect(r.perSubject[0]).toMatchObject({
      code: "X",
      requiredHours: 10,
      assignedHours: 4,
      remainingHours: 6,
    });
    expect(r.totals).toEqual({ requiredHours: 10, assignedHours: 4, remainingHours: 6 });
  });

  it("splits a requirement across teachers when the least-loaded one fills up", () => {
    const input: BalanceInput = {
      teachers: [T("AA", 6, ["X"]), T("BB", 6, ["X"])],
      subjects: [{ code: "X" }],
      requirements: [{ classLabel: "C1", subjectCode: "X", hours: 10 }],
    };
    const r = computeBalance(input);
    const loads = Object.fromEntries(r.perTeacher.map((t) => [t.code, t.suggestedHours]));
    // Both teachers are used, neither exceeds the 6h cap, all 10h covered.
    expect(loads.AA).toBeGreaterThan(0);
    expect(loads.BB).toBeGreaterThan(0);
    expect(loads.AA + loads.BB).toBe(10);
    expect(loads.AA).toBeLessThanOrEqual(6);
    expect(loads.BB).toBeLessThanOrEqual(6);
    expect(r.perSubject[0].remainingHours).toBe(0);
  });

  it("spreads per-class requirements to the least-loaded eligible teacher", () => {
    const input: BalanceInput = {
      teachers: [T("AA", 20, ["X"]), T("BB", 20, ["X"])],
      subjects: [{ code: "X" }],
      requirements: [
        { classLabel: "C1", subjectCode: "X", hours: 4 },
        { classLabel: "C2", subjectCode: "X", hours: 4 },
        { classLabel: "C3", subjectCode: "X", hours: 4 },
        { classLabel: "C4", subjectCode: "X", hours: 4 },
      ],
    };
    const r = computeBalance(input);
    const loads = r.perTeacher.map((t) => t.suggestedHours).sort((a, b) => a - b);
    expect(loads).toEqual([8, 8]); // perfectly even split over 4 class requirements
  });

  it("computes remaining hours per subject, including a subject nobody can teach", () => {
    const input: BalanceInput = {
      teachers: [T("AA", 20, ["X"])],
      subjects: [{ code: "X" }, { code: "Y" }, { code: "Z" }],
      requirements: [
        { classLabel: "C1", subjectCode: "X", hours: 6 },
        { classLabel: "C1", subjectCode: "Y", hours: 5 },
      ],
    };
    const r = computeBalance(input);
    const byCode = Object.fromEntries(r.perSubject.map((s) => [s.code, s]));
    expect(byCode.X).toMatchObject({ requiredHours: 6, assignedHours: 6, remainingHours: 0 });
    expect(byCode.Y).toMatchObject({ requiredHours: 5, assignedHours: 0, remainingHours: 5 });
    expect(byCode.Y.eligibleTeacherCodes).toEqual([]);
    // Z is defined but never required: it still appears, fully covered at 0h.
    expect(byCode.Z).toMatchObject({ requiredHours: 0, assignedHours: 0, remainingHours: 0 });
    expect(byCode.X.eligibleTeacherCodes).toEqual(["AA"]);
  });

  it("flags under-loaded teachers (< 60% of the average load) and full ones", () => {
    const input: BalanceInput = {
      teachers: [
        T("AA", 20, ["X"]), // only teacher for X -> takes all 20h -> full
        T("BB", 20, ["Y"]),
        T("CC", 20, ["Y"]), // same eligibility as BB but loses the tie -> 0h
      ],
      subjects: [{ code: "X" }, { code: "Y" }],
      requirements: [
        { classLabel: "C1", subjectCode: "X", hours: 20 },
        { classLabel: "C1", subjectCode: "Y", hours: 2 },
      ],
    };
    const r = computeBalance(input);
    const byCode = Object.fromEntries(r.perTeacher.map((t) => [t.code, t]));
    // Average load = (20 + 2 + 0) / 3 ≈ 7.33h; 60% of that ≈ 4.4h.
    expect(r.averageSuggestedHours).toBeCloseTo(22 / 3, 2);
    expect(byCode.AA.suggestedHours).toBe(20);
    expect(byCode.AA.status).toBe("full");
    expect(byCode.BB.suggestedHours).toBe(2);
    expect(byCode.BB.status).toBe("under"); // 2h < 4.4h and below own 20h max
    expect(byCode.CC.suggestedHours).toBe(0);
    expect(byCode.CC.status).toBe("under");
  });

  it("marks an evenly loaded teacher 'balanced'", () => {
    const input: BalanceInput = {
      teachers: [T("AA", 20, ["X"]), T("BB", 20, ["X"])],
      subjects: [{ code: "X" }],
      requirements: [
        { classLabel: "C1", subjectCode: "X", hours: 4 },
        { classLabel: "C2", subjectCode: "X", hours: 4 },
      ],
    };
    const r = computeBalance(input);
    for (const t of r.perTeacher) {
      expect(t.suggestedHours).toBe(4);
      expect(t.status).toBe("balanced"); // 4h = average, below the 20h max
    }
  });

  it("aggregates a teacher's hours per subject across classes", () => {
    const input: BalanceInput = {
      teachers: [T("AA", 30, ["X", "Y"])],
      subjects: [{ code: "X" }, { code: "Y" }],
      requirements: [
        { classLabel: "C1", subjectCode: "X", hours: 4 },
        { classLabel: "C2", subjectCode: "X", hours: 3 },
        { classLabel: "C1", subjectCode: "Y", hours: 2 },
      ],
    };
    const r = computeBalance(input);
    expect(r.perTeacher[0].subjects).toEqual([
      { code: "X", hours: 7 },
      { code: "Y", hours: 2 },
    ]);
    expect(r.perTeacher[0].suggestedHours).toBe(9);
  });

  it("processes most-constrained requirements first (fewest eligible teachers)", () => {
    // S is teachable by both, R only by AA. If S were assigned first it
    // would eat AA's cap and strand R; constrained-first must cover both.
    const input: BalanceInput = {
      teachers: [T("AA", 6, ["R", "S"]), T("BB", 6, ["S"])],
      subjects: [{ code: "R" }, { code: "S" }],
      requirements: [
        { classLabel: "C1", subjectCode: "S", hours: 6 },
        { classLabel: "C1", subjectCode: "R", hours: 6 },
      ],
    };
    const r = computeBalance(input);
    expect(r.totals.remainingHours).toBe(0);
    const aa = r.perTeacher.find((t) => t.code === "AA")!;
    expect(aa.subjects).toEqual([{ code: "R", hours: 6 }]);
  });

  it("matches subject codes case-insensitively", () => {
    const input: BalanceInput = {
      teachers: [T("AA", 10, ["dbms"])],
      subjects: [{ code: "DBMS" }],
      requirements: [{ classLabel: "C1", subjectCode: "Dbms", hours: 4 }],
    };
    const r = computeBalance(input);
    expect(r.perSubject[0]).toMatchObject({ code: "DBMS", assignedHours: 4, remainingHours: 0 });
    expect(r.perTeacher[0].subjects).toEqual([{ code: "DBMS", hours: 4 }]);
  });
});
