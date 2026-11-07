/**
 * Load-balance / coverage preview — a GREEDY suggested distribution of
 * the required class hours across the eligible teachers.
 *
 * This is NOT the solver: it ignores days, periods and availability and
 * answers two planning questions while data is being entered:
 *   1. Coverage — for every subject, how many of its required weekly
 *      hours are still LEFT to cover given the teachers' weekly caps?
 *   2. Balance — which teachers end up with a small share of the work,
 *      so subjects can be re-distributed to even the load out?
 *
 * Pure function of plain data (like the solver), so it is unit-tested
 * directly and shared by both balance endpoints:
 *   POST /api/balance/preview — wizard state (codes, no DB ids)
 *   GET  /api/balance         — the saved workspace data
 *
 * Algorithm: requirements are processed most-constrained first
 * (fewest eligible teachers, then most hours). Each requirement's
 * hours go to the eligible teacher with the lowest suggested load so
 * far who still has weekly capacity; when that teacher fills up
 * mid-requirement, the rest spills to the next-least-loaded eligible
 * teacher (a requirement may be SPLIT across teachers). Nothing ever
 * exceeds a teacher's weekly max.
 */

export interface BalanceTeacherInput {
  /** Faculty code (display + identity), e.g. "DJB". */
  code: string;
  name: string;
  weeklyMaxHours: number;
  /** Subject CODES this teacher can teach (H6 eligibility). */
  eligibleSubjectCodes: string[];
}

export interface BalanceSubjectInput {
  code: string;
}

export interface BalanceRequirementInput {
  /** Display label of the class, e.g. "B.Tech Sem 5 A". */
  classLabel: string;
  subjectCode: string;
  hours: number;
}

export interface BalanceInput {
  teachers: BalanceTeacherInput[];
  subjects: BalanceSubjectInput[];
  requirements: BalanceRequirementInput[];
}

export type TeacherLoadStatus = "under" | "full" | "balanced";

export interface SubjectBalance {
  code: string;
  requiredHours: number;
  assignedHours: number;
  /** requiredHours - assignedHours: the hours still left to cover. */
  remainingHours: number;
  eligibleTeacherCodes: string[];
}

export interface TeacherBalance {
  code: string;
  name: string;
  suggestedHours: number;
  weeklyMaxHours: number;
  /** Suggested hours grouped by subject code, sorted by code. */
  subjects: Array<{ code: string; hours: number }>;
  status: TeacherLoadStatus;
}

export interface BalanceReport {
  perSubject: SubjectBalance[];
  perTeacher: TeacherBalance[];
  totals: { requiredHours: number; assignedHours: number; remainingHours: number };
  /** Mean suggested load across teachers who can teach at least one subject. */
  averageSuggestedHours: number;
}

/** Codes match case-insensitively (wizard codes are typed by hand). */
const key = (code: string) => code.trim().toUpperCase();

interface TeacherState {
  input: BalanceTeacherInput;
  displayCode: string;
  normCode: string;
  eligible: Set<string>; // normalised subject codes
  load: number;
  bySubject: Map<string, { code: string; hours: number }>; // norm subject code -> row
}

