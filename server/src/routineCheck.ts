import { SubjectData, TeacherData } from "./solver/types.js";

export interface EntryLike {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
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
  // H4: weekly cap, counting the whole block's hours
  const weekCount = others.filter((e) => e.teacherId === block.teacherId).length;
  if (weekCount + len > teacher.weeklyHours) {
    return `${teacher.name} would exceed weekly hours ${teacher.weeklyHours} (H4).`;
  }
  return null;
}

/**
 * Validate one placement against H1–H7, given the full entry list with
 * `candidate` already in its (possibly new) position and every entry in
 * `excludeIds` ignored for clash counting except the candidate itself.
 * This is the in-memory equivalent of the original SQL check_entry():
 * manual moves/swaps are re-checked instantly and rejected with a reason.
 *
 * Returns a reason string, or null when the placement is legal.
 */
export function checkPlacement(
  entries: EntryLike[],
  candidate: EntryLike,
  teachers: Map<string, TeacherData>,
  subjects: Map<string, SubjectData>,
): string | null {
  const teacher = teachers.get(candidate.teacherId);
  if (!teacher) return "Teacher not found.";
  const subject = subjects.get(candidate.subjectId);
  if (!subject) return "Subject not found.";

  // H6: eligibility
  if (!teacher.subjects.has(candidate.subjectId)) {
    return `${teacher.name} cannot teach ${subject.name} (H6).`;
  }
  // H7: availability
  if (
    teacher.unavailable.has(`${candidate.day}|${candidate.period}`) ||
    teacher.unavailable.has(`${candidate.day}|*`)
  ) {
    return `${teacher.name} is unavailable at ${candidate.day} P${candidate.period} (H7).`;
  }

  const others = entries.filter((e) => e.id !== candidate.id);
  // H1: teacher clash
  const clashT = others.find(
    (e) => e.teacherId === candidate.teacherId && e.day === candidate.day && e.period === candidate.period,
  );
  if (clashT) {
    return `${teacher.name} already teaches another class at ${candidate.day} P${candidate.period} (H1).`;
  }
  // H2: class clash
  const clashC = others.find(
    (e) => e.classId === candidate.classId && e.day === candidate.day && e.period === candidate.period,
  );
  if (clashC) {
    return `Class already has a period at ${candidate.day} P${candidate.period} (H2).`;
  }
  // H3: daily cap (candidate counts as 1 of the day's periods)
  const dayCount = others.filter((e) => e.teacherId === candidate.teacherId && e.day === candidate.day).length;
  if (dayCount + 1 > teacher.maxPerDay) {
    return `${teacher.name} would exceed max/day ${teacher.maxPerDay} (H3).`;
  }
  // H4: weekly cap
  const weekCount = others.filter((e) => e.teacherId === candidate.teacherId).length;
  if (weekCount + 1 > teacher.weeklyHours) {
    return `${teacher.name} would exceed weekly hours ${teacher.weeklyHours} (H4).`;
  }
  return null;
}
