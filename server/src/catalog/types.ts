/**
 * Syllabus catalogue — plain-data shapes.
 *
 * A catalogue is the department's OFFICIAL syllabus course structure,
 * extracted from the institute's published syllabus PDFs (sources and
 * caveats: reference/CATALOGUE-PROVENANCE.md; the raw extractions live
 * in reference/catalogue-raw/). It is the single source the guided
 * setup flow and the CSE seed are built from: subjects are PRELOADED
 * from here — the user only assigns teachers.
 *
 * Per subject:
 *   syllabusCode  the code printed in the syllabus (null when the
 *                 syllabus prints none — the M.Tech syllabi print no
 *                 codes at all)
 *   shortCode     the display code used in routine cells, from the
 *                 department routine sheet's legends
 *   derived       true when the shortCode was derived (not printed in
 *                 the syllabus / not on the routine sheet)
 *   L / T / P     lecture / tutorial / practical hours per week
 *   weeklyHours   L+T+P for timetabled subjects, 0 otherwise
 *   sessionHours  one session's length on the hourly grid, per the
 *                 block model: theory 2h; lab P=6 -> 3h sessions
 *                 (two of them), P=3 -> 3h, P=2 -> 2h; seminar = its
 *                 weekly hours (1 or 2)
 *   timetabled    false for project / thesis / viva / training /
 *                 NSS-NCC — real syllabus items that never appear on
 *                 the routine grid
 */

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
  /** Stable key, unique within its semester (and group): the shortCode. */
  key: string;
  syllabusCode: string | null;
  shortCode: string;
  title: string;
  L: number;
  T: number;
  P: number;
  credits: number;
  kind: CatalogueKind;
  timetabled: boolean;
  derived?: boolean;
  weeklyHours: number;
  sessionHours: number;
  /** For kind === "elective": the options this slot is chosen from. */
  electivePool?: CatalogueElectiveOption[];
}

export interface CatalogueSemester {
  semester: number;
  /** Flat subject list (most semesters). */
  subjects?: CatalogueSubject[];
  /**
   * Section variants of the same semester — B.Tech Sem 1/2 run as
   * Group I / Group II with different subject sets.
   */
  groups?: { I: CatalogueSubject[]; II: CatalogueSubject[] };
}

export interface CatalogueProgramme {
  programme: string; // "B.Tech" | "MCA" | "M.Tech"
  /** M.Tech only: "Artificial Intelligence" | "Cyber Security" | "Data Science & Engineering". */
  specialisation?: string;
  semesters: CatalogueSemester[];
}

export interface CatalogueDepartment {
  /** Catalogue id used in API paths, e.g. "CSE". */
  id: string;
  name: string;
  shortName: string;
  programmes: CatalogueProgramme[];
}

/** The subject list for one class of a semester (group-aware). */
export function semesterSubjects(
  sem: CatalogueSemester,
  group?: string | null,
): CatalogueSubject[] {
  if (sem.groups) {
    if (group === "II") return sem.groups.II;
    return sem.groups.I; // default: Group I
  }
  return sem.subjects ?? [];
}

export function findProgramme(
  dept: CatalogueDepartment,
  programme: string,
  specialisation?: string | null,
): CatalogueProgramme | null {
  return (
    dept.programmes.find(
      (p) =>
        p.programme === programme &&
        (programme !== "M.Tech" || (p.specialisation ?? "") === (specialisation ?? "")),
    ) ?? null
  );
}

export function findSemester(
  prog: CatalogueProgramme,
  semester: number,
): CatalogueSemester | null {
  return prog.semesters.find((s) => s.semester === semester) ?? null;
}

/**
 * One catalogue subject resolved into the routine-subject shape used
 * by the seed and the guided endpoint: elective slots become the
 * PICKED option (its code/title/syllabus code, the slot's L-T-P and
 * credits); everything else passes through. Only timetabled subjects
 * resolve — callers filter first.
 */
export interface ResolvedSubject {
  catalogueKey: string;
  shortCode: string;
  title: string;
  syllabusCode: string | null;
  credits: number;
  type: "theory" | "lab";
  kind: CatalogueKind;
  sessionHours: number;
  weeklyHours: number;
}

export function resolveSubject(
  subject: CatalogueSubject,
  electivePick?: string | null,
): ResolvedSubject | null {
  if (!subject.timetabled) return null;
  if (subject.kind === "elective") {
    const pool = subject.electivePool ?? [];
    const pick = pool.find((o) => o.shortCode === electivePick);
    if (!pick) return null;
    return {
      catalogueKey: subject.key,
      shortCode: pick.shortCode,
      title: pick.title,
      syllabusCode: pick.syllabusCode,
      credits: subject.credits,
      type: "theory",
      kind: subject.kind,
      sessionHours: subject.sessionHours,
      weeklyHours: subject.weeklyHours,
    };
  }
  return {
    catalogueKey: subject.key,
    shortCode: subject.shortCode,
    title: subject.title,
    syllabusCode: subject.syllabusCode,
    credits: subject.credits,
    type: subject.kind === "lab" ? "lab" : "theory",
    kind: subject.kind,
    sessionHours: subject.sessionHours,
    weeklyHours: subject.weeklyHours,
  };
}
