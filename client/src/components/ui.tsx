import { Fragment } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { RoutineEntry, ScheduleConfig } from "../types";

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
      {type === "lab" ? " · LAB" : ""}
    </span>
  );
}

/**
 * The weekly grid: rows = days, columns = periods, with a LUNCH column
 * inserted after the lunchAfter period. `entries` must already be
 * filtered to the class/teacher being shown.
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
  const by = new Map(entries.map((e) => [`${e.day}|${e.period}`, e]));
  const periods = Array.from({ length: config.periodsPerDay }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-primary/60">
            <th className="th">Day</th>
            {periods.map((p) => (
              <Fragment key={p}>
                <th className="th text-center">P{p}</th>
                {config.lunchAfter === p && <th className="th bg-teal-50 text-center">Break</th>}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.days.map((day) => (
            <tr key={day} className="border-b border-line align-top">
              <td className="td whitespace-nowrap font-medium">{day}</td>
              {periods.map((p) => {
                const e = by.get(`${day}|${p}`);
                return (
                  <Fragment key={p}>
                    <td className="td min-w-[110px] text-center">
                      {e ? (
                        <div>
                          <SubjectChip code={e.subjectCode} type={e.subjectType} />
                          <div className="mt-1 text-xs text-muted">
                            {cellMode === "teacher" ? e.className : e.teacherName}
                          </div>
                          {cellMode === "master" && (
                            <div className="text-xs text-muted">{e.className}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {config.lunchAfter === p && (
                      <td className="td bg-teal-50/60 text-center text-xs text-muted">LUNCH</td>
                    )}
                  </Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
