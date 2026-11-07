import { z } from "zod";

export const teacherSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  designation: z.string().trim().default(""),
  maxPerDay: z.coerce.number().int().min(0).max(20),
  weeklyHours: z.coerce.number().int().min(0).max(80),
  subjects: z.array(z.string()).default([]),
});

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  code: z.string().trim().min(1, "code is required"),
  type: z.enum(["theory", "lab"]),
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
  periodDuration: z.coerce.number().int().min(5).max(240).default(50),
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
