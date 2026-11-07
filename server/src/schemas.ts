import { z } from "zod";

export const teacherSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  /** Faculty code printed on the master sheet (e.g. "DJB"); optional. */
  code: z.string().trim().max(12).default(""),
  designation: z.string().trim().default(""),
  maxPerDay: z.coerce.number().int().min(0).max(20),
  weeklyHours: z.coerce.number().int().min(0).max(80),
  subjects: z.array(z.string()).default([]),
});

export const subjectSchema = z
  .object({
    name: z.string().trim().min(1, "name is required"),
    code: z.string().trim().min(1, "code is required"),
    type: z.enum(["theory", "lab"]),
    /**
     * Session length in hours on the hourly grid. Optional on input —
     * the route fills the type default (theory 2, lab 3) when omitted.
     */
    sessionHours: z.coerce.number().int().min(1).max(3).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.sessionHours === undefined) return;
    if (v.type === "theory" && v.sessionHours > 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionHours"],
        message: "theory sessions are 1 or 2 hours",
      });
    }
    if (v.type === "lab" && v.sessionHours < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionHours"],
        message: "lab sessions are 2 or 3 hours",
      });
    }
  });

export const classSchema = z.object({
  program: z.string().trim().min(1, "program is required"),
  year: z.string().trim().min(1, "year is required"),
  section: z.string().trim().default(""),
});

export const classSubjectSchema = z.object({
  subjectId: z.string().min(1),
  hours: z.coerce.number().int().min(0).max(60),
});

export const configSchema = z.object({
  days: z.array(z.string().trim().min(1)).min(1).max(7),
  periodsPerDay: z.coerce.number().int().min(1).max(12),
  lunchAfter: z.coerce.number().int().min(0).max(12).nullable().default(null),
  periodDuration: z.coerce.number().int().min(5).max(240).default(60),
  startTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "start time must be HH:MM (24h)")
    .default("09:00"),
  session: z.string().trim().max(40).default("ODD 2026"),
  effectiveFrom: z.string().trim().max(20).default("27/07/2026"),
  department: z.string().trim().min(1).max(80).default("Computer Science and Engineering"),
  departmentShort: z.string().trim().min(1).max(12).default("CSE"),
});

export const availabilitySchema = z.object({
  /** Array of "Day|period" strings; period "null" blocks the whole day. */
  blocked: z.array(z.string()).default([]),
});

export const moveSchema = z.object({
  entryId: z.string().min(1),
  day: z.string().min(1),
  period: z.coerce.number().int().min(1),
});

export const swapSchema = z.object({
  entryA: z.string().min(1),
  entryB: z.string().min(1),
});

// ------------------------------------------------------- department wizard
/**
 * POST /api/setup/department — the New Department wizard payload.
 *
 * One self-contained document: department identity (Step 1), classes
 * (Step 2), courses (Step 3), teachers (Step 4) and the class→course
 * weekly-hours mapping (Step 5). Cross-references inside the payload
 * use the course CODE (what the wizard displays), never database ids.
 * The institute (NIT Agartala) and the time grid are product constants
 * and are deliberately NOT part of this payload.
 */
export const wizardTeacherSchema = z.object({
  name: z.string().trim().min(1, "teacher name is required"),
  code: z.string().trim().max(12).default(""),
  designation: z.string().trim().default(""),
  maxPerDay: z.coerce.number().int().min(0).max(20),
  weeklyHours: z.coerce.number().int().min(0).max(80),
  /** Courses this teacher can teach — course CODES from Step 3. */
  subjects: z.array(z.string().trim().min(1)).default([]),
  /** Optional whole-day unavailability, e.g. "Saturday" / "Friday". */
  unavailableDay: z.string().trim().max(20).nullable().default(null),
});

export const departmentSetupSchema = z.object({
  department: z.object({
    name: z.string().trim().min(1, "department name is required").max(80),
    short: z.string().trim().min(1, "department short name is required").max(12),
    session: z.string().trim().min(1).max(40).default("ODD 2026"),
    effectiveFrom: z.string().trim().max(20).default(""),
  }),
  classes: z.array(classSchema).min(1, "at least one class is required").max(40),
  subjects: z.array(subjectSchema).min(1, "at least one course is required").max(80),
  teachers: z.array(wizardTeacherSchema).min(1, "at least one teacher is required").max(80),
  classSubjects: z
    .array(
      z.object({
        classIndex: z.coerce.number().int().min(0),
        subjectCode: z.string().trim().min(1),
        hours: z.coerce.number().int().min(0).max(60),
      }),
    )
    .default([]),
});
