import type { Server } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { prepareAccounts } from "../src/accounts.js";
import { ClassSection, RoutineEntry } from "../src/models.js";
import { addDefaultRooms } from "../src/rooms.js";

let mongo: MongoMemoryServer;
let server: Server;
let base: string;
const password = "test-only-password";
const adminCode = "test-only-admin-code";

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  vi.stubEnv("ADMIN_SIGNUP_CODE", adminCode);
  await Promise.all([prepareAccounts(), addDefaultRooms()]);
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (typeof address !== "object" || !address) throw new Error("Missing server address");
  base = `http://127.0.0.1:${address.port}/api`;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.disconnect();
  await mongo?.stop();
});

async function request(path: string, options: { method?: string; cookie?: string; body?: object } = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      ...(options.body && { "Content-Type": "application/json" }),
      ...(options.cookie && { Cookie: options.cookie }),
    },
    body: options.body && JSON.stringify(options.body),
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  const data = response.status === 204 ? undefined : await response.json();
  return { status: response.status, data, cookie };
}

it("publishes a room-safe schedule and serves only the linked teacher or class", async () => {
  expect((await request("/dashboard")).status).toBe(401);
  const signup = (role: string, code?: string) => request("/auth/signup", { body: {
    name: role, role, email: `${role}@example.com`, password, adminCode: code,
  } });
  expect((await signup("admin")).status).toBe(403);
  const admin = await signup("admin", adminCode);
  const teacher = await signup("teacher");
  const student = await signup("student");
  expect([admin.status, teacher.status, student.status]).toEqual([201, 201, 201]);
  expect((await request("/routine/generate", { method: "POST", cookie: student.cookie })).status).toBe(403);
  expect((await request("/me/routine", { cookie: student.cookie })).data).toEqual({ linked: false, entries: [] });
  expect((await request("/seed", { method: "POST", cookie: admin.cookie })).status).toBe(200);
  const sampleAssignments = (await request("/setup/previous-assignments/CSE", { cookie: admin.cookie })).data;
  expect(sampleAssignments.source).toBe("CSE Odd 2026 sample");
  expect(sampleAssignments.rows.length).toBeGreaterThan(0);

  const classes = await ClassSection.find().lean();
  expect(classes.filter((section) => section.program === "B.Tech").map((section) => section.studentCount)).toEqual(Array(8).fill(60));
  expect(classes.filter((section) => section.program === "MCA").map((section) => section.studentCount)).toEqual(Array(6).fill(30));
  expect(classes.filter((section) => section.program === "M.Tech").map((section) => section.studentCount)).toEqual(Array(3).fill(15));
  const sample = classes.find((section) => section.program === "MCA")!;
  const setSampleSize = (studentCount: number | null) => ClassSection.findByIdAndUpdate(sample._id, { studentCount });
  const generate = () => request("/routine/generate", { method: "POST", cookie: admin.cookie });
  await setSampleSize(null);
  const missingSizes = await generate();
  expect(missingSizes.status).toBe(400);
  expect(missingSizes.data.error).toContain("enter the student count");
  await setSampleSize(61);
  expect((await generate()).data.error).toContain("no lab has 61 seats");
  await setSampleSize(sample.studentCount);

  const rooms = (await request("/rooms", { cookie: admin.cookie })).data as { number: string; capacity: number; type: string }[];
  expect(rooms).toHaveLength(20);
  expect(rooms.filter((room) => room.type === "lab")).toHaveLength(4);
  expect(rooms.filter((room) => room.type === "lab").every((room) => room.capacity === 60)).toBe(true);
  const result = await generate();
  expect(result.status).toBe(200);
  expect(result.data.success, JSON.stringify(result.data.unplaced.slice(0, 4))).toBe(true);
  expect(result.data.placedPeriods).toBe(400);
  const savedAssignments = (await request("/setup/previous-assignments/CSE", { cookie: admin.cookie })).data;
  expect(savedAssignments.source).toBe("ODD 2026");
  expect(savedAssignments.rows).toEqual(expect.arrayContaining([expect.objectContaining({ programme: "MCA", section: "B" })]));

  const routine = (await request("/routine", { cookie: admin.cookie })).data.entries as {
    teacherId: string; classId: string; roomNumber: string; subjectType: string;
    day: string; period: number; sessionId: number;
  }[];
  const occupied = new Set<string>();
  const roomsBySession = new Map<number, string>();
  const classSizes = new Map(classes.map((section) => [section._id.toString(), section.studentCount!]));
  for (const entry of routine) {
    const room = rooms.find((candidate) => candidate.number === entry.roomNumber)!;
    expect(room.capacity).toBeGreaterThanOrEqual(classSizes.get(entry.classId)!);
    expect(room.type).toBe(entry.subjectType);
    const slot = `${entry.roomNumber}|${entry.day}|${entry.period}`;
    expect(occupied.has(slot), slot).toBe(false);
    occupied.add(slot);
    expect(roomsBySession.get(entry.sessionId) ?? entry.roomNumber).toBe(entry.roomNumber);
    roomsBySession.set(entry.sessionId, entry.roomNumber);
  }

  const { teacherId, classId } = routine[0];
  for (const [user, memberId, field] of [[teacher, teacherId, "teacherId"], [student, classId, "classId"]] as const) {
    const linked = await request(`/accounts/${user.data.id}`, { method: "PUT", cookie: admin.cookie, body: { memberId } });
    expect(linked.status).toBe(200);
    expect((await request("/routine", { cookie: user.cookie })).status).toBe(403);
    const personal = await request("/me/routine", { cookie: user.cookie });
    expect(personal.data.entries).toEqual(routine.filter((entry) => entry[field] === memberId));
  }

  await setSampleSize(61);
  expect((await generate()).status).toBe(400);
  expect(await RoutineEntry.countDocuments()).toBe(400);
  await setSampleSize(sample.studentCount);

  const adminRequest = (path: string, options: Parameters<typeof request>[1] = {}) => request(path, { ...options, cookie: admin.cookie });
  const mainDepartment = (await adminRequest("/departments")).data.departments[0];
  const copy = await adminRequest(`/departments/${mainDepartment.id}/variations`, { body: { name: "Room alternative" } });
  expect(copy.status).toBe(201);
  expect((await adminRequest(`/departments/${mainDepartment.id}/variations`, { body: { name: "room alternative" } })).status).toBe(409);
  const draft = await adminRequest("/routine");
  expect(draft.data.config.variationName).toBe("Room alternative");
  expect(draft.data.entries).toHaveLength(routine.length);
  expect(draft.data.entries[0].classId).not.toBe(routine[0].classId);
  expect((await generate()).data.success).toBe(true);
  expect((await request("/me/routine", { cookie: student.cookie })).data.entries).toEqual(routine.filter((entry) => entry.classId === classId));
  await adminRequest("/routine/clear", { method: "POST" });
  expect((await adminRequest("/routine")).data.entries).toHaveLength(0);
  await adminRequest(`/departments/${mainDepartment.id}/activate`, { method: "POST" });
  expect((await adminRequest("/routine")).data.entries).toEqual(routine);

  const subject = { shortCode: "NLP", title: "Natural Language Processing", weeklyHours: 2, sessionHours: 2, credits: 2 };
  const cls = { programme: "B.Tech", semester: 1, section: "Group I", custom: true,
    assignments: [{ key: "NLP", teacherCode: "A" }], customSubjects: [subject] };
  const payload = { variationName: "Syllabus alternative", department: { name: mainDepartment.name, short: "CSE" },
    teachers: [{ name: "Teacher A", code: "A", weeklyHours: 15 }], classes: [cls] };
  const duplicate = await adminRequest("/setup/guided", { body: { ...payload, classes: [{ ...cls, customSubjects: [subject, subject] }] } });
  expect(duplicate.status).toBe(400);
  expect(duplicate.data.problems.join(" ")).toContain("NLP is selected more than once");
  const variant = await adminRequest("/setup/guided", { body: payload });
  expect(variant.status).toBe(201);
  expect((await adminRequest("/departments")).data.departments.find((department: { id: string }) => department.id === variant.data.departmentId))
    .toMatchObject({ parentDepartmentId: mainDepartment.id, variationName: "Syllabus alternative" });
  expect((await generate()).data.placedPeriods).toBe(2);

  const signedIn = await request("/auth/login", { body: { email: "student@example.com", password } });
  expect(signedIn.status).toBe(200);
  expect((await request("/auth/logout", { method: "POST", cookie: signedIn.cookie })).status).toBe(204);
  expect((await request("/auth/me", { cookie: signedIn.cookie })).status).toBe(401);
}, 30_000);
