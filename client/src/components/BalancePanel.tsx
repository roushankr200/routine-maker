import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { BalanceReport, TeacherLoadStatus } from "../types";

/**
 * Coverage & balance — presentational view of a BalanceReport:
 * (a) per subject: required hours, covered hours and the hours still
 *     LEFT to cover (red badge while any remain, "Covered" at zero);
 * (b) per teacher: the greedy suggested load against their weekly
 *     max, with under-loaded teachers flagged so subjects can be
 *     redistributed to even the load out.
 * Used live inside the department wizard; the Validation page renders
 * the same report from the saved data.
 */

export const STATUS_LABEL: Record<TeacherLoadStatus, string> = {
  under: "Under-loaded",
  full: "Full",
  balanced: "Balanced",
};

export const STATUS_BADGE: Record<TeacherLoadStatus, string> = {
  under: "bg-amber-100 text-amber-900",
  full: "bg-teal-700 text-white",
  balanced: "bg-teal-100 text-teal-900",
};

export default function BalancePanel({ report, note }: { report: BalanceReport; note?: string }) {
  const { perSubject, perTeacher, totals } = report;
  return (
    <div>
      <p className="mb-3 text-sm">
        <span className="font-semibold">{totals.requiredHours}h</span> required ·{" "}
        <span className="font-semibold">{totals.assignedHours}h</span> covered ·{" "}
        {totals.remainingHours > 0 ? (
          <span className="font-semibold text-red-700">{totals.remainingHours}h still left to cover</span>
        ) : (
          <span className="font-semibold text-teal-800">nothing left — every hour is covered</span>
        )}
        {note && <span className="block text-xs text-muted">{note}</span>}
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* (a) Subject coverage — hours left */}
        <div className="overflow-x-auto">
          <h3 className="mb-2 text-sm font-semibold">Hours left per course</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-primary/60">
                <th className="th">Course</th>
                <th className="th text-center">Required</th>
                <th className="th text-center">Covered</th>
                <th className="th text-center">Left</th>
              </tr>
            </thead>
            <tbody>
              {perSubject.map((s) => (
                <tr key={s.code} className="border-b border-line">
                  <td className="td">
                    <span className="font-mono text-xs font-semibold">{s.code}</span>
                    {s.eligibleTeacherCodes.length > 0 && (
                      <span className="block text-xs text-muted">
                        can be taught by {s.eligibleTeacherCodes.join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="td text-center font-mono">{s.requiredHours}h</td>
                  <td className="td text-center font-mono">{s.assignedHours}h</td>
                  <td className="td text-center">
                    {s.remainingHours > 0 ? (
                      <span className="chip bg-red-100 font-semibold text-red-800">
                        {s.remainingHours}h left
                      </span>
                    ) : (
                      <span className="chip bg-teal-100 font-medium text-teal-900">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Covered
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {perSubject.length === 0 && (
                <tr>
                  <td className="td text-muted" colSpan={4}>
                    No courses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* (b) Teacher loads — who is getting less? */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Suggested load per teacher</h3>
          <ul className="grid gap-3">
            {perTeacher.map((t) => {
              const pct =
                t.weeklyMaxHours > 0
                  ? Math.min(100, Math.round((t.suggestedHours / t.weeklyMaxHours) * 100))
                  : 100;
              return (
                <li key={`${t.code}-${t.name}`} className="rounded-md border border-line px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {t.name}{" "}
                      <span className="font-mono text-xs text-muted">{t.code}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {t.suggestedHours} / {t.weeklyMaxHours} h
                      </span>
                      <span className={`chip font-medium ${STATUS_BADGE[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-teal-100"
                    role="img"
                    aria-label={`${t.name}: suggested ${t.suggestedHours} of ${t.weeklyMaxHours} weekly hours`}
                  >
                    <div
                      className={`h-full rounded-full ${t.status === "under" ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {t.subjects.length > 0 && (
                    <p className="mt-1.5 text-xs text-muted">
                      {t.subjects.map((s) => `${s.code} ${s.hours}h`).join(" · ")}
                    </p>
                  )}
                  {t.status === "under" && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                      Under-loaded — can take more subjects. Tick extra courses for this teacher
                      above to balance the load.
                    </p>
                  )}
                </li>
              );
            })}
            {perTeacher.length === 0 && <li className="text-sm text-muted">No teachers yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
