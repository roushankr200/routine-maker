/**
 * Plain-data shapes the solver works on. The DB layer (loadSolverData)
 * converts Mongoose documents into these; the tests build them directly
 * in memory. The solver itself never touches the database — it is a
 * pure function of these shapes, exactly like the original design.
 *
 * Ids are strings here (Mongo ObjectIds stringified, or simple test ids).
 */

export interface TeacherData {
  id: string;
  name: string;
  maxPerDay: number;
  weeklyHours: number;
  /** Subject ids this teacher is eligible to teach (H6). */
  subjects: Set<string>;
  /**
   * Blocked slots, encoded "Day|period" for a single period and
   * "Day|*" for a whole day off (H7).
   */
  unavailable: Set<string>;
}

export interface SubjectData {
  id: string;
  name: string;
  code: string;
  type: "theory" | "lab";
  /**
   * Length (in hourly grid slots) of ONE session of this subject, as on
   * the real NITA sheet: theory sessions run 1–2 consecutive hours
   * (default 2), lab sessions 2–3 consecutive hours (default 3).
   * A class-subject's weekly hours are split into sessions of this
   * length, plus one shorter remainder session when hours do not
   * divide evenly (e.g. theory 3h @ 2h/session -> 2h + 1h).
   */
  sessionHours: number;
}

/** Default session length by subject type (real-sheet pattern). */
export function defaultSessionHours(type: "theory" | "lab"): number {
  return type === "lab" ? 3 : 2;
}

/**
 * Normalise a stored sessionHours value: fall back to the type default
 * when missing/out of range (theory 1–2, lab 2–3).
 */
export function sessionHoursOf(subject: SubjectData): number {
  const fallback = defaultSessionHours(subject.type);
  const v = subject.sessionHours;
  if (!Number.isInteger(v)) return fallback;
  if (subject.type === "theory") return v >= 1 && v <= 2 ? v : fallback;
  return v >= 2 && v <= 3 ? v : fallback;
}

export interface ClassSubjectData {
  classId: string;
  subjectId: string;
  hours: number;
}

export interface ScheduleConfig {
  days: string[];
  periodsPerDay: number;
  /** Lunch sits after this period number, or null for no lunch break. */
  lunchAfter: number | null;
  /**
   * Presentation-only fields (the solver ignores them): they let the
   * master sheet print real clock times and the session header, the
   * way the NITA CSE master routine does. The grid unit is one hour:
   * times are computed from startTime + periodDuration, with lunch
   * occupying one grid slot in the clock (NITA pattern: hourly grid
   * from 9:00, lunch 1–2). Sessions are BLOCKS merged across hours.
   */
  periodDuration?: number;
  startTime?: string; // "HH:MM", 24h
  session?: string; // e.g. "ODD 2026"
  effectiveFrom?: string; // "w.e.f." date text, e.g. "27/07/2026"
  /** Department full name, e.g. "Computer Science and Engineering". */
  department?: string;
  /** Department short name for the sheet masthead, e.g. "CSE". */
  departmentShort?: string;
}

/**
 * One placeable unit: a single SESSION — a block of consecutive hourly
 * slots (theory 1–2h, lab 2–3h, or a shorter remainder session).
 */
export interface Job {
  jobIndex: number;
  classId: string;
  subjectId: string;
  duration: number; // session length in hourly slots
  eligibleTeachers: string[]; // teacher ids allowed by H6, insertion order
}

export interface Placement {
  job: Job;
  day: string;
  period: number; // first period of the block
  teacherId: string;
}

export interface UnplacedJob {
  classId: string;
  subjectId: string;
  duration: number;
  reason: string;
}

/** One hourly row of the final routine (a session flattens to `duration` rows). */
export interface RoutineEntryData {
  classId: string;
  subjectId: string;
  teacherId: string;
  day: string;
  period: number;
}

export interface SolveResult {
  placements: Placement[];
  unplaced: UnplacedJob[];
  success: boolean;
  elapsedSeconds: number;
  nodes: number;
  totalJobs: number;
  entries: RoutineEntryData[];
}

export function unavailableKey(day: string, period: number | null): string {
  return period === null ? `${day}|*` : `${day}|${period}`;
}
