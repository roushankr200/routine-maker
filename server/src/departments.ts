import { Types } from "mongoose";
import {
  ClassSection,
  ClassSubject,
  Department,
  RoutineEntry,
  Subject,
  Teacher,
  TeacherUnavailable,
  getOrCreateConfig,
} from "./models.js";

/**
 * Multi-department storage.
 *
 * Every data document carries a `departmentId`; ALL endpoints operate
 * on the ACTIVE department only (its id lives on the singleton Config
 * document). Creating a department never deletes another one — the
 * only way data leaves is the explicit per-department delete below.
 */

// Loosely typed on purpose: the six scoped models share the same
// delete/count/update surface but have distinct document types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SCOPED_MODELS: any[] = [
  Teacher,
  Subject,
  ClassSection,
  ClassSubject,
  TeacherUnavailable,
  RoutineEntry,
];

/** "Computer Science and Engineering" (case-insensitive) lookup. */
export async function findDepartmentByName(name: string) {
  const all = await Department.find().lean();
  const key = name.trim().toLowerCase();
  return all.find((d) => d.name.trim().toLowerCase() === key) ?? null;
}

export async function listDepartments() {
  return Department.find().sort({ createdAt: 1 });
}

export async function getActiveDepartment() {
  const cfg = await getOrCreateConfig();
  if (cfg.activeDepartmentId) {
    const dept = await Department.findById(cfg.activeDepartmentId);
    if (dept) return dept;
  }
  // Fall back to the oldest department (and remember it).
  const first = await Department.findOne().sort({ createdAt: 1 });
  if (first) {
    cfg.activeDepartmentId = first._id;
    await cfg.save();
    return first;
  }
  return null;
}

export async function getActiveDepartmentId(): Promise<string | null> {
  const dept = await getActiveDepartment();
  return dept ? dept._id.toString() : null;
}

export async function setActiveDepartment(id: string | Types.ObjectId): Promise<void> {
  const cfg = await getOrCreateConfig();
  cfg.activeDepartmentId = new Types.ObjectId(id.toString());
  await cfg.save();
}

/** The Mongo filter that scopes a query to one department. */
export function scope(departmentId: string) {
  return { departmentId: new Types.ObjectId(departmentId) };
}

/** Delete ONLY one department's scoped data (the department stays). */
export async function deleteScopedData(departmentId: string): Promise<void> {
  const filter = scope(departmentId);
  await Promise.all(SCOPED_MODELS.map((m) => m.deleteMany(filter)));
}

/** Delete one department's scoped data + the department itself. */
export async function deleteDepartmentData(departmentId: string): Promise<void> {
  await deleteScopedData(departmentId);
  await Department.findByIdAndDelete(departmentId);
}

/** Per-department headline counts (teachers / subjects / classes / entries). */
export async function departmentCounts(departmentId: string) {
  const filter = scope(departmentId);
  const [teachers, subjects, classes, entries] = await Promise.all([
    Teacher.countDocuments(filter),
    Subject.countDocuments(filter),
    ClassSection.countDocuments(filter),
    RoutineEntry.countDocuments(filter),
  ]);
  return { teachers, subjects, classes, entries };
}

/**
 * Boot/backfill: data written before multi-department storage has no
 * `departmentId`. If any such legacy document exists, create ONE
 * department from the Config identity fields (the CSE defaults) and
 * assign every legacy document to it, then make it active. Idempotent.
 */
export async function backfillLegacyData(): Promise<void> {
  const legacyFilter = {
    $or: [{ departmentId: { $exists: false } }, { departmentId: null }],
  };
  let legacyCount = 0;
  for (const m of SCOPED_MODELS) {
    legacyCount += await m.countDocuments(legacyFilter);
  }
  if (legacyCount === 0) {
    // Still make sure an active department is recorded when some exist.
    await getActiveDepartment();
    return;
  }
  const cfg = await getOrCreateConfig();
  let dept = await findDepartmentByName(cfg.department);
  if (!dept) {
    dept = await Department.create({
      name: cfg.department,
      shortName: cfg.departmentShort,
      session: cfg.session,
      effectiveFrom: cfg.effectiveFrom,
    });
  }
  for (const m of SCOPED_MODELS) {
    await m.updateMany(legacyFilter as never, {
      $set: { departmentId: dept._id },
    });
  }
  if (!cfg.activeDepartmentId) await setActiveDepartment(dept._id);
  console.log(
    `[departments] backfilled ${legacyCount} legacy documents into "${dept.name}"`,
  );
}