export function computeBalance(input: BalanceInput): BalanceReport {
  // ---- normalise teachers -------------------------------------------
  const teachers: TeacherState[] = input.teachers.map((t, i) => ({
    input: t,
    displayCode: t.code.trim() || `#${i + 1}`,
    normCode: key(t.code) || `#${i + 1}`,
    eligible: new Set(t.eligibleSubjectCodes.map(key).filter(Boolean)),
    load: 0,
    bySubject: new Map(),
  }));
  // ---- subject registry (subjects list first, then any stray codes) -
  const subjectDisplay = new Map<string, string>(); // norm -> display code
  for (const s of input.subjects) {
    const n = key(s.code);
    if (n && !subjectDisplay.has(n)) subjectDisplay.set(n, s.code.trim());
  }
  for (const r of input.requirements) {
    const n = key(r.subjectCode);
    if (n && !subjectDisplay.has(n)) subjectDisplay.set(n, r.subjectCode.trim());
  }

  const eligibleFor = (subjectNorm: string): TeacherState[] =>
    teachers.filter((t) => t.eligible.has(subjectNorm));

  // ---- required hours per subject ------------------------------------
  const required = new Map<string, number>();
  for (const r of input.requirements) {
    if (r.hours <= 0) continue;
    const n = key(r.subjectCode);
    if (!n) continue;
    required.set(n, (required.get(n) ?? 0) + r.hours);
  }

  // ---- greedy assignment ---------------------------------------------
  const ordered = input.requirements
    .filter((r) => r.hours > 0 && key(r.subjectCode))
    .map((r) => ({ r, eligibleCount: eligibleFor(key(r.subjectCode)).length }))
    .sort(
      (a, b) =>
        a.eligibleCount - b.eligibleCount || // most constrained first
        b.r.hours - a.r.hours || // then biggest requirement first
        key(a.r.subjectCode).localeCompare(key(b.r.subjectCode)) ||
        a.r.classLabel.localeCompare(b.r.classLabel),
    );

  const assigned = new Map<string, number>(); // norm subject code -> hours
  for (const { r } of ordered) {
    const n = key(r.subjectCode);
    let remaining = r.hours;
    while (remaining > 0) {
      const candidates = eligibleFor(n)
        .filter((t) => t.load < t.input.weeklyMaxHours)
        .sort((a, b) => a.load - b.load || a.normCode.localeCompare(b.normCode));
      if (candidates.length === 0) break; // nobody has capacity left
      const t = candidates[0];
      const chunk = Math.min(t.input.weeklyMaxHours - t.load, remaining);
      t.load += chunk;
      const row = t.bySubject.get(n) ?? { code: subjectDisplay.get(n)!, hours: 0 };
      row.hours += chunk;
      t.bySubject.set(n, row);
      assigned.set(n, (assigned.get(n) ?? 0) + chunk);
      remaining -= chunk;
    }
  }

  // ---- report ----------------------------------------------------------
  const perSubject: SubjectBalance[] = [...subjectDisplay.entries()]
    .map(([n, code]) => {
      const requiredHours = required.get(n) ?? 0;
      const assignedHours = assigned.get(n) ?? 0;
      return {
        code,
        requiredHours,
        assignedHours,
        remainingHours: requiredHours - assignedHours,
        eligibleTeacherCodes: eligibleFor(n).map((t) => t.displayCode),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const withEligibility = teachers.filter((t) => t.eligible.size > 0);
  const averageSuggestedHours =
    withEligibility.length === 0
      ? 0
      : withEligibility.reduce((sum, t) => sum + t.load, 0) / withEligibility.length;

  const perTeacher: TeacherBalance[] = teachers.map((t) => {
    const suggestedHours = t.load;
    const weeklyMaxHours = t.input.weeklyMaxHours;
    let status: TeacherLoadStatus;
    if (suggestedHours >= weeklyMaxHours) status = "full";
    else if (suggestedHours < 0.6 * averageSuggestedHours) status = "under";
    else status = "balanced";
    return {
      code: t.displayCode,
      name: t.input.name,
      suggestedHours,
      weeklyMaxHours,
      subjects: [...t.bySubject.values()].sort((a, b) => a.code.localeCompare(b.code)),
      status,
    };
  });

  const totalRequired = perSubject.reduce((s, x) => s + x.requiredHours, 0);
  const totalAssigned = perSubject.reduce((s, x) => s + x.assignedHours, 0);
  return {
    perSubject,
    perTeacher,
    totals: {
      requiredHours: totalRequired,
      assignedHours: totalAssigned,
      remainingHours: totalRequired - totalAssigned,
    },
    averageSuggestedHours: Math.round(averageSuggestedHours * 100) / 100,
  };
}
