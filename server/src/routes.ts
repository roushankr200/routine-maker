import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { z } from "zod";
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
import {
  deleteDepartmentData,
  departmentCounts,
  findDepartmentByName,
  getActiveDepartment,
  listDepartments,
  scope,
  setActiveDepartment,
} from "./departments.js";
import { mergedScheduleConfig } from "./data.js";
import {
  availabilitySchema,
  balancePreviewSchema,
  classSchema,
  classSubjectSchema,
  configSchema,
  departmentSetupSchema,
  moveSchema,
  subjectSchema,
  swapSchema,
  teacherSchema,
} from "./schemas.js";
import {
  computeBalance,
  BalanceInput,
  BalanceReport,
} from "./solver/balance.js";
import { loadSolverData, validateData, SolverDataset } from "./data.js";
import {
  SubjectData,
  TeacherData,
  defaultSessionHours,
  unavailableKey,
} from "./solver/types.js";
import { solve } from "./solver/solver.js";
import { loadDemoData } from "./seed.js";
import { classLabel } from "./demoData.js";
import { checkBlockPlacement, EntryLike, sessionBlock } from "./routineCheck.js";

export const router = Router();

function parse<T>(schema: z.ZodSchema<T>, body: unknown, res: Response): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
    return null;
  }
  return result.data;
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** Id of the ACTIVE department, or null on a fresh (empty) workspace. */
async function activeDeptId(): Promise<string | null> {
  const dept = await getActiveDepartment();
  return dept ? dept._id.toString() : null;
}

/**
 * Active department id for WRITE endpoints: when there is no
 * department yet there is nothing to write into — 400 with the reason.
 */
async function requireActiveDept(res: Response): Promise<string | null> {
  const id = await activeDeptId();
  if (!id) {
    res.status(400).json({
      error: "No active department yet — load the CSE department or create one with the setup wizard first.",
    });
    return null;
  }
  return id;
}

/** Read-side filter: the active department's scope (matches nothing when empty). */
async function readFilter() {
  const id = await activeDeptId();
  return id ? scope(id) : { departmentId: { $exists: false } };
}

// -------------------------------------------------------------- departments
router.get(
  "/departments",
  wrap(async (_req, res) => {
    const [depts, activeId] = await Promise.all([listDepartments(), activeDeptId()]);
    const out = [];
    for (const d of depts) {
      const counts = await departmentCounts(d._id.toString());
      out.push({
        id: d._id.toString(),
        name: d.name,
        shortName: d.shortName,
        session: d.session,
        effectiveFrom: d.effectiveFrom,
        createdAt: d.createdAt,
        counts,
        isActive: d._id.toString() === activeId,
      });
    }
    res.json({ departments: out, activeDepartmentId: activeId });
  }),
);

router.post(
  "/departments/:id/activate",
  wrap(async (req, res) => {
    const dept = await Department.findById(req.params.id);
    if (!dept) return void res.status(404).json({ error: "Department not found." });
    await setActiveDepartment(dept._id);
    const counts = await departmentCounts(dept._id.toString());
    res.json({
      message: `${dept.shortName} (${dept.name}) is now the active department.`,
      department: { id: dept._id.toString(), name: dept.name, shortName: dept.shortName },
      counts,
    });
  }),
);

router.delete(
  "/departments/:id",
  wrap(async (req, res) => {
    const dept = await Department.findById(req.params.id);
    if (!dept) return void res.status(404).json({ error: "Department not found." });
    const total = await Department.countDocuments();
    if (total <= 1) {
      return void res.status(400).json({
        error: "Cannot delete the last remaining department — create another department first if you want to replace it.",
      });
    }
    const wasActive = (await activeDeptId()) === dept._id.toString();
    await deleteDepartmentData(dept._id.toString());
    let newActive: string | null = null;
    if (wasActive) {
      const next = await Department.findOne().sort({ createdAt: 1 });
      if (next) {
        await setActiveDepartment(next._id);
        newActive = next._id.toString();
      }
    }
    res.json({
      message: `Department ${dept.shortName} (${dept.name}) and its data were deleted. Other departments were not touched.`,
      deletedDepartmentId: dept._id.toString(),
      activeDepartmentId: newActive ?? (await activeDeptId()),
    });
  }),
);

// ---------------------------------------------------------------- dashboard
router.get(
  "/dashboard",
  wrap(async (_req, res) => {
    const filter = await readFilter();
    const [teachers, subjects, classes, entries] = await Promise.all([
      Teacher.countDocuments(filter),
      Subject.countDocuments(filter),
      ClassSection.countDocuments(filter),
      RoutineEntry.countDocuments(filter),
    ]);
    const data = await loadSolverData();
    const { issues, warnings } = validateData(data);
    res.json({
      stats: { teachers, subjects, classes, entries },
      issues,
      warnings,
      hasRoutine: entries > 0,
      config: data.config,
    });
  }),
);

