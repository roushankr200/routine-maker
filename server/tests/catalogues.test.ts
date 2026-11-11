/**
 * All-department catalogue integrity (v2.4) — per-semester credit
 * sums pinned against the totals printed in the official syllabus
 * documents staged in reference/catalogue-raw/ (see
 * reference/CATALOGUE-PROVENANCE.md for sources and the modelling
 * rules), plus the generic invariants the setup and solver rely on.
 * Pure data: no database needed. Run: npm test (vitest)
 */
import { describe, it, expect } from "vitest";
import {
  CATALOGUES,
  CatalogueProgramme,
  CatalogueSubject,
} from "../src/catalog/index.js";

function subjectsOf(prog: CatalogueProgramme, semester: number): CatalogueSubject[] {
  const sem = prog.semesters.find((s) => s.semester === semester)!;
  return sem.groups ? [...sem.groups.I, ...sem.groups.II] : (sem.subjects ?? []);
}

function semesterCredits(prog: CatalogueProgramme, semester: number): number[] {
  const sem = prog.semesters.find((s) => s.semester === semester)!;
  const sum = (list: CatalogueSubject[]) =>
    list.reduce((acc, s) => acc + (s.credits ?? 0), 0);
  return sem.groups ? [sum(sem.groups.I), sum(sem.groups.II)] : [sum(sem.subjects ?? [])];
}

/** Sem 3–8 credit totals for B.Tech; all 4 for M.Tech programmes. */
const EXPECTED: Record<string, Record<string, number[]>> = {
  CSE: { "B.Tech": [24, 21, 24, 27, 13, 13] },
  CIVIL: {
    "B.Tech": [21.5, 22, 22, 22, 21.5, 13],
    "M.Tech|Structural Engineering": [25, 25, 10, 20],
    // The Geotechnical Sem-2 ROWS sum to 24 although the PDF prints
    // a total of 25 (source inconsistency — see provenance note).
    "M.Tech|Geotechnical Engineering": [25, 24, 10, 20],
    "M.Tech|Transportation Engineering": [25, 25, 10, 20],
    "M.Tech|Environmental Engineering": [25, 25, 10, 20],
    "M.Tech|Water Resources Engineering": [25, 25, 10, 20],
    "M.Tech|Hydroinformatics Engineering": [25, 25, 20, 40],
    "M.Tech|Seismic Engineering": [25, 25, 10, 20],
  },
  EE: {
    "B.Tech": [23.5, 25.5, 24, 19.5, 16.5, 13],
    "M.Tech|Power Electronics & Drives": [25, 25, 10, 20],
    "M.Tech|Instrumentation": [25, 25, 10, 20],
    "M.Tech|Power System": [25, 25, 10, 20],
    "M.Tech|Integrated Energy System": [25, 25, 10, 20],
  },
  ECE: {
    "B.Tech": [25, 25, 23, 21, 13, 13],
    "M.Tech|Communication Systems & Signal Processing": [25, 25, 10, 20],
    "M.Tech|VLSI Design": [25, 25, 10, 20],
  },
  EIE: { "M.Tech|IoT and Sensor Systems": [25, 25, 10, 20] },
  MECH: {
    "B.Tech": [24, 23, 25, 23, 14, 13],
    "M.Tech|Material Science and Engineering": [28, 20, 12, 20],
    "M.Tech|Thermal Science and Engineering": [25, 25, 10, 20],
    "M.Tech|Manufacturing Technology": [25, 25, 10, 20],
    "M.Tech|Automotive Engineering": [25, 25, 10, 20],
    "M.Tech|Machine Design": [25, 25, 10, 20],
  },
  CHEMICAL: { "B.Tech": [19.5, 22, 19.5, 24.5, 18.5, 13], "M.Tech": [25, 25, 10, 20] },
  BIO: { "B.Tech": [23, 21, 21, 21, 18, 13], "M.Tech": [25, 25, 10, 20] },
};

describe("catalogue credit totals match the printed syllabus totals", () => {
  for (const [deptId, programmes] of Object.entries(EXPECTED)) {
    const dept = CATALOGUES[deptId];
    for (const [key, totals] of Object.entries(programmes)) {
      it(`${deptId} ${key}`, () => {
        const [programme, spec] = key.split("|");
        const prog = dept.programmes.find(
          (p) => p.programme === programme && (p.specialisation ?? "") === (spec ?? ""),
        );
        expect(prog, `${deptId} ${key}`).toBeDefined();
        const startSemester = programme === "B.Tech" ? 3 : 1;
        totals.forEach((expected, i) => {
          for (const total of semesterCredits(prog!, startSemester + i)) {
            expect(total, `${deptId} ${key} Sem ${startSemester + i}`).toBe(expected);
          }
        });
      });
    }
  }
});

