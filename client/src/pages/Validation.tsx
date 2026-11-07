import { useQuery } from "@tanstack/react-query";
import { errorMessage, fetchValidation } from "../api";
import { Banner, PageTitle } from "../components/ui";

/** FR10: demand vs eligible-teacher capacity per subject, before/after generation. */
export default function Validation() {
  const { data, error } = useQuery({ queryKey: ["validation"], queryFn: fetchValidation });
  if (error) return <Banner kind="error" text={errorMessage(error)} />;
  if (!data) return <p className="text-muted">Loading…</p>;

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
              <th className="th">Demand (periods/wk)</th>
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
        means some periods can never be placed — add a teacher or raise a weekly cap.
      </p>
    </div>
  );
}