router.post(
  "/seed",
  wrap(async (_req, res) => {
    const counts = await loadDemoData();
    res.json({
      message:
        `NIT Agartala CSE department ${counts.created ? "created" : "reloaded (only CSE data was refreshed — other departments untouched)"}: ` +
        `${counts.teachers} teachers, ${counts.subjects} subjects, ${counts.classes} classes. Now click Generate Routine.`,
      counts,
    });
  }),
);

// ------------------------------------------------- new department wizard
/**
 * POST /api/setup/department — the wizard's single commit endpoint.
 *
 * The whole payload is validated FIRST (Zod shape, then cross-reference
 * and duplicate checks, then the same pre-flight validation the
 * Validation page uses). A bad payload changes nothing.
 *
 * MULTI-DEPARTMENT: nothing is ever wiped. On success a NEW Department
 * is created with its own scoped data and made active; every existing
 * department keeps its data untouched. If a department with the same
 * name already exists, the route answers 409 with its id so the UI
 * can offer switching to it instead.
 * The institute (NIT Agartala) and the time grid are product constants
 * and are not part of this payload.
 */
router.post(
  "/setup/department",
  wrap(async (req, res) => {
    const raw = parse(departmentSetupSchema, req.body, res);
    if (!raw) return;

    // Normalise Zod defaults into concrete locals (the wizard always
    // sends every field; defaults only guard partial API callers).
    const body = {
      department: {
        name: raw.department.name,
        short: raw.department.short,
        session: raw.department.session ?? "ODD 2026",
        effectiveFrom: raw.department.effectiveFrom ?? "",
      },
      classes: raw.classes.map((c) => ({ ...c, section: c.section ?? "" })),
      subjects: raw.subjects,
      teachers: raw.teachers.map((t) => ({
        ...t,
        code: t.code ?? "",
        designation: t.designation ?? "",
        subjects: t.subjects ?? [],
        unavailableDay: t.unavailableDay ?? null,
      })),
      classSubjects: raw.classSubjects ?? [],
    };

    const problems: string[] = [];

    // -- duplicate + cross-reference checks (payload-internal) --------
    const subjectCodes = new Map<string, number>(); // upper-cased code -> index
    body.subjects.forEach((s, i) => {
      const key = s.code.toUpperCase();
      if (subjectCodes.has(key)) problems.push(`Duplicate course code "${s.code}" (Step 3).`);
      else subjectCodes.set(key, i);
    });
    const classKeys = new Set<string>();
    body.classes.forEach((c) => {
      const key = `${c.program}|${c.year}|${c.section}`.toLowerCase();
      if (classKeys.has(key))
        problems.push(`Duplicate class "${classLabel(c.program, c.year, c.section)}" (Step 2).`);
      classKeys.add(key);
    });
    const teacherCodes = new Map<string, string>(); // upper-cased code -> name
    body.teachers.forEach((t) => {
      if (t.code) {
        const key = t.code.toUpperCase();
        if (teacherCodes.has(key))
          problems.push(
            `Faculty code "${t.code}" is used by both ${teacherCodes.get(key)} and ${t.name} (Step 4).`,
          );
        else teacherCodes.set(key, t.name);
      }
      for (const code of t.subjects) {
        if (!subjectCodes.has(code.toUpperCase()))
          problems.push(`Teacher ${t.name} can teach "${code}", which is not one of the Step 3 courses.`);
      }
    });
    const mappingSeen = new Set<string>();
    for (const m of body.classSubjects) {
      if (m.classIndex >= body.classes.length) {
        problems.push(`Mapping refers to class #${m.classIndex + 1}, which does not exist.`);
        continue;
      }
      if (!subjectCodes.has(m.subjectCode.toUpperCase())) {
        problems.push(`Mapping refers to course "${m.subjectCode}", which is not one of the Step 3 courses.`);
        continue;
      }
      const key = `${m.classIndex}|${m.subjectCode.toUpperCase()}`;
      if (mappingSeen.has(key)) problems.push(`Duplicate mapping entry for course "${m.subjectCode}".`);
      mappingSeen.add(key);
    }
    if (problems.length) {
      return void res.status(400).json({ error: "Department setup has problems", problems });
    }

    // -- pre-flight validation on a synthetic dataset (nothing wiped) -
    const cfg = await getOrCreateConfig();
    const synthTeachers = new Map<string, TeacherData>();
    body.teachers.forEach((t, i) => {
      const id = `t${i}`;
      synthTeachers.set(id, {
        id,
        name: t.name,
        maxPerDay: t.maxPerDay,
        weeklyHours: t.weeklyHours,
        subjects: new Set(t.subjects.map((c) => `s${subjectCodes.get(c.toUpperCase())}`)),
        unavailable: t.unavailableDay
          ? new Set([unavailableKey(t.unavailableDay, null)])
          : new Set<string>(),
      });
    });
    const synthSubjects = new Map<string, SubjectData>();
    body.subjects.forEach((s, i) => {
      const id = `s${i}`;
      synthSubjects.set(id, {
        id,
        name: s.name,
        code: s.code,
        type: s.type,
        sessionHours: s.sessionHours ?? defaultSessionHours(s.type),
      });
    });
    const synthDataset: SolverDataset = {
      teachers: synthTeachers,
      subjects: synthSubjects,
      classSubjects: body.classSubjects
        .filter((m) => m.hours > 0)
        .map((m) => ({
          classId: `c${m.classIndex}`,
          subjectId: `s${subjectCodes.get(m.subjectCode.toUpperCase())}`,
          hours: m.hours,
        })),
      config: {
        days: cfg.days,
        periodsPerDay: cfg.periodsPerDay,
        lunchAfter: cfg.lunchAfter ?? null,
        periodDuration: cfg.periodDuration,
        startTime: cfg.startTime,
        session: body.department.session,
        effectiveFrom: body.department.effectiveFrom,
        department: body.department.name,
        departmentShort: body.department.short,
      },
      classNames: new Map(
        body.classes.map((c, i) => [`c${i}`, classLabel(c.program, c.year, c.section)]),
      ),
    };
    const report = validateData(synthDataset);

    // -- duplicate department name? Never overwrite: 409 + switch hint -
    const existingDept = await findDepartmentByName(body.department.name);
    if (existingDept) {
      return void res.status(409).json({
        error: "Department already exists",
        departmentId: existingDept._id.toString(),
        department: {
          id: existingDept._id.toString(),
          name: existingDept.name,
          shortName: existingDept.shortName,
        },
      });
    }

    // -- create the NEW department + its scoped data (nothing wiped) ---
    const dept = await Department.create({
      name: body.department.name,
      shortName: body.department.short,
      session: body.department.session,
      effectiveFrom: body.department.effectiveFrom,
    });
    const deptFilter = scope(dept._id.toString());

    const subjectIdByCode = new Map<string, string>();
    for (const s of body.subjects) {
      const doc = await Subject.create({
        ...deptFilter,
        name: s.name,
        code: s.code,
        type: s.type,
        sessionHours: s.sessionHours ?? defaultSessionHours(s.type),
      });
      subjectIdByCode.set(s.code.toUpperCase(), doc._id.toString());
    }

    const classIds: string[] = [];
    for (const c of body.classes) {
      const doc = await ClassSection.create({
        ...deptFilter,
        program: c.program,
        year: c.year,
        section: c.section,
      });
      classIds.push(doc._id.toString());
    }

    for (const t of body.teachers) {
      const doc = await Teacher.create({
        ...deptFilter,
        name: t.name,
        code: t.code,
        designation: t.designation,
        maxPerDay: t.maxPerDay,
        weeklyHours: t.weeklyHours,
        subjects: t.subjects.map((code) => subjectIdByCode.get(code.toUpperCase())),
      });
      if (t.unavailableDay) {
        await TeacherUnavailable.create({
          ...deptFilter,
          teacherId: doc._id,
          day: t.unavailableDay,
          period: null,
        });
      }
    }

    let mappings = 0;
    for (const m of body.classSubjects) {
      if (m.hours <= 0) continue;
      await ClassSubject.create({
        ...deptFilter,
        classId: classIds[m.classIndex],
        subjectId: subjectIdByCode.get(m.subjectCode.toUpperCase()),
        hours: m.hours,
      });
      mappings++;
    }

    await setActiveDepartment(dept._id);

    res.status(201).json({
      message:
        `${body.department.short} department created alongside your existing departments (nothing was deleted): ${body.classes.length} classes, ` +
        `${body.subjects.length} courses, ${body.teachers.length} teachers, ${mappings} class-course mappings. ` +
        `It is now the active department — click Generate Routine.`,
      departmentId: dept._id.toString(),
      counts: {
        teachers: body.teachers.length,
        subjects: body.subjects.length,
        classes: body.classes.length,
        classSubjects: mappings,
      },
      validation: {
        issues: report.issues,
        warnings: report.warnings,
        slotsPerWeek: report.slotsPerWeek,
        demandBySubject: report.demandBySubject.map((d) => ({
          subject: `${d.subject.code} — ${d.subject.name}`,
          demand: d.demand,
          capacity: d.capacity,
          teachers: d.teachers,
        })),
        demandByClass: report.demandByClass.map((d) => ({
          className: d.className,
          total: d.total,
        })),
      },
    });
  }),
);

