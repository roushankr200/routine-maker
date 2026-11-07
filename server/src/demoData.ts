/**
 * One-click MCA demo data — designed to be solvable (verified by tests).
 *
 * Load split: each subject has exactly 2 eligible teachers; total demand
 * 86 periods vs 148 combined weekly capacity, classes fill 28–30 of 42
 * weekly slots, so the solver has real constraints but real slack.
 *
 * These constants are the single source used by both the DB seed
 * (seed.ts) and the solver tests (which build plain in-memory data).
 */

import {
  ClassSubjectData,
  ScheduleConfig,
  SubjectData,
  TeacherData,
  unavailableKey,
} from "./solver/types.js";

export const DEMO_CONFIG: ScheduleConfig = {
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  periodsPerDay: 7,
  lunchAfter: 4,
};

export const DEMO_PERIOD_DURATION = 50;

/** [name, code, type] */
export const DEMO_SUBJECTS: Array<[string, string, "theory" | "lab"]> = [
  ["Database Management Systems", "CA501", "theory"],
  ["Operating Systems", "CA502", "theory"],
  ["Java Programming", "CA503", "theory"],
  ["Data Structures & Algorithms", "CA504", "theory"],
  ["Computer Networks", "CA505", "theory"],
  ["Machine Learning", "CA506", "theory"],
  ["Web Technologies", "CA507", "theory"],
  ["DBMS Lab", "CA591", "lab"],
  ["Java Lab", "CA592", "lab"],
];

/** [name, designation, maxPerDay, weeklyHours, eligible subject codes] */
export const DEMO_TEACHERS: Array<[string, string, number, number, string[]]> = [
  ["Dr. Anil Sharma", "Professor", 4, 18, ["CA501", "CA591"]],
  ["Dr. Priya Singh", "Associate Professor", 4, 18, ["CA502", "CA504"]],
  ["Prof. Rahul Verma", "Assistant Professor", 4, 18, ["CA503", "CA592"]],
  ["Dr. Sneha Patel", "Assistant Professor", 4, 16, ["CA505", "CA502"]],
  ["Prof. Vikram Das", "Assistant Professor", 4, 16, ["CA504", "CA506"]],
  ["Dr. Kavita Rao", "Associate Professor", 4, 16, ["CA506", "CA501"]],
  ["Prof. Arjun Mehta", "Assistant Professor", 4, 16, ["CA507", "CA503"]],
  ["Dr. Neha Gupta", "Assistant Professor", 4, 16, ["CA507", "CA505"]],
  ["Prof. Rohit Kumar", "Assistant Professor", 4, 14, ["CA592", "CA591"]],
];

/** [program, year, section] */
export const DEMO_CLASSES: Array<[string, string, string]> = [
  ["MCA", "Sem 1", ""],
  ["MCA", "Sem 3", ""],
  ["MCA", "Sem 5", ""],
];

/** Per class (same order as DEMO_CLASSES): subject code -> hours/week. */
export const DEMO_CLASS_SUBJECTS: Array<Record<string, number>> = [
  { CA504: 4, CA503: 4, CA502: 4, CA501: 4, CA505: 3, CA507: 3, CA592: 4, CA591: 2 }, // 28
  { CA504: 3, CA503: 3, CA502: 3, CA501: 4, CA506: 4, CA505: 4, CA507: 3, CA592: 2, CA591: 4 }, // 30
  { CA506: 5, CA505: 3, CA502: 3, CA501: 3, CA507: 4, CA503: 3, CA504: 3, CA592: 2, CA591: 2 }, // 28
];

/** Teacher name -> [day, period|null][]. period null = whole day off. */
export const DEMO_UNAVAILABLE: Record<string, Array<[string, number | null]>> = {
  "Prof. Rohit Kumar": [["Saturday", null]],
  "Dr. Priya Singh": [["Monday", 1]],
  "Dr. Anil Sharma": [["Wednesday", 7]],
};

export function classLabel(program: string, year: string, section: string): string {
  return `${program} ${year}${section ? ` ${section}` : ""}`.trim();
}

/**
 * Build the plain in-memory solver data for the demo dataset, using
 * simple readable string ids. Used by the solver tests (no database).
 */
export function buildDemoSolverData(): {
  teachers: Map<string, TeacherData>;
  subjects: Map<string, SubjectData>;
  classSubjects: ClassSubjectData[];
  config: ScheduleConfig;
} {
  const subjects = new Map<string, SubjectData>();
  for (const [name, code, type] of DEMO_SUBJECTS) {
    subjects.set(code, { id: code, name, code, type });
  }
  const teachers = new Map<string, TeacherData>();
  DEMO_TEACHERS.forEach(([name, , maxPerDay, weeklyHours, codes], i) => {
    const id = `T${i + 1}`;
    const unavailable = new Set<string>();
    for (const [day, period] of DEMO_UNAVAILABLE[name] ?? []) {
      unavailable.add(unavailableKey(day, period));
    }
    teachers.set(id, {
      id,
      name,
      maxPerDay,
      weeklyHours,
      subjects: new Set(codes),
      unavailable,
    });
  });
  const classSubjects: ClassSubjectData[] = [];
  DEMO_CLASS_SUBJECTS.forEach((mapping, idx) => {
    for (const [code, hours] of Object.entries(mapping)) {
      classSubjects.push({ classId: `C${idx + 1}`, subjectId: code, hours });
    }
  });
  return { teachers, subjects, classSubjects, config: { ...DEMO_CONFIG } };
}
