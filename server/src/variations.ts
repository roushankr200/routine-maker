import { Types } from "mongoose";
import { deleteDepartmentData, publishedRoutineScope, scope, setActiveDepartment, variationKey } from "./departments.js";
import { ClassSection, ClassSubject, Department, RoutineEntry, Subject, Teacher, TeacherUnavailable, type IDepartment } from "./models.js";

type Workspace = Pick<IDepartment, "name" | "shortName" | "session" | "effectiveFrom" | "parentDepartmentId" | "publicationId"> & { _id: Types.ObjectId };

export async function copyRoutineVariation(source: Workspace, variationName: string) {
  const filter = scope(source._id.toString());
  const [subjects, classes, teachers, requirements, unavailable, routine] = await Promise.all([
    Subject.find(filter).lean(), ClassSection.find(filter).lean(), Teacher.find(filter).lean(),
    ClassSubject.find(filter).lean(), TeacherUnavailable.find(filter).lean(),
    RoutineEntry.find(publishedRoutineScope(source)).lean(),
  ]);
  const ids = (docs: { _id: Types.ObjectId }[]) => new Map(docs.map(({ _id }) => [_id.toString(), new Types.ObjectId()]));
  const subjectIds = ids(subjects);
  const classIds = ids(classes);
  const teacherIds = ids(teachers);
  const remap = (map: Map<string, Types.ObjectId>, id: Types.ObjectId) => {
    const mapped = map.get(id.toString());
    if (!mapped) throw new Error("The source variation contains a missing class, subject or teacher.");
    return mapped;
  };

  const publicationId = new Types.ObjectId();
  const workspace = await Department.create({
    name: source.name, shortName: source.shortName, session: source.session, effectiveFrom: source.effectiveFrom,
    parentDepartmentId: source.parentDepartmentId ?? source._id, variationName, variationKey: variationKey(variationName), publicationId,
  });
  const departmentId = workspace._id;
  try {
    await Subject.insertMany(subjects.map((doc) => ({ ...doc, departmentId, _id: remap(subjectIds, doc._id) })));
    await ClassSection.insertMany(classes.map((doc) => ({ ...doc, departmentId, _id: remap(classIds, doc._id) })));
    await Teacher.insertMany(teachers.map((doc) => ({
      ...doc, departmentId, _id: remap(teacherIds, doc._id), subjects: doc.subjects.map((id) => remap(subjectIds, id)),
    })));
    await ClassSubject.insertMany(requirements.map(({ _id, classId, subjectId, teacherId, ...doc }) => ({
      ...doc, departmentId, classId: remap(classIds, classId), subjectId: remap(subjectIds, subjectId),
      teacherId: teacherId && remap(teacherIds, teacherId),
    })));
    await TeacherUnavailable.insertMany(unavailable.map(({ _id, teacherId, ...doc }) => ({
      ...doc, departmentId, teacherId: remap(teacherIds, teacherId),
    })));
    await RoutineEntry.insertMany(routine.map(({ _id, classId, subjectId, teacherId, ...doc }) => ({
      ...doc, departmentId, publicationId, classId: remap(classIds, classId), subjectId: remap(subjectIds, subjectId),
      teacherId: remap(teacherIds, teacherId),
    })));
    await setActiveDepartment(departmentId);
  } catch (error) {
    await deleteDepartmentData(departmentId.toString());
    throw error;
  }
  return workspace;
}