// ----------------------------------------------------------------- teachers
router.get(
  "/teachers",
  wrap(async (_req, res) => {
    const teachers = await Teacher.find(await readFilter()).sort({ name: 1 }).lean();
    res.json(
      teachers.map((t) => ({ ...t, id: t._id.toString(), subjects: t.subjects.map(String) })),
    );
  }),
);

router.post(
  "/teachers",
  wrap(async (req, res) => {
    const body = parse(teacherSchema, req.body, res);
    if (!body) return;
    const deptId = await requireActiveDept(res);
    if (!deptId) return;
    const doc = await Teacher.create({ ...body, departmentId: new Types.ObjectId(deptId) });
    res.status(201).json({ id: doc._id.toString(), message: "Teacher saved." });
  }),
);

router.put(
  "/teachers/:id",
  wrap(async (req, res) => {
    const body = parse(teacherSchema, req.body, res);
    if (!body) return;
    const deptId = await activeDeptId();
    const doc = deptId
      ? await Teacher.findOneAndUpdate({ _id: req.params.id, ...scope(deptId) }, body, { new: true })
      : null;
    if (!doc) return void res.status(404).json({ error: "Teacher not found." });
    res.json({ id: doc._id.toString(), message: "Teacher saved." });
  }),
);

router.delete(
  "/teachers/:id",
  wrap(async (req, res) => {
    const deptId = await activeDeptId();
    if (deptId) await Teacher.findOneAndDelete({ _id: req.params.id, ...scope(deptId) });
    else await Teacher.findByIdAndDelete(req.params.id);
    await TeacherUnavailable.deleteMany({ teacherId: req.params.id });
    await RoutineEntry.deleteMany({ teacherId: req.params.id });
    res.json({ message: "Teacher deleted." });
  }),
);

