import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { errorMessage, fetchClasses, fetchRoutine } from "../api";
import { Banner, PageTitle, RoutineGrid } from "../components/ui";
import { exportGridCsv } from "../utils/csv";

export default function ByClass() {
  const { data, error } = useQuery({ queryKey: ["routine"], queryFn: fetchRoutine });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const [classId, setClassId] = useState("");

  useEffect(() => {
    if (!classId && classes.length > 0) setClassId(classes[0].id);
  }, [classes, classId]);

  if (error) return <Banner kind="error" text={errorMessage(error)} />;
  if (!data) return <p className="text-muted">Loading…</p>;
  const cls = classes.find((c) => c.id === classId);
  const mine = data.entries.filter((e) => e.classId === classId);

  return (
    <div>
      <PageTitle title="Routine by Class">
        <button
          className="btn-ghost"
          disabled={!cls || mine.length === 0}
          onClick={() => cls && exportGridCsv(`routine_class_${cls.name}.csv`, data.config, mine, "class")}
        >
          <Download className="h-4 w-4" aria-hidden /> Export CSV
        </button>
      </PageTitle>
      <div className="mb-4 max-w-xs">
        <label className="label" htmlFor="bc-class">Class</label>
        <select id="bc-class" className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {cls && (
        <div className="card px-4 py-3">
          <RoutineGrid config={data.config} entries={mine} cellMode="class" />
        </div>
      )}
    </div>
  );
}
