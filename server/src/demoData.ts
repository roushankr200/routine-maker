/**
 * One-click demo data — the REAL NIT Agartala CSE DEPARTMENT, modelled
 * on the department's actual master routine (ODD 2026, w.e.f. 27/07/2026;
 * see reference/NITA-CSE-ROUTINE-ODD-2026-REFERENCE.md).
 *
 * SUBJECTS COME FROM THE SYLLABUS CATALOGUE (server/src/catalog/):
 * classes, subjects, weekly hours, session lengths and credits are
 * DERIVED from the official syllabus course structures — this file
 * only adds what a syllabus cannot know: which faculty teach (the
 * routine sheet's assignments, reference §5/§6), each section's fixed
 * elective picks, and teacher load caps.
 *
 * The seed covers the whole CSE department on one master grid —
 * 14 classes: B.Tech Sem 1 (Group I + Group II), Sem 3/5/7 A+B ·
 * MCA Sem 1/3/5 · M.Tech Sem 1 CYSEC / DSE / AI. (BTMT and MBA
 * cohorts also appear on the real sheet; they belong to other
 * departments and are out of scope for the CSE seed.)
 *
 * Faculty names + codes are the sheet's (§5 + the PDF footer).
 * Teaching assignments follow the sheet's cells wherever a named
 * teacher is printed (e.g. DMS 3B = PB, DBMS 5A = SN, OS = SDB,
 * ML 7A = KC / 7B = AJ, CRYPTO = NK, CAO 5A = KKD, DSPM 3A = SD);
 * every subject has at least 2 eligible teachers. B.Tech Sem 1 is
 * taught mainly by OTHER departments (Basic Sciences & Humanities,
 * ME, EE…) whose faculty the CSE sheet does not list — those ten
 * teachers are generic placeholders, marked "First-year (other
 * department)".
 *
 * Elective simplification (combined-cohort modelling is v3): each
 * section takes a FIXED pick from the syllabus elective pool —
 * B.Tech 5A = DIP, 5B = CG (Elective-I); 7A = IR + CC, 7B = BD + SC
 * (Elective-III/IV); MCA 5 = WCN + DIP; M.Tech AI = NLP + IR,
 * CYSEC = ACN + DH, DSE = NLP + IR.
 *
 * Catalogue hours differ from the old hand-tuned seed where the
 * syllabus says so: MCA labs are 0-0-6 (two 3h sessions/week),
 * M.Tech labs are 0-0-2 (one 2h session), B.Tech Sem 7 keeps only
 * ML + IPR + two electives (the rest is project work, not
 * timetabled). Subject codes are shared across classes exactly
 * where the real legends share them (DCLD, DMS, AI, AI Lab, IR,
 * ADSA, Seminar …), so clash scope stays department-wide; where
 * programmes print different credits for one shared code, the
 * Subject keeps the first programme's value (see
 * reference/CATALOGUE-PROVENANCE.md).
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
import {
  CSE_CATALOGUE,
  findProgramme,
  findSemester,
  resolveSubject,
  semesterSubjects,
} from "./catalog/index.js";

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

// ------------------------------------------------------------- seed classes
interface SeedClassDef {
  programme: string;
  specialisation?: string;
  semester: number;
  section: string;
  group?: "I" | "II";
  /** Elective slot key -> picked option shortCode (documented above). */
  electivePicks: Record<string, string>;
}

const SEED_CLASS_DEFS: SeedClassDef[] = [
  { programme: "B.Tech", semester: 1, section: "Group I", group: "I", electivePicks: {} },
  { programme: "B.Tech", semester: 1, section: "Group II", group: "II", electivePicks: {} },
  { programme: "B.Tech", semester: 3, section: "A", electivePicks: {} },
  { programme: "B.Tech", semester: 3, section: "B", electivePicks: {} },
  { programme: "B.Tech", semester: 5, section: "A", electivePicks: { "Elective-I": "DIP" } },
  { programme: "B.Tech", semester: 5, section: "B", electivePicks: { "Elective-I": "CG" } },
  {
    programme: "B.Tech",
    semester: 7,
    section: "A",
    electivePicks: { "Elective-III": "IR", "Elective-IV": "CC" },
  },
  {
    programme: "B.Tech",
    semester: 7,
    section: "B",
    electivePicks: { "Elective-III": "BD", "Elective-IV": "SC" },
  },
  { programme: "MCA", semester: 1, section: "", electivePicks: {} },
  { programme: "MCA", semester: 3, section: "", electivePicks: {} },
  {
    programme: "MCA",
    semester: 5,
    section: "",
    electivePicks: { "Elective-I": "WCN", "Elective-II": "DIP" },
  },
  {
    programme: "M.Tech",
    specialisation: "Cyber Security",
    semester: 1,
    section: "CYSEC",
    electivePicks: { "Elective-I": "ACN", "Elective-II": "DH" },
  },
  {
    programme: "M.Tech",
    specialisation: "Data Science & Engineering",
    semester: 1,
    section: "DSE",
    electivePicks: { "Elective-I": "NLP", "Elective-II": "IR" },
  },
  {
    programme: "M.Tech",
    specialisation: "Artificial Intelligence",
    semester: 1,
    section: "AI",
    electivePicks: { "Elective-I": "NLP", "Elective-II": "IR" },
  },
];

