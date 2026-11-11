/**
 * Unified setup (v2.4) — integration tests against a real
 * (in-memory) MongoDB + the real Express app over HTTP.
 *
 * Covers the one-setup contract of POST /api/setup/guided:
 *  (a) a catalogue department (Civil) created WITH website faculty
 *      preload — teachers carry the registry's names/designations,
 *      never client-sent ones — then generates with 0 unplaced;
 *  (b) the fully manual path (custom class + custom subjects)
 *      creates a department end-to-end (the old wizard's job);
 *  (c) Production assignments without the user-supplied numbers the
 *      syllabus does not publish -> 400; with numbers -> 201;
 *  (d) duplicate department name -> 409 (unchanged semantics).
 * Run: npm test (vitest)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { backfillLegacyData } from "../src/departments.js";

let mongod: MongoMemoryServer;
let server: Server;
let base: string;

async function req(method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, json: json as never };
}

interface CatSubject {
  key: string;
  shortCode: string;
  title: string;
  timetabled: boolean;
  weeklyHours: number | null;
  electivePool?: Array<{ shortCode: string }>;
}
interface CatDept {
  programmes: Array<{
    programme: string;
    specialisation?: string;
    numbersRequired?: boolean;
    semesters: Array<{ semester: number; subjects?: CatSubject[] }>;
  }>;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { storageEngine: "ephemeralForTest" },
  });
  await mongoose.connect(mongod.getUri("routine-maker-unified-test"));
  await backfillLegacyData();
  server = createApp().listen(0);
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod?.stop();
});

describe("unified setup", () => {
  it("(a) Civil with faculty preload: registry names/designations win; generate -> 0 unplaced", async () => {
    const cat = (await (await fetch(`${base}/api/catalog/CIVIL`)).json()) as CatDept;
    const btech = cat.programmes.find((p) => p.programme === "B.Tech")!;
    const facultyRes = (await (await fetch(`${base}/api/faculty/CIVIL`)).json()) as {
      faculty: Array<{ name: string; designation: string; code: string }>;
    };
    const pool = facultyRes.faculty.slice(0, 6);
    expect(pool).toHaveLength(6);

    // Assignments built from the catalogue itself: rotate the pool;
    // electives take their first pool option, or a typed custom pick
    // where the syllabus prints no pool (Sem 5 Professional Elective-I).
    let demand = 0;
    const classes = [3, 5].map((semester) => {
      const sem = btech.semesters.find((s) => s.semester === semester)!;
      let i = 0;
      const assignments = (sem.subjects ?? [])
        .filter((s) => s.timetabled)
        .map((s) => {
          demand += s.weeklyHours ?? 0;
          const a: Record<string, unknown> = {
            key: s.key,
            teacherCode: pool[i++ % pool.length].code,
          };
          if (s.electivePool !== undefined) {
            if (s.electivePool.length > 0) a.electivePick = s.electivePool[0].shortCode;
            else a.customPick = { shortCode: "HSSE", title: "Human Values and Professional Ethics" };
          }
          return a;
        });
      return { programme: "B.Tech", semester, section: "", assignments };
    });

    const created = await req("POST", "/api/setup/guided", {
      catalogueId: "CIVIL",
      facultyDeptId: "CIVIL",
      department: { name: "Civil Engineering", short: "CE", session: "ODD 2026", effectiveFrom: "" },
      // Client sends GARBAGE names for preloaded teachers on purpose:
      // the server must replace them with the registry's.
      teachers: pool.map((m) => ({
        facultyCode: m.code,
        code: m.code,
        name: "CLIENT LIES",
        designation: "CLIENT LIES",
        maxPerDay: 5,
        weeklyHours: 40,
      })),
      classes,
    });
    expect(created.status).toBe(201);
    const counts = (created.json as { counts: { teachers: number; classes: number } }).counts;
    expect(counts.teachers).toBe(6);
    expect(counts.classes).toBe(2);

    const teachers = (await req("GET", "/api/teachers")).json as Array<{
      name: string;
      designation: string;
      code: string;
    }>;
    expect(teachers).toHaveLength(6);
    for (const t of teachers) {
      const member = pool.find((m) => m.code === t.code)!;
      expect(t.name).toBe(member.name);
      expect(t.designation).toBe(member.designation);
    }

    const gen = await req("POST", "/api/routine/generate");
    expect(gen.status).toBe(200);
    const genJson = gen.json as {
      success: boolean;
      placedPeriods: number;
      totalPeriods: number;
      unplaced: unknown[];
    };
    expect(genJson.success).toBe(true);
    expect(genJson.unplaced).toHaveLength(0);
    expect(genJson.placedPeriods).toBe(genJson.totalPeriods);
    expect(genJson.totalPeriods).toBe(demand);
    const routine = await req("GET", "/api/routine");
    expect((routine.json as { entries: unknown[] }).entries).toHaveLength(demand);
  });

  it("(b) manual path: custom class + custom subjects create a department end-to-end", async () => {
    const created = await req("POST", "/api/setup/guided", {
      department: { name: "Physics", short: "PHY", session: "ODD 2026", effectiveFrom: "" },
      teachers: [
        { name: "Dr. Manual One", code: "MO", designation: "Professor", maxPerDay: 5, weeklyHours: 20 },
        { name: "Dr. Manual Two", code: "MT", designation: "Assistant Professor", maxPerDay: 5, weeklyHours: 20 },
      ],
      classes: [
        {
          programme: "B.Sc.-M.Sc. (Integrated)",
          semester: 1,
          section: "",
          custom: true,
          customSubjects: [
            { shortCode: "PHY101", title: "Classical Mechanics", kind: "theory", weeklyHours: 4, sessionHours: 2, credits: 4 },
            { shortCode: "PHY102", title: "Mechanics Laboratory", kind: "lab", weeklyHours: 3, sessionHours: 3, credits: 2 },
          ],
          assignments: [
            { key: "PHY101", teacherCode: "MO" },
            { key: "PHY102", teacherCode: "MT" },
          ],
        },
      ],
    });
    expect(created.status).toBe(201);
    expect((created.json as { counts: unknown }).counts).toMatchObject({
      teachers: 2,
      subjects: 2,
      classes: 1,
    });

    const gen = await req("POST", "/api/routine/generate");
    expect(gen.status).toBe(200);
    expect((gen.json as { success: boolean }).success).toBe(true);
    const routine = await req("GET", "/api/routine");
    expect((routine.json as { entries: unknown[] }).entries).toHaveLength(7);
  });

  it("(c) Production without numbers -> 400; with numbers -> 201", async () => {
    const cat = (await (await fetch(`${base}/api/catalog/PROD`)).json()) as CatDept;
    const btech = cat.programmes.find((p) => p.programme === "B.Tech")!;
    expect(btech.numbersRequired).toBe(true);
    const sem3 = btech.semesters.find((s) => s.semester === 3)!;
    const timetabled = (sem3.subjects ?? []).filter((s) => s.timetabled);
    expect(timetabled.length).toBeGreaterThan(0);
    expect(timetabled.every((s) => s.weeklyHours === null)).toBe(true);

    const teachers = [
      { name: "Dr. Prod One", code: "PO", designation: "", maxPerDay: 5, weeklyHours: 80 },
      { name: "Dr. Prod Two", code: "PT", designation: "", maxPerDay: 5, weeklyHours: 80 },
    ];
    const bare = await req("POST", "/api/setup/guided", {
      catalogueId: "PROD",
      department: { name: "Production Engineering", short: "PE", session: "ODD 2026", effectiveFrom: "" },
      teachers,
      classes: [
        {
          programme: "B.Tech",
          semester: 3,
          section: "",
          assignments: timetabled.map((s, i) => ({
            key: s.key,
            teacherCode: i % 2 === 0 ? "PO" : "PT",
          })),
        },
      ],
    });
    expect(bare.status).toBe(400);
    const problems = (bare.json as { problems: string[] }).problems;
    expect(problems.join(" ")).toMatch(/no weekly hours, session hours or credits in the published syllabus/);

    const withNumbers = await req("POST", "/api/setup/guided", {
      catalogueId: "PROD",
      department: { name: "Production Engineering", short: "PE", session: "ODD 2026", effectiveFrom: "" },
      teachers,
      classes: [
        {
          programme: "B.Tech",
          semester: 3,
          section: "",
          assignments: timetabled.map((s, i) => ({
            key: s.key,
            teacherCode: i % 2 === 0 ? "PO" : "PT",
            weeklyHours: 4,
            sessionHours: 2,
            credits: 3,
          })),
        },
      ],
    });
    expect(withNumbers.status).toBe(201);
    expect((withNumbers.json as { counts: { subjects: number } }).counts.subjects).toBe(
      timetabled.length,
    );
  });

  it("(d) duplicate department name -> 409 with the existing department id", async () => {
    const depts = (await req("GET", "/api/departments")).json as {
      departments: Array<{ id: string; name: string }>;
    };
    const civil = depts.departments.find((d) => d.name === "Civil Engineering")!;
    const dup = await req("POST", "/api/setup/guided", {
      department: { name: "civil engineering", short: "CE", session: "ODD 2026", effectiveFrom: "" },
      teachers: [{ name: "Dr. Dup", code: "DU", designation: "", maxPerDay: 5, weeklyHours: 10 }],
      classes: [
        {
          programme: "Anything",
          semester: 1,
          section: "",
          custom: true,
          customSubjects: [
            { shortCode: "X1", title: "X", kind: "theory", weeklyHours: 2, sessionHours: 2, credits: 2 },
          ],
          assignments: [{ key: "X1", teacherCode: "DU" }],
        },
      ],
    });
    expect(dup.status).toBe(409);
    expect((dup.json as { departmentId: string }).departmentId).toBe(civil.id);
  });

  it("the removed wizard endpoint is gone (404)", async () => {
    const res = await req("POST", "/api/setup/department", {});
    expect(res.status).toBe(404);
  });
});
