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
  RoutineEntry,
  Subject,
  Teacher,
  TeacherUnavailable,
} from "./models.js";

/** Replace ALL data with the NITA CSE MCA dataset (same data as the tests use). */
export async function loadDemoData(): Promise<{ teachers: number; subjects: number; classes: number }> {
  await Promise.all([
    RoutineEntry.deleteMany({}),
    TeacherUnavailable.deleteMany({}),
    ClassSubject.deleteMany({}),
    Teacher.deleteMany({}),
    Subject.deleteMany({}),
    ClassSection.deleteMany({}),
  ]);

  await Config.findOneAndUpdate(
    {},
    {
      days: DEMO_CONFIG.days,
      periodsPerDay: DEMO_CONFIG.periodsPerDay,
      lunchAfter: DEMO_CONFIG.lunchAfter,
      periodDuration: DEMO_CONFIG.periodDuration ?? DEMO_PERIOD_DURATION,
      startTime: DEMO_CONFIG.startTime ?? "09:00",
      session: DEMO_CONFIG.session ?? "ODD 2026",
      effectiveFrom: DEMO_CONFIG.effectiveFrom ?? "27/07/2026",
      department: DEMO_CONFIG.department ?? "Computer Science and Engineering",
      departmentShort: DEMO_CONFIG.departmentShort ?? "CSE",
    },
    { upsert: true },
  );

  const codeToId = new Map<string, string>();
  for (const [name, code, type, sessionHours] of DEMO_SUBJECTS) {
    const doc = await Subject.create({ name, code, type, sessionHours });
    codeToId.set(code, doc._id.toString());
  }

  const nameToId = new Map<string, string>();
  for (const [name, code, designation, maxPerDay, weeklyHours, codes] of DEMO_TEACHERS) {
    const doc = await Teacher.create({
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
    const doc = await ClassSection.create({ program, year, section });
    classIds.push(doc._id.toString());
  }

  for (let idx = 0; idx < DEMO_CLASS_SUBJECTS.length; idx++) {
    for (const [code, hours] of Object.entries(DEMO_CLASS_SUBJECTS[idx])) {
      await ClassSubject.create({
        classId: classIds[idx],
        subjectId: codeToId.get(code),
        hours,
      });
    }
  }

  for (const [teacherName, slots] of Object.entries(DEMO_UNAVAILABLE)) {
    for (const [day, period] of slots) {
      await TeacherUnavailable.create({ teacherId: nameToId.get(teacherName), day, period });
    }
  }

  return { teachers: DEMO_TEACHERS.length, subjects: DEMO_SUBJECTS.length, classes: DEMO_CLASSES.length };
}
