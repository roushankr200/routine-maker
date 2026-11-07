import { SubjectData, TeacherData } from "./solver/types.js";

export interface EntryLike {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  day: string;
  period: number;
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
