/**
 * One-click demo data — the REAL NIT Agartala CSE MCA programme, modelled
 * on the department's actual master routine (ODD 2026, w.e.f. 27/07/2026;
 * see reference/NITA-CSE-ROUTINE-ODD-2026-REFERENCE.md).
 *
 * Subjects and full names come from the real sheet's legend (§6); faculty
 * names + codes from its footer (§5). Sem 5 teaching assignments are the
 * ones printed on the real sheet (§7): AI / AI Lab = DJB, CD / CD Lab = PB,
 * E-COMM + WCN = MKDB, DIP = TP. Sem 1 / 3 assignments are plausible picks
 * from the same faculty table. Every subject has exactly 2 eligible
 * teachers; each class fills 23–25 of the 35 weekly hours (Mon–Fri × 7)
 * in 12 block sessions, so the solver has real constraints but real
 * slack (verified by tests).
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
  // NITA pattern from the real sheet: Mon–Fri, hourly grid from 9:00,
  // lunch 1:00–2:00 after P4. Sessions are blocks across hours.
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  periodsPerDay: 7,
  lunchAfter: 4,
  periodDuration: 60,
  startTime: "09:00",
  session: "ODD 2026",
  effectiveFrom: "27/07/2026",
  department: "Computer Science and Engineering",
  departmentShort: "CSE",
};

export const DEMO_PERIOD_DURATION = 60;

/**
 * [name, code, type, sessionHours] — codes and full names from the real
 * sheet's subject legend (reference §6). Lab codes carry "Lab" in the
 * code itself, exactly as printed on the sheet ("AI Lab", "CD Lab", …).
 * Session lengths follow the real sheet's block model: theory sessions
 * are 2h blocks, lab sessions are single 3h blocks.
 */
export const DEMO_SUBJECTS: Array<[string, string, "theory" | "lab", number]> = [
  // MCA Sem 1
  ["Data and File Structure", "DFS", "theory", 2],
  ["Digital Circuit and Logic Design", "DCLD", "theory", 2],
  ["Discrete Mathematical Structure", "DMS", "theory", 2],
  ["Principles of Management and Practices", "PMP", "theory", 2],
  ["Web Technology", "WT", "theory", 2],
  ["Data and File Structure Lab", "DFS Lab", "lab", 3],
  ["Web Technology Lab", "WT Lab", "lab", 3],
  // MCA Sem 3
  ["Communicative English and Technical Writing", "CETW", "theory", 2],
  ["Data Mining and Data Warehousing", "DMDW", "theory", 2],
  ["Design and Analysis of Algorithms", "DAA", "theory", 2],
  ["Numerical Methods", "NM", "theory", 2],
  ["Software Engineering", "SE", "theory", 2],
  ["Design and Analysis of Algorithms Lab", "DAA Lab", "lab", 3],
  ["Software Engineering Lab", "SE Lab", "lab", 3],
  // MCA Sem 5
  ["Artificial Intelligence", "AI", "theory", 2],
  ["Compiler Design", "CD", "theory", 2],
  ["E-Commerce", "E-COMM", "theory", 2],
  ["Wireless Communication Network", "WCN", "theory", 2],
  ["Digital Image Processing", "DIP", "theory", 2],
  ["Artificial Intelligence Lab", "AI Lab", "lab", 3],
  ["Compiler Design Lab", "CD Lab", "lab", 3],
];

/**
 * [name, code, designation, maxPerDay, weeklyHours, eligible subject codes]
 * Names + codes from the real sheet's faculty footer (reference §5).
 * First eligible teacher per subject is the primary (for Sem 5, the one
 * printed on the real sheet).
 */
