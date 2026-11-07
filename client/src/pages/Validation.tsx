import { useQuery } from "@tanstack/react-query";
import { errorMessage, fetchBalance, fetchValidation } from "../api";
import { STATUS_BADGE, STATUS_LABEL } from "../components/BalancePanel";
import { Banner, PageTitle } from "../components/ui";

/** FR10: demand vs eligible-teacher capacity per subject, before/after generation. */
export default function Validation() {
  const { data, error } = useQuery({ queryKey: ["validation"], queryFn: fetchValidation });
  const balance = useQuery({ queryKey: ["balance"], queryFn: fetchBalance });
  if (error) return <Banner kind="error" text={errorMessage(error)} />;
  if (!data) return <p className="text-muted">Loading…</p>;

  const uncovered = (balance.data?.perSubject ?? []).filter((s) => s.remainingHours > 0);

  return (
    <div>
      <PageTitle title="Validation Report" />
      {data.issues.length > 0 && (
        <div className="card mb-4 border-red-300 px-5 py-4">
          <h2 className="mb-2 font-semibold text-red-800">Issues — generation cannot fully succeed until fixed</h2>
          <ul className="list-inside list-disc text-sm text-red-900">
            {data.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}
      {data.warnings.length > 0 && (
        <div className="card mb-4 px-5 py-4">
          <h2 className="mb-2 font-semibold">Warnings</h2>
          <ul className="list-inside list-disc text-sm text-muted">
            {data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {data.issues.length === 0 && data.warnings.length === 0 && (
        <Banner kind="success" text="No issues — the data is consistent and generation should succeed." />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-primary/60">
              <th className="th">Subject</th>
              <th className="th">Demand (hours/wk)</th>
              <th className="th">Eligible teachers</th>
              <th className="th">Combined capacity</th>
              <th className="th">Placed now</th>
            </tr>
          </thead>
          <tbody>
            {data.demandBySubject.map((d) => (
              <tr key={d.subjectId} className="border-b border-line">
                <td className="td">
                  <span className="font-mono text-xs">{d.subject.code}</span> {d.subject.name}
                </td>
                <td className="td font-mono">{d.demand}</td>
                <td className="td text-muted">{d.teachers.join(", ") || "—"}</td>
                <td className={`td font-mono ${d.capacity < d.demand ? "font-semibold text-red-700" : ""}`}>
                  {d.capacity}
                </td>
                <td className="td font-mono">{d.placed}</td>
              </tr>
            ))}
            {data.demandBySubject.length === 0 && (
              <tr><td className="td text-muted" colSpan={5}>No class-subject hours defined yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted">
        The week has {data.slotsPerWeek} slots per class. Demand above capacity for any subject
        means some hours can never be placed — add a teacher or raise a weekly cap.
      </p>

      {/* ------------------------------------------------ Load balance */}
      <h2 className="mb-3 mt-8 text-xl font-semibold tracking-tight">Load balance</h2>
      <p className="mb-4 text-sm text-muted">
        A greedy suggested distribution of the required hours across the eligible teachers
        (most-constrained subjects first, least-loaded teacher first, weekly caps respected).
        It shows which course hours are still <strong>left to cover</strong> and which teachers
        are getting less than the others — redistribute subjects to even the load out.
      </p>

      {balance.error ? (
        <Banner kind="error" text={errorMessage(balance.error)} />
      ) : !balance.data ? (
        <p className="text-muted">Loading balance…</p>
      ) : (
        <>
          {uncovered.length > 0 && (
            <div className="card mb-4 border-amber-300 px-5 py-4">
              <h3 className="mb-2 font-semibold text-amber-900">
                Hours still left to cover — the suggested distribution cannot place these
              </h3>
              <ul className="list-inside list-disc text-sm text-amber-900">
                {uncovered.map((s) => (
                  <li key={s.code}>
                    <span className="font-mono text-xs font-semibold">{s.code}</span>:{" "}
                    {s.remainingHours}h of {s.requiredHours}h left
                    {s.eligibleTeacherCodes.length > 0
                      ? ` — eligible teachers (${s.eligibleTeacherCodes.join(", ")}) are at their weekly caps. Raise a cap or make another teacher eligible.`
                      : " — NO teacher can teach this course. Assign one on the Teachers page."}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-primary/60">
                  <th className="th">Teacher</th>
                  <th className="th">Suggested hours</th>
                  <th className="th">Weekly max</th>
                  <th className="th">Subjects (suggested)</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody>
                {balance.data.perTeacher.map((t) => (
                  <tr key={`${t.code}-${t.name}`} className="border-b border-line">
                    <td className="td">
                      {t.name}{" "}
                      <span className="font-mono text-xs text-muted">{t.code}</span>
                    </td>
                    <td className="td font-mono">{t.suggestedHours}</td>
                    <td className="td font-mono">{t.weeklyMaxHours}</td>
                    <td className="td text-muted">
                      {t.subjects.map((s) => `${s.code} ${s.hours}h`).join(" · ") || "—"}
                    </td>
                    <td className="td">
                      <span className={`chip font-medium ${STATUS_BADGE[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                      {t.status === "under" && (
                        <span className="ml-2 text-xs text-amber-800">
                          under-loaded — can take more subjects
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {balance.data.perTeacher.length === 0 && (
                  <tr>
                    <td className="td text-muted" colSpan={5}>
                      No teachers defined yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">
            Average suggested load: {balance.data.averageSuggestedHours}h across teachers who
            can teach at least one course. Totals: {balance.data.totals.assignedHours}h of{" "}
            {balance.data.totals.requiredHours}h required is covered by the suggestion
            {balance.data.totals.remainingHours > 0
              ? ` — ${balance.data.totals.remainingHours}h remains uncovered.`
              : "."}
          </p>
        </>
      )}
    </div>
  );
}
