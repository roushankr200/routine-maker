/**
 * One-click demo data — the REAL NIT Agartala CSE DEPARTMENT, modelled
 * on the department's actual master routine (ODD 2026, w.e.f. 27/07/2026;
 * see reference/NITA-CSE-ROUTINE-ODD-2026-REFERENCE.md).
 *
 * This is a DEPARTMENT routine maker, so the built-in seed covers the
 * whole CSE department on one master grid — 12 classes:
 *   B.Tech Sem 3 A/B, Sem 5 A/B, Sem 7 A/B · MCA Sem 1/3/5 ·
 *   M.Tech Sem 1 CYSEC / DSE / AI.
 * (BTMT and MBA cohorts also appear on the real sheet; they belong to
 * other departments and are out of scope for the CSE seed.)
 *
 * Subjects and full names come from the real sheet's legends (§6, and
 * the PDF's own legend pages); faculty names + codes from its footer
 * (§5 + the PDF footer, which lists more faculty than §5's table).
 * Teaching assignments follow the sheet's cells wherever a named
 * teacher is printed (e.g. DMS 3B = PB, DBMS 5A = SN, OS = SDB,
 * ML 7A = KC / 7B = AJ, CRYPTO = NK, CAO 5A = KKD, DSPM 3A = SD);
 * where the sheet prints XX or an unlisted code, the primary is a
 * sensible pick from the same subject area. Every subject has at
 * least 2 eligible teachers.
 *
 * Elective simplification (combined-cohort modelling is v3): each
 * section takes a FIXED elective set instead of running combined
 * elective groups in parallel — B.Tech 5A = FC + DIP, 5B = FC + CG;
 * B.Tech 7A = IR + CC, 7B = BD + SC; the M.Tech sections take their
 * listed electives. Subject codes are shared across classes exactly
 * where the real legends share them (DCLD, DMS, AI, AI Lab, IR, NLP,
 * ADSA, Seminar …), so clash scope stays department-wide.
 *
 * B.Tech 7th sem carries only ML + electives on the real sheet (the
 * rest of the 7th-sem week is project work, which is not timetabled),
 * so those two classes are deliberately lighter than the others.
 *
 * Weekly hours follow the block model: theory 4h = two 2h sessions,
 * theory 3h = 2h + 1h, each lab 3h = one 3h block, Seminar 1h.
 * Loads were tuned so the full department generates with 0 unplaced
 * (verified by the solver tests).
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
 * sheet's subject legends (reference §6 + PDF legend pages). Lab codes
 * carry "Lab" in the code itself, exactly as printed on the sheet
 * ("AI Lab", "CD Lab", …). Session lengths follow the real sheet's
 * block model: theory sessions are 2h blocks (Seminar 1h), lab
 * sessions are single 3h blocks.
 */
