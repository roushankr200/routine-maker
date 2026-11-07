import { Fragment } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { RoutineEntry, ScheduleConfig } from "../types";
import { periodRange, sessionRange } from "../utils/time";

/** Inline feedback banner — success / error / info, text + icon + colour (never colour alone). */
export function Banner({
  kind,
  text,
}: {
  kind: "success" | "error" | "info" | "warning";
  text: string;
}) {
  const styles = {
    success: "border-teal-300 bg-teal-50 text-teal-900",
    error: "border-red-300 bg-red-50 text-red-900",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    info: "border-teal-200 bg-white text-ink",
  }[kind];
  const Icon = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info }[kind];
  return (
    <div role="status" className={`mb-4 flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function SubjectChip({ code, type }: { code: string; type: "theory" | "lab" }) {
  return (
    <span
      className={`chip ${type === "lab" ? "bg-orange-100 text-orange-800" : "bg-teal-100 text-teal-900"}`}
    >
      {code}
      {/* NITA lab codes already carry "Lab" ("AI Lab") — don't print it twice. */}
      {type === "lab" && !/lab/i.test(code) ? " · LAB" : ""}
    </span>
  );
}

export interface SessionCell {
  /** First entry of the block (its id identifies the session). */
  entry: RoutineEntry;
  start: number;
  length: number;
}

/**
 * Group a day's flattened hourly entries into SESSION BLOCKS: maximal
 * runs of consecutive periods with the same class, subject and teacher.
 * (Sessions never cross lunch, so a run never spans the break.)
 */
export function sessionBlocks(entries: RoutineEntry[], day: string): Map<number, SessionCell> {
  const by = new Map(entries.filter((e) => e.day === day).map((e) => [e.period, e]));
  const blocks = new Map<number, SessionCell>();
  const periods = [...by.keys()].sort((a, b) => a - b);
  for (const p of periods) {
    const e = by.get(p)!;
    const prev = by.get(p - 1);
    // Start a run at p when the previous period is not the same session.
    const continuesPrev =
      prev !== undefined &&
      prev.classId === e.classId &&
      prev.subjectId === e.subjectId &&
      prev.teacherId === e.teacherId;
    if (continuesPrev) continue;
    let length = 1;
    while (true) {
      const nxt = by.get(p + length);
      if (
        nxt &&
        nxt.classId === e.classId &&
        nxt.subjectId === e.subjectId &&
        nxt.teacherId === e.teacherId
      ) {
        length++;
      } else break;
    }
    blocks.set(p, { entry: e, start: p, length });
  }
  return blocks;
}

/**
 * The weekly grid: rows = days, columns = hourly slots, with a LUNCH
 * column inserted after the lunchAfter slot. Sessions render MERGED
 * across their hours (colSpan = block length) with their start–end
 * clock time (e.g. 9:00–11:00). `entries` must already be filtered to
 * the class/teacher being shown.
 */
export function RoutineGrid({
  config,
  entries,
  cellMode,
}: {
  config: ScheduleConfig;
  entries: RoutineEntry[];
  cellMode: "class" | "teacher" | "master";
}) {
  const periods = Array.from({ length: config.periodsPerDay }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-primary/60">
            <th className="th">Day</th>
            {periods.map((p) => (
              <Fragment key={p}>
                <th className="th text-center">
                  P{p}
                  <span className="block font-mono text-[11px] font-normal normal-case">
                    {periodRange(config, p)}
                  </span>
                </th>
                {config.lunchAfter === p && <th className="th bg-teal-50 text-center">Break</th>}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.days.map((day) => {
            const blocks = sessionBlocks(entries, day);
            const covered = new Set<number>();
            for (const b of blocks.values()) {
              for (let i = 1; i < b.length; i++) covered.add(b.start + i);
            }
            return (
              <tr key={day} className="border-b border-line align-top">
                <td className="td whitespace-nowrap font-medium">{day}</td>
                {periods.map((p) => {
                  const block = blocks.get(p);
                  return (
                    <Fragment key={p}>
                      {!covered.has(p) && (
                        <td className="td min-w-[110px] text-center" colSpan={block?.length ?? 1}>
                          {block ? (
                            <div>
                              <SubjectChip code={block.entry.subjectCode} type={block.entry.subjectType} />
                              <div className="mt-1 text-xs text-muted">
                                {cellMode === "teacher" ? block.entry.className : block.entry.teacherName}
                              </div>
                              {cellMode === "master" && (
                                <div className="text-xs text-muted">{block.entry.className}</div>
                              )}
                              <div className="mt-0.5 font-mono text-[11px] font-medium text-primary-dark">
                                {sessionRange(config, block.start, block.length)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      )}
                      {config.lunchAfter === p && (
                        <td className="td bg-teal-50/60 text-center text-xs text-muted">LUNCH</td>
                      )}
                    </Fragment>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
