import { RoutineEntry, Subject, getOrCreateConfig } from "./models.js";
import { sessionHoursOf } from "./solver/types.js";

/** Bring saved timetables into the one-lab-per-week rule without moving sessions. */
export async function normalizeSavedLabSessions(): Promise<number> {
  const labs = await Subject.find({ type: "lab" }).select("type sessionHours").lean();
  if (!labs.length) return 0;
  const config = await getOrCreateConfig();
  const durations = new Map(labs.map((lab) => [lab._id.toString(), sessionHoursOf(lab)]));
  const entries = await RoutineEntry.find({ subjectId: { $in: labs.map((lab) => lab._id) } }).lean();
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = `${entry.departmentId}|${entry.publicationId ?? ""}|${entry.classId}|${entry.subjectId}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  const removed: typeof entries[number]["_id"][] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => config.days.indexOf(a.day) - config.days.indexOf(b.day) || a.period - b.period);
    const maxHours = durations.get(group[0].subjectId.toString())!;
    const blocks: typeof entries[] = [];
    for (const entry of group) {
      const block = blocks.at(-1);
      const previous = block?.at(-1);
      if (block && previous && previous.day === entry.day && previous.period + 1 === entry.period
        && previous.period !== config.lunchAfter && previous.sessionId === entry.sessionId
        && previous.teacherId.equals(entry.teacherId) && String(previous.roomId) === String(entry.roomId)) {
        block.push(entry);
      } else {
        blocks.push([entry]);
      }
    }
    // Prefer a full block. If multiple blocks fit, keep the earliest one.
    const kept = blocks.reduce((best, block) => Math.min(block.length, maxHours) > Math.min(best.length, maxHours) ? block : best);
    const keepIds = new Set(kept.slice(0, maxHours).map((entry) => entry._id.toString()));
    for (const entry of group) if (!keepIds.has(entry._id.toString())) removed.push(entry._id);
  }
  if (!removed.length) return 0;
  return (await RoutineEntry.deleteMany({ _id: { $in: removed } })).deletedCount;
}
