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
    /** Syllabus credits (from the catalogue for syllabus subjects). */
    credits: z.coerce.number().int().min(0).max(40).default(0),
    /** Code as printed in the syllabus document, e.g. "UCS03B08". */
    syllabusCode: z.string().trim().max(24).default(""),
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
  /** Programme classification for master-sheet grouping (defaults to program). */
  programme: z.string().trim().max(40).optional(),
  /** Numeric semester when known; the route derives it from `year` otherwise. */
  semesterNumber: z.coerce.number().int().min(1).max(12).nullable().optional(),
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

// ------------------------------------------------------- load balance
/**
 * POST /api/balance/preview — a coverage & balance panel over
 * not-yet-saved setup state.
 *
 * Same code-based cross-references as the setup payload (courses
 * and mapping by CODE, classes by index), but deliberately more
 * lenient: the panel runs on half-typed state, so teacher names
 * may still be blank and courses may carry just a code. Structural
 * problems (hours out of range, references to unknown course codes,
 * duplicate codes) are rejected by the route with a problems list.
 */
export const balancePreviewSchema = z.object({
  classes: z.array(classSchema).max(40).default([]),
  subjects: z
    .array(
      z.object({
        code: z.string().trim().min(1, "course code is required"),
        name: z.string().trim().default(""),
        type: z.enum(["theory", "lab"]).default("theory"),
        sessionHours: z.coerce.number().int().min(1).max(3).optional(),
      }),
    )
    .min(1, "at least one course is required")
    .max(80),
  teachers: z
    .array(
      z.object({
        name: z.string().trim().default(""),
        code: z.string().trim().max(12).default(""),
        weeklyHours: z.coerce.number().int().min(0).max(80),
        /** Courses this teacher can teach — course CODES. */
        subjects: z.array(z.string().trim().min(1)).default([]),
      }),
    )
    .min(1, "at least one teacher is required")
    .max(80),
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

// ------------------------------------------------------- unified setup
/**
 * POST /api/setup/guided — the ONE department setup (v2.4).
 *
 * The client walks the selected department's CATALOGUE (when it has
 * one) semester by semester and sends DECISIONS: which teachers exist
 * (the pool — website-preloaded by derived faculty code, or manual)
 * and, per class, which teacher takes each preloaded subject (or "XX"
 * = no teacher yet) and which option each elective slot takes.
 * Subject hours, credits and session lengths are NEVER taken from the
 * client for catalogue subjects — the route re-resolves them from the
 * server-side catalogue. The only client-supplied numbers are:
 *  - manually added subjects (customSubjects), validated here;
 *  - per-assignment numbers for catalogue subjects whose syllabus
 *    prints none (Production B.Tech) — REQUIRED there, route-checked.
 * Classes flagged `custom: true` have no catalogue at all: every
 * subject is a customSubject (the old wizard's job, in this endpoint).
 */
export const guidedCustomSubjectSchema = z
  .object({
    shortCode: z.string().trim().min(1, "subject code is required").max(24),
    title: z.string().trim().min(1, "subject title is required").max(120),
    kind: z.enum(["theory", "lab", "seminar"]).default("theory"),
    weeklyHours: z.coerce.number().int().min(1).max(35),
    sessionHours: z.coerce.number().int().min(1).max(3),
    credits: z.number().min(0).max(40),
  })
  .superRefine((subject, ctx) => {
    if (subject.sessionHours > subject.weeklyHours) {
      ctx.addIssue({
        code: "custom",
        path: ["sessionHours"],
        message: "session length must not exceed the subject's weekly hours",
      });
    }
  });

export const guidedSetupSchema = z.object({
  /** Catalogue id (CSE, CIVIL, …); omit for a fully manual department. */
  catalogueId: z.string().trim().min(1).optional(),
  /** Registry department whose website faculty list is preloaded. */
  facultyDeptId: z.string().trim().min(1).optional(),
  department: z.object({
    name: z.string().trim().min(1, "department name is required").max(80),
    short: z.string().trim().min(1, "department short name is required").max(12),
    session: z.string().trim().min(1).max(40).default("ODD 2026"),
    effectiveFrom: z.string().trim().max(20).default(""),
  }),
  teachers: z
    .array(
      z.object({
        /**
         * Derived faculty code (e.g. "PPS") of a website-listed
         * teacher. When set, `name`/`designation` are IGNORED — the
         * server re-resolves them from the faculty registry.
         */
        facultyCode: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).optional(),
        code: z.string().trim().min(1, "teacher code is required").max(12),
        designation: z.string().trim().default(""),
        maxPerDay: z.coerce.number().int().min(0).max(20).default(5),
        /** The teacher's weekly max hours — assignments may not exceed it. */
        weeklyHours: z.coerce.number().int().min(0).max(80),
      }),
    )
    .min(1, "at least one teacher is required")
    .max(120),
  classes: z
    .array(
      z.object({
        programme: z.string().trim().min(1),
        /** M.Tech specialisation, exactly as named in the catalogue. */
        specialisation: z.string().trim().max(60).optional(),
        semester: z.coerce.number().int().min(1).max(12),
        section: z.string().trim().max(20).default(""),
        /** B.Tech Sem 1/2 section variant: "I" | "II". */
        group: z.enum(["I", "II"]).optional(),
        /** True = a manual class: no catalogue, all subjects custom. */
        custom: z.boolean().default(false),
        /** Manually added subjects for this class (any setup path). */
        customSubjects: z.array(guidedCustomSubjectSchema).max(40).default([]),
        assignments: z
          .array(
            z.object({
              /** Catalogue subject key, or a customSubjects shortCode. */
              key: z.string().trim().min(1),
              /** Teacher CODE from the pool, or "XX" = no teacher yet. */
              teacherCode: z.string().trim().min(1),
              /** For elective slots: the picked option's shortCode. */
              electivePick: z.string().trim().min(1).optional(),
              /**
               * For elective slots the syllabus prints NO pool for:
               * the manually entered chosen subject.
               */
              customPick: z
                .object({
                  shortCode: z.string().trim().min(1).max(24),
                  title: z.string().trim().min(1).max(120),
                })
                .optional(),
              /**
               * Numbers for a catalogue subject whose syllabus prints
               * none (Production) — REQUIRED there, ignored otherwise.
               */
              weeklyHours: z.coerce.number().int().min(1).max(35).optional(),
              sessionHours: z.coerce.number().int().min(1).max(3).optional(),
              credits: z.number().min(0).max(40).optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1, "at least one class is required")
    .max(60),
});
