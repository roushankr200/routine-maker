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
  /** Syllabus credits (0 when not from a syllabus). */
  credits: number;
  /** Code as printed in the syllabus document, e.g. "UCS03B08" ("" if none). */
  syllabusCode?: string;
}

export interface ClassRequirement {
  subjectId: string;
  hours: number;
  name: string;
  code: string;
  type: "theory" | "lab";
  sessionHours: number;
  credits?: number;
  syllabusCode?: string;
}

export interface ClassSection {
  id: string;
  program: string;
  year: string;
  section: string;
  /** Programme classification for master-sheet grouping/filtering. */
  programme: string;
  /** Numeric semester when known (null = unknown). */
  semesterNumber: number | null;
  name: string;
  requirements: ClassRequirement[];
  totalHours: number;
}

// ------------------------------------------------------- syllabus catalogue
export type CatalogueKind =
  | "theory"
  | "lab"
  | "elective"
  | "seminar"
  | "project"
  | "viva"
  | "other";

export interface CatalogueElectiveOption {
  syllabusCode: string | null;
  shortCode: string;
  title: string;
  derived?: boolean;
}

export interface CatalogueSubject {
  key: string;
  syllabusCode: string | null;
  shortCode: string;
  title: string;
  L: number;
  T: number;
  P: number;
  /** Null = the syllabus publishes no numbers (Production B.Tech). */
  credits: number | null;
  kind: CatalogueKind;
  timetabled: boolean;
  derived?: boolean;
  weeklyHours: number | null;
  sessionHours: number | null;
  electivePool?: CatalogueElectiveOption[];
}

export interface CatalogueSemester {
  semester: number;
  subjects?: CatalogueSubject[];
  groups?: { I: CatalogueSubject[]; II: CatalogueSubject[] };
}

export interface CatalogueProgramme {
  programme: string;
  specialisation?: string;
  /** True when the syllabus publishes no L/T/P/credits (Production). */
  numbersRequired?: boolean;
  semesters: CatalogueSemester[];
}

export interface CatalogueDepartment {
  id: string;
  name: string;
  shortName: string;
  programmes: CatalogueProgramme[];
}

export interface CatalogListResponse {
  departments: Array<{
    id: string;
    name: string;
    shortName: string;
    programmes: Array<{
      programme: string;
      specialisation?: string;
      numbersRequired?: boolean;
      semesters: number[];
    }>;
  }>;
}

// ---------------------------------------------------- faculty registry
/** One of the 14 NITA units in GET /api/faculty. */
export interface RegistryDepartment {
  id: string;
  name: string;
  shortName: string;
  hasCatalogue: boolean;
  facultyCount: number;
}

export interface FacultyMember {
  name: string;
  designation: string;
  /** Derived short code (initials; collisions get digits). */
  code: string;
}

export interface FacultyDeptResponse extends RegistryDepartment {
  faculty: FacultyMember[];
}

/** A manually added subject in the unified setup payload. */
export interface CustomSubjectPayload {
  shortCode: string;
  title: string;
  kind: "theory" | "lab" | "seminar";
  weeklyHours: number;
  sessionHours: number;
  credits: number;
}

/** POST /api/setup/guided payload — the ONE unified setup (v2.4). */
export interface GuidedSetupPayload {
  catalogueId?: string;
  facultyDeptId?: string;
  department: { name: string; short: string; session: string; effectiveFrom: string };
  teachers: Array<{
    /** Website faculty code — the server re-resolves name/designation. */
    facultyCode?: string;
    name?: string;
    code: string;
    designation?: string;
    maxPerDay?: number;
    weeklyHours: number;
  }>;
  classes: Array<{
    programme: string;
    specialisation?: string;
    semester: number;
    section: string;
    group?: "I" | "II";
    /** True = manual class (no catalogue); subjects are all custom. */
    custom?: boolean;
    customSubjects?: CustomSubjectPayload[];
    assignments: Array<{
      key: string;
      teacherCode: string;
      electivePick?: string;
      /** For elective slots whose syllabus prints no pool. */
      customPick?: { shortCode: string; title: string };
      /** Required for subjects whose syllabus prints no numbers. */
      weeklyHours?: number;
      sessionHours?: number;
      credits?: number;
    }>;
  }>;
}

export interface GuidedSetupResult {
  message: string;
  departmentId: string;
  counts: {
    teachers: number;
    subjects: number;
    classes: number;
    classSubjects: number;
    xxSubjects: number;
  };
  teacherLoads: Array<{
    code: string;
    name: string;
    assignedHours: number;
    weeklyHours: number;
  }>;
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



/** Coverage & balance report (GET /api/balance, POST /api/balance/preview). */
export type TeacherLoadStatus = "under" | "full" | "balanced";

export interface BalanceSubjectRow {
  code: string;
  requiredHours: number;
  assignedHours: number;
  /** Hours still left to cover — the headline number while entering data. */
  remainingHours: number;
  eligibleTeacherCodes: string[];
}

export interface BalanceTeacherRow {
  code: string;
  name: string;
  suggestedHours: number;
  weeklyMaxHours: number;
  subjects: Array<{ code: string; hours: number }>;
  status: TeacherLoadStatus;
}

export interface BalanceReport {
  perSubject: BalanceSubjectRow[];
  perTeacher: BalanceTeacherRow[];
  totals: { requiredHours: number; assignedHours: number; remainingHours: number };
  averageSuggestedHours: number;
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

/** One department in GET /api/departments (multi-department storage). */
export interface DepartmentSummary {
  id: string;
  name: string;
  shortName: string;
  session: string;
  effectiveFrom: string;
  createdAt: string;
  counts: { teachers: number; subjects: number; classes: number; entries: number };
  isActive: boolean;
}

export interface DepartmentsResponse {
  departments: DepartmentSummary[];
  activeDepartmentId: string | null;
}
