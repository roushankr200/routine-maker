import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  ClassSection,
  ClassSubject,
  RoutineEntry,
  Subject,
  Teacher,
  TeacherUnavailable,
  getOrCreateConfig,
} from "./models.js";
import {
  availabilitySchema,
  classSchema,
  classSubjectSchema,
  configSchema,
  moveSchema,
  subjectSchema,
  swapSchema,
  teacherSchema,
} from "./schemas.js";
import { loadSolverData, validateData } from "./data.js";
import { solve } from "./solver/solver.js";
import { loadDemoData } from "./seed.js";
import { classLabel } from "./demoData.js";
import { checkPlacement, EntryLike } from "./routineCheck.js";

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

// ---------------------------------------------------------------- dashboard
router.get(
  "/dashboard",
  wrap(async (_req, res) => {
    const [teachers, subjects, classes, entries] = await Promise.all([
      Teacher.countDocuments(),
      Subject.countDocuments(),
      ClassSection.countDocuments(),
      RoutineEntry.countDocuments(),
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
      message: `MCA demo data loaded: ${counts.teachers} teachers, ${counts.subjects} subjects, ${counts.classes} classes. Now click Generate Routine.`,
      counts,
    });
  }),
);

// ----------------------------------------------------------------- teachers
router.get(
  "/teachers",
  wrap(async (_req, res) => {
    const teachers = await Teacher.find().sort({ name: 1 }).lean();
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
    const doc = await Teacher.create(body);
    res.status(201).json({ id: doc._id.toString(), message: "Teacher saved." });
  }),
);

router.put(
  "/teachers/:id",
  wrap(async (req, res) => {
    const body = parse(teacherSchema, req.body, res);
    if (!body) return;
    const doc = await Teacher.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!doc) return void res.status(404).json({ error: "Teacher not found." });
    res.json({ id: doc._id.toString(), message: "Teacher saved." });
  }),
);

router.delete(
  "/teachers/:id",
  wrap(async (req, res) => {
    await Teacher.findByIdAndDelete(req.params.id);
    await TeacherUnavailable.deleteMany({ teacherId: req.params.id });
    await RoutineEntry.deleteMany({ teacherId: req.params.id });
    res.json({ message: "Teacher deleted." });
  }),
);

