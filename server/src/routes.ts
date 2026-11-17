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
  findVariation,
  getActiveDepartment,
  listDepartments,
  publishedRoutineScope,
  scope,
  setActiveDepartment,
  variationKey,
} from "./departments.js";
import { mergedScheduleConfig } from "./data.js";
import {
  availabilitySchema,
  balancePreviewSchema,
  classSchema,
  classSubjectSchema,
  configSchema,
  guidedSetupSchema,
  moveSchema,
  subjectSchema,
  swapSchema,
  teacherSchema,
} from "./schemas.js";
import {
  DEPARTMENT_REGISTRY,
  facultyWithCodes,
  findFaculty,
  findProgramme,
  findSemester,
  getCatalogue,
  listCatalogues,
  resolveSubject,
  semesterSubjects,
} from "./catalog/index.js";
import {
  computeBalance,
  BalanceInput,
  BalanceReport,
} from "./solver/balance.js";
import { loadSolverData, validateData } from "./data.js";
import { solve } from "./solver/solver.js";
import { scheduledWeeklyHours, teacherWeeklyLimit } from "./solver/types.js";
import { loadDemoData } from "./seed.js";
import { classLabel, parseSemesterNumber } from "./demoData.js";
import { checkBlockPlacement, EntryLike, savedFacultyWorkloadIssues, sessionBlock } from "./routineCheck.js";
import { accountFor } from "./accounts.js";
import { Room, otherRoomReservations, roomConstraints } from "./rooms.js";
import { scheduleWrite } from "./scheduleWrite.js";
import { previousAssignments } from "./previousAssignments.js";
import { copyRoutineVariation } from "./variations.js";

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
  (req: Request, res: Response, next: NextFunction) => {
    const run = () => fn(req, res);
    return (req.method === "GET" ? run() : scheduleWrite(run)).catch(next);
  };

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
      error: "No active department yet — load the CSE department or set up a department first.",
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
    const grouped = depts.filter((d) => !d.parentDepartmentId).flatMap((d) => [
      d, ...depts.filter((variation) => variation.parentDepartmentId?.equals(d._id)),
    ]);
    for (const d of grouped) {
      const counts = await departmentCounts(d._id.toString());
      out.push({
        id: d._id.toString(),
        name: d.name,
        shortName: d.shortName,
        parentDepartmentId: d.parentDepartmentId?.toString() ?? null,
        variationName: d.variationName ?? null,
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

router.post("/departments/:id/variations", wrap(async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(1).max(60) }), req.body, res);
  if (!body) return;
  if (!Types.ObjectId.isValid(req.params.id)) return void res.status(404).json({ error: "Department or variation not found." });
  const source = await Department.findById(req.params.id);
  if (!source) return void res.status(404).json({ error: "Department or variation not found." });
  if (await findVariation(source.parentDepartmentId ?? source._id, body.name)) {
    return void res.status(409).json({ error: "A variation with this name already exists in this department." });
  }
  const copy = await copyRoutineVariation(source, body.name);
  res.status(201).json({ id: copy._id.toString(), message: `Variation “${body.name}” created.` });
}));

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
    if (!dept.parentDepartmentId && await Department.exists({ parentDepartmentId: dept._id })) {
      return void res.status(409).json({ error: "Delete this department’s variations before deleting the department." });
    }
    const total = await Department.countDocuments({ parentDepartmentId: null });
    if (!dept.parentDepartmentId && total <= 1) {
      return void res.status(400).json({
        error: "Cannot delete the last remaining department — create another department first if you want to replace it.",
      });
    }
    const wasActive = (await activeDeptId()) === dept._id.toString();
    await deleteDepartmentData(dept._id.toString());
    let newActive: string | null = null;
    if (wasActive) {
      const next = (dept.parentDepartmentId && await Department.findById(dept.parentDepartmentId))
        || await Department.findOne({ parentDepartmentId: null }).sort({ createdAt: 1 });
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
    const department = await getActiveDepartment();
    const departmentId = department?._id.toString();
    const filter = departmentId ? scope(departmentId) : { departmentId: { $exists: false } };
    const [teachers, subjects, classes, entries, data] = await Promise.all([
      Teacher.countDocuments({ ...filter, isPlaceholder: { $ne: true } }),
      Subject.countDocuments(filter),
      ClassSection.countDocuments(filter),
      entriesAsLikes(department),
      loadSolverData(departmentId),
    ]);
    const { issues, warnings } = validateData(data);
    res.json({
      stats: { teachers, subjects, classes, entries: entries.length },
      issues: [...issues, ...savedFacultyWorkloadIssues(entries, data.teachers, data.config)],
      warnings,
      hasRoutine: entries.length > 0,
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

// ------------------------------------------------------- syllabus catalogue
/**
 * The syllabus catalogue: official course structures the guided setup
 * preloads subjects from. Read-only, DB-free.
 */
router.get(
  "/catalog",
  wrap(async (_req, res) => {
    res.json({
      departments: listCatalogues().map((d) => ({
        id: d.id,
        name: d.name,
        shortName: d.shortName,
        programmes: d.programmes.map((p) => ({
          programme: p.programme,
          ...(p.specialisation ? { specialisation: p.specialisation } : {}),
          ...(p.numbersRequired ? { numbersRequired: true } : {}),
          semesters: p.semesters.map((s) => s.semester),
        })),
      })),
    });
  }),
);

router.get(
  "/catalog/:deptId",
  wrap(async (req, res) => {
    const dept = getCatalogue(req.params.deptId);
    if (!dept) return void res.status(404).json({ error: "Catalogue not found." });
    res.json(dept);
  }),
);

// --------------------------------------------------- faculty + departments
/**
 * GET /api/faculty — the department registry (all 14 NITA units):
 * which have a syllabus catalogue to preload courses from and how
 * many teachers their website faculty list carries.
 */
router.get(
  "/faculty",
  wrap(async (_req, res) => {
    res.json({
      departments: DEPARTMENT_REGISTRY.map((d) => ({
        id: d.id,
        name: d.name,
        shortName: d.shortName,
        hasCatalogue: d.hasCatalogue,
        facultyCount: d.facultyCount,
      })),
    });
  }),
);

/**
 * GET /api/faculty/:deptId — one department's website faculty list,
 * each person with their derived short code (used by the setup's
 * preload). Education has no website presence: an empty list.
 */
router.get(
  "/faculty/:deptId",
  wrap(async (req, res) => {
    const entry = DEPARTMENT_REGISTRY.find(
      (d) => d.id === req.params.deptId.toUpperCase(),
    );
    if (!entry) return void res.status(404).json({ error: "Department not found." });
    res.json({
      id: entry.id,
      name: entry.name,
      shortName: entry.shortName,
      hasCatalogue: entry.hasCatalogue,
      facultyCount: entry.facultyCount,
      faculty: facultyWithCodes(entry.id) ?? [],
    });
  }),
);

// ------------------------------------------------------------ unified setup
router.get("/setup/previous-assignments/:deptId", wrap(async (req, res) => {
  const entry = DEPARTMENT_REGISTRY.find((item) => item.id === req.params.deptId.toUpperCase());
  if (!entry) return void res.status(404).json({ error: "Department not found." });
  res.json(await scheduleWrite(() => previousAssignments(entry.name, entry.id === "CSE")));
}));

/**
 * POST /api/setup/guided — the ONE department setup's single commit
 * (v2.4; the route name is kept from v2.3 for compatibility).
 *
 * The payload carries DECISIONS (teacher pool + per-class teacher /
 * elective-pick assignments keyed by subject key); catalogue subjects'
 * hours, credits and session lengths are re-resolved from the
 * server-side CATALOGUE, never trusted from the client. On top of the
 * v2.3 flow it supports:
 *  - catalogue for ANY NITA department (or none: manual departments)
 *  - website faculty preload: a teacher may carry a `facultyCode`;
 *    the server re-resolves name/designation from the faculty
 *    registry — client-sent names for preloaded teachers are ignored
 *  - per-class `customSubjects` (manually added subjects) alongside
 *    catalogue subjects, and `custom: true` classes (all-manual)
 *  - per-assignment numbers for catalogue subjects whose syllabus
 *    prints none (Production B.Tech): required there, else 400
 *  - `customPick` for elective slots the syllabus prints no pool for
 *
 * Validation (all before anything is written):
 *  - every catalogue class must exist in the catalogue
 *  - every TIMETABLED subject of every class is assigned (a teacher
 *    from the pool, or "XX" = no teacher yet)
 *  - elective slots carry a valid pool pick / custom pick
 *  - no teacher's total assigned hours exceed their weekly max
 *  - duplicate department name -> 409 (multi-department semantics:
 *    creating NEVER deletes or overwrites another department)
 *
 * On success a NEW department is created with Teachers (eligibility =
 * exactly the subjects each teacher was assigned), Subjects,
 * ClassSections and ClassSubjects, and made active. XX subjects are
 * assigned to one internal placeholder teacher with code "XX" (hidden
 * from teacher lists/counts) so generation succeeds and the slots
 * print as XX, exactly like the real sheet.
 */
router.post(
  "/setup/guided",
  wrap(async (req, res) => {
    const body = parse(guidedSetupSchema, req.body, res);
    if (!body) return;

    const catalogue = body.catalogueId ? getCatalogue(body.catalogueId) : null;
    if (body.catalogueId && !catalogue) {
      return void res.status(400).json({
        error: `Unknown catalogue "${body.catalogueId}".`,
        problems: [`Catalogue "${body.catalogueId}" does not exist.`],
      });
    }

    const problems: string[] = [];

    // -- teacher pool: website-preloaded teachers are re-resolved -----
    // from the faculty registry by derived code (names are NEVER
    // trusted from the client); manual teachers carry their own name.
    interface PoolTeacher {
      name: string;
      code: string;
      designation: string;
      maxPerDay: number;
      weeklyHours: number;
    }
    const poolTeachers: PoolTeacher[] = [];
    const teacherByCode = new Map<string, PoolTeacher>();
    for (const t of body.teachers) {
      let name = t.name ?? "";
      let designation = t.designation ?? "";
      if (t.facultyCode) {
        if (!body.facultyDeptId) {
          problems.push(
            `Teacher "${t.code}" references website faculty code "${t.facultyCode}" but the payload names no faculty department.`,
          );
          continue;
        }
        const member = findFaculty(body.facultyDeptId, t.facultyCode);
        if (!member) {
          problems.push(
            `Faculty code "${t.facultyCode}" is not in the ${body.facultyDeptId} faculty list from nita.ac.in.`,
          );
          continue;
        }
        name = member.name;
        designation = member.designation;
      } else if (!name) {
        problems.push(`Teacher with code "${t.code}" has no name.`);
        continue;
      }
      const key = t.code.toUpperCase();
      if (key === "XX") problems.push(`Teacher code "XX" is reserved (it means "no teacher yet").`);
      else if (teacherByCode.has(key)) problems.push(`Duplicate teacher code "${t.code}".`);
      else {
        const pool: PoolTeacher = {
          name,
          code: t.code,
          designation,
          maxPerDay: t.maxPerDay ?? 5,
          weeklyHours: t.weeklyHours,
        };
        teacherByCode.set(key, pool);
        poolTeachers.push(pool);
      }
    }

    interface ResolvedSubjectShape {
      catalogueKey: string;
      shortCode: string;
      title: string;
      syllabusCode: string | null;
      credits: number | null;
      type: "theory" | "lab";
      kind: string;
      sessionHours: number;
      weeklyHours: number;
    }
    interface ResolvedAssignment {
      classIndex: number;
      resolved: ResolvedSubjectShape;
      teacherCode: string | null; // null = XX
    }
    const resolvedAssignments: ResolvedAssignment[] = [];
    const loadByTeacher = new Map<string, number>(); // upper code -> hours
    const xxSubjects = new Set<string>(); // resolved shortCodes assigned XX

    body.classes.forEach((cls, classIndex) => {
      const label =
        `${cls.programme} Sem ${cls.semester}${cls.section ? ` ${cls.section}` : ""}`.trim();
      const assignmentByKey = new Map(cls.assignments.map((a) => [a.key, a]));
      const customByKey = new Map((cls.customSubjects ?? []).map((s) => [s.shortCode, s]));
      const subjectCodes = new Set<string>();

      /** Shared teacher/XX bookkeeping for one resolved subject. */
      const record = (
        key: string,
        resolved: ResolvedSubjectShape | null,
        failProblem: string | null,
      ) => {
        const a = assignmentByKey.get(key);
        if (!a) return; // "not assigned" is reported by the caller loops
        if (!resolved) {
          problems.push(failProblem!);
          return;
        }
        const subjectCode = resolved.shortCode.toUpperCase();
        if (subjectCodes.has(subjectCode)) {
          problems.push(`Class ${label}: ${resolved.shortCode} is selected more than once. Choose a different elective or remove the duplicate subject.`);
          return;
        }
        subjectCodes.add(subjectCode);
        if (a.teacherCode.toUpperCase() === "XX") {
          resolvedAssignments.push({ classIndex, resolved, teacherCode: null });
          xxSubjects.add(resolved.shortCode);
          return;
        }
        const teacher = teacherByCode.get(a.teacherCode.toUpperCase());
        if (!teacher) {
          problems.push(
            `Class ${label}: subject ${resolved.shortCode} is assigned to teacher "${a.teacherCode}", who is not in the teacher pool.`,
          );
          return;
        }
        resolvedAssignments.push({ classIndex, resolved, teacherCode: teacher.code });
        const tkey = teacher.code.toUpperCase();
        loadByTeacher.set(tkey, (loadByTeacher.get(tkey) ?? 0) + scheduledWeeklyHours(resolved.weeklyHours, resolved));
      };

      // -- catalogue subjects (skipped for fully manual classes) ------
      let catSubjects: ReturnType<typeof semesterSubjects> = [];
      if (!cls.custom) {
        if (!catalogue) {
          problems.push(
            `Class ${label}: no catalogue was selected, so this class must be a manual class (custom) with its own subjects.`,
          );
          return;
        }
        const prog = findProgramme(catalogue, cls.programme, cls.specialisation);
        if (!prog) {
          problems.push(
            `Class ${label}: programme "${cls.programme}"${cls.specialisation ? ` (${cls.specialisation})` : ""} is not in the ${catalogue.id} catalogue.`,
          );
          return;
        }
        const sem = findSemester(prog, cls.semester);
        if (!sem) {
          problems.push(`Class ${label}: semester ${cls.semester} is not in the catalogue.`);
          return;
        }
        catSubjects = semesterSubjects(sem, cls.group);
        for (const cs of catSubjects) {
          if (!cs.timetabled) continue;
          const a = assignmentByKey.get(cs.key);
          if (!a) {
            problems.push(`Class ${label}: subject ${cs.shortCode} (${cs.title}) is not assigned to a teacher.`);
            continue;
          }
          // Subjects whose syllabus prints NO numbers (Production):
          // the assignment MUST carry user-supplied numbers.
          let numbers: { weeklyHours: number; sessionHours: number; credits: number } | undefined;
          if (cs.weeklyHours === null) {
            if (
              a.weeklyHours === undefined ||
              a.sessionHours === undefined ||
              a.credits === undefined
            ) {
              problems.push(
                `Class ${label}: subject ${cs.shortCode} (${cs.title}) has no weekly hours, session hours or credits in the published syllabus — enter them in the setup so the subject can be timetabled.`,
              );
              continue;
            }
            if (a.sessionHours > a.weeklyHours) {
              problems.push(
                `Class ${label}: subject ${cs.shortCode} — session hours (${a.sessionHours}) exceed its weekly hours (${a.weeklyHours}).`,
              );
              continue;
            }
            numbers = {
              weeklyHours: a.weeklyHours,
              sessionHours: a.sessionHours,
              credits: a.credits,
            };
          }
          const resolved = resolveSubject(cs, a.electivePick, {
            numbers,
            customPick: a.customPick,
          });
          if (!resolved) {
            problems.push(
              cs.electivePool !== undefined && cs.electivePool.length === 0
                ? `Class ${label}: elective ${cs.shortCode} has no subject list in the syllabus — type the chosen subject's code and title in the setup.`
                : `Class ${label}: elective ${cs.shortCode} needs a valid pick from its pool${a.electivePick ? ` (got "${a.electivePick}")` : ""}.`,
            );
            continue;
          }
          record(cs.key, resolved, null);
        }
        // A class whose catalogue semester is entirely non-timetabled
        // (e.g. M.Tech Sem 3) has nothing to assign — the client skips
        // those, but an empty class is rejected rather than created
        // hollow — unless manual subjects were added to it.
        if (
          catSubjects.every((s) => !s.timetabled) &&
          (cls.customSubjects ?? []).length === 0
        ) {
          problems.push(
            `Class ${label}: this semester has no timetabled subjects (project/viva only) — do not include it.`,
          );
        }
      } else if ((cls.customSubjects ?? []).length === 0) {
        problems.push(`Class ${label}: a manual class needs at least one manually added subject.`);
      }

      // -- manually added subjects (any class) -------------------------
      for (const cs of cls.customSubjects ?? []) {
        if (catSubjects.some((s) => s.key === cs.shortCode && s.timetabled)) {
          problems.push(
            `Class ${label}: manual subject code "${cs.shortCode}" duplicates a catalogue subject in the same class.`,
          );
          continue;
        }
        const a = assignmentByKey.get(cs.shortCode);
        if (!a) {
          problems.push(`Class ${label}: subject ${cs.shortCode} (${cs.title}) is not assigned to a teacher.`);
          continue;
        }
        record(
          cs.shortCode,
          {
            catalogueKey: cs.shortCode,
            shortCode: cs.shortCode,
            title: cs.title,
            syllabusCode: null,
            credits: cs.credits,
            type: cs.kind === "lab" ? "lab" : "theory",
            kind: cs.kind ?? "theory",
            sessionHours: cs.sessionHours,
            weeklyHours: cs.weeklyHours,
          },
          null,
        );
      }

      // -- assignments must refer to something real --------------------
      for (const key of assignmentByKey.keys()) {
        if (!catSubjects.some((s) => s.key === key && s.timetabled) && !customByKey.has(key)) {
          problems.push(
            cls.custom
              ? `Class ${label}: assignment refers to unknown subject "${key}".`
              : `Class ${label}: assignment refers to unknown catalogue subject "${key}".`,
          );
        }
      }
    });

    for (const [key, load] of loadByTeacher) {
      const t = teacherByCode.get(key)!;
      if (load > t.weeklyHours) {
        problems.push(
          `Teacher ${t.name} (${t.code}) is assigned ${load}h/week, over their weekly max of ${t.weeklyHours}h.`,
        );
      }
    }
    if (problems.length) {
      return void res.status(400).json({ error: "Setup has problems", problems });
    }

    // -- duplicate department name? Never overwrite: 409 + switch hint -
    const existingDept = await findDepartmentByName(body.department.name);
    if (existingDept && !body.variationName) {
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
    if (!existingDept && body.variationName) {
      return void res.status(400).json({ error: "Create the department before adding a routine variation." });
    }
    const variationName = body.variationName;
    if (existingDept && variationName && await findVariation(existingDept._id, variationName)) {
      return void res.status(409).json({ error: "A variation with this name already exists in this department." });
    }

    // -- create the NEW department + its scoped data (nothing wiped) ---
    const dept = await Department.create({
      name: existingDept?.name ?? body.department.name,
      shortName: existingDept?.shortName ?? body.department.short,
      session: body.department.session ?? "ODD 2026",
      effectiveFrom: body.department.effectiveFrom ?? "",
      ...(existingDept && variationName ? { parentDepartmentId: existingDept._id, variationName, variationKey: variationKey(variationName) } : {}),
    });
    const deptFilter = scope(dept._id.toString());

    try {

      // Subjects: unique by shortCode within the department.
      const subjectIdByCode = new Map<string, string>();
      for (const ra of resolvedAssignments) {
        const r = ra.resolved;
        if (subjectIdByCode.has(r.shortCode)) continue;
        const doc = await Subject.create({
          ...deptFilter,
          name: r.title,
          code: r.shortCode,
          type: r.type,
          sessionHours: r.sessionHours,
          credits: r.credits,
          syllabusCode: r.syllabusCode ?? "",
        });
        subjectIdByCode.set(r.shortCode, doc._id.toString());
      }

      const classIds: string[] = [];
      const originalClasses = existingDept ? await ClassSection.find(scope(existingDept._id.toString())).lean() : [];
      for (const cls of body.classes) {
        const original = originalClasses.find((row) => row.program === cls.programme
          && (row.semesterNumber ?? parseSemesterNumber(row.year)) === cls.semester && row.section === cls.section);
        const doc = await ClassSection.create({
          ...deptFilter,
          program: cls.programme,
          year: `Sem ${cls.semester}`,
          section: cls.section ?? "",
          programme: cls.programme,
          semesterNumber: cls.semester,
          studentCount: cls.studentCount ?? original?.studentCount ?? null,
        });
        classIds.push(doc._id.toString());
      }

      // Teachers: eligibility = exactly the subjects they were assigned.
      const eligibilityByTeacher = new Map<string, Set<string>>();
      for (const ra of resolvedAssignments) {
        if (!ra.teacherCode) continue;
        const key = ra.teacherCode.toUpperCase();
        if (!eligibilityByTeacher.has(key)) eligibilityByTeacher.set(key, new Set());
        eligibilityByTeacher.get(key)!.add(ra.resolved.shortCode);
      }
      const teacherIds = new Map<string, Types.ObjectId>();
      let teachersCreated = 0;
      for (const t of poolTeachers) {
        const codes = eligibilityByTeacher.get(t.code.toUpperCase()) ?? new Set<string>();
        const teacher = await Teacher.create({
          ...deptFilter,
          name: t.name,
          code: t.code,
          designation: t.designation ?? "",
          maxPerDay: t.maxPerDay ?? 5,
          weeklyHours: t.weeklyHours,
          subjects: [...codes].map((c) => subjectIdByCode.get(c)),
        });
        teacherIds.set(t.code.toUpperCase(), teacher._id);
        teachersCreated++;
      }

      // XX placeholder: one internal teacher for every XX subject.
      if (xxSubjects.size > 0) {
        const teacher = await Teacher.create({
          ...deptFilter,
          name: "Teacher not assigned yet",
          code: "XX",
          designation: "",
          maxPerDay: 7,
          weeklyHours: 80,
          subjects: [...xxSubjects].map((c) => subjectIdByCode.get(c)),
          isPlaceholder: true,
        });
        teacherIds.set("XX", teacher._id);
      }

      let mappings = 0;
      for (const ra of resolvedAssignments) {
        await ClassSubject.create({
          ...deptFilter,
          classId: classIds[ra.classIndex],
          subjectId: subjectIdByCode.get(ra.resolved.shortCode),
          teacherId: variationName ? teacherIds.get(ra.teacherCode?.toUpperCase() ?? "XX") : undefined,
          hours: ra.resolved.weeklyHours,
        });
        mappings++;
      }

      await setActiveDepartment(dept._id);

      res.status(201).json({
        message:
          `${variationName ? `Routine variation “${variationName}” created for ${dept.shortName}` : `${dept.shortName} department created`}: ` +
          `${body.classes.length} classes, ${subjectIdByCode.size} subjects, ${teachersCreated} teachers` +
          (xxSubjects.size > 0 ? `, ${xxSubjects.size} subject(s) left as XX (no teacher yet)` : "") +
          `. It is now the active department — click Generate Routine.`,
        departmentId: dept._id.toString(),
        variationName: variationName ?? null,
        counts: {
          teachers: teachersCreated,
          subjects: subjectIdByCode.size,
          classes: body.classes.length,
          classSubjects: mappings,
          xxSubjects: xxSubjects.size,
        },
        teacherLoads: poolTeachers.map((t) => ({
          code: t.code,
          name: t.name,
          assignedHours: loadByTeacher.get(t.code.toUpperCase()) ?? 0,
          weeklyHours: t.weeklyHours,
        })),
      });
    } catch (error) {
      await deleteDepartmentData(dept._id.toString());
      throw error;
    }
  }),
);

// ----------------------------------------------------------------- teachers
router.get(
  "/teachers",
  wrap(async (_req, res) => {
    const filter = await readFilter();
    const teachers = await Teacher.find({ ...filter, isPlaceholder: { $ne: true } })
      .sort({ name: 1 })
      .lean();
    res.json(
      teachers.map((t) => ({ ...t, id: t._id.toString(), weeklyHours: teacherWeeklyLimit(t), subjects: t.subjects.map(String) })),
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
    if (!deptId || !await Teacher.findOneAndDelete({ _id: req.params.id, ...scope(deptId) })) {
      return void res.status(404).json({ error: "Teacher not found." });
    }
    await ClassSubject.updateMany({ ...scope(deptId), teacherId: req.params.id }, { $unset: { teacherId: 1 } });
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
              hours: scheduledWeeklyHours(r.hours, s),
              recordedHours: r.hours,
              name: s?.name ?? "?",
              code: s?.code ?? "?",
              type: s?.type ?? "theory",
              sessionHours: s?.sessionHours ?? (s?.type === "lab" ? 3 : 2),
              credits: s?.credits ?? 0,
              syllabusCode: s?.syllabusCode ?? "",
            };
          })
          .sort((a, b) => a.code.localeCompare(b.code));
        return {
          id: c._id.toString(),
          program: c.program,
          year: c.year,
          section: c.section,
          programme: c.programme ?? c.program,
          semesterNumber: c.semesterNumber ?? parseSemesterNumber(c.year),
          name: classLabel(c.program, c.year, c.section),
          studentCount: c.studentCount ?? null,
          requirements: reqs,
          totalHours: reqs.reduce((sum, r) => sum + r.hours, 0),
        };
      }),
    );
  }),
);

