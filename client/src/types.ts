export interface ScheduleConfig {
  days: string[];
  periodsPerDay: number;
  lunchAfter: number | null;
  periodDuration?: number;
}

export interface Teacher {
  id: string;
  name: string;
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
}

export interface ClassRequirement {
  subjectId: string;
  hours: number;
  name: string;
  code: string;
  type: "theory" | "lab";
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
  teacherName: string;
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