router.get(
  "/teachers/:id/availability",
  wrap(async (req, res) => {
    const deptId = await activeDeptId();
    const teacher = deptId
      ? await Teacher.findOne({ _id: req.params.id, ...scope(deptId) }).lean()
      : null;
    if (!teacher) return void res.status(404).json({ error: "Teacher not found." });
    const rows = await TeacherUnavailable.find({ teacherId: req.params.id }).lean();
    res.json({
      teacher: { id: teacher._id.toString(), name: teacher.name },
      blocked: rows.map((r) => `${r.day}|${r.period === null ? "null" : r.period}`),
    });
  }),
);

router.put(
  "/teachers/:id/availability",
  wrap(async (req, res) => {
    const body = parse(availabilitySchema, req.body, res);
    if (!body) return;
    const deptId = await activeDeptId();
    const teacher = deptId
      ? await Teacher.findOne({ _id: req.params.id, ...scope(deptId) })
      : null;
    if (!teacher) return void res.status(404).json({ error: "Teacher not found." });
    await TeacherUnavailable.deleteMany({ teacherId: req.params.id });
    const docs = (body.blocked ?? []).map((key) => {
      const [day, period] = key.split("|");
      return {
        departmentId: teacher.departmentId,
        teacherId: req.params.id,
        day,
        period: period === "null" || period === "*" ? null : Number(period),
      };
    });
    if (docs.length) await TeacherUnavailable.insertMany(docs);
    res.json({ message: `Availability saved for ${teacher.name}.` });
  }),
);

// ----------------------------------------------------------------- subjects
router.get(
  "/subjects",
  wrap(async (_req, res) => {
    const subjects = await Subject.find(await readFilter()).sort({ code: 1 }).lean();
    res.json(subjects.map((s) => ({ ...s, id: s._id.toString() })));
  }),
);

/** Fill the session-length default (theory 2h, lab 3h) when omitted. */
function subjectBody(body: { type: "theory" | "lab"; sessionHours?: number }) {
  return {
    ...body,
    sessionHours: body.sessionHours ?? (body.type === "lab" ? 3 : 2),
  };
}

router.post(
  "/subjects",
  wrap(async (req, res) => {
    const body = parse(subjectSchema, req.body, res);
    if (!body) return;
    const deptId = await requireActiveDept(res);
    if (!deptId) return;
    const doc = await Subject.create({
      ...subjectBody(body),
      departmentId: new Types.ObjectId(deptId),
    });
    res.status(201).json({ id: doc._id.toString(), message: "Subject saved." });
  }),
);

router.put(
  "/subjects/:id",
  wrap(async (req, res) => {
    const body = parse(subjectSchema, req.body, res);
    if (!body) return;
    const deptId = await activeDeptId();
    const doc = deptId
      ? await Subject.findOneAndUpdate({ _id: req.params.id, ...scope(deptId) }, subjectBody(body), { new: true })
      : null;
    if (!doc) return void res.status(404).json({ error: "Subject not found." });
    res.json({ id: doc._id.toString(), message: "Subject saved." });
  }),
);

router.delete(
  "/subjects/:id",
  wrap(async (req, res) => {
    const deptId = await activeDeptId();
    if (deptId) await Subject.findOneAndDelete({ _id: req.params.id, ...scope(deptId) });
    else await Subject.findByIdAndDelete(req.params.id);
    await ClassSubject.deleteMany({ subjectId: req.params.id });
    await RoutineEntry.deleteMany({ subjectId: req.params.id });
    await Teacher.updateMany(deptId ? scope(deptId) : {}, { $pull: { subjects: req.params.id } });
    res.json({ message: "Subject deleted." });
  }),
);

// ------------------------------------------------------------------ classes
router.get(
  "/classes",
  wrap(async (_req, res) => {
    const filter = await readFilter();
    const [classes, requirements, subjects] = await Promise.all([
      ClassSection.find(filter).sort({ program: 1, year: 1 }).lean(),
      ClassSubject.find(filter).lean(),
      Subject.find(filter).lean(),
    ]);
    const subjectById = new Map(subjects.map((s) => [s._id.toString(), s]));
    res.json(
      classes.map((c) => {
        const reqs = requirements
          .filter((r) => r.classId.toString() === c._id.toString())
          .map((r) => {
            const s = subjectById.get(r.subjectId.toString());
            return {
              subjectId: r.subjectId.toString(),
              hours: r.hours,
              name: s?.name ?? "?",
              code: s?.code ?? "?",
              type: s?.type ?? "theory",
              sessionHours: s?.sessionHours ?? (s?.type === "lab" ? 3 : 2),
            };
          })
          .sort((a, b) => a.code.localeCompare(b.code));
        return {
          id: c._id.toString(),
          program: c.program,
          year: c.year,
          section: c.section,
          name: classLabel(c.program, c.year, c.section),
          requirements: reqs,
          totalHours: reqs.reduce((sum, r) => sum + r.hours, 0),
        };
      }),
    );
  }),
);

