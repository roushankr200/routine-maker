/**
 * Guided (syllabus) setup — integration tests against a real
 * (in-memory) MongoDB + the real Express app over HTTP.
 *
 * Under test: POST /api/setup/guided creates a department whose
 * subjects are re-resolved from the server-side CATALOGUE (credits,
 * syllabus codes, hours), validates completeness / teacher weekly
 * max / duplicate names BEFORE writing, and leaves subjects marked
 * "XX" generatable via the hidden placeholder teacher. Multi-
 * department rule holds here too: guided creation never touches an
 * existing department. Run: npm test (vitest)
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

/** MCA Sem 1 only, 3 teachers — loads: TO 13h, TT 14h, TH 10h (caps 24). */
function mcaPayload(departmentName: string, overrides?: {
  omit?: string;
  xx?: string;
  teacherMax?: Record<string, number>;
}) {
  const assignments = [
    { key: "DFS", teacherCode: "TO" },
    { key: "DCLD", teacherCode: "TT" },
    { key: "DMS", teacherCode: "TH" },
    { key: "PMP", teacherCode: "TO" },
    { key: "WT", teacherCode: "TT" },
    { key: "DFS Lab", teacherCode: "TO" },
    { key: "WT Lab", teacherCode: "TH" },
  ]
    .filter((a) => a.key !== overrides?.omit)
    .map((a) => (a.key === overrides?.xx ? { ...a, teacherCode: "XX" } : a));
  return {
    catalogueId: "CSE",
    department: { name: departmentName, short: "GTD", session: "ODD 2026", effectiveFrom: "27/07/2026" },
    teachers: [
      { name: "Dr. Test One", code: "TO", maxPerDay: 5, weeklyHours: overrides?.teacherMax?.TO ?? 24 },
      { name: "Dr. Test Two", code: "TT", maxPerDay: 5, weeklyHours: overrides?.teacherMax?.TT ?? 24 },
      { name: "Dr. Test Three", code: "TH", maxPerDay: 5, weeklyHours: overrides?.teacherMax?.TH ?? 24 },
    ],
    classes: [
      { programme: "MCA", semester: 1, section: "", assignments },
    ],
  };
}

