/**
 * Multi-department storage — integration tests against a real
 * (in-memory) MongoDB + the real Express app over HTTP.
 *
 * The user's rule under test: adding a new department must NEVER
 * delete an existing one. Departments coexist; only the explicit
 * DELETE /api/departments/:id removes one (and never the last one).
 * Run: npm test  (vitest)
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

/** A small, feasible ECE department in the wizard's payload shape. */
const ECE_PAYLOAD = {
  department: {
    name: "Electronics and Communication Engineering",
    short: "ECE",
    session: "ODD 2026",
    effectiveFrom: "27/07/2026",
  },
  classes: [
    { program: "B.Tech", year: "5th", section: "A" },
    { program: "B.Tech", year: "3rd", section: "A" },
  ],
  subjects: [
    { name: "Digital Signal Processing", code: "DSP", type: "theory", sessionHours: 2 },
    { name: "Microprocessors", code: "MPMC", type: "theory", sessionHours: 2 },
    { name: "Engineering Mathematics", code: "EM", type: "theory", sessionHours: 2 },
    { name: "DSP Laboratory", code: "DSPL", type: "lab", sessionHours: 3 },
    { name: "Seminar", code: "SEM", type: "theory", sessionHours: 1 },
  ],
  teachers: [
    { name: "Dr. ECE One", code: "EO", designation: "Professor", maxPerDay: 5, weeklyHours: 20, subjects: ["DSP", "DSPL"], unavailableDay: null },
    { name: "Dr. ECE Two", code: "ET", designation: "Associate Professor", maxPerDay: 5, weeklyHours: 20, subjects: ["MPMC", "DSP"], unavailableDay: null },
    { name: "Dr. ECE Three", code: "EH", designation: "Assistant Professor", maxPerDay: 5, weeklyHours: 20, subjects: ["EM", "SEM"], unavailableDay: null },
    { name: "Dr. ECE Four", code: "EF", designation: "Assistant Professor", maxPerDay: 5, weeklyHours: 20, subjects: ["DSPL", "MPMC", "SEM"], unavailableDay: null },
  ],
  classSubjects: [
    { classIndex: 0, subjectCode: "DSP", hours: 4 },
    { classIndex: 0, subjectCode: "MPMC", hours: 4 },
    { classIndex: 0, subjectCode: "EM", hours: 4 },
    { classIndex: 0, subjectCode: "DSPL", hours: 3 },
    { classIndex: 0, subjectCode: "SEM", hours: 1 },
    { classIndex: 1, subjectCode: "DSP", hours: 4 },
    { classIndex: 1, subjectCode: "EM", hours: 4 },
    { classIndex: 1, subjectCode: "DSPL", hours: 3 },
  ],
};
const ECE_TOTAL_HOURS = ECE_PAYLOAD.classSubjects.reduce((s, m) => s + m.hours, 0); // 27

interface DeptRow {
  id: string;
  name: string;
  shortName: string;
  counts: { teachers: number; subjects: number; classes: number; entries: number };
  isActive: boolean;
}
async function departments(): Promise<DeptRow[]> {
  const r = await req("GET", "/api/departments");
  expect(r.status).toBe(200);
  return (r.json as { departments: DeptRow[] }).departments;
}

let cseId = "";
let eceId = "";

