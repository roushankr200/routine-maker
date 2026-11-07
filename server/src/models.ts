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
 *   RoutineEntry    (was: routine_entry — one row per hourly slot;
 *                    a session occupies several consecutive rows)
 */

/**
 * Department — one institute department (CSE, ECE, …). Departments
 * coexist: each owns its own teachers / subjects / classes / routine,
 * scoped by `departmentId` on every data document. Creating a
 * department NEVER touches another department's data; a department is
 * removed only by the explicit DELETE /api/departments/:id action.
 */
export interface IDepartment {
  name: string;
  shortName: string;
  /** Session label printed on the master sheet, e.g. "ODD 2026". */
  session: string;
  /** "w.e.f." date text printed on the master sheet, e.g. "27/07/2026". */
  effectiveFrom: string;
  createdAt: Date;
  updatedAt: Date;
}
const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    session: { type: String, default: "ODD 2026" },
    effectiveFrom: { type: String, default: "" },
  },
  { timestamps: true },
);
export const Department = mongoose.model<IDepartment>("Department", departmentSchema);

const departmentRef = {
  type: Schema.Types.ObjectId,
  ref: "Department",
  required: true,
  index: true,
} as const;

export interface ITeacher {
  departmentId: Types.ObjectId;
  name: string;
  /** Short faculty code as printed on the master sheet, e.g. "DJB". */
  code: string;
  designation: string;
  maxPerDay: number;
  weeklyHours: number;
  /** Eligibility (H6): subjects this teacher can teach. */
  subjects: Types.ObjectId[];
}
const teacherSchema = new Schema<ITeacher>({
  departmentId: departmentRef,
  name: { type: String, required: true },
  code: { type: String, default: "" },
  designation: { type: String, default: "" },
  maxPerDay: { type: Number, required: true, default: 4 },
  weeklyHours: { type: Number, required: true, default: 16 },
  subjects: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
});
export const Teacher = mongoose.model<ITeacher>("Teacher", teacherSchema);

export interface ISubject {
  departmentId: Types.ObjectId;
  name: string;
  code: string;
  type: "theory" | "lab";
  /**
   * Length (hours) of one session on the hourly grid: theory 1–2
   * (default 2), lab 2–3 (default 3) — the real NITA sheet's blocks.
   */
  sessionHours: number;
}
const subjectSchema = new Schema<ISubject>({
  departmentId: departmentRef,
  name: { type: String, required: true },
  code: { type: String, required: true },
  type: { type: String, enum: ["theory", "lab"], required: true },
  sessionHours: {
    type: Number,
    default: function (this: ISubject) {
      return this.type === "lab" ? 3 : 2;
    },
  },
});
export const Subject = mongoose.model<ISubject>("Subject", subjectSchema);

export interface IClassSection {
  departmentId: Types.ObjectId;
  program: string;
  year: string;
  section: string;
}
const classSectionSchema = new Schema<IClassSection>({
  departmentId: departmentRef,
  program: { type: String, required: true },
  year: { type: String, required: true },
  section: { type: String, default: "" },
});
export const ClassSection = mongoose.model<IClassSection>("ClassSection", classSectionSchema);

export interface IClassSubject {
  departmentId: Types.ObjectId;
  classId: Types.ObjectId;
  subjectId: Types.ObjectId;
  hours: number;
}
const classSubjectSchema = new Schema<IClassSubject>({
  departmentId: departmentRef,
  classId: { type: Schema.Types.ObjectId, ref: "ClassSection", required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  hours: { type: Number, required: true },
});
classSubjectSchema.index({ classId: 1, subjectId: 1 }, { unique: true });
export const ClassSubject = mongoose.model<IClassSubject>("ClassSubject", classSubjectSchema);

export interface ITeacherUnavailable {
  departmentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  day: string;
  /** null = the whole day is blocked. */
  period: number | null;
}
const teacherUnavailableSchema = new Schema<ITeacherUnavailable>({
  departmentId: departmentRef,
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
  /** Day start "HH:MM" (24h) — period clock times are derived from it. */
  startTime: string;
  /** Session label printed on the master sheet, e.g. "ODD 2026". */
  session: string;
  /** "w.e.f." date text printed on the master sheet, e.g. "27/07/2026". */
  effectiveFrom: string;
  /**
   * The department using the product. The INSTITUTE is a product
   * constant (NIT Agartala — never a config field); only the
   * department varies per user of the product.
   */
  department: string;
  /** Short department name for the masthead, e.g. "CSE". */
  departmentShort: string;
  /**
   * The currently ACTIVE department. All data endpoints operate on
   * this department only. (Legacy department/departmentShort/session/
   * effectiveFrom fields above remain as fallbacks for a fresh DB
   * with no departments yet, and as the backfill source.)
   */
  activeDepartmentId: Types.ObjectId | null;
}
const configSchema = new Schema<IConfig>({
  // NITA pattern (real CSE master routine, ODD 2026): Mon–Fri, hourly
  // grid of 7 slots, 9:00 start, lunch 1:00–2:00 after P4. Sessions are
  // blocks merged across hours (theory 1–2h, labs 2–3h).
  days: { type: [String], default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
  periodsPerDay: { type: Number, default: 7 },
  lunchAfter: { type: Number, default: 4 },
  periodDuration: { type: Number, default: 60 },
  startTime: { type: String, default: "09:00" },
  session: { type: String, default: "ODD 2026" },
  effectiveFrom: { type: String, default: "27/07/2026" },
  department: { type: String, default: "Computer Science and Engineering" },
  departmentShort: { type: String, default: "CSE" },
  activeDepartmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
});
export const Config = mongoose.model<IConfig>("Config", configSchema);

export interface IRoutineEntry {
  departmentId: Types.ObjectId;
  classId: Types.ObjectId;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  day: string;
  period: number;
}
const routineEntrySchema = new Schema<IRoutineEntry>({
  departmentId: departmentRef,
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