export const DEMO_SUBJECTS: Array<[string, string, "theory" | "lab", number]> = [
  // ── MCA Sem 1 ──────────────────────────────────────────────────────
  ["Data and File Structure", "DFS", "theory", 2],
  ["Digital Circuit and Logic Design", "DCLD", "theory", 2],
  ["Discrete Mathematical Structure", "DMS", "theory", 2],
  ["Principles of Management and Practices", "PMP", "theory", 2],
  ["Web Technology", "WT", "theory", 2],
  ["Data and File Structure Lab", "DFS Lab", "lab", 3],
  ["Web Technology Lab", "WT Lab", "lab", 3],
  // ── MCA Sem 3 ──────────────────────────────────────────────────────
  ["Communicative English and Technical Writing", "CETW", "theory", 2],
  ["Data Mining and Data Warehousing", "DMDW", "theory", 2],
  ["Design and Analysis of Algorithms", "DAA", "theory", 2],
  ["Numerical Methods", "NM", "theory", 2],
  ["Software Engineering", "SE", "theory", 2],
  ["Design and Analysis of Algorithms Lab", "DAA Lab", "lab", 3],
  ["Software Engineering Lab", "SE Lab", "lab", 3],
  // ── MCA Sem 5 ──────────────────────────────────────────────────────
  ["Artificial Intelligence", "AI", "theory", 2],
  ["Compiler Design", "CD", "theory", 2],
  ["E-Commerce", "E-COMM", "theory", 2],
  ["Wireless Communication Network", "WCN", "theory", 2],
  ["Digital Image Processing", "DIP", "theory", 2],
  ["Artificial Intelligence Lab", "AI Lab", "lab", 3],
  ["Compiler Design Lab", "CD Lab", "lab", 3],
  // ── B.Tech Sem 3 (DCLD / DMS shared with MCA Sem 1, above) ────────
  ["Data Structure and Programming Methodology", "DSPM", "theory", 2],
  ["Data Structure and Programming Methodology Lab", "DSPM Lab", "lab", 3],
  ["Digital Circuit and Logic Design Lab", "DCLD Lab", "lab", 3],
  ["Engineering Mathematics III", "EM3", "theory", 2],
  ["Introduction to Graph Theory", "IGT", "theory", 2],
  ["Data Communication", "DCN", "theory", 2],
  // ── B.Tech Sem 5 (DIP shared with MCA Sem 5, above) ───────────────
  ["Computer Architecture and Organization", "CAO", "theory", 2],
  ["Computer Architecture and Organization Lab", "CAO Lab", "lab", 3],
  ["Database Management System", "DBMS", "theory", 2],
  ["Database Management System Lab", "DBMS Lab", "lab", 3],
  ["Engineering Economics and Costing", "EEC", "theory", 2],
  ["Operating System", "OS", "theory", 2],
  ["Operating System Lab", "OS Lab", "lab", 3],
  ["Foundation of Cryptography", "FC", "theory", 2],
  ["Computer Graphics", "CG", "theory", 2],
  ["Seminar", "Seminar", "theory", 1],
  // ── B.Tech Sem 7 (ML + electives only on the real sheet — no lab) ─
  ["Machine Learning", "ML", "theory", 2],
  ["Information Retrieval", "IR", "theory", 2],
  ["Cloud Computing", "CC", "theory", 2],
  ["Big Data Analytics", "BD", "theory", 2],
  ["Soft Computing", "SC", "theory", 2],
  // ── M.Tech Sem 1 CYSEC ─────────────────────────────────────────────
  ["Mathematical Foundation of Computer Science", "MFCS", "theory", 2],
  ["Principles of Cryptography", "CRYPTO", "theory", 2],
  ["Advanced Computer Network", "ACN", "theory", 2],
  ["Data Hiding", "DH", "theory", 2],
  ["Cryptography Lab", "Crypto Lab", "lab", 3],
  // ── M.Tech Sem 1 DSE (IR + Seminar shared, above) ─────────────────
  ["Data Mining", "DM", "theory", 2],
  ["Mathematical Foundation of Data Science", "MFDS", "theory", 2],
  ["Natural Language Processing", "NLP", "theory", 2],
  ["Data Science Foundation Lab", "DSF Lab", "lab", 3],
  ["Advanced Data Structures and Algorithms Lab", "ADSA Lab", "lab", 3],
  // ── M.Tech Sem 1 AI (ADSA is "ALL specializations" on the sheet) ──
  ["Advanced Data Structures and Algorithms", "ADSA", "theory", 2],
  ["Computational Methods of Optimization", "CM", "theory", 2],
];

/**
 * [name, code, designation, maxPerDay, weeklyHours, eligible subject codes]
 * Names + codes from the real sheet's faculty footer (reference §5 and
 * the PDF footer). First eligible teacher per subject is the primary —
 * for subjects printed on the sheet, the teacher the sheet itself
 * names. Loads are realistic department loads (max 5h/day, 20–24h/week;
 * Tapas is technical staff with a lighter cap).
 */