router.get(
  "/teachers/:id/availability",
  wrap(async (req, res) => {
    const teacher = await Teacher.findById(req.params.id).lean();
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
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return void res.status(404).json({ error: "Teacher not found." });
    await TeacherUnavailable.deleteMany({ teacherId: req.params.id });
    const docs = (body.blocked ?? []).map((key) => {
      const [day, period] = key.split("|");
      return {
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
    const subjects = await Subject.find().sort({ code: 1 }).lean();
    res.json(subjects.map((s) => ({ ...s, id: s._id.toString() })));
  }),
);

router.post(
  "/subjects",
  wrap(async (req, res) => {
    const body = parse(subjectSchema, req.body, res);
    if (!body) return;
    const doc = await Subject.create(body);
    res.status(201).json({ id: doc._id.toString(), message: "Subject saved." });
  }),
);

router.put(
  "/subjects/:id",
  wrap(async (req, res) => {
    const body = parse(subjectSchema, req.body, res);
    if (!body) return;
    const doc = await Subject.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!doc) return void res.status(404).json({ error: "Subject not found." });
    res.json({ id: doc._id.toString(), message: "Subject saved." });
  }),
);

router.delete(
  "/subjects/:id",
  wrap(async (req, res) => {
    await Subject.findByIdAndDelete(req.params.id);
    await ClassSubject.deleteMany({ subjectId: req.params.id });
    await RoutineEntry.deleteMany({ subjectId: req.params.id });
    await Teacher.updateMany({}, { $pull: { subjects: req.params.id } });
    res.json({ message: "Subject deleted." });
  }),
);

// ------------------------------------------------------------------ classes
router.get(
  "/classes",
  wrap(async (_req, res) => {
    const [classes, requirements, subjects] = await Promise.all([
      ClassSection.find().sort({ program: 1, year: 1 }).lean(),
      ClassSubject.find().lean(),
      Subject.find().lean(),
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
    const doc = await ClassSection.create(body);
    res.status(201).json({ id: doc._id.toString(), message: "Class saved." });
  }),
);

router.put(
  "/classes/:id",
  wrap(async (req, res) => {
    const body = parse(classSchema, req.body, res);
    if (!body) return;
    const doc = await ClassSection.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!doc) return void res.status(404).json({ error: "Class not found." });
    res.json({ id: doc._id.toString(), message: "Class saved." });
  }),
);

router.delete(
  "/classes/:id",
  wrap(async (req, res) => {
    await ClassSection.findByIdAndDelete(req.params.id);
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
    await ClassSubject.findOneAndUpdate(
      { classId: req.params.id, subjectId: body.subjectId },
      { hours: body.hours },
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
    const cfg = await getOrCreateConfig();
    res.json({
      days: cfg.days,
      periodsPerDay: cfg.periodsPerDay,
      lunchAfter: cfg.lunchAfter,
      periodDuration: cfg.periodDuration,
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
    await cfg.save();
    await RoutineEntry.deleteMany({}); // grid changed -> routine invalid
    res.json({ message: "Time structure saved. Existing routine was cleared (grid changed)." });
  }),
);

// ------------------------------------------------------------------ routine
async function populatedEntries() {
  const [entries, subjects, teachers, classes] = await Promise.all([
    RoutineEntry.find().lean(),
    Subject.find().lean(),
    Teacher.find().lean(),
    ClassSection.find().lean(),
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
      teacherName: t?.name ?? "?",
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
    const cls = await ClassSection.findById(req.params.id).lean();
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
    const teacher = await Teacher.findById(req.params.id).lean();
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
    const data = await loadSolverData();
    const result = solve(data.teachers, data.subjects, data.classSubjects, data.config, 10);
    await RoutineEntry.deleteMany({});
    if (result.entries.length) {
      await RoutineEntry.insertMany(
        result.entries.map((e) => ({
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
        ? `Routine generated: ${result.entries.length}/${totalPeriods} periods placed (${result.placements.length}/${result.totalJobs} jobs) in ${result.elapsedSeconds.toFixed(2)}s, search nodes ${result.nodes}. Zero hard-rule violations.`
        : `Partial routine: ${result.entries.length}/${totalPeriods} periods placed. Some jobs could not be placed — see unplaced list.`,
    });
  }),
);

router.post(
  "/routine/clear",
  wrap(async (_req, res) => {
    await RoutineEntry.deleteMany({});
    res.json({ message: "Routine cleared." });
  }),
);

async function entriesAsLikes(): Promise<EntryLike[]> {
  const docs = await RoutineEntry.find().lean();
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
    const candidate: EntryLike = { ...entry, day: body.day, period: body.period };
    const reason = checkPlacement(entries, candidate, data.teachers, data.subjects);
    if (reason) return void res.status(409).json({ error: `Move rejected: ${reason}` });
    await RoutineEntry.findByIdAndUpdate(entry.id, { day: body.day, period: body.period });
    res.json({ message: "Move applied — no rule broken." });
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
        .json({ error: "Swap rejected: swap is supported within the same class (use Move for single entries)." });
    }
    // Simulate the swap in memory, validate both entries in their new slots.
    const swapped: EntryLike[] = entries.map((e) => {
      if (e.id === a.id) return { ...e, day: b.day, period: b.period };
      if (e.id === b.id) return { ...e, day: a.day, period: a.period };
      return e;
    });
    const newA = swapped.find((e) => e.id === a.id)!;
    const newB = swapped.find((e) => e.id === b.id)!;
    const r1 = checkPlacement(swapped, newA, data.teachers, data.subjects);
    const r2 = r1 ? null : checkPlacement(swapped, newB, data.teachers, data.subjects);
    if (r1 || r2) return void res.status(409).json({ error: `Swap rejected: ${r1 ?? r2}` });
    await RoutineEntry.findByIdAndUpdate(a.id, { day: b.day, period: b.period });
    await RoutineEntry.findByIdAndUpdate(b.id, { day: a.day, period: a.period });
    res.json({ message: "Swap applied — no rule broken." });
  }),
);

// --------------------------------------------------------------- validation
router.get(
  "/validation",
  wrap(async (_req, res) => {
    const data = await loadSolverData();
    const report = validateData(data);
    const placedDocs = await RoutineEntry.aggregate([
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
