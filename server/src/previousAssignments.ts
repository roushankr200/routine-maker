import { findDepartmentByName, publishedRoutineScope, scope } from "./departments.js";
import { buildDemoSolverData, DEMO_CLASSES, DEMO_SUBJECTS, DEMO_TEACHERS, parseSemesterNumber } from "./demoData.js";
import { ClassSection, RoutineEntry, Subject, Teacher } from "./models.js";
import { solve } from "./solver/solver.js";
import { teacherWeeklyLimit } from "./solver/types.js";

interface AssignmentRow {
  programme: string;
  semester: number;
  section: string;
  subjectCode: string;
  syllabusCode: string;
  teacher: { name: string; code: string; designation: string; weeklyHours: number };
}

function primaryTeachers<T extends { classId: string; subjectId: string; teacherId: string }>(entries: T[]): T[] {
  const counts = new Map<string, Map<string, { entry: T; hours: number }>>();
  for (const entry of entries) {
    const key = `${entry.classId}|${entry.subjectId}`;
    const teachers = counts.get(key) ?? new Map();
    const previous = teachers.get(entry.teacherId);
    teachers.set(entry.teacherId, { entry, hours: (previous?.hours ?? 0) + 1 });
    counts.set(key, teachers);
  }
  return [...counts.values()].flatMap((teachers) => {
    const ranked = [...teachers.values()].sort((a, b) => b.hours - a.hours);
    return ranked[0].hours === ranked[1]?.hours ? [] : [ranked[0].entry];
  });
}

function cseSample(): AssignmentRow[] {
  const { teachers, subjects, classSubjects, config } = buildDemoSolverData();
  const result = solve(teachers, subjects, classSubjects, config);
  const codes = new Map(DEMO_SUBJECTS.map(([, code, , , , syllabusCode]) => [code, syllabusCode]));
  return primaryTeachers(result.entries).map((entry) => {
    const [programme, , section, semester] = DEMO_CLASSES[Number(entry.classId.slice(1)) - 1];
    const [name, code, designation, , weeklyHours] = DEMO_TEACHERS[Number(entry.teacherId.slice(1)) - 1];
    return { programme, semester, section, subjectCode: entry.subjectId, syllabusCode: codes.get(entry.subjectId) ?? "", teacher: { name, code, designation, weeklyHours } };
  });
}

export async function previousAssignments(departmentName: string, useCseSample: boolean) {
  const department = await findDepartmentByName(departmentName);
  if (department) {
    const entries = await RoutineEntry.find(publishedRoutineScope(department)).lean();
    if (entries.length) {
      const filter = scope(department._id.toString());
      const [classes, subjects, teachers] = await Promise.all([
        ClassSection.find(filter).lean(), Subject.find(filter).lean(),
        Teacher.find({ ...filter, isPlaceholder: { $ne: true } }).lean(),
      ]);
      const classesById = new Map(classes.map((row) => [row._id.toString(), row]));
      const subjectsById = new Map(subjects.map((row) => [row._id.toString(), row]));
      const teachersById = new Map(teachers.map((row) => [row._id.toString(), row]));
      const rows = primaryTeachers(entries.map((row) => ({
        classId: row.classId.toString(), subjectId: row.subjectId.toString(), teacherId: row.teacherId.toString(),
      }))).flatMap(({ classId, subjectId, teacherId }): AssignmentRow[] => {
        const cls = classesById.get(classId);
        const subject = subjectsById.get(subjectId);
        const teacher = teachersById.get(teacherId);
        const semester = cls?.semesterNumber ?? (cls && parseSemesterNumber(cls.year));
        if (!cls || !subject || !teacher || !semester) return [];
        const { name, code, designation } = teacher;
        const weeklyHours = teacherWeeklyLimit(teacher);
        return [{ programme: cls.programme || cls.program, semester, section: cls.section, subjectCode: subject.code,
          syllabusCode: subject.syllabusCode, teacher: { name, code, designation, weeklyHours } }];
      });
      return { source: department.session || "Saved routine", rows };
    }
  }
  return useCseSample ? { source: "CSE Odd 2026 sample", rows: cseSample() } : { source: null, rows: [] };
}
