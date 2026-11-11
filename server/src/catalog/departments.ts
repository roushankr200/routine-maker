/**
 * Department registry — every NITA unit the unified setup's
 * department dropdown offers: the 13 departments that exist on
 * nita.ac.in plus Education (which has NO presence on the live
 * site — no faculty page, no syllabus: fully manual).
 *
 * `catalogueId` points at the syllabus catalogue (catalog/index.ts)
 * when the department's course structure was published and
 * extracted; departments without one still preload their faculty
 * and take courses through the manual path of the same setup.
 */

import { FACULTY } from "./faculty.js";

export interface DepartmentRegistryEntry {
  /** Registry id — also the catalogue id and faculty key. */
  id: string;
  name: string;
  shortName: string;
  /** Syllabus catalogue id, or null when none was published/found. */
  catalogueId: string | null;
  hasCatalogue: boolean;
  facultyCount: number;
}

function entry(
  id: string,
  name: string,
  shortName: string,
  catalogueId: string | null,
): DepartmentRegistryEntry {
  return {
    id,
    name,
    shortName,
    catalogueId,
    hasCatalogue: catalogueId !== null,
    facultyCount: FACULTY[id]?.length ?? 0,
  };
}

export const DEPARTMENT_REGISTRY: DepartmentRegistryEntry[] = [
  entry("CSE", "Computer Science and Engineering", "CSE", "CSE"),
  entry("CIVIL", "Civil Engineering", "CE", "CIVIL"),
  entry("EE", "Electrical Engineering", "EE", "EE"),
  entry("ECE", "Electronics and Communication Engineering", "ECE", "ECE"),
  entry("EIE", "Electronics and Instrumentation Engineering", "EIE", "EIE"),
  entry("MECH", "Mechanical Engineering", "ME", "MECH"),
  entry("PROD", "Production Engineering", "PE", "PROD"),
  entry("CHEMICAL", "Chemical Engineering", "ChemE", "CHEMICAL"),
  entry("BIO", "Bio-Engineering", "BioE", "BIO"),
  entry("CHEMISTRY", "Chemistry", "Chem", null),
  entry("PHYSICS", "Physics", "Phy", null),
  entry("MATHS", "Mathematics", "Math", null),
  entry("MHSS", "Management, Humanities and Social Sciences", "MHSS", null),
  entry("EDUCATION", "Education", "Edu", null),
];

export function getRegistryDepartment(id: string): DepartmentRegistryEntry | null {
  return DEPARTMENT_REGISTRY.find((d) => d.id === id.toUpperCase()) ?? null;
}