router.post(
  "/classes",
  wrap(async (req, res) => {
    const body = parse(classSchema, req.body, res);
    if (!body) return;
    const deptId = await requireActiveDept(res);
    if (!deptId) return;
    const doc = await ClassSection.create({ ...body, departmentId: new Types.ObjectId(deptId) });
    res.status(201).json({ id: doc._id.toString(), message: "Class saved." });
  }),
);

router.put(
  "/classes/:id",
  wrap(async (req, res) => {
    const body = parse(classSchema, req.body, res);
    if (!body) return;
    const deptId = await activeDeptId();
    const doc = deptId
      ? await ClassSection.findOneAndUpdate({ _id: req.params.id, ...scope(deptId) }, body, { new: true })
      : null;
    if (!doc) return void res.status(404).json({ error: "Class not found." });
    res.json({ id: doc._id.toString(), message: "Class saved." });
  }),
);

router.delete(
  "/classes/:id",
  wrap(async (req, res) => {
    const deptId = await activeDeptId();
    if (deptId) await ClassSection.findOneAndDelete({ _id: req.params.id, ...scope(deptId) });
    else await ClassSection.findByIdAndDelete(req.params.id);
    await ClassSubject.deleteMany({ classId: req.params.id });
    await RoutineEntry.deleteMany({ classId: req.params.id });
    res.json({ message: "Class deleted." });
  }),
);

router.post(
  "/classes/:id/subjects",
  wrap(async (req, res) => {
    const body = parse(classSubjectSchema, req.body, res);
    if (!body) return;
    const deptId = await requireActiveDept(res);
    if (!deptId) return;
    const [cls, subj] = await Promise.all([
      ClassSection.findOne({ _id: req.params.id, ...scope(deptId) }),
      Subject.findOne({ _id: body.subjectId, ...scope(deptId) }),
    ]);
    if (!cls || !subj) {
      return void res.status(404).json({ error: "Class or subject not found in the active department." });
    }
    await ClassSubject.findOneAndUpdate(
      { classId: req.params.id, subjectId: body.subjectId },
      { hours: body.hours, departmentId: new Types.ObjectId(deptId) },
      { upsert: true },
    );
    res.json({ message: "Class subject hours saved." });
  }),
);

router.delete(
  "/classes/:id/subjects/:subjectId",
  wrap(async (req, res) => {
    await ClassSubject.deleteOne({ classId: req.params.id, subjectId: req.params.subjectId });
    res.json({ message: "Requirement removed." });
  }),
);

// ------------------------------------------------------------------- config
router.get(
  "/config",
  wrap(async (_req, res) => {
    // Grid from Config; department identity merged from the ACTIVE
    // department so the masthead/sidebar always show it.
    const cfg = await mergedScheduleConfig();
    const raw = await getOrCreateConfig();
    res.json({
      days: cfg.days,
      periodsPerDay: cfg.periodsPerDay,
      lunchAfter: cfg.lunchAfter,
      periodDuration: raw.periodDuration,
      startTime: cfg.startTime,
      session: cfg.session,
      effectiveFrom: cfg.effectiveFrom,
      department: cfg.department,
      departmentShort: cfg.departmentShort,
    });
  }),
);

router.put(
  "/config",
  wrap(async (req, res) => {
    const body = parse(configSchema, req.body, res);
    if (!body) return;
    const cfg = await getOrCreateConfig();
    cfg.days = body.days ?? cfg.days;
    cfg.periodsPerDay = body.periodsPerDay ?? cfg.periodsPerDay;
    cfg.lunchAfter = !body.lunchAfter ? null : body.lunchAfter;
    cfg.periodDuration = body.periodDuration ?? cfg.periodDuration;
    cfg.startTime = body.startTime ?? cfg.startTime;
    await cfg.save();
    // Department identity edits belong to the ACTIVE department doc.
    const dept = await getActiveDepartment();
    if (dept) {
      if (body.department !== undefined) dept.name = body.department;
      if (body.departmentShort !== undefined) dept.shortName = body.departmentShort;
      if (body.session !== undefined) dept.session = body.session;
      if (body.effectiveFrom !== undefined) dept.effectiveFrom = body.effectiveFrom;
      await dept.save();
    }
    // Grid changed -> only the ACTIVE department's routine is invalid.
    const deptId = await activeDeptId();
    if (deptId) await RoutineEntry.deleteMany(scope(deptId));
    res.json({ message: "Time structure saved. The active department's routine was cleared (grid changed)." });
  }),
);

