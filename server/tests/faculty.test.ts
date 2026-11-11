/**
 * Faculty registry — the website faculty lists staged in
 * reference/faculty-raw/ (extracted from nita.ac.in on 2026-11-11).
 * Pins the exact per-department counts (237 people across 13
 * departments; Education has no website presence), the derived
 * short codes (initials, collisions resolved with digits, unique
 * and stable per department) and the read-only faculty API.
 * Run: npm test (vitest)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";
import {
  DEPARTMENT_REGISTRY,
  FACULTY,
  facultyWithCodes,
} from "../src/catalog/index.js";

const EXPECTED_COUNTS: Record<string, number> = {
  CSE: 25,
  CIVIL: 33,
  EE: 23,
  ECE: 17,
  EIE: 10,
  MECH: 31,
  PROD: 14,
  CHEMICAL: 11,
  BIO: 9,
  CHEMISTRY: 18,
  PHYSICS: 15,
  MATHS: 19,
  MHSS: 12,
  EDUCATION: 0,
};

describe("faculty registry data", () => {
  it("covers all 14 registry departments with the exact staged counts (237 total)", () => {
    expect(DEPARTMENT_REGISTRY).toHaveLength(14);
    let total = 0;
    for (const dept of DEPARTMENT_REGISTRY) {
      expect(FACULTY[dept.id], dept.id).toBeDefined();
      expect(FACULTY[dept.id].length, dept.id).toBe(EXPECTED_COUNTS[dept.id]);
      expect(dept.facultyCount, dept.id).toBe(EXPECTED_COUNTS[dept.id]);
      total += FACULTY[dept.id].length;
    }
    expect(total).toBe(237);
  });

  it("registry flags: 9 departments have a catalogue; Education has neither catalogue nor faculty", () => {
    const withCatalogue = DEPARTMENT_REGISTRY.filter((d) => d.hasCatalogue).map((d) => d.id);
    expect(withCatalogue.sort()).toEqual([
      "BIO", "CHEMICAL", "CIVIL", "CSE", "ECE", "EE", "EIE", "MECH", "PROD",
    ]);
    const education = DEPARTMENT_REGISTRY.find((d) => d.id === "EDUCATION")!;
    expect(education.hasCatalogue).toBe(false);
    expect(education.facultyCount).toBe(0);
  });

  it("names and designations are the staged ones (spot checks)", () => {
    expect(FACULTY.CSE[0]).toEqual({
      name: "Dr. Ashim Saha",
      designation: "HOD & Associate Professor",
    });
    expect(FACULTY.CSE.some((m) => m.name === "Dr. Nirmalya Kar")).toBe(true);
    expect(FACULTY.CIVIL[0].name).toBe("Dr. PARTHA PRATIM SARKAR");
    expect(FACULTY.MHSS.some((m) => m.name === "Dr. Anirban Dutta")).toBe(true);
  });

  it("derived teacher codes are unique within every department and stable across calls", () => {
    for (const dept of DEPARTMENT_REGISTRY) {
      const coded = facultyWithCodes(dept.id)!;
      const codes = coded.map((m) => m.code);
      expect(new Set(codes).size, dept.id).toBe(codes.length);
      expect(codes.every((c) => /^[A-Z0-9]+$/.test(c)), dept.id).toBe(true);
      // Deterministic: a second derivation yields identical codes.
      expect(facultyWithCodes(dept.id)!.map((m) => m.code)).toEqual(codes);
    }
  });

  it("code derivation: initials with honorifics dropped; collisions get digits", () => {
    const civil = facultyWithCodes("CIVIL")!;
    expect(civil[0].code).toBe("PPS"); // Dr. PARTHA PRATIM SARKAR
    const cse = facultyWithCodes("CSE")!;
    // "SD" is claimed first by Dr. Suman Deb; later SDs get digits.
    expect(cse.find((m) => m.name === "Dr. Suman Deb")!.code).toBe("SD");
    expect(cse.find((m) => m.name === "Dr. SWAPAN DEBBARMA")!.code).toBe("SD2");
    expect(cse.find((m) => m.name === "Dr. Smita Das")!.code).toBe("SD3");
  });
});

describe("faculty API", () => {
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

  it("GET /api/faculty lists all 14 departments with catalogue flags and counts", async () => {
    const res = await fetch(`${base}/api/faculty`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      departments: Array<{ id: string; hasCatalogue: boolean; facultyCount: number }>;
    };
    expect(json.departments).toHaveLength(14);
    const cse = json.departments.find((d) => d.id === "CSE")!;
    expect(cse).toMatchObject({ hasCatalogue: true, facultyCount: 25 });
    const physics = json.departments.find((d) => d.id === "PHYSICS")!;
    expect(physics).toMatchObject({ hasCatalogue: false, facultyCount: 15 });
  });

  it("GET /api/faculty/CIVIL returns the people with derived codes", async () => {
    const res = await fetch(`${base}/api/faculty/CIVIL`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      faculty: Array<{ name: string; designation: string; code: string }>;
    };
    expect(json.faculty).toHaveLength(33);
    expect(json.faculty[0]).toEqual({
      name: "Dr. PARTHA PRATIM SARKAR",
      designation: "Professor & HOD",
      code: "PPS",
    });
  });

  it("GET /api/faculty/EDUCATION is an empty list; unknown department -> 404", async () => {
    const edu = await fetch(`${base}/api/faculty/EDUCATION`);
    expect(edu.status).toBe(200);
    expect(((await edu.json()) as { faculty: unknown[] }).faculty).toHaveLength(0);
    const nope = await fetch(`${base}/api/faculty/NOPE`);
    expect(nope.status).toBe(404);
  });
});
