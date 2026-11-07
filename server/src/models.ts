import mongoose, { HydratedDocument, Schema, Types } from "mongoose";

/**
 * Mongoose models — the MongoDB mirror of the original relational schema:
 *
 *   Teacher         (was: teacher + teacher_subject eligibility)
 *   Subject         (was: subject)
 *   ClassSection    (was: class_section)
 *   ClassSubject    (was: class_subject — hours per class per subject)
 *   TeacherUnavailable (was: teacher_unavailable; period null = full day)
 *   Config          (was: config — single document, _id "singleton")
 *   RoutineEntry    (was: routine_entry — one row per single period)
 */

export interface ITeacher {
  name: string;
  designation: string;
  maxPerDay: number;
  weeklyHours: number;
  /** Eligibility (H6): subjects this teacher can teach. */
  subjects: Types.ObjectId[];
}
const teacherSchema = new Schema<ITeacher>({
  name: { type: String, required: true },
  designation: { type: String, default: "" },
  maxPerDay: { type: Number, required: true, default: 4 },
  weeklyHours: { type: Number, required: true, default: 16 },
  subjects: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
});
export const Teacher = mongoose.model<ITeacher>("Teacher", teacherSchema);

export interface ISubject {
  name: string;
  code: string;
  type: "theory" | "lab";
}
const subjectSchema = new Schema<ISubject>({
  name: { type: String, required: true },
  code: { type: String, required: true },
  type: { type: String, enum: ["theory", "lab"], required: true },
});
export const Subject = mongoose.model<ISubject>("Subject", subjectSchema);

export interface IClassSection {
  program: string;
  year: string;
  section: string;
}
const classSectionSchema = new Schema<IClassSection>({
  program: { type: String, required: true },
  year: { type: String, required: true },
  section: { type: String, default: "" },
});
export const ClassSection = mongoose.model<IClassSection>("ClassSection", classSectionSchema);

export interface IClassSubject {
  classId: Types.ObjectId;
  subjectId: Types.ObjectId;
  hours: number;
}
const classSubjectSchema = new Schema<IClassSubject>({
  classId: { type: Schema.Types.ObjectId, ref: "ClassSection", required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  hours: { type: Number, required: true },
});
classSubjectSchema.index({ classId: 1, subjectId: 1 }, { unique: true });
export const ClassSubject = mongoose.model<IClassSubject>("ClassSubject", classSubjectSchema);

export interface ITeacherUnavailable {
  teacherId: Types.ObjectId;
  day: string;
  /** null = the whole day is blocked. */
  period: number | null;
}
const teacherUnavailableSchema = new Schema<ITeacherUnavailable>({
  teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
  day: { type: String, required: true },
  period: { type: Number, default: null },
});
export const TeacherUnavailable = mongoose.model<ITeacherUnavailable>(
  "TeacherUnavailable",
  teacherUnavailableSchema,
);

export interface IConfig {
  days: string[];
  periodsPerDay: number;
  lunchAfter: number | null;
  periodDuration: number;
}
const configSchema = new Schema<IConfig>({
  days: { type: [String], default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] },
  periodsPerDay: { type: Number, default: 7 },
  lunchAfter: { type: Number, default: 4 },
  periodDuration: { type: Number, default: 50 },
});
export const Config = mongoose.model<IConfig>("Config", configSchema);

export interface IRoutineEntry {
  classId: Types.ObjectId;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  day: string;
  period: number;
}
const routineEntrySchema = new Schema<IRoutineEntry>({
  classId: { type: Schema.Types.ObjectId, ref: "ClassSection", required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
  day: { type: String, required: true },
  period: { type: Number, required: true },
});
export const RoutineEntry = mongoose.model<IRoutineEntry>("RoutineEntry", routineEntrySchema);

export type ConfigDoc = HydratedDocument<IConfig>;

export async function getOrCreateConfig(): Promise<ConfigDoc> {
  let cfg = await Config.findOne();
  if (!cfg) cfg = await Config.create({});
  return cfg;
}
