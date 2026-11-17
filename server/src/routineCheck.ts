import { hasBackToBackSession, SubjectData, TeacherData, teacherWeeklyLimit } from "./solver/types.js";

export interface EntryLike {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId?: string;
  sessionId?: number;
  day: string;
  period: number;
}

export interface BlockInfo {
  classId: string;
  subjectId: string;
  teacherId: string;
  /** Session length in hourly slots. */
  length: number;
}

export interface GridShape {
  periodsPerDay: number;
  lunchAfter: number | null;
}

export function savedFacultyWorkloadIssues(entries: EntryLike[], teachers: Map<string, TeacherData>, grid: GridShape): string[] {
  const hours = new Map<string, number>();
  const slots = new Map<string, EntryLike>();
  const adjacent = new Set<string>();
  for (const entry of entries) {
    hours.set(entry.teacherId, (hours.get(entry.teacherId) ?? 0) + 1);
    slots.set(`${entry.teacherId}|${entry.day}|${entry.period}`, entry);
  }
  for (const entry of entries) {
    if (entry.period === grid.lunchAfter || entry.period >= grid.periodsPerDay) continue;
    const next = slots.get(`${entry.teacherId}|${entry.day}|${entry.period + 1}`);
    if (!next || teachers.get(entry.teacherId)?.isPlaceholder) continue;
    const sameSession = entry.sessionId !== undefined || next.sessionId !== undefined
      ? entry.sessionId === next.sessionId
      : entry.classId === next.classId && entry.subjectId === next.subjectId && entry.roomId === next.roomId;
    if (!sameSession) adjacent.add(entry.teacherId);
  }
  const overCap = [...teachers.values()].filter((teacher) => (hours.get(teacher.id) ?? 0) > teacherWeeklyLimit(teacher));
  const issues: string[] = [];
  if (overCap.length) issues.push(`The saved routine exceeds the weekly limit for ${overCap.length} teacher(s) (H4).`);
  if (adjacent.size) issues.push(`The saved routine has back-to-back sessions for ${adjacent.size} teacher(s) (H9).`);
  if (issues.length) issues.push("Generate the routine again to apply the current faculty rules.");
  return issues;
}

/**
 * The SESSION BLOCK an entry belongs to: the maximal run of consecutive
 * hourly entries on the same day with the same class, subject and
 * teacher that contains the entry, sorted by period. Sessions are
 * stored flattened (one row per hour), so a block is recovered by
 * walking out from the picked entry in both directions.
 */
export function sessionBlock(entries: EntryLike[], entryId: string): EntryLike[] {
  const start = entries.find((e) => e.id === entryId);
  if (!start) return [];
  const same = (e: EntryLike) =>
    e.classId === start.classId &&
    e.subjectId === start.subjectId &&
    e.teacherId === start.teacherId &&
    e.roomId === start.roomId &&
    e.sessionId === start.sessionId &&
    e.day === start.day;
  const byPeriod = new Map<number, EntryLike>();
  for (const e of entries) if (same(e)) byPeriod.set(e.period, e);
  let lo = start.period;
  let hi = start.period;
  while (byPeriod.has(lo - 1)) lo--;
  while (byPeriod.has(hi + 1)) hi++;
  const block: EntryLike[] = [];
  for (let p = lo; p <= hi; p++) block.push(byPeriod.get(p)!);
  return block;
}

/**
 * Validate placing a whole session block (length L) at (day, start)
 * against `others` — every entry that is NOT part of the moving block,
 * already in its (possibly new) position. Checks, over the FULL span:
 * segment fit (never crossing lunch, inside the day), H6 eligibility,
 * H7 availability, H1 teacher clash, H2 class clash, and H3/H4 with
 * the block counting L hours. Returns a reason or null.
 */
export function checkBlockPlacement(
  others: EntryLike[],
  block: BlockInfo,
  day: string,
  start: number,
  teachers: Map<string, TeacherData>,
  subjects: Map<string, SubjectData>,
  grid: GridShape,
): string | null {
  const teacher = teachers.get(block.teacherId);
  if (!teacher) return "Teacher not found.";
  const subject = subjects.get(block.subjectId);
  if (!subject) return "Subject not found.";
  const len = block.length;
  const end = start + len - 1;
  const fmt = (p: number) => `${day} P${p}`;

  if (start < 1 || end > grid.periodsPerDay) {
    return `A ${len}h session starting at ${fmt(start)} does not fit in the day (P1–P${grid.periodsPerDay}).`;
  }
  if (grid.lunchAfter !== null && start <= grid.lunchAfter && grid.lunchAfter < end) {
    return `A ${len}h session starting at ${fmt(start)} would cross the lunch break.`;
  }
  // H6: eligibility
  if (!teacher.subjects.has(block.subjectId)) {
    return `${teacher.name} cannot teach ${subject.name} (H6).`;
  }
  for (let p = start; p <= end; p++) {
    // H7: availability
    if (teacher.unavailable.has(`${day}|${p}`) || teacher.unavailable.has(`${day}|*`)) {
      return `${teacher.name} is unavailable at ${fmt(p)} (H7).`;
    }
    // H1: teacher clash
    const clashT = others.find((e) => e.teacherId === block.teacherId && e.day === day && e.period === p);
    if (clashT) return `${teacher.name} already teaches another class at ${fmt(p)} (H1).`;
    // H2: class clash
    const clashC = others.find((e) => e.classId === block.classId && e.day === day && e.period === p);
    if (clashC) return `Class already has a session at ${fmt(p)} (H2).`;
  }
  // H3: daily cap, counting the whole block's hours
  const dayCount = others.filter((e) => e.teacherId === block.teacherId && e.day === day).length;
  if (dayCount + len > teacher.maxPerDay) {
    return `${teacher.name} would exceed max/day ${teacher.maxPerDay}h (H3).`;
  }
  // H4: weekly cap, counting the whole block's hours.
  const weekCount = others.filter((e) => e.teacherId === block.teacherId).length;
  const weeklyLimit = teacherWeeklyLimit(teacher);
  if (weekCount + len > weeklyLimit) {
    return `${teacher.name} would exceed weekly hours ${weeklyLimit} (H4).`;
  }
  if (!teacher.isPlaceholder && hasBackToBackSession(start, end, grid,
    (period) => others.some((e) => e.teacherId === block.teacherId && e.day === day && e.period === period))) {
    return `${teacher.name} needs a break between teaching sessions on ${day} (H9).`;
  }
  return null;
}

/** Check the candidate's complete session against the other saved entries. */
export function checkPlacement(
  entries: EntryLike[],
  candidate: EntryLike,
  teachers: Map<string, TeacherData>,
  subjects: Map<string, SubjectData>,
  grid: GridShape = { periodsPerDay: 8, lunchAfter: 4 },
): string | null {
  const proposed = [...entries.filter((e) => e.id !== candidate.id), candidate];
  const block = candidate.sessionId === undefined ? [candidate] : sessionBlock(proposed, candidate.id);
  const ids = new Set(block.map((e) => e.id));
  return checkBlockPlacement(
    proposed.filter((e) => !ids.has(e.id)), { ...candidate, length: block.length },
    candidate.day, block[0].period, teachers, subjects, grid,
  );
}