/** [name, code, type, sessionHours, credits, syllabusCode] — derived from the catalogue. */
export type DemoSubjectTuple = [string, string, "theory" | "lab", number, number, string];

const derivedSubjects = new Map<string, DemoSubjectTuple>();

/**
 * Per class (same order as DEMO_CLASSES): subject code -> hours/week,
 * resolved from the catalogue (weeklyHours = L+T+P; MCA labs 6h split
 * into two 3h sessions by the solver, M.Tech labs one 2h session).
 */
export const DEMO_CLASS_SUBJECTS: Array<Record<string, number>> = SEED_CLASS_DEFS.map((def) => {
  const prog = findProgramme(CSE_CATALOGUE, def.programme, def.specialisation);
  const sem = prog ? findSemester(prog, def.semester) : null;
  if (!prog || !sem) {
    throw new Error(`Catalogue has no ${def.programme} Sem ${def.semester} for the seed`);
  }
  const mapping: Record<string, number> = {};
  for (const cs of semesterSubjects(sem, def.group)) {
    const r = resolveSubject(cs, def.electivePicks[cs.key]);
    if (!r) continue; // non-timetabled (project/viva/NSS) or unpicked elective
    mapping[r.shortCode] = r.weeklyHours;
    if (!derivedSubjects.has(r.shortCode)) {
      derivedSubjects.set(r.shortCode, [
        r.title,
        r.shortCode,
        r.type,
        r.sessionHours,
        r.credits,
        r.syllabusCode ?? "",
      ]);
    }
  }
  return mapping;
});

/** All seed subjects (unique by code, first programme wins), catalogue-derived. */
export const DEMO_SUBJECTS: DemoSubjectTuple[] = [...derivedSubjects.values()];

/** [program, year, section, semesterNumber] */
export const DEMO_CLASSES: Array<[string, string, string, number]> = SEED_CLASS_DEFS.map(
  (def) => [def.programme, `Sem ${def.semester}`, def.section, def.semester],
);

/**
 * [name, code, designation, maxPerDay, weeklyHours, eligible subject codes]
 * Names + codes from the real sheet's faculty footer (reference §5 and
 * the PDF footer). First eligible teacher per subject is the primary —
 * for subjects printed on the sheet, the teacher the sheet itself
 * names. Loads are realistic department loads (max 5h/day, 20–24h/week;
 * Tapas is technical staff with a lighter cap). The last ten entries
 * are the first-year placeholders described in the header.
 */