// ------------------------------------------------------------------ routine
async function populatedEntries() {
  const filter = await readFilter();
  const [entries, subjects, teachers, classes] = await Promise.all([
    RoutineEntry.find(filter).lean(),
    Subject.find(filter).lean(),
    Teacher.find(filter).lean(),
    ClassSection.find(filter).lean(),
  ]);
  const sById = new Map(subjects.map((s) => [s._id.toString(), s]));
  const tById = new Map(teachers.map((t) => [t._id.toString(), t]));
  const cById = new Map(classes.map((c) => [c._id.toString(), c]));
  return entries.map((e) => {
    const s = sById.get(e.subjectId.toString());
    const t = tById.get(e.teacherId.toString());
    const c = cById.get(e.classId.toString());
    return {
      id: e._id.toString(),
      classId: e.classId.toString(),
      subjectId: e.subjectId.toString(),
      teacherId: e.teacherId.toString(),
      day: e.day,
      period: e.period,
      subjectName: s?.name ?? "?",
      subjectCode: s?.code ?? "?",
      subjectType: s?.type ?? "theory",
      sessionHours: s?.sessionHours ?? (s?.type === "lab" ? 3 : 2),
      teacherName: t?.name ?? "?",
      teacherCode: t?.code ?? "",
      className: c ? classLabel(c.program, c.year, c.section) : "?",
    };
  });
}

router.get(
  "/routine",
  wrap(async (_req, res) => {
    const [entries, data] = await Promise.all([populatedEntries(), loadSolverData()]);
    res.json({ config: data.config, entries });
  }),
);

router.get(
  "/routine/class/:id",
  wrap(async (req, res) => {
    const all = await populatedEntries();
    const deptId = await activeDeptId();
    const cls = deptId
      ? await ClassSection.findOne({ _id: req.params.id, ...scope(deptId) }).lean()
      : null;
    if (!cls) return void res.status(404).json({ error: "Class not found." });
    const data = await loadSolverData();
    res.json({
      config: data.config,
      class: {
        id: cls._id.toString(),
        name: classLabel(cls.program, cls.year, cls.section),
      },
      entries: all.filter((e) => e.classId === req.params.id),
    });
  }),
);

router.get(
  "/routine/teacher/:id",
  wrap(async (req, res) => {
    const all = await populatedEntries();
    const deptId = await activeDeptId();
    const teacher = deptId
      ? await Teacher.findOne({ _id: req.params.id, ...scope(deptId) }).lean()
      : null;
    if (!teacher) return void res.status(404).json({ error: "Teacher not found." });
    const data = await loadSolverData();
    const mine = all.filter((e) => e.teacherId === req.params.id);
    const daily: Record<string, number> = {};
    for (const d of data.config.days) daily[d] = mine.filter((e) => e.day === d).length;
    res.json({
      config: data.config,
      teacher: { id: teacher._id.toString(), name: teacher.name },
      entries: mine,
      daily,
      total: mine.length,
    });
  }),
);

router.post(
  "/routine/generate",
  wrap(async (_req, res) => {
    const deptId = await requireActiveDept(res);
    if (!deptId) return;
    const data = await loadSolverData();
    const result = solve(data.teachers, data.subjects, data.classSubjects, data.config, 10);
    await RoutineEntry.deleteMany(scope(deptId));
    if (result.entries.length) {
      await RoutineEntry.insertMany(
        result.entries.map((e) => ({
          departmentId: new Types.ObjectId(deptId),
          classId: e.classId,
          subjectId: e.subjectId,
          teacherId: e.teacherId,
          day: e.day,
          period: e.period,
        })),
      );
    }
    const totalPeriods = data.classSubjects.reduce((sum, cs) => sum + cs.hours, 0);
    res.json({
      success: result.success,
      placedPeriods: result.entries.length,
      totalPeriods,
      placedJobs: result.placements.length,
      totalJobs: result.totalJobs,
      elapsedSeconds: result.elapsedSeconds,
      nodes: result.nodes,
      unplaced: result.unplaced.map((u) => ({
        className: data.classNames.get(u.classId) ?? u.classId,
        subjectName: data.subjects.get(u.subjectId)?.name ?? u.subjectId,
        duration: u.duration,
        reason: u.reason,
      })),
      message: result.success
        ? `Routine generated: ${result.entries.length}/${totalPeriods} hours placed (${result.placements.length}/${result.totalJobs} sessions) in ${result.elapsedSeconds.toFixed(2)}s, search nodes ${result.nodes}. Zero hard-rule violations.`
        : `Partial routine: ${result.entries.length}/${totalPeriods} hours placed. Some sessions could not be placed — see unplaced list.`,
    });
  }),
);

router.post(
  "/routine/clear",
  wrap(async (_req, res) => {
    const filter = await readFilter();
    await RoutineEntry.deleteMany(filter);
    res.json({ message: "Routine cleared." });
  }),
);

async function entriesAsLikes(): Promise<EntryLike[]> {
  const docs = await RoutineEntry.find(await readFilter()).lean();
  return docs.map((e) => ({
    id: e._id.toString(),
    classId: e.classId.toString(),
    subjectId: e.subjectId.toString(),
    teacherId: e.teacherId.toString(),
    day: e.day,
    period: e.period,
  }));
}