export const DEMO_TEACHERS: Array<[string, string, string, number, number, string[]]> = [
  ["Dr. Dhrubajyoti Bhowmik", "DJB", "", 4, 16, ["AI", "AI Lab"]],
  ["Dr. Prashant Bhardwaj", "PB", "", 4, 16, ["CD", "CD Lab"]],
  ["Dr. Mrinal Kanti Debbarma", "MKDB", "", 4, 16, ["E-COMM", "WCN"]],
  ["Tapas", "TP", "Technical Assistant", 3, 8, ["DIP"]],
  ["Dr. Awnish Kumar", "AK", "", 4, 16, ["AI", "AI Lab"]],
  ["Dr. Jayakumar L", "JKL", "", 4, 16, ["CD", "CD Lab"]],
  ["Mr. Bidyasagar Debnath", "BD", "", 4, 16, ["E-COMM", "CETW", "PMP"]],
  ["Dr. Nirmalya Kar", "NK", "", 4, 16, ["WCN"]],
  ["Dr. Smita Das", "SmD", "", 4, 16, ["DIP"]],
  ["Dr. Gyanabati Khuraijam", "GK", "", 4, 16, ["CETW", "PMP"]],
  ["Dr. Ranjita Das", "RD", "", 4, 16, ["DMDW", "DFS", "DFS Lab"]],
  ["Dr. Diptendu Bhattacharya", "DB", "", 4, 16, ["DMDW", "DFS", "DFS Lab"]],
  ["Dr. Swapan Debbarma", "SDB", "", 4, 16, ["DAA", "DAA Lab"]],
  ["Dr. Kunal Chakma", "KC", "", 4, 16, ["DAA", "DAA Lab"]],
  ["Dr. Nikhil Debbarma", "NDB", "", 4, 16, ["NM", "DMS"]],
  ["Dr. Anupam Jamatia", "AJ", "", 4, 16, ["NM", "DMS"]],
  ["Dr. Kishore Kumar Dhar", "KKD", "", 4, 16, ["SE", "SE Lab"]],
  ["Dr. Dwijen Rudrapal", "DRP", "", 4, 16, ["SE", "SE Lab"]],
  ["Dr. Suman Deb", "SD", "", 4, 16, ["DCLD"]],
  ["Mr. Tribid Debbarma", "TDB", "", 4, 16, ["DCLD"]],
  ["Dr. Amit Bikram Choudhury", "AS", "", 4, 16, ["WT", "WT Lab"]],
  ["Dr. Suyel Nama Sudra", "SN", "", 4, 16, ["WT", "WT Lab"]],
];

/** [program, year, section] */
export const DEMO_CLASSES: Array<[string, string, string]> = [
  ["MCA", "Sem 1", ""],
  ["MCA", "Sem 3", ""],
  ["MCA", "Sem 5", ""],
];

/**
 * Per class (same order as DEMO_CLASSES): subject code -> hours/week.
 * Block model: theory 4h = two 2h sessions, theory 3h = 2h + 1h;
 * each lab is 3h = one 3h block. Every class fits the 35h week
 * (Mon–Fri × 7 hourly slots) with slack for the solver.
 */
export const DEMO_CLASS_SUBJECTS: Array<Record<string, number>> = [
  { DFS: 4, DCLD: 4, DMS: 4, PMP: 3, WT: 4, "DFS Lab": 3, "WT Lab": 3 }, // Sem 1 = 25h, 12 sessions
  { CETW: 3, DMDW: 4, DAA: 4, NM: 3, SE: 4, "DAA Lab": 3, "SE Lab": 3 }, // Sem 3 = 24h, 12 sessions
  { AI: 4, CD: 4, "E-COMM": 3, WCN: 3, DIP: 3, "AI Lab": 3, "CD Lab": 3 }, // Sem 5 = 23h, 12 sessions
];

/** Teacher name -> [day, period|null][]. period null = whole day off. */
export const DEMO_UNAVAILABLE: Record<string, Array<[string, number | null]>> = {
  "Dr. Mrinal Kanti Debbarma": [["Monday", 1]],
  "Dr. Prashant Bhardwaj": [["Friday", 7]],
  Tapas: [["Wednesday", null]],
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
  for (const [name, code, type, sessionHours] of DEMO_SUBJECTS) {
    subjects.set(code, { id: code, name, code, type, sessionHours });
  }
  const teachers = new Map<string, TeacherData>();
  DEMO_TEACHERS.forEach(([name, , , maxPerDay, weeklyHours, codes], i) => {
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
