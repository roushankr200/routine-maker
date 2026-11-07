import type { RoutineEntry, ScheduleConfig } from "../types";

function download(filename: string, rows: string[][]): void {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function cellText(e: RoutineEntry | undefined, mode: "master" | "class" | "teacher"): string {
  if (!e) return "";
  if (mode === "master") return `${e.subjectCode} (${e.teacherName})`;
  if (mode === "class") return `${e.subjectCode} (${e.teacherName})`;
  return `${e.subjectCode} (${e.className})`;
}

/** Master CSV: one row per class per day, lunch column included — same shape as the original export. */
export function exportMasterCsv(
  config: ScheduleConfig,
  entries: RoutineEntry[],
  classes: Array<{ id: string; name: string }>,
): void {
  const by = new Map(entries.map((e) => [`${e.classId}|${e.day}|${e.period}`, e]));
  const header = ["Class", "Day"];
  for (let p = 1; p <= config.periodsPerDay; p++) {
    header.push(`P${p}`);
    if (config.lunchAfter === p) header.push("Break");
  }
  const rows: string[][] = [header];
  for (const cl of classes) {
    for (const day of config.days) {
      const row = [cl.name, day];
      for (let p = 1; p <= config.periodsPerDay; p++) {
        row.push(cellText(by.get(`${cl.id}|${day}|${p}`), "master"));
        if (config.lunchAfter === p) row.push("LUNCH");
      }
      rows.push(row);
    }
  }
  download("master_routine.csv", rows);
}

export function exportGridCsv(
  filename: string,
  config: ScheduleConfig,
  entries: RoutineEntry[],
  mode: "class" | "teacher",
): void {
  const by = new Map(entries.map((e) => [`${e.day}|${e.period}`, e]));
  const header = ["Day", ...Array.from({ length: config.periodsPerDay }, (_, i) => `P${i + 1}`)];
  const rows: string[][] = [header];
  for (const day of config.days) {
    rows.push([
      day,
      ...Array.from({ length: config.periodsPerDay }, (_, i) =>
        cellText(by.get(`${day}|${i + 1}`), mode),
      ),
    ]);
  }
  download(filename, rows);
}