router.post(
  "/routine/move",
  wrap(async (req, res) => {
    const body = parse(moveSchema, req.body, res);
    if (!body) return;
    const [entries, data] = await Promise.all([entriesAsLikes(), loadSolverData()]);
    const entry = entries.find((e) => e.id === body.entryId);
    if (!entry) return void res.status(404).json({ error: "Entry not found." });
    // A move moves the WHOLE session block the entry belongs to;
    // body.period is the block's new start. The full span is checked.
    const block = sessionBlock(entries, entry.id);
    const blockIds = new Set(block.map((e) => e.id));
    const others = entries.filter((e) => !blockIds.has(e.id));
    const first = block[0];
    const reason = checkBlockPlacement(
      others,
      { classId: first.classId, subjectId: first.subjectId, teacherId: first.teacherId, length: block.length },
      body.day,
      body.period,
      data.teachers,
      data.subjects,
      { periodsPerDay: data.config.periodsPerDay, lunchAfter: data.config.lunchAfter },
    );
    if (reason) return void res.status(409).json({ error: `Move rejected: ${reason}` });
    for (let i = 0; i < block.length; i++) {
      await RoutineEntry.findByIdAndUpdate(block[i].id, { day: body.day, period: body.period + i });
    }
    res.json({
      message: `Move applied — the whole ${block.length}h session moved, no rule broken.`,
    });
  }),
);

router.post(
  "/routine/swap",
  wrap(async (req, res) => {
    const body = parse(swapSchema, req.body, res);
    if (!body) return;
    const [entries, data] = await Promise.all([entriesAsLikes(), loadSolverData()]);
    const a = entries.find((e) => e.id === body.entryA);
    const b = entries.find((e) => e.id === body.entryB);
    if (!a || !b) return void res.status(404).json({ error: "Swap rejected: entry not found." });
    if (a.classId !== b.classId) {
      return void res
        .status(409)
        .json({ error: "Swap rejected: swap is supported within the same class (use Move for single sessions)." });
    }
    // Swap exchanges the two SESSION BLOCKS the picked entries belong
    // to: block A takes block B's start and vice versa. Both full spans
    // are validated in their new positions before anything is written.
    const blockA = sessionBlock(entries, a.id);
    const blockB = sessionBlock(entries, b.id);
    const idsA = new Set(blockA.map((e) => e.id));
    const idsB = new Set(blockB.map((e) => e.id));
    if ([...idsA].some((id) => idsB.has(id))) {
      return void res.status(409).json({ error: "Swap rejected: both picks are in the same session." });
    }
    const grid = { periodsPerDay: data.config.periodsPerDay, lunchAfter: data.config.lunchAfter };
    const startA = { day: blockA[0].day, period: blockA[0].period };
    const startB = { day: blockB[0].day, period: blockB[0].period };
    const rest = entries.filter((e) => !idsA.has(e.id) && !idsB.has(e.id));
    const movedA: EntryLike[] = blockA.map((e, i) => ({ ...e, day: startB.day, period: startB.period + i }));
    const movedB: EntryLike[] = blockB.map((e, i) => ({ ...e, day: startA.day, period: startA.period + i }));
    const info = (blk: EntryLike[]) => ({
      classId: blk[0].classId,
      subjectId: blk[0].subjectId,
      teacherId: blk[0].teacherId,
      length: blk.length,
    });
    const r1 = checkBlockPlacement(
      [...rest, ...movedB], info(blockA), startB.day, startB.period, data.teachers, data.subjects, grid,
    );
    const r2 = r1
      ? null
      : checkBlockPlacement(
          [...rest, ...movedA], info(blockB), startA.day, startA.period, data.teachers, data.subjects, grid,
        );
    if (r1 || r2) return void res.status(409).json({ error: `Swap rejected: ${r1 ?? r2}` });
    for (let i = 0; i < blockA.length; i++) {
      await RoutineEntry.findByIdAndUpdate(blockA[i].id, { day: startB.day, period: startB.period + i });
    }
    for (let i = 0; i < blockB.length; i++) {
      await RoutineEntry.findByIdAndUpdate(blockB[i].id, { day: startA.day, period: startA.period + i });
    }
    res.json({ message: "Swap applied — both sessions moved as whole blocks, no rule broken." });
  }),
);

// ------------------------------------------------------------ load balance
/**
 * Coverage & balance — the greedy suggested distribution of required
 * hours across eligible teachers (see solver/balance.ts). Answers,
 * while data is being entered: "which subjects still have hours LEFT
 * to cover?" and "which teachers are getting too little work?".
 */

