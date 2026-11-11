/**
 * Syllabus catalogue integrity — the catalogue is the single source
 * for the guided setup and the CSE seed, so its data is pinned
 * against the OFFICIAL syllabus documents it was extracted from
 * (reference/catalogue-raw/, reference/CATALOGUE-PROVENANCE.md):
 * per-semester credit sums must equal the printed totals, every
 * timetabled subject must carry positive weekly hours, elective
 * slots must carry their pools, and the session-length rules of the
 * block model must hold. Pure data + the read-only catalog API:
 * no database needed. Run: npm test (vitest)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";
import {
  CSE_CATALOGUE,
  CatalogueProgramme,
  CatalogueSubject,
} from "../src/catalog/index.js";

function allSubjects(prog: CatalogueProgramme): CatalogueSubject[] {
  return prog.semesters.flatMap((s) =>
    s.groups ? [...s.groups.I, ...s.groups.II] : (s.subjects ?? []),
  );
}

function semesterCredits(prog: CatalogueProgramme, semester: number): number[] {
  const sem = prog.semesters.find((s) => s.semester === semester)!;
  if (sem.groups) {
    return [
      sem.groups.I.reduce((sum, s) => sum + s.credits, 0),
      sem.groups.II.reduce((sum, s) => sum + s.credits, 0),
    ];
  }
  return [(sem.subjects ?? []).reduce((sum, s) => sum + s.credits, 0)];
}

const EXPECTED_CREDITS: Record<string, number[]> = {
  "B.Tech": [22, 21, 24, 21, 24, 27, 13, 13],
  MCA: [25, 26, 25, 26, 24, 14],
  "M.Tech|Artificial Intelligence": [25, 25, 10, 20],
  "M.Tech|Cyber Security": [25, 25, 10, 20],
  "M.Tech|Data Science & Engineering": [25, 25, 10, 20],
};

describe("catalogue credit totals match the printed syllabus totals", () => {
  for (const prog of CSE_CATALOGUE.programmes) {
    const key = prog.specialisation ? `${prog.programme}|${prog.specialisation}` : prog.programme;
    it(`${key}: per-semester sums`, () => {
      const expected = EXPECTED_CREDITS[key];
      expect(expected, `no expectation recorded for ${key}`).toBeDefined();
      expect(prog.semesters.map((s) => s.semester)).toEqual(
        expected.map((_, i) => i + 1),
      );
      prog.semesters.forEach((sem, i) => {
        for (const total of semesterCredits(prog, sem.semester)) {
          expect(total, `${key} Sem ${sem.semester}`).toBe(expected[i]);
        }
      });
    });
  }
});

describe("catalogue subject invariants", () => {
  it("every timetabled subject has weeklyHours = L+T+P > 0 and credits >= 0", () => {
    for (const prog of CSE_CATALOGUE.programmes) {
      for (const s of allSubjects(prog)) {
        expect(s.credits, `${s.shortCode} credits`).toBeGreaterThanOrEqual(0);
        if (s.timetabled) {
          expect(s.weeklyHours, `${s.shortCode} weeklyHours`).toBe(s.L + s.T + s.P);
          expect(s.weeklyHours, `${s.shortCode} weeklyHours`).toBeGreaterThan(0);
        } else {
          expect(s.weeklyHours, `${s.shortCode} weeklyHours`).toBe(0);
        }
      }
    }
  });

  it("session lengths follow the block model (theory/elective <= 2, lab 2-3, seminar = weekly)", () => {
    for (const prog of CSE_CATALOGUE.programmes) {
      for (const s of allSubjects(prog)) {
        if (!s.timetabled) continue;
        if (s.kind === "lab") {
          expect(s.sessionHours, `${s.shortCode}`).toBeGreaterThanOrEqual(2);
          expect(s.sessionHours, `${s.shortCode}`).toBeLessThanOrEqual(3);
          // The MCA 0-0-6 labs split into two 3h sessions.
          if (s.P === 6) expect(s.sessionHours, `${s.shortCode}`).toBe(3);
          if (s.P === 2) expect(s.sessionHours, `${s.shortCode}`).toBe(2);
        } else if (s.kind === "seminar") {
          expect(s.sessionHours, `${s.shortCode}`).toBe(s.weeklyHours);
        } else {
          expect(s.sessionHours, `${s.shortCode}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it("elective slots carry non-empty pools; non-electives carry none", () => {
    for (const prog of CSE_CATALOGUE.programmes) {
      for (const s of allSubjects(prog)) {
        if (s.kind === "elective") {
          expect(s.electivePool?.length, `${prog.programme} ${s.key}`).toBeGreaterThan(0);
          for (const o of s.electivePool ?? []) {
            expect(o.shortCode.length).toBeGreaterThan(0);
            expect(o.title.length).toBeGreaterThan(0);
          }
        } else {
          expect(s.electivePool).toBeUndefined();
        }
      }
    }
  });

  it("subject keys are unique within each semester (and group)", () => {
    for (const prog of CSE_CATALOGUE.programmes) {
      for (const sem of prog.semesters) {
        const lists = sem.groups ? [sem.groups.I, sem.groups.II] : [sem.subjects ?? []];
        for (const list of lists) {
          const keys = list.map((s) => s.key);
          expect(new Set(keys).size, `${prog.programme} Sem ${sem.semester}`).toBe(keys.length);
        }
      }
    }
  });

  it("the seed's elective picks exist in their pools", () => {
    // B.Tech 5A DIP / 5B CG, 7A IR+CC, 7B BD+SC; MCA 5 WCN+DIP;
    // M.Tech AI NLP+IR, CYSEC ACN+DH, DSE NLP+IR (demoData.ts picks).
    const picks: Array<[string, string | undefined, number, string, string]> = [
      ["B.Tech", undefined, 5, "Elective-I", "DIP"],
      ["B.Tech", undefined, 5, "Elective-I", "CG"],
      ["B.Tech", undefined, 7, "Elective-III", "IR"],
      ["B.Tech", undefined, 7, "Elective-IV", "CC"],
      ["B.Tech", undefined, 7, "Elective-III", "BD"],
      ["B.Tech", undefined, 7, "Elective-IV", "SC"],
      ["MCA", undefined, 5, "Elective-I", "WCN"],
      ["MCA", undefined, 5, "Elective-II", "DIP"],
      ["M.Tech", "Artificial Intelligence", 1, "Elective-I", "NLP"],
      ["M.Tech", "Artificial Intelligence", 1, "Elective-II", "IR"],
      ["M.Tech", "Cyber Security", 1, "Elective-I", "ACN"],
      ["M.Tech", "Cyber Security", 1, "Elective-II", "DH"],
      ["M.Tech", "Data Science & Engineering", 1, "Elective-I", "NLP"],
      ["M.Tech", "Data Science & Engineering", 1, "Elective-II", "IR"],
    ];
    for (const [programme, spec, semester, slot, pick] of picks) {
      const prog = CSE_CATALOGUE.programmes.find(
        (p) => p.programme === programme && (p.specialisation ?? "") === (spec ?? ""),
      )!;
      const sem = prog.semesters.find((s) => s.semester === semester)!;
      const slotSubject = (sem.subjects ?? []).find((s) => s.key === slot)!;
      expect(
        slotSubject.electivePool?.some((o) => o.shortCode === pick),
        `${programme} Sem ${semester} ${slot} -> ${pick}`,
      ).toBe(true);
    }
  });
});

describe("catalog API", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    server = createApp().listen(0);
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    base = `http://127.0.0.1:${addr.port}`;
  });
  afterAll(async () => {
    server?.close();
  });

  it("GET /api/catalog lists CSE with its 5 programmes", async () => {
    const res = await fetch(`${base}/api/catalog`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      departments: Array<{ id: string; programmes: unknown[] }>;
    };
    expect(json.departments).toHaveLength(1);
    expect(json.departments[0].id).toBe("CSE");
    expect(json.departments[0].programmes).toHaveLength(5);
  });

  it("GET /api/catalog/CSE returns the full tree; unknown id -> 404", async () => {
    const res = await fetch(`${base}/api/catalog/CSE`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { programmes: Array<{ programme: string; semesters: unknown[] }> };
    const btech = json.programmes.find((p) => p.programme === "B.Tech")!;
    expect(btech.semesters).toHaveLength(8);
    const missing = await fetch(`${base}/api/catalog/NOPE`);
    expect(missing.status).toBe(404);
  });
});
