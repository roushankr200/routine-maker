import {
  DEMO_CLASS_SUBJECTS,
  DEMO_CLASSES,
  DEMO_CONFIG,
  DEMO_PERIOD_DURATION,
  DEMO_SUBJECTS,
  DEMO_TEACHERS,
  DEMO_UNAVAILABLE,
} from "./demoData.js";
import {
  ClassSection,
  ClassSubject,
  Config,
  Department,
  RoutineEntry,
  Subject,
  Teacher,
  TeacherUnavailable,
} from "./models.js";
import {
  deleteScopedData,
  findDepartmentByName,
  scope,
  setActiveDepartment,
} from "./departments.js";

/**
 * Load the built-in NIT Agartala CSE department.
 *
 * Multi-department rule: this touches ONLY the CSE department. If CSE
 * does not exist yet it is created; if it does, only CSE's own scoped
 * data is refreshed (the demo reload). Every other department in the
 * workspace is left exactly as it was. CSE becomes the active
 * department either way.
 */
export async function loadDemoData(): Promise<{
  teachers: number;
  subjects: number;
  classes: number;
  created: boolean;
  departmentId: string;
}> {
  const deptName = DEMO_CONFIG.department ?? "Computer Science and Engineering";
  const existing = await findDepartmentByName(deptName);
  const created = !existing;

  let deptId: string;
  if (existing) {
    // Refresh ONLY CSE's own scoped data — never another department's.
    // The department document (and its id) is kept and updated in place.
    deptId = existing._id.toString();
    await deleteScopedData(deptId);
    await Department.findByIdAndUpdate(deptId, {
      shortName: DEMO_CONFIG.departmentShort ?? "CSE",
      session: DEMO_CONFIG.session ?? "ODD 2026",
      effectiveFrom: DEMO_CONFIG.effectiveFrom ?? "27/07/2026",
    });
  } else {
    const dept = await Department.create({
      name: deptName,
      shortName: DEMO_CONFIG.departmentShort ?? "CSE",
      session: DEMO_CONFIG.session ?? "ODD 2026",
      effectiveFrom: DEMO_CONFIG.effectiveFrom ?? "27/07/2026",
    });
    deptId = dept._id.toString();
  }
  const filter = scope(deptId);

  // The institute-fixed grid lives in Config (shared by all
  // departments); the demo seed keeps it at the NITA standard values.
  await Config.findOneAndUpdate(
    {},
    {
      days: DEMO_CONFIG.days,
      periodsPerDay: DEMO_CONFIG.periodsPerDay,
      lunchAfter: DEMO_CONFIG.lunchAfter,
      periodDuration: DEMO_CONFIG.periodDuration ?? DEMO_PERIOD_DURATION,
      startTime: DEMO_CONFIG.startTime ?? "09:00",
    },
    { upsert: true },
  );

  const codeToId = new Map<string, string>();
  for (const [name, code, type, sessionHours] of DEMO_SUBJECTS) {
    const doc = await Subject.create({ ...filter, name, code, type, sessionHours });
    codeToId.set(code, doc._id.toString());
  }

  const nameToId = new Map<string, string>();
  for (const [name, code, designation, maxPerDay, weeklyHours, codes] of DEMO_TEACHERS) {
    const doc = await Teacher.create({
      ...filter,
      name,
      code,
      designation,
      maxPerDay,
      weeklyHours,
      subjects: codes.map((c) => codeToId.get(c)),
    });
    nameToId.set(name, doc._id.toString());
  }

  const classIds: string[] = [];
  for (const [program, year, section] of DEMO_CLASSES) {
    const doc = await ClassSection.create({ ...filter, program, year, section });
    classIds.push(doc._id.toString());
  }

  for (let idx = 0; idx < DEMO_CLASS_SUBJECTS.length; idx++) {
    for (const [code, hours] of Object.entries(DEMO_CLASS_SUBJECTS[idx])) {
      await ClassSubject.create({
        ...filter,
        classId: classIds[idx],
        subjectId: codeToId.get(code),
        hours,
      });
    }
  }

  for (const [teacherName, slots] of Object.entries(DEMO_UNAVAILABLE)) {
    for (const [day, period] of slots) {
      await TeacherUnavailable.create({
        ...filter,
        teacherId: nameToId.get(teacherName),
        day,
        period,
      });
    }
  }

  await setActiveDepartment(deptId);

  return {
    teachers: DEMO_TEACHERS.length,
    subjects: DEMO_SUBJECTS.length,
    classes: DEMO_CLASSES.length,
    created,
    departmentId: deptId,
  };
}