beforeAll(async () => {
  // ephemeralForTest keeps the data in RAM: with two memory-server
  // test files running in parallel workers, the default WiredTiger
  // on-disk storage can exhaust a small /tmp (512 MB here).
  mongod = await MongoMemoryServer.create({
    instance: { storageEngine: "ephemeralForTest" },
  });
  await mongoose.connect(mongod.getUri("routine-maker-departments-test"));
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

describe("multi-department storage", () => {
  it("seed creates the CSE department; generating scopes to it (346 entries)", async () => {
    const seed = await req("POST", "/api/seed");
    expect(seed.status).toBe(200);
    const depts = await departments();
    expect(depts).toHaveLength(1);
    expect(depts[0].shortName).toBe("CSE");
    expect(depts[0].counts).toMatchObject({ teachers: 42, subjects: 69, classes: 14 });
    expect(depts[0].isActive).toBe(true);
    cseId = depts[0].id;

    const gen = await req("POST", "/api/routine/generate");
    expect(gen.status).toBe(200);
    expect((gen.json as { success: boolean }).success).toBe(true);
    const routine = await req("GET", "/api/routine");
    expect((routine.json as { entries: unknown[] }).entries).toHaveLength(346);
    expect((routine.json as { config: { departmentShort: string } }).config.departmentShort).toBe("CSE");
  });

  it("creating ECE via the wizard does NOT touch CSE (no wipe)", async () => {
    const created = await req("POST", "/api/setup/department", ECE_PAYLOAD);
    expect(created.status).toBe(201);
    eceId = (created.json as { departmentId: string }).departmentId;
    expect(eceId).toBeTruthy();

    const depts = await departments();
    expect(depts).toHaveLength(2);
    const cse = depts.find((d) => d.id === cseId)!;
    const ece = depts.find((d) => d.id === eceId)!;
    // CSE fully intact — including its generated routine.
    expect(cse.counts).toMatchObject({ teachers: 42, subjects: 69, classes: 14, entries: 346 });
    expect(ece.counts).toMatchObject({ teachers: 4, subjects: 5, classes: 2 });
    // The new department becomes active.
    expect(ece.isActive).toBe(true);
    expect(cse.isActive).toBe(false);
  });

  it("routine generation is scoped per department", async () => {
    // ECE is active: its own (empty) routine, its own generation.
    const before = await req("GET", "/api/routine");
    expect((before.json as { entries: unknown[] }).entries).toHaveLength(0);
    expect((before.json as { config: { departmentShort: string } }).config.departmentShort).toBe("ECE");

    const gen = await req("POST", "/api/routine/generate");
    expect(gen.status).toBe(200);
    expect((gen.json as { success: boolean }).success).toBe(true);
    const after = await req("GET", "/api/routine");
    expect((after.json as { entries: unknown[] }).entries).toHaveLength(ECE_TOTAL_HOURS);

    // Switch back to CSE: its 42 teachers and 346 routine entries are all still there.
    const act = await req("POST", `/api/departments/${cseId}/activate`);
    expect(act.status).toBe(200);
    const teachers = await req("GET", "/api/teachers");
    expect((teachers.json as unknown[]).length).toBe(42);
    const routine = await req("GET", "/api/routine");
    expect((routine.json as { entries: unknown[] }).entries).toHaveLength(346);

    // GET /api/balance is scoped too (CSE demand = 346h).
    const balance = await req("GET", "/api/balance");
    expect((balance.json as { totals: { requiredHours: number } }).totals.requiredHours).toBe(346);
  });

  it("re-seeding CSE refreshes ONLY CSE; ECE survives", async () => {
    const seed = await req("POST", "/api/seed");
    expect(seed.status).toBe(200);
    const depts = await departments();
    expect(depts).toHaveLength(2);
    const ece = depts.find((d) => d.id === eceId)!;
    expect(ece.counts).toMatchObject({ teachers: 4, subjects: 5, classes: 2, entries: ECE_TOTAL_HOURS });
    const cse = depts.find((d) => d.id === cseId)!;
    expect(cse.id).toBe(cseId); // same department, refreshed in place
    expect(cse.isActive).toBe(true);
  });

  it("duplicate department name -> 409 with the existing department id", async () => {
    const dup = await req("POST", "/api/setup/department", {
      ...ECE_PAYLOAD,
      department: { ...ECE_PAYLOAD.department, name: "electronics and communication engineering" },
    });
    expect(dup.status).toBe(409);
    expect((dup.json as { error: string }).error).toBe("Department already exists");
    expect((dup.json as { departmentId: string }).departmentId).toBe(eceId);
    expect(await departments()).toHaveLength(2);
  });

  it("explicit delete removes ONLY that department; the last one is protected", async () => {
    const del = await req("DELETE", `/api/departments/${eceId}`);
    expect(del.status).toBe(200);
    const depts = await departments();
    expect(depts).toHaveLength(1);
    expect(depts[0].id).toBe(cseId);
    expect(depts[0].counts).toMatchObject({ teachers: 42, subjects: 69, classes: 14 });
    expect(depts[0].isActive).toBe(true);

    const delLast = await req("DELETE", `/api/departments/${cseId}`);
    expect(delLast.status).toBe(400);
    expect(await departments()).toHaveLength(1);
  });
});
