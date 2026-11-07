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
}

/** One placeable unit: 1 period of theory, or one 2-period lab block. */
export interface Job {
  jobIndex: number;
  classId: string;
  subjectId: string;
  duration: number; // 1 = theory, 2 = lab block
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

/** One single-period row of the final routine (labs flatten to 2 rows). */
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
