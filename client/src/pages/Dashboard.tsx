import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Play, Trash2 } from "lucide-react";
import { clearRoutine, errorMessage, fetchDashboard, generateRoutine, seedDemo } from "../api";
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
          <Database className="h-4 w-4" aria-hidden /> Load MCA Demo Data
        </button>
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

      <div className="card mt-5 px-5 py-4">
        <h2 className="mb-2 font-semibold">Demo walkthrough (5 steps)</h2>
        <ol className="list-inside list-decimal space-y-1 text-sm">
          <li>Click Load MCA Demo Data (9 teachers, 9 subjects incl. 2 labs, 3 MCA classes).</li>
          <li>Open Validation — check demand vs teacher capacity per subject.</li>
          <li>Click Generate Routine.</li>
          <li>View Master / per-class / per-teacher routines, export CSV.</li>
          <li>Try a manual Move on the master view — illegal moves are rejected with the rule broken.</li>
        </ol>
      </div>
    </div>
  );
}
