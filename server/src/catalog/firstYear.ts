/**
 * The common B.Tech first year (Sem 1–2), shared by EVERY B.Tech
 * programme of every department: NITA runs one institute-wide first
 * year (Group I / Group II subject sets) from
 * https://www.nita.ac.in/FinalSyllabus_1stYear_2021.pdf.
 *
 * The first-year structure tables print NO subject codes; short
 * codes are derived (only 4 syllabus codes could be verified from
 * the document's detailed sections) — see CATALOGUE-PROVENANCE.md.
 */

import { sub } from "./build.js";
import { CatalogueSemester, CatalogueSubject } from "./types.js";

const BT_S1_G1: CatalogueSubject[] = [
  sub({ code: "EM1", title: "Engineering Mathematics-I", ltp: [2, 1, 0], credits: 3, derived: true }),
  sub({ code: "PHY1", title: "Engineering Physics-I", ltp: [2, 1, 0], credits: 3, syllabusCode: "UPH11B07", derived: true }),
  sub({ code: "CHE1", title: "Engineering Chemistry-I", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCY11B10", derived: true }),
  sub({ code: "BEE", title: "Basic Electrical Engineering", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "ENGM", title: "Engineering Mechanics", ltp: [3, 1, 0], credits: 4, derived: true }),
  sub({ code: "PCE", title: "Language (Professional Communication in English)", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "CHE Lab", title: "Engineering Chemistry Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "WS", title: "Workshop Practice", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "BEE Lab", title: "Basic Electrical Engineering Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "NSS", title: "NSS/NCC", ltp: [0, 0, 3], credits: 0, kind: "other", timetabled: false, derived: true }),
];
const BT_S1_G2: CatalogueSubject[] = [
  sub({ code: "EM1", title: "Engineering Mathematics-I", ltp: [2, 1, 0], credits: 3, derived: true }),
  sub({ code: "PHY1", title: "Engineering Physics-I", ltp: [2, 1, 0], credits: 3, syllabusCode: "UPH11B07", derived: true }),
  sub({ code: "CHE1", title: "Engineering Chemistry-I", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCY11B10", derived: true }),
  sub({ code: "BE", title: "Basic Electronics", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "DISM", title: "Disaster Management", ltp: [2, 0, 0], credits: 2, derived: true }),
  sub({ code: "ITP", title: "Introduction to Programming", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "PHY Lab", title: "Engineering Physics Lab", ltp: [0, 0, 2], credits: 1, syllabusCode: "UPH12P06", derived: true }),
  sub({ code: "EG", title: "Engineering Graphics", ltp: [1, 0, 2], credits: 2, derived: true }),
  sub({ code: "ITP Lab", title: "Computer Programming Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "BE Lab", title: "Basic Electronics Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "NSS", title: "NSS/NCC", ltp: [0, 0, 3], credits: 0, kind: "other", timetabled: false, derived: true }),
];
const BT_S2_G1: CatalogueSubject[] = [
  sub({ code: "EM2", title: "Engineering Mathematics-II", ltp: [2, 1, 0], credits: 3, derived: true }),
  sub({ code: "PHY2", title: "Engineering Physics-II", ltp: [2, 1, 0], credits: 3, syllabusCode: "UPH12B09", derived: true }),
  sub({ code: "CHE2", title: "Engineering Chemistry-II", ltp: [2, 0, 0], credits: 2, derived: true }),
  sub({ code: "BE", title: "Basic Electronics", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "DISM", title: "Disaster Management", ltp: [2, 0, 0], credits: 2, derived: true }),
  sub({ code: "ITP", title: "Introduction to Programming", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "PHY Lab", title: "Engineering Physics Lab", ltp: [0, 0, 2], credits: 1, syllabusCode: "UPH12P06", derived: true }),
  sub({ code: "EG", title: "Engineering Graphics", ltp: [1, 0, 2], credits: 2, derived: true }),
  sub({ code: "ITP Lab", title: "Computer Programming Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "BE Lab", title: "Basic Electronics Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
];
const BT_S2_G2: CatalogueSubject[] = [
  sub({ code: "EM2", title: "Engineering Mathematics-II", ltp: [2, 1, 0], credits: 3, derived: true }),
  sub({ code: "PHY2", title: "Engineering Physics-II", ltp: [2, 1, 0], credits: 3, syllabusCode: "UPH12B09", derived: true }),
  sub({ code: "CHE2", title: "Engineering Chemistry-II", ltp: [2, 0, 0], credits: 2, derived: true }),
  sub({ code: "BEE", title: "Basic Electrical Engineering", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "ENGM", title: "Engineering Mechanics", ltp: [3, 1, 0], credits: 4, derived: true }),
  sub({ code: "PCE", title: "Language (Professional Communication in English)", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "CHE Lab", title: "Engineering Chemistry Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "WS", title: "Workshop Practice", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "BEE Lab", title: "Basic Electrical Engineering Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
];

/** Sem 1–2 (Group I / Group II) — the first two semesters of every B.Tech. */
export const FIRST_YEAR_SEMESTERS: CatalogueSemester[] = [
  { semester: 1, groups: { I: BT_S1_G1, II: BT_S1_G2 } },
  { semester: 2, groups: { I: BT_S2_G1, II: BT_S2_G2 } },
];

/**
 * title -> first-year code, for seeding other departments' CodeBooks:
 * when a later-semester title IS a first-year subject (it is not —
 * but a shared title like a lab must never fork into two codes).
 */
export const FIRST_YEAR_CODES: Array<readonly [string, string]> = [
  ...BT_S1_G1,
  ...BT_S1_G2,
  ...BT_S2_G1,
  ...BT_S2_G2,
].map((s) => [s.title, s.shortCode] as const);
