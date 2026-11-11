import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Database, Play, Trash2 } from "lucide-react";
import {
  activateDepartment,
  clearRoutine,
  deleteDepartment,
  errorMessage,
  fetchDashboard,
  fetchDepartments,
  generateRoutine,
  seedDemo,
} from "../api";
import { Banner, PageTitle } from "../components/ui";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-5 py-4">
      <div className="font-mono text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });
  const [feedback, setFeedback] = useState<{ kind: "success" | "error" | "warning"; text: string } | null>(null);

  const refresh = () => qc.invalidateQueries();
  const seed = useMutation({
    mutationFn: seedDemo,
    onSuccess: (r) => {
      setFeedback({ kind: "success", text: r.message });
      refresh();
    },
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });
  const generate = useMutation({
    mutationFn: generateRoutine,
    onSuccess: (r) => {
      setFeedback({ kind: r.success ? "success" : "warning", text: r.message });
      refresh();
    },
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });
  const { data: deptData } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments });
  const switchDept = useMutation({
    mutationFn: (id: string) => activateDepartment(id),
    onSuccess: () => window.location.reload(),
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });
  const removeDept = useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: (r) => {
      setFeedback({ kind: "success", text: r.message });
      window.location.reload();
    },
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });
  const clear = useMutation({
    mutationFn: clearRoutine,
    onSuccess: (r) => {
      setFeedback({ kind: "success", text: r.message });
      refresh();
    },
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error) return <Banner kind="error" text={errorMessage(error)} />;
  if (!data) return null;

  return (
    <div>
      <PageTitle title="Dashboard">
        <button className="btn-ghost" onClick={() => seed.mutate()} disabled={seed.isPending}>
          <Database className="h-4 w-4" aria-hidden /> Load NIT Agartala CSE Data
        </button>
        <Link className="btn-ghost" to="/setup">
          <BookOpen className="h-4 w-4" aria-hidden /> Set up a department
        </Link>
        <button className="btn-accent" onClick={() => generate.mutate()} disabled={generate.isPending}>
          <Play className="h-4 w-4" aria-hidden /> Generate Routine
        </button>
        {data.hasRoutine && (
          <button className="btn-danger" onClick={() => clear.mutate()} disabled={clear.isPending}>
            <Trash2 className="h-4 w-4" aria-hidden /> Clear Routine
          </button>
        )}
      </PageTitle>

      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Teachers" value={data.stats.teachers} />
        <StatCard label="Subjects" value={data.stats.subjects} />
        <StatCard label="Classes" value={data.stats.classes} />
        <StatCard label="Periods placed" value={data.stats.entries} />
      </div>

      {data.issues.length > 0 && (
        <div className="card mt-5 border-red-300 px-5 py-4">
          <h2 className="mb-2 font-semibold text-red-800">Data problems to fix</h2>
          <ul className="list-inside list-disc text-sm text-red-900">
            {data.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}
      {data.warnings.length > 0 && (
        <div className="card mt-5 px-5 py-4">
          <h2 className="mb-2 font-semibold">Notes</h2>
          <ul className="list-inside list-disc text-sm text-muted">
            {data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {deptData && (
        <div className="card mt-5 px-5 py-4">
          <h2 className="mb-2 font-semibold">Departments</h2>
          <p className="mb-3 text-sm text-muted">
            Departments are saved side by side. Switching departments never deletes
            anything — a department and its data are removed only when you press its
            Delete button here.
          </p>
          {deptData.departments.length === 0 ? (
            <p className="text-sm text-muted">
              No departments yet — load the built-in CSE department or set one up.
            </p>
          ) : (
            <ul className="grid gap-2">
              {deptData.departments.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-mono font-semibold">{d.shortName}</span> — {d.name}{" "}
                    <span className="text-muted">
                      · {d.counts.teachers} teachers · {d.counts.subjects} subjects ·{" "}
                      {d.counts.classes} classes
                    </span>
                    {d.isActive && (
                      <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-primary-dark">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!d.isActive && (
                      <button
                        className="btn-ghost"
                        onClick={() => switchDept.mutate(d.id)}
                        disabled={switchDept.isPending}
                      >
                        Switch
                      </button>
                    )}
                    <button
                      className="btn-danger"
                      disabled={deptData.departments.length <= 1 || removeDept.isPending}
                      title={
                        deptData.departments.length <= 1
                          ? "The last remaining department cannot be deleted"
                          : undefined
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete the ${d.shortName} department and all its data? This cannot be undone. Other departments are not affected.`,
                          )
                        ) {
                          removeDept.mutate(d.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card mt-5 px-5 py-4">
        <h2 className="mb-2 font-semibold">Two ways to use Routine Maker</h2>
        <p className="mb-2 text-sm">
          <strong>Path A — the built-in department:</strong> NIT Agartala CSE comes preloaded.
          Loading (or reloading) it only ever touches the CSE department — every other
          department you have created keeps its data.
        </p>
        <ol className="list-inside list-decimal space-y-1 text-sm">
          <li>Click Load NIT Agartala CSE Data (42 faculty, 69 subjects incl. 20 labs, 14 classes — B.Tech Sem 1 Group I + II / Sem 3 / 5 / 7 A+B, MCA Sem 1 / 3 / 5, M.Tech CYSEC / DSE / AI — subjects, hours and credits derived from the official syllabus catalogue, faculty from the real sheet, Mon–Fri).</li>
          <li>Open Validation — check demand vs teacher capacity per subject.</li>
          <li>Click Generate Routine.</li>
          <li>View the Master sheet (NITA format: time-headed columns, LUNCH, faculty + subject legends) / per-class / per-teacher routines, export CSV, or print the master sheet.</li>
          <li>Try a manual Move on the master view — illegal moves are rejected with the rule broken.</li>
        </ol>
        <p className="mb-2 mt-4 text-sm">
          <strong>Path B — set up any NITA department</strong>:{" "}
          <Link className="font-medium text-primary-dark underline" to="/setup">
            open the setup
          </Link>
          . Pick the department from the dropdown — its teachers preload from nita.ac.in
          and, where NITA publishes a course structure, its subjects preload from the
          official syllabus catalogue (codes, hours, credits). You assign each semester's
          subjects to teachers, semester by semester; Generate unlocks when everything
          is assigned (subjects with no teacher yet are marked XX, like the real sheet).
          Departments without a published structure (Chemistry, Physics, Maths, MHSS,
          Education) preload their faculty and take their courses by hand in the same
          setup. Creating a department ADDS it alongside your existing ones — nothing
          is ever replaced or deleted.
        </p>
      </div>
    </div>
  );
}