export const DEMO_TEACHERS: Array<[string, string, string, number, number, string[]]> = [
  ["Dr. Dhrubajyoti Bhowmik", "DJB", "", 5, 22, ["AI", "AI Lab", "CAO", "Seminar"]],
  ["Dr. Prashant Bhardwaj", "PB", "", 5, 22, ["CD", "CD Lab", "DMS", "CRYPTO", "Crypto Lab"]],
  ["Dr. Mrinal Kanti Debbarma", "MKDB", "", 5, 20, ["WCN"]],
  ["Tapas", "TP", "Technical Assistant", 3, 12, ["DIP", "DH", "DSPM Lab", "WS"]],
  ["Dr. Awnish Kumar", "AK", "", 5, 22, ["AI", "AI Lab", "DCN", "DSPM Lab"]],
  ["Dr. Jayakumar L", "JKL", "", 5, 22, ["CD", "CD Lab", "DH", "OS Lab", "BD"]],
  ["Mr. Bidyasagar Debnath", "BD", "", 5, 20, ["CETW", "PMP", "EEC", "IPR", "PCE", "DISM"]],
  ["Dr. Nirmalya Kar", "NK", "", 5, 22, ["WCN", "CRYPTO", "Crypto Lab", "Seminar", "CC"]],
  ["Dr. Smita Das", "SmD", "", 5, 22, ["DIP", "IGT", "ACN", "DBMS Lab"]],
  ["Dr. Gyanabati Khuraijam", "GK", "", 5, 20, ["CETW", "PMP", "IPR"]],
  ["Dr. Ranjita Das", "RD", "", 5, 22, ["DMDW", "DFS", "DFS Lab", "DBMS Lab", "DM", "CG", "IR", "SC", "ITP", "ITP Lab"]],
  ["Dr. Diptendu Bhattacharya", "DB", "", 5, 22, ["DMDW", "DFS", "DFS Lab", "DCLD", "DCLD Lab", "CM", "BEE", "BEE Lab", "ITP Lab"]],
  ["Dr. Swapan Debbarma", "SDB", "", 5, 22, ["DAA", "DAA Lab", "OS", "OS Lab", "ADSA", "ADSA Lab", "DSF Lab"]],
  ["Dr. Kunal Chakma", "KC", "", 5, 24, ["DAA", "DAA Lab", "ML", "DM", "DSF Lab", "ADSA", "ADSA Lab", "BD"]],
  ["Dr. Nikhil Debbarma", "NDB", "", 5, 22, ["NM", "DMS", "CAO Lab", "IGT", "MFDS"]],
  ["Dr. Anupam Jamatia", "AJ", "", 5, 24, ["NM", "DMS", "ML", "NLP", "CM", "MFCS"]],
  ["Dr. Kishore Kumar Dhar", "KKD", "", 5, 22, ["SE", "SE Lab", "CAO", "CAO Lab", "DCN", "ACN"]],
  ["Dr. Dwijen Rudrapal", "DRP", "", 5, 22, ["SE", "SE Lab", "IR", "DSPM", "DSPM Lab", "DBMS Lab", "ITP"]],
  ["Dr. Suman Deb", "SD", "", 5, 24, ["DCLD", "DSPM", "AI", "AI Lab", "NLP", "Seminar", "SC"]],
  ["Mr. Tribid Debbarma", "TDB", "", 5, 20, ["DCLD", "DCLD Lab", "CC", "Seminar", "BE", "BE Lab"]],
  ["Dr. Amit Bikram Choudhury", "AS", "", 5, 22, ["WT", "WT Lab", "DBMS", "EEC"]],
  ["Dr. Suyel Nama Sudra", "SN", "", 5, 20, ["WT", "WT Lab", "DBMS"]],
  // Further faculty from the PDF footer (beyond the §5 table):
  ["Dr. Moumita Majumder", "MM", "", 5, 20, ["DBMS", "DM"]],
  ["Dr. Arijta Datta", "AD", "", 5, 20, ["CG", "DIP"]],
  ["Dr. Sushmita Sharma", "SSH", "", 5, 20, ["SE", "CETW"]],
  ["Dr. Parijata Majumder", "PM", "", 5, 20, ["EM3", "MFDS", "EM1"]],
  ["Dr. Syeda Zeenat Marshoodulla", "SZM", "", 5, 20, ["EM3", "MFCS"]],
  ["Mr. Nabendu Debnath", "ND", "", 5, 20, ["DCN", "ACN"]],
  ["Dr. Suprito Datta", "SPD", "", 5, 20, ["OS", "CC"]],
  ["Dr. Sudipa Chaudhury", "SC", "", 5, 20, ["CG", "SC"]],
  ["Dr. Abhijit Baidya", "AB", "", 5, 20, ["BD", "ML"]],
  ["Dr. Jayashree Chakraborty", "JC", "", 5, 20, ["WT", "SE"]],
  // B.Tech Sem 1 is taught by other departments (the CSE sheet lists
  // no first-year faculty) — generic placeholders, honestly labelled.
  ["First-Year Mathematics Faculty", "FYM", "First-year (other department)", 5, 20, ["EM1", "PHY1", "ENGM"]],
  ["First-Year Physics Faculty", "FYP", "First-year (other department)", 5, 20, ["PHY1", "PHY Lab", "CHE1", "CHE Lab"]],
  ["First-Year Chemistry Faculty", "FYC", "First-year (other department)", 5, 20, ["CHE1", "CHE Lab", "PHY Lab"]],
  ["First-Year Electrical Faculty", "FYE", "First-year (other department)", 5, 20, ["BEE", "BEE Lab"]],
  ["First-Year Mechanics Faculty", "FYME", "First-year (other department)", 5, 20, ["ENGM", "EG"]],
  ["First-Year English Faculty", "FYEN", "First-year (other department)", 5, 20, ["PCE"]],
  ["First-Year Electronics Faculty", "FYEL", "First-year (other department)", 5, 20, ["BE", "BE Lab"]],
  ["First-Year Graphics Faculty", "FYEG", "First-year (other department)", 5, 20, ["EG"]],
  ["First-Year Workshop Faculty", "FYWS", "First-year (other department)", 5, 20, ["WS"]],
  ["Disaster Management Faculty", "DMF", "First-year (other department)", 5, 20, ["DISM"]],
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
 * Best-effort numeric semester from a class's year text, for
 * master-sheet grouping: "Sem 3" / "Semester 3" -> 3; ordinal years
 * ("3rd") are read as the semester of that year label; anything else
 * -> null (the class groups under its programme, unsorted by term).
 */
export function parseSemesterNumber(year: string): number | null {
  const sem = year.match(/sem(?:ester)?\s*(\d{1,2})/i);
  if (sem) return Number(sem[1]);
  const ord = year.trim().match(/^(\d{1,2})(?:st|nd|rd|th)$/i);
  if (ord) return Number(ord[1]);
  const plain = year.trim().match(/^(\d{1,2})$/);
  if (plain) return Number(plain[1]);
  return null;
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