/** Build the balance input from the saved workspace (DB) data. */
async function balanceFromDb(): Promise<BalanceReport> {
  const filter = await readFilter();
  const [teacherDocs, subjectDocs, classDocs, csDocs] = await Promise.all([
    Teacher.find(filter).sort({ name: 1 }).lean(),
    Subject.find(filter).sort({ code: 1 }).lean(),
    ClassSection.find(filter).lean(),
    ClassSubject.find(filter).lean(),
  ]);
  const codeBySubjectId = new Map(subjectDocs.map((s) => [s._id.toString(), s.code]));
  const labelByClassId = new Map(
    classDocs.map((c) => [c._id.toString(), classLabel(c.program, c.year, c.section)]),
  );
  const input: BalanceInput = {
    teachers: teacherDocs.map((t) => ({
      code: t.code ?? "",
      name: t.name,
      weeklyMaxHours: t.weeklyHours,
      eligibleSubjectCodes: t.subjects
        .map((sid) => codeBySubjectId.get(sid.toString()))
        .filter((c): c is string => Boolean(c)),
    })),
    subjects: subjectDocs.map((s) => ({ code: s.code })),
    requirements: csDocs
      .filter((cs) => cs.hours > 0)
      .map((cs) => ({
        classLabel: labelByClassId.get(cs.classId.toString()) ?? "?",
        subjectCode: codeBySubjectId.get(cs.subjectId.toString()) ?? "?",
        hours: cs.hours,
      })),
  };
  return computeBalance(input);
}

router.get(
  "/balance",
  wrap(async (_req, res) => {
    res.json(await balanceFromDb());
  }),
);

/**
 * POST /api/balance/preview — same computation for not-yet-saved
 * wizard state. Read-only: a bad payload is a 400 with a problems
 * list and nothing is written, ever.
 */
router.post(
  "/balance/preview",
  wrap(async (req, res) => {
    const raw = parse(balancePreviewSchema, req.body, res);
    if (!raw) return;

    // Normalise Zod defaults into concrete locals.
    const body = {
      classes: (raw.classes ?? []).map((c) => ({ ...c, section: c.section ?? "" })),
      subjects: raw.subjects.map((s) => ({ ...s, name: s.name ?? "" })),
      teachers: raw.teachers.map((t) => ({
        ...t,
        name: t.name ?? "",
        code: t.code ?? "",
        subjects: t.subjects ?? [],
      })),
      classSubjects: raw.classSubjects ?? [],
    };

    const problems: string[] = [];
    const subjectCodes = new Map<string, string>(); // upper-cased -> display code
    for (const s of body.subjects) {
      const k = s.code.toUpperCase();
      if (subjectCodes.has(k)) problems.push(`Duplicate course code "${s.code}".`);
      else subjectCodes.set(k, s.code);
    }
    body.teachers.forEach((t, i) => {
      for (const code of t.subjects) {
        if (!subjectCodes.has(code.toUpperCase()))
          problems.push(
            `Teacher ${t.name || `#${i + 1}`} can teach "${code}", which is not one of the courses.`,
          );
      }
    });
    for (const m of body.classSubjects) {
      if (!subjectCodes.has(m.subjectCode.toUpperCase()))
        problems.push(`Mapping refers to course "${m.subjectCode}", which does not exist.`);
      if (body.classes.length > 0 && m.classIndex >= body.classes.length)
        problems.push(`Mapping refers to class #${m.classIndex + 1}, which does not exist.`);
    }
    if (problems.length) {
      return void res.status(400).json({ error: "Balance preview has problems", problems });
    }

    const input: BalanceInput = {
      teachers: body.teachers.map((t, i) => ({
        code: t.code || "",
        name: t.name || `Teacher ${i + 1}`,
        weeklyMaxHours: t.weeklyHours,
        eligibleSubjectCodes: t.subjects,
      })),
      subjects: body.subjects.map((s) => ({ code: s.code })),
      requirements: body.classSubjects
        .filter((m) => m.hours > 0)
        .map((m) => ({
          classLabel:
            body.classes[m.classIndex] !== undefined
              ? classLabel(
                  body.classes[m.classIndex].program,
                  body.classes[m.classIndex].year,
                  body.classes[m.classIndex].section,
                )
              : `Class ${m.classIndex + 1}`,
          subjectCode: m.subjectCode,
          hours: m.hours,
        })),
    };
    res.json(computeBalance(input));
  }),
);

// --------------------------------------------------------------- validation
router.get(
  "/validation",
  wrap(async (_req, res) => {
    const data = await loadSolverData();
    const report = validateData(data);
    const deptId = await activeDeptId();
    const placedDocs = await RoutineEntry.aggregate([
      ...(deptId
        ? [{ $match: { departmentId: new Types.ObjectId(deptId) } }]
        : [{ $match: { departmentId: { $exists: false } } }]),
      { $group: { _id: "$subjectId", n: { $sum: 1 } } },
    ]);
    const placed: Record<string, number> = {};
    for (const p of placedDocs) placed[p._id.toString()] = p.n;
    res.json({
      issues: report.issues,
      warnings: report.warnings,
      slotsPerWeek: report.slotsPerWeek,
      demandBySubject: report.demandBySubject.map((d) => ({
        subjectId: d.subjectId,
        subject: d.subject,
        demand: d.demand,
        capacity: d.capacity,
        teachers: d.teachers,
        placed: placed[d.subjectId] ?? 0,
      })),
      demandByClass: report.demandByClass,
    });
  }),
);