export const DEMO_TEACHERS: Array<[string, string, string, number, number, string[]]> = [
  ["Dr. Dhrubajyoti Bhowmik", "DJB", "", 5, 22, ["AI", "AI Lab", "CAO", "Seminar"]],
  ["Dr. Prashant Bhardwaj", "PB", "", 5, 22, ["CD", "CD Lab", "DMS", "FC", "CRYPTO", "Crypto Lab"]],
  ["Dr. Mrinal Kanti Debbarma", "MKDB", "", 5, 20, ["E-COMM", "WCN"]],
  ["Tapas", "TP", "Technical Assistant", 3, 12, ["DIP", "DH", "DSPM Lab"]],
  ["Dr. Awnish Kumar", "AK", "", 5, 22, ["AI", "AI Lab", "DCN", "DSPM Lab"]],
  ["Dr. Jayakumar L", "JKL", "", 5, 22, ["CD", "CD Lab", "DH", "OS Lab", "BD"]],
  ["Mr. Bidyasagar Debnath", "BD", "", 5, 20, ["E-COMM", "CETW", "PMP", "EEC"]],
  ["Dr. Nirmalya Kar", "NK", "", 5, 22, ["WCN", "FC", "CRYPTO", "Crypto Lab", "Seminar", "CC"]],
  ["Dr. Smita Das", "SmD", "", 5, 22, ["DIP", "IGT", "ACN", "DBMS Lab"]],
  ["Dr. Gyanabati Khuraijam", "GK", "", 5, 20, ["CETW", "PMP"]],
  ["Dr. Ranjita Das", "RD", "", 5, 22, ["DMDW", "DFS", "DFS Lab", "DBMS Lab", "DM", "CG", "IR", "SC"]],
  ["Dr. Diptendu Bhattacharya", "DB", "", 5, 22, ["DMDW", "DFS", "DFS Lab", "DCLD", "DCLD Lab", "CM"]],
  ["Dr. Swapan Debbarma", "SDB", "", 5, 22, ["DAA", "DAA Lab", "OS", "OS Lab", "ADSA", "ADSA Lab", "DSF Lab"]],
  ["Dr. Kunal Chakma", "KC", "", 5, 24, ["DAA", "DAA Lab", "ML", "DM", "DSF Lab", "ADSA", "ADSA Lab", "BD"]],
  ["Dr. Nikhil Debbarma", "NDB", "", 5, 22, ["NM", "DMS", "CAO Lab", "IGT", "MFDS"]],
  ["Dr. Anupam Jamatia", "AJ", "", 5, 24, ["NM", "DMS", "ML", "NLP", "CM", "MFCS"]],
  ["Dr. Kishore Kumar Dhar", "KKD", "", 5, 22, ["SE", "SE Lab", "CAO", "CAO Lab", "DCN", "ACN"]],
  ["Dr. Dwijen Rudrapal", "DRP", "", 5, 22, ["SE", "SE Lab", "IR", "DSPM", "DSPM Lab", "DBMS Lab"]],
  ["Dr. Suman Deb", "SD", "", 5, 24, ["DCLD", "DSPM", "AI", "AI Lab", "NLP", "Seminar", "SC"]],
  ["Mr. Tribid Debbarma", "TDB", "", 5, 20, ["DCLD", "DCLD Lab", "CC", "Seminar"]],
  ["Dr. Amit Bikram Choudhury", "AS", "", 5, 22, ["WT", "WT Lab", "DBMS", "EEC"]],
  ["Dr. Suyel Nama Sudra", "SN", "", 5, 20, ["WT", "WT Lab", "DBMS"]],
  // Further faculty from the PDF footer (beyond the §5 table):
  ["Dr. Moumita Majumder", "MM", "", 5, 20, ["DBMS", "DM"]],
  ["Dr. Arijta Datta", "AD", "", 5, 20, ["CG", "DIP"]],
  ["Dr. Sushmita Sharma", "SSH", "", 5, 20, ["SE", "CETW"]],
  ["Dr. Parijata Majumder", "PM", "", 5, 20, ["EM3", "MFDS"]],
  ["Dr. Syeda Zeenat Marshoodulla", "SZM", "", 5, 20, ["EM3", "MFCS"]],
  ["Mr. Nabendu Debnath", "ND", "", 5, 20, ["DCN", "ACN"]],
  ["Dr. Suprito Datta", "SPD", "", 5, 20, ["OS", "CC"]],
  ["Dr. Sudipa Chaudhury", "SC", "", 5, 20, ["CG", "SC"]],
  ["Dr. Abhijit Baidya", "AB", "", 5, 20, ["BD", "ML"]],
  ["Dr. Jayashree Chakraborty", "JC", "", 5, 20, ["WT", "SE"]],
];

