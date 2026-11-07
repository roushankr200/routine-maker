import {
  ClassSubject,
  ClassSection,
  Subject,
  Teacher,
  TeacherUnavailable,
  getOrCreateConfig,
} from "./models.js";
import {
  ClassSubjectData,
  ScheduleConfig,
  SubjectData,
  TeacherData,
  unavailableKey,
} from "./solver/types.js";
import { classLabel } from "./demoData.js";

export interface SolverDataset {
  teachers: Map<string, TeacherData>;
  subjects: Map<string, SubjectData>;
  classSubjects: ClassSubjectData[];
  config: ScheduleConfig;
  classNames: Map<string, string>;
}

/** Convert the MongoDB documents into the solver's plain-data shapes. */
export async function loadSolverData(): Promise<SolverDataset> {
  const [teacherDocs, subjectDocs, csDocs, unavDocs, classDocs, cfg] = await Promise.all([
    Teacher.find().sort({ name: 1 }),
    Subject.find().sort({ code: 1 }),
    ClassSubject.find(),
    TeacherUnavailable.find(),
    ClassSection.find(),
    getOrCreateConfig(),
  ]);

  const unavByTeacher = new Map<string, Set<string>>();
  for (const u of unavDocs) {
    const tid = u.teacherId.toString();
    if (!unavByTeacher.has(tid)) unavByTeacher.set(tid, new Set());
    unavByTeacher.get(tid)!.add(unavailableKey(u.day, u.period ?? null));
  }

  const teachers = new Map<string, TeacherData>();
  for (const t of teacherDocs) {
    const id = t._id.toString();
    teachers.set(id, {
      id,
      name: t.name,
      maxPerDay: t.maxPerDay,
      weeklyHours: t.weeklyHours,
      subjects: new Set(t.subjects.map((s) => s.toString())),
      unavailable: unavByTeacher.get(id) ?? new Set(),
    });
  }

  const subjects = new Map<string, SubjectData>();
  for (const s of subjectDocs) {
    const id = s._id.toString();
    subjects.set(id, {
      id,
      name: s.name,
      code: s.code,
      type: s.type,
      sessionHours: s.sessionHours ?? (s.type === "lab" ? 3 : 2),
    });
  }

  const classSubjects: ClassSubjectData[] = csDocs.map((cs) => ({
    classId: cs.classId.toString(),
    subjectId: cs.subjectId.toString(),
    hours: cs.hours,
  }));

  const classNames = new Map<string, string>();
  for (const c of classDocs) {
    classNames.set(c._id.toString(), classLabel(c.program, c.year, c.section));
  }

  const config: ScheduleConfig = {
    days: cfg.days,
    periodsPerDay: cfg.periodsPerDay,
    lunchAfter: cfg.lunchAfter ?? null,
    periodDuration: cfg.periodDuration,
    startTime: cfg.startTime,
    session: cfg.session,
    effectiveFrom: cfg.effectiveFrom,
    department: cfg.department,
    departmentShort: cfg.departmentShort,
  };
  return { teachers, subjects, classSubjects, config, classNames };
}

/**
 * Pre-flight data validation (FR10): reports problems in plain words,
 * e.g. "DBMS needs 12 periods/week but DBMS teachers can take only 10".
 */
export function validateData(data: SolverDataset): {
  issues: string[];
  warnings: string[];
  slotsPerWeek: number;
  demandBySubject: Array<{
    subjectId: string;
    subject: SubjectData;
    demand: number;
    capacity: number;
    teachers: string[];
  }>;
  demandByClass: Array<{ classId: string; className: string; total: number }>;
} {
  const { teachers, subjects, classSubjects, config, classNames } = data;
  const issues: string[] = [];
  const warnings: string[] = [];
  const slotsPerWeek = config.days.length * config.periodsPerDay;

  const demandMap = new Map<string, number>();
  const classDemandMap = new Map<string, number>();
  for (const cs of classSubjects) {
    demandMap.set(cs.subjectId, (demandMap.get(cs.subjectId) ?? 0) + cs.hours);
    classDemandMap.set(cs.classId, (classDemandMap.get(cs.classId) ?? 0) + cs.hours);
    const subject = subjects.get(cs.subjectId);
    if (subject) {
      const sh = subject.sessionHours;
      const rem = cs.hours % sh;
      if (rem !== 0) {
        warnings.push(
          `${subject.name}: ${cs.hours}h/week at ${sh}h per session leaves one shorter ${rem}h session for one class.`,
        );
      }
      const longestSegment =
        config.lunchAfter === null
          ? config.periodsPerDay
          : Math.max(config.lunchAfter, config.periodsPerDay - config.lunchAfter);
      if (sh > longestSegment) {
        issues.push(
          `${subject.name}: a ${sh}h session cannot fit in any morning/afternoon segment (longest is ${longestSegment}h).`,
        );
      }
    }
  }

  const demandBySubject = [...demandMap.entries()].map(([sid, demand]) => {
    const eligible = [...teachers.values()].filter((t) => t.subjects.has(sid));
    const capacity = eligible.reduce((sum, t) => sum + t.weeklyHours, 0);
    const subject = subjects.get(sid)!;
    if (eligible.length === 0) {
      issues.push(`${subject.name} needs ${demand} periods/week but NO teacher can teach it (H6).`);
    } else if (demand > capacity) {
      issues.push(
        `${subject.name} needs ${demand} periods/week but eligible teachers' combined weekly cap is ${capacity}.`,
      );
    }
    return { subjectId: sid, subject, demand, capacity, teachers: eligible.map((t) => t.name) };
  });

  const demandByClass = [...classDemandMap.entries()].map(([cid, total]) => {
    if (total > slotsPerWeek) {
      issues.push(
        `${classNames.get(cid) ?? cid} needs ${total} periods but the week only has ${slotsPerWeek} slots.`,
      );
    }
    return { classId: cid, className: classNames.get(cid) ?? cid, total };
  });

  for (const t of teachers.values()) {
    if (t.subjects.size === 0) warnings.push(`Teacher ${t.name} has no subjects assigned.`);
  }
  if (classSubjects.length === 0) {
    warnings.push(
      "No class-subject hours defined yet — add them on the Classes page or load demo data.",
    );
  }
  return { issues, warnings, slotsPerWeek, demandBySubject, demandByClass };
}
