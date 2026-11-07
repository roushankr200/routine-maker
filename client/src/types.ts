export interface ScheduleConfig {
  days: string[];
  periodsPerDay: number;
  lunchAfter: number | null;
  periodDuration?: number;
  /** Day start "HH:MM" (24h); period clock times are derived from it. */
  startTime?: string;
  /** Session label for the master sheet header, e.g. "ODD 2026". */
  session?: string;
  /** "w.e.f." date text for the master sheet header, e.g. "27/07/2026". */
  effectiveFrom?: string;
  /** Department full name, e.g. "Computer Science and Engineering". */
  department?: string;
  /** Department short name for the masthead, e.g. "CSE". */
  departmentShort?: string;
}

export interface Teacher {
  id: string;
  name: string;
  /** Faculty code printed on the master sheet, e.g. "DJB". */
  code: string;
  designation: string;
  maxPerDay: number;
  weeklyHours: number;
  subjects: string[]; // subject ids (eligibility)
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  type: "theory" | "lab";
  /** Session length in hours: theory 1–2 (default 2), lab 2–3 (default 3). */
  sessionHours: number;
}

export interface ClassRequirement {
  subjectId: string;
  hours: number;
  name: string;
  code: string;
  type: "theory" | "lab";
  sessionHours: number;
}

export interface ClassSection {
  id: string;
  program: string;
  year: string;
  section: string;
  name: string;
  requirements: ClassRequirement[];
  totalHours: number;
}

export interface RoutineEntry {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  day: string;
  period: number;
  subjectName: string;
  subjectCode: string;
  subjectType: "theory" | "lab";
  sessionHours: number;
  teacherName: string;
  teacherCode: string;
  className: string;
}

export interface GenerateResult {
  success: boolean;
  placedPeriods: number;
  totalPeriods: number;
  placedJobs: number;
  totalJobs: number;
  elapsedSeconds: number;
  nodes: number;
  unplaced: Array<{ className: string; subjectName: string; duration: number; reason: string }>;
  message: string;
}

export interface DashboardData {
  stats: { teachers: number; subjects: number; classes: number; entries: number };
  issues: string[];
  warnings: string[];
  hasRoutine: boolean;
  config: ScheduleConfig;
}

/** Payload of the New Department wizard (POST /api/setup/department). */
export interface WizardPayload {
  department: { name: string; short: string; session: string; effectiveFrom: string };
  classes: Array<{ program: string; year: string; section: string }>;
  subjects: Array<{ name: string; code: string; type: "theory" | "lab"; sessionHours: number }>;
  teachers: Array<{
    name: string;
    code: string;
    designation: string;
    maxPerDay: number;
    weeklyHours: number;
    /** Course CODES this teacher can teach. */
    subjects: string[];
    unavailableDay: string | null;
  }>;
  classSubjects: Array<{ classIndex: number; subjectCode: string; hours: number }>;
}

export interface DepartmentSetupResult {
  message: string;
  counts: { teachers: number; subjects: number; classes: number; classSubjects: number };
  validation: {
    issues: string[];
    warnings: string[];
    slotsPerWeek: number;
    demandBySubject: Array<{
      subject: string;
      demand: number;
      capacity: number;
      teachers: string[];
    }>;
    demandByClass: Array<{ className: string; total: number }>;
  };
}

export interface ValidationData {
  issues: string[];
  warnings: string[];
  slotsPerWeek: number;
  demandBySubject: Array<{
    subjectId: string;
    subject: { id: string; name: string; code: string; type: string };
    demand: number;
    capacity: number;
    teachers: string[];
    placed: number;
  }>;
  demandByClass: Array<{ classId: string; className: string; total: number }>;
}