/** [program, year, section] */
export const DEMO_CLASSES: Array<[string, string, string]> = [
  ["B.Tech", "Sem 3", "A"],
  ["B.Tech", "Sem 3", "B"],
  ["B.Tech", "Sem 5", "A"],
  ["B.Tech", "Sem 5", "B"],
  ["B.Tech", "Sem 7", "A"],
  ["B.Tech", "Sem 7", "B"],
  ["MCA", "Sem 1", ""],
  ["MCA", "Sem 3", ""],
  ["MCA", "Sem 5", ""],
  ["M.Tech", "Sem 1", "CYSEC"],
  ["M.Tech", "Sem 1", "DSE"],
  ["M.Tech", "Sem 1", "AI"],
];

/**
 * Per class (same order as DEMO_CLASSES): subject code -> hours/week.
 * Block model: theory 4h = two 2h sessions, theory 3h = 2h + 1h;
 * each lab is 3h = one 3h block; Seminar is a single 1h session.
 * Every class fits the 35h week (Mon–Fri × 7 hourly slots).
 * The three MCA mappings are the original MCA seed, unchanged.
 */
export const DEMO_CLASS_SUBJECTS: Array<Record<string, number>> = [
  // B.Tech Sem 3 A = 27h, 14 sessions
  { DSPM: 4, DCLD: 4, DMS: 4, EM3: 3, IGT: 3, DCN: 3, "DSPM Lab": 3, "DCLD Lab": 3 },
  // B.Tech Sem 3 B = 27h, 14 sessions
  { DSPM: 4, DCLD: 4, DMS: 4, EM3: 3, IGT: 3, DCN: 3, "DSPM Lab": 3, "DCLD Lab": 3 },
  // B.Tech Sem 5 A = 31h, 16 sessions (electives: FC + DIP)
  { CAO: 4, DBMS: 4, EEC: 3, OS: 4, FC: 3, DIP: 3, "DBMS Lab": 3, "OS Lab": 3, "CAO Lab": 3, Seminar: 1 },
  // B.Tech Sem 5 B = 31h, 16 sessions (electives: FC + CG)
  { CAO: 4, DBMS: 4, EEC: 3, OS: 4, FC: 3, CG: 3, "DBMS Lab": 3, "OS Lab": 3, "CAO Lab": 3, Seminar: 1 },
  // B.Tech Sem 7 A = 11h, 6 sessions (electives: IR + CC — sheet has only ML + electives)
  { ML: 4, IR: 4, CC: 3 },
  // B.Tech Sem 7 B = 11h, 6 sessions (electives: BD + SC)
  { ML: 4, BD: 4, SC: 3 },
  // MCA Sem 1 = 25h, 12 sessions (unchanged)
  { DFS: 4, DCLD: 4, DMS: 4, PMP: 3, WT: 4, "DFS Lab": 3, "WT Lab": 3 },
  // MCA Sem 3 = 24h, 12 sessions (unchanged)
  { CETW: 3, DMDW: 4, DAA: 4, NM: 3, SE: 4, "DAA Lab": 3, "SE Lab": 3 },
  // MCA Sem 5 = 23h, 12 sessions (unchanged)
  { AI: 4, CD: 4, "E-COMM": 3, WCN: 3, DIP: 3, "AI Lab": 3, "CD Lab": 3 },
  // M.Tech Sem 1 CYSEC = 18h, 10 sessions
  { MFCS: 4, CRYPTO: 4, ACN: 3, DH: 3, "Crypto Lab": 3, Seminar: 1 },
  // M.Tech Sem 1 DSE = 21h, 11 sessions
  { DM: 4, MFDS: 4, NLP: 3, IR: 3, "DSF Lab": 3, "ADSA Lab": 3, Seminar: 1 },
  // M.Tech Sem 1 AI = 21h, 12 sessions
  { ADSA: 4, AI: 4, CM: 3, NLP: 3, IR: 3, "AI Lab": 3, Seminar: 1 },
];

/** Teacher name -> [day, period|null][]. period null = whole day off. */
export const DEMO_UNAVAILABLE: Record<string, Array<[string, number | null]>> = {
  "Dr. Mrinal Kanti Debbarma": [["Monday", 1]],
  "Dr. Prashant Bhardwaj": [["Friday", 7]],
  Tapas: [["Wednesday", null]],
  "Dr. Ranjita Das": [["Wednesday", 5]],
  "Dr. Kunal Chakma": [["Monday", 2]],
  "Dr. Suman Deb": [["Friday", 1]],
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
