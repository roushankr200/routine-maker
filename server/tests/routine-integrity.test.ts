/**
 * Routine integrity — regression tests for two user reports (2026-11-11):
 *
 *  1. "MCA has 2 labs but only 1 lab shows in the week." The generated
 *     data was always correct — every 0-0-6 lab subject is placed as
 *     exactly 2 sessions x 3h — the second (afternoon) lab was hidden
 *     by a master-sheet rendering bug (fixed client-side). These tests
 *     lock the DATA side in: per class-subject, placed hours equal the
 *     required hours, and every LAB subject's placed session count
 *     equals splitSessions(hours, sessionHours).
 *
 *  2. "Classes appear in lunch time." No placed session block may
 *     cross the lunch break: blocks are reconstructed from the
 *     flattened entries per class/day and none may span lunchAfter.
 *
 * Integration style mirrors departments.test.ts: real app + in-memory
 * Mongo, CSE seed, one generation.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { backfillLegacyData } from "../src/departments.js";
import { splitSessions } from "../src/solver/solver.js";

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

interface ReqRow {
  subjectId: string;
  hours: number;
  code: string;
  type: "theory" | "lab";
  sessionHours: number;
}
interface ClassRow {
  id: string;
  name: string;
  requirements: ReqRow[];
}
interface EntryRow {
  classId: string;
  subjectId: string;
  teacherId: string;
  day: string;
  period: number;
}
interface RoutineResp {
  config: { days: string[]; periodsPerDay: number; lunchAfter: number };
  entries: EntryRow[];
}

interface Block {
  classId: string;
  subjectId: string;
  day: string;
  start: number;
  length: number;
}

/**
 * Reconstruct session blocks from flattened hourly entries: a block is
 * a maximal run of consecutive periods on one day for one class with
 * the same subject AND teacher (the same rule the client grids use).
 */
function blocksOf(entries: EntryRow[]): Block[] {
  const blocks: Block[] = [];
  const byClassDay = new Map<string, EntryRow[]>();
  for (const e of entries) {
    const key = `${e.classId}|${e.day}`;
    const list = byClassDay.get(key) ?? [];
    list.push(e);
    byClassDay.set(key, list);
  }
  for (const list of byClassDay.values()) {
    const sorted = [...list].sort((a, b) => a.period - b.period);
    let i = 0;
    while (i < sorted.length) {
      const first = sorted[i];
      let length = 1;
      while (
        i + length < sorted.length &&
        sorted[i + length].period === first.period + length &&
        sorted[i + length].subjectId === first.subjectId &&
        sorted[i + length].teacherId === first.teacherId
      ) {
        length++;
      }
      blocks.push({
        classId: first.classId,
        subjectId: first.subjectId,
        day: first.day,
        start: first.period,
        length,
      });
      i += length;
    }
  }
  return blocks;
}

let classes: ClassRow[] = [];
let routine: RoutineResp;
let blocks: Block[] = [];

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { storageEngine: "ephemeralForTest" },
  });
  await mongoose.connect(mongod.getUri("routine-maker-integrity-test"));
  await backfillLegacyData();
  server = createApp().listen(0);
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  base = `http://127.0.0.1:${addr.port}`;

  const seed = await req("POST", "/api/seed");
  expect(seed.status).toBe(200);
  const gen = await req("POST", "/api/routine/generate");
  expect(gen.status).toBe(200);
  expect((gen.json as { success: boolean }).success).toBe(true);

  const cls = await req("GET", "/api/classes");
  expect(cls.status).toBe(200);
  classes = cls.json as ClassRow[];
  const rt = await req("GET", "/api/routine");
  expect(rt.status).toBe(200);
  routine = rt.json as RoutineResp;
  blocks = blocksOf(routine.entries);
});

afterAll(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod?.stop();
});

describe("CSE seed routine integrity", () => {
  it("places every required hour of every class-subject", () => {
    expect(routine.entries.length).toBe(346); // seed total, known-good
    const placed = new Map<string, number>();
    for (const e of routine.entries) {
      const key = `${e.classId}|${e.subjectId}`;
      placed.set(key, (placed.get(key) ?? 0) + 1);
    }
    const mismatches: string[] = [];
    for (const c of classes) {
      for (const r of c.requirements) {
        const got = placed.get(`${c.id}|${r.subjectId}`) ?? 0;
        if (got !== r.hours) {
          mismatches.push(`${c.name} ${r.code}: required ${r.hours}h, placed ${got}h`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("every LAB subject is placed as splitSessions(hours, sessionHours) sessions per week", () => {
    const labBlocks = new Map<string, number>();
    for (const b of blocks) {
      const key = `${b.classId}|${b.subjectId}`;
      labBlocks.set(key, (labBlocks.get(key) ?? 0) + 1);
    }
    const mismatches: string[] = [];
    let labCount = 0;
    for (const c of classes) {
      for (const r of c.requirements) {
        if (r.type !== "lab") continue;
        labCount++;
        const expected = splitSessions(r.hours, r.sessionHours).length;
        const got = labBlocks.get(`${c.id}|${r.subjectId}`) ?? 0;
        if (got !== expected) {
          mismatches.push(
            `${c.name} ${r.code}: ${r.hours}h @ ${r.sessionHours}h/session -> ${expected} sessions expected, ${got} placed`,
          );
        }
      }
    }
    expect(labCount).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });

  it("MCA 6h labs (0-0-6) are placed as exactly 2 sessions of 3h in the week", () => {
    // The user's exact case: MCA labs are 6 weekly hours at 3h per
    // session — BOTH sessions must be in the generated week.
    const mcaLabs: Array<{ cls: string; code: string }> = [];
    for (const c of classes) {
      if (!c.name.includes("MCA")) continue;
      for (const r of c.requirements) {
        if (r.type === "lab" && r.hours === 6 && r.sessionHours === 3) {
          mcaLabs.push({ cls: c.name, code: r.code });
          const mine = blocks.filter((b) => b.classId === c.id && b.subjectId === r.subjectId);
          expect(
            mine.map((b) => b.length).sort(),
            `${c.name} ${r.code} session lengths`,
          ).toEqual([3, 3]);
        }
      }
    }
    // DFS Lab, WT Lab, DAA Lab, SE Lab, CD Lab, AI Lab across MCA 1/3/5.
    expect(mcaLabs.length).toBeGreaterThanOrEqual(6);
  });

  it("no placed session block crosses the lunch break", () => {
    const lunchAfter = routine.config.lunchAfter;
    expect(lunchAfter).toBeGreaterThan(0);
    const crossing = blocks.filter(
      (b) => b.start <= lunchAfter && b.start + b.length - 1 > lunchAfter,
    );
    expect(
      crossing.map(
        (b) => `${b.classId} ${b.day} P${b.start}..P${b.start + b.length - 1} crosses lunch after P${lunchAfter}`,
      ),
    ).toEqual([]);
  });
});