describe("all catalogues: generic invariants", () => {
  it("aggregate holds exactly the 9 catalogued departments", () => {
    expect(Object.keys(CATALOGUES).sort()).toEqual([
      "BIO", "CHEMICAL", "CIVIL", "CSE", "ECE", "EE", "EIE", "MECH", "PROD",
    ]);
  });

  it("every B.Tech programme opens with the common first year (22/21 credits, Groups I/II)", () => {
    for (const dept of Object.values(CATALOGUES)) {
      const btech = dept.programmes.find((p) => p.programme === "B.Tech");
      if (!btech) continue; // EIE has no B.Tech catalogue
      for (const [semester, credits] of [[1, 22], [2, 21]] as const) {
        const sem = btech.semesters.find((s) => s.semester === semester)!;
        expect(sem.groups, `${dept.id} Sem ${semester}`).toBeDefined();
        expect(semesterCredits(btech, semester)).toEqual([credits, credits]);
      }
    }
  });

  it("subject keys are unique within every semester (and group)", () => {
    for (const dept of Object.values(CATALOGUES)) {
      for (const prog of dept.programmes) {
        for (const sem of prog.semesters) {
          const lists = sem.groups ? [sem.groups.I, sem.groups.II] : [sem.subjects ?? []];
          for (const list of lists) {
            const keys = list.map((s) => s.key);
            expect(new Set(keys).size, `${dept.id} Sem ${sem.semester}`).toBe(keys.length);
          }
        }
      }
    }
  });

  it("timetabled subjects obey the block rules (hours >= 1, session 1..3, session <= hours)", () => {
    for (const dept of Object.values(CATALOGUES)) {
      for (const prog of dept.programmes) {
        for (const sem of prog.semesters) {
          for (const s of subjectsOf(prog, sem.semester)) {
            if (s.weeklyHours === null) {
              // Only Production B.Tech may carry unpublished numbers
              // (timetabled or not — nothing is invented for them).
              expect(dept.id).toBe("PROD");
              expect(prog.numbersRequired).toBe(true);
              expect(s.credits).toBeNull();
              continue;
            }
            if (!s.timetabled) {
              expect(s.weeklyHours, `${dept.id}/${s.shortCode}`).toBe(0);
              continue;
            }
            expect(s.weeklyHours, `${dept.id}/${s.shortCode}`).toBeGreaterThanOrEqual(1);
            expect(s.sessionHours, `${dept.id}/${s.shortCode}`).toBeGreaterThanOrEqual(1);
            expect(s.sessionHours, `${dept.id}/${s.shortCode}`).toBeLessThanOrEqual(3);
            expect(s.sessionHours, `${dept.id}/${s.shortCode}`).toBeLessThanOrEqual(s.weeklyHours);
            expect(s.credits, `${dept.id}/${s.shortCode}`).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it("elective pools are defined everywhere; only the two Civil slots print no pool", () => {
    const emptyPools: string[] = [];
    for (const dept of Object.values(CATALOGUES)) {
      for (const prog of dept.programmes) {
        for (const sem of prog.semesters) {
          for (const s of subjectsOf(prog, sem.semester)) {
            if (s.electivePool === undefined) continue;
            if (s.electivePool.length === 0) emptyPools.push(`${dept.id}/${s.key}`);
          }
        }
      }
    }
    expect(emptyPools.sort()).toEqual(["CIVIL/UCE04E01", "CIVIL/UCE05E01"]);
  });

  it("Production B.Tech: numbersRequired, Sem 3-8 numbers are null (never invented)", () => {
    const prod = CATALOGUES.PROD.programmes.find((p) => p.programme === "B.Tech")!;
    expect(prod.numbersRequired).toBe(true);
    for (const semester of [3, 4, 5, 6, 7, 8]) {
      for (const s of subjectsOf(prod, semester)) {
        if (!s.timetabled) continue;
        expect(s.weeklyHours, `Sem ${semester} ${s.shortCode}`).toBeNull();
        expect(s.credits, `Sem ${semester} ${s.shortCode}`).toBeNull();
      }
    }
    // The common first year DOES publish numbers.
    for (const s of subjectsOf(prod, 1)) {
      expect(s.weeklyHours).not.toBeNull();
    }
  });
});