beforeAll(async () => {
  // ephemeralForTest keeps the data in RAM: with two memory-server
  // test files running in parallel workers, the default WiredTiger
  // on-disk storage can exhaust a small /tmp (512 MB here).
  mongod = await MongoMemoryServer.create({
    instance: { storageEngine: "ephemeralForTest" },
  });
  await mongoose.connect(mongod.getUri("routine-maker-guided-test"));
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

describe("guided setup validation (nothing is written on a bad payload)", () => {
  it("unassigned subject -> 400 with a problems list", async () => {
    const r = await req("POST", "/api/setup/guided", mcaPayload("Guided Test Dept", { omit: "WT" }));
    expect(r.status).toBe(400);
    const problems = (r.json as { problems: string[] }).problems;
    expect(problems.some((p) => p.includes("WT"))).toBe(true);
    const depts = await req("GET", "/api/departments");
    expect((depts.json as { departments: unknown[] }).departments).toHaveLength(0);
  });

  it("teacher assigned over their weekly max -> 400", async () => {
    const r = await req(
      "POST",
      "/api/setup/guided",
      mcaPayload("Guided Test Dept", { teacherMax: { TO: 10 } }), // TO's load is 13h
    );
    expect(r.status).toBe(400);
    const problems = (r.json as { problems: string[] }).problems;
    expect(problems.some((p) => p.includes("weekly max"))).toBe(true);
    const depts = await req("GET", "/api/departments");
    expect((depts.json as { departments: unknown[] }).departments).toHaveLength(0);
  });

  it("elective slot without a pick -> 400", async () => {
    const payload = mcaPayload("Guided Test Dept");
    payload.classes = [
      {
        programme: "MCA",
        semester: 5,
        section: "",
        assignments: [
          { key: "AI", teacherCode: "TO" },
          { key: "CD", teacherCode: "TT" },
          { key: "Elective-I", teacherCode: "TO" }, // no electivePick
          { key: "Elective-II", teacherCode: "TT", electivePick: "DIP" },
          { key: "AI Lab", teacherCode: "TO" },
          { key: "CD Lab", teacherCode: "TT" },
        ],
      },
    ];
    const r = await req("POST", "/api/setup/guided", payload);
    expect(r.status).toBe(400);
    const problems = (r.json as { problems: string[] }).problems;
    expect(problems.some((p) => p.includes("Elective-I"))).toBe(true);
  });
});

describe("guided setup happy path", () => {
  it("creates the department from the catalogue (credits + syllabus codes resolved server-side)", async () => {
    const r = await req("POST", "/api/setup/guided", mcaPayload("Guided Test Dept"));
    expect(r.status).toBe(201);
    const counts = (r.json as { counts: Record<string, number> }).counts;
    expect(counts).toMatchObject({ teachers: 3, subjects: 7, classes: 1, xxSubjects: 0 });

    const subjects = (await req("GET", "/api/subjects")).json as Array<{
      code: string;
      credits: number;
      syllabusCode: string;
    }>;
    const dfs = subjects.find((s) => s.code === "DFS")!;
    expect(dfs.credits).toBe(4);
    expect(dfs.syllabusCode).toBe("MCA01C01");
    const dfsLab = subjects.find((s) => s.code === "DFS Lab")!;
    expect(dfsLab.credits).toBe(3);

    // The new department is active and generates: MCA Sem 1 = 31h.
    const gen = await req("POST", "/api/routine/generate");
    expect(gen.status).toBe(200);
    expect((gen.json as { success: boolean }).success).toBe(true);
    expect((gen.json as { placedPeriods: number; totalPeriods: number }).placedPeriods).toBe(31);
    expect((gen.json as { totalPeriods: number }).totalPeriods).toBe(31);
  });

  it("duplicate department name -> 409 with the existing id", async () => {
    const r = await req("POST", "/api/setup/guided", mcaPayload("guided test dept"));
    expect(r.status).toBe(409);
    expect((r.json as { error: string }).error).toBe("Department already exists");
    expect((r.json as { departmentId: string }).departmentId).toBeTruthy();
  });
});

describe("guided setup with an XX subject", () => {
  it("XX is accepted, hidden from teacher lists, and generation still succeeds with XX slots", async () => {
    const r = await req(
      "POST",
      "/api/setup/guided",
      mcaPayload("Guided XX Dept", { xx: "PMP" }),
    );
    expect(r.status).toBe(201);
    expect((r.json as { counts: { xxSubjects: number } }).counts.xxSubjects).toBe(1);

    // The placeholder teacher is NOT a teacher: list shows only the 3 real ones.
    const teachers = (await req("GET", "/api/teachers")).json as Array<{ code: string }>;
    expect(teachers).toHaveLength(3);
    expect(teachers.some((t) => t.code === "XX")).toBe(false);
    const depts = (await req("GET", "/api/departments")).json as {
      departments: Array<{ name: string; counts: { teachers: number } }>;
    };
    expect(depts.departments.find((d) => d.name === "Guided XX Dept")!.counts.teachers).toBe(3);

    // Generation succeeds and the PMP slots are taught by "XX".
    const gen = await req("POST", "/api/routine/generate");
    expect(gen.status).toBe(200);
    expect((gen.json as { success: boolean }).success).toBe(true);
    const routine = (await req("GET", "/api/routine")).json as {
      entries: Array<{ subjectCode: string; teacherCode: string }>;
    };
    const pmp = routine.entries.filter((e) => e.subjectCode === "PMP");
    expect(pmp.length).toBe(3);
    expect(pmp.every((e) => e.teacherCode === "XX")).toBe(true);
  });

  it("guided departments coexist with the CSE seed (nothing is wiped)", async () => {
    const seed = await req("POST", "/api/seed");
    expect(seed.status).toBe(200);
    const depts = (await req("GET", "/api/departments")).json as {
      departments: Array<{ name: string; counts: Record<string, number> }>;
    };
    expect(depts.departments).toHaveLength(3);
    const cse = depts.departments.find((d) => d.name === "Computer Science and Engineering")!;
    expect(cse.counts).toMatchObject({ teachers: 42, subjects: 69, classes: 14 });
    const xx = depts.departments.find((d) => d.name === "Guided XX Dept")!;
    expect(xx.counts).toMatchObject({ teachers: 3, subjects: 7, classes: 1 });
  });
});