/** Fill programme/semesterNumber defaults for class writes. */
function classBody(body: {
  program: string;
  year: string;
  section?: string;
  programme?: string;
  semesterNumber?: number | null;
  studentCount?: number | null;
}) {
  return {
    program: body.program,
    year: body.year,
    section: body.section ?? "",
    programme: body.programme ?? body.program,
    semesterNumber: body.semesterNumber ?? parseSemesterNumber(body.year),
    studentCount: body.studentCount,
  };
}

router.post(
  "/classes",
  wrap(async (req, res) => {
    const body = parse(classSchema, req.body, res);
    if (!body) return;
    const deptId = await requireActiveDept(res);
    if (!deptId) return;
    const doc = await ClassSection.create({
      ...classBody(body),
      departmentId: new Types.ObjectId(deptId),
    });
    res.status(201).json({ id: doc._id.toString(), message: "Class saved." });
  }),
);

router.put(
  "/classes/:id",
  wrap(async (req, res) => {
    const body = parse(classSchema, req.body, res);
    if (!body) return;
    const deptId = await activeDeptId();
    if (deptId && body.studentCount !== undefined) {
      const previous = await ClassSection.findOne({ _id: req.params.id, ...scope(deptId) });
      if (previous && (previous.studentCount ?? null) !== body.studentCount && await RoutineEntry.exists({ ...scope(deptId), classId: previous._id })) {
        return void res.status(409).json({ error: "Clear the department routine before changing the size of a scheduled class." });
      }
    }
    const doc = deptId
      ? await ClassSection.findOneAndUpdate(
          { _id: req.params.id, ...scope(deptId) },
          classBody(body),
          { new: true },
        )
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
async function populatedEntries(departmentId?: string, member: { teacherId?: Types.ObjectId; classId?: Types.ObjectId } = {}) {
  return scheduleWrite(async () => {
    const department = departmentId ? await Department.findById(departmentId) : await getActiveDepartment();
    if (!department) return [];
    const filter = scope(department._id.toString());
    const [entries, subjects, teachers, classes, rooms] = await Promise.all([
      RoutineEntry.find({ ...publishedRoutineScope(department), ...member }).lean(),
      Subject.find(filter).lean(),
      Teacher.find(filter).lean(),
      ClassSection.find(filter).lean(),
      Room.find().lean(),
    ]);
    const sById = new Map(subjects.map((s) => [s._id.toString(), s]));
    const tById = new Map(teachers.map((t) => [t._id.toString(), t]));
    const cById = new Map(classes.map((c) => [c._id.toString(), c]));
    const roomById = new Map(rooms.map((room) => [room._id.toString(), room]));
    return entries.map((e) => {
      const s = sById.get(e.subjectId.toString());
      const t = tById.get(e.teacherId.toString());
      const c = cById.get(e.classId.toString());
      const room = e.roomId && roomById.get(e.roomId.toString());
      return {
        id: e._id.toString(),
        classId: e.classId.toString(),
        subjectId: e.subjectId.toString(),
        teacherId: e.teacherId.toString(),
        roomNumber: room?.number ?? null,
        roomFloor: room?.floor ?? null,
        roomCapacity: room?.capacity ?? null,
        sessionId: e.sessionId,
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
  });
}

export const personalRoutineRouter = Router();
personalRoutineRouter.get("/", wrap(async (_req, res) => {
  res.set("Cache-Control", "private, no-store");
  const { role, memberId } = accountFor(res);
  if (!memberId || role === "admin") return void res.json({ linked: false, entries: [] });
  const target = role === "teacher"
    ? await Teacher.findOne({ _id: memberId, isPlaceholder: { $ne: true } }).lean()
    : await ClassSection.findById(memberId).lean();
  if (!target) return void res.json({ linked: false, entries: [] });
  const departmentId = target.departmentId.toString();
  if (!await Department.exists({ _id: target.departmentId, parentDepartmentId: null })) {
    return void res.json({ linked: false, entries: [] });
  }
  const [config, entries] = await Promise.all([
    mergedScheduleConfig(departmentId),
    populatedEntries(departmentId, role === "teacher" ? { teacherId: memberId } : { classId: memberId }),
  ]);
  res.json({ linked: true, config, entries: entries.filter((entry) => entry.roomNumber !== null) });
}));

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
    const data = await loadSolverData(deptId);
    const rooms = await roomConstraints(deptId, data.classSizes);
    const checkRooms = rooms.rooms.length > 0 || Boolean(res.locals.account);
    if (checkRooms) {
      const problems = new Set<string>();
      for (const { classId, subjectId } of data.classSubjects) {
        const size = data.classSizes.get(classId);
        const name = data.classNames.get(classId) ?? "Unknown class";
        const type = data.subjects.get(subjectId)?.type;
        if (!size) problems.add(`${name}: enter the student count on the Classes page.`);
        else if (type && !rooms.rooms.some((room) => room.type === type && room.capacity >= size)) {
          problems.add(`${name}: no ${type === "lab" ? "lab" : "classroom"} has ${size} seats.`);
        }
      }
      if (problems.size) return void res.status(400).json({ error: [...problems].join("\n") });
    }
    const result = solve(data.teachers, data.subjects, data.classSubjects, data.config, 10, checkRooms ? rooms : undefined);
    if (result.success) {
      const filter = scope(deptId);
      const publicationId = new Types.ObjectId();
      try {
        await RoutineEntry.insertMany(result.entries.map((e) => ({ ...e, publicationId, departmentId: filter.departmentId })));
        await Department.findByIdAndUpdate(deptId, { publicationId });
      } catch (error) {
        await RoutineEntry.deleteMany({ ...filter, publicationId });
        throw error;
      }
      await RoutineEntry.deleteMany({ ...filter, publicationId: { $ne: publicationId } });
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
        : `The solver placed ${result.entries.length}/${totalPeriods} hours. Review unplaced sessions and try again.`,
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

async function entriesAsLikes(department?: Awaited<ReturnType<typeof getActiveDepartment>>): Promise<EntryLike[]> {
  if (department === undefined) department = await getActiveDepartment();
  if (!department) return [];
  const docs = await RoutineEntry.find(publishedRoutineScope(department)).lean();
  return docs.map((e) => ({
    id: e._id.toString(),
    classId: e.classId.toString(),
    subjectId: e.subjectId.toString(),
    teacherId: e.teacherId.toString(),
    roomId: e.roomId?.toString(),
    sessionId: e.sessionId,
    day: e.day,
    period: e.period,
  }));
}

async function movedRoomProblem(entries: EntryLike[], movingIds: string[]) {
  const rooms = [...new Set(entries.flatMap((entry) => entry.roomId ? [entry.roomId] : []))];
  if (!rooms.length) return null;
  const active = await getActiveDepartment();
  if (!active) return null;
  const other = await otherRoomReservations(active._id.toString());
  const bookings = await RoutineEntry.find({ $or: [active, ...other].map(publishedRoutineScope), roomId: { $in: rooms }, _id: { $nin: movingIds } }).lean();
  for (const entry of entries) {
    if (!entry.roomId) continue;
    const conflict = bookings.some((other) => other.roomId?.toString() === entry.roomId && other.day === entry.day && other.period === entry.period)
      || entries.some((other) => other.id !== entry.id && other.roomId === entry.roomId && other.day === entry.day && other.period === entry.period);
    if (conflict) return `The assigned room is already in use on ${entry.day} at period ${entry.period}.`;
  }
  return null;
}

router.post(
  "/routine/move",
  wrap(async (req, res) => {
    const body = parse(moveSchema, req.body, res);
    if (!body) return;
    const [entries, data] = await Promise.all([entriesAsLikes(), loadSolverData()]);
    if (!data.config.days.includes(body.day)) return void res.status(400).json({ error: "Choose a teaching day." });
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
    const roomProblem = await movedRoomProblem(block.map((e, i) => ({ ...e, day: body.day, period: body.period + i })), [...blockIds]);
    if (roomProblem) return void res.status(409).json({ error: `Move rejected: ${roomProblem}` });
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
    const roomProblem = await movedRoomProblem([...movedA, ...movedB], [...idsA, ...idsB]);
    if (roomProblem) return void res.status(409).json({ error: `Swap rejected: ${roomProblem}` });
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
    Teacher.find({ ...filter, isPlaceholder: { $ne: true } }).sort({ name: 1 }).lean(),
    Subject.find(filter).sort({ code: 1 }).lean(),
    ClassSection.find(filter).lean(),
    ClassSubject.find(filter).lean(),
  ]);
  const codeBySubjectId = new Map(subjectDocs.map((s) => [s._id.toString(), s.code]));
  const subjectById = new Map(subjectDocs.map((s) => [s._id.toString(), s]));
  const labelByClassId = new Map(
    classDocs.map((c) => [c._id.toString(), classLabel(c.program, c.year, c.section)]),
  );
  const input: BalanceInput = {
    teachers: teacherDocs.map((t) => ({
      code: t.code ?? "",
      name: t.name,
      weeklyMaxHours: teacherWeeklyLimit(t),
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
        hours: scheduledWeeklyHours(cs.hours, subjectById.get(cs.subjectId.toString())),
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
      subjects: raw.subjects.map((s) => ({ ...s, name: s.name ?? "", type: s.type ?? "theory" })),
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
    const subjectsByCode = new Map(body.subjects.map((subject) => [subject.code.toUpperCase(), subject]));
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
          hours: scheduledWeeklyHours(m.hours, subjectsByCode.get(m.subjectCode.toUpperCase())),
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
