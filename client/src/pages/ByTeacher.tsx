import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { errorMessage, fetchRoutine, fetchTeachers } from "../api";
import { Banner, PageTitle, RoutineGrid } from "../components/ui";
import { exportGridCsv } from "../utils/csv";

export default function ByTeacher() {
  const { data, error } = useQuery({ queryKey: ["routine"], queryFn: fetchRoutine });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers });
  const [teacherId, setTeacherId] = useState("");

  useEffect(() => {
    if (!teacherId && teachers.length > 0) setTeacherId(teachers[0].id);
  }, [teachers, teacherId]);

  if (error) return <Banner kind="error" text={errorMessage(error)} />;
  if (!data) return <p className="text-muted">Loading…</p>;
  const teacher = teachers.find((t) => t.id === teacherId);
  const mine = data.entries.filter((e) => e.teacherId === teacherId);
  const daily = data.config.days.map((d) => ({
    day: d,
    count: mine.filter((e) => e.day === d).length,
  }));

  return (
    <div>
      <PageTitle title="Routine by Teacher">
        <button
          className="btn-ghost"
          disabled={!teacher || mine.length === 0}
          onClick={() =>
            teacher && exportGridCsv(`routine_teacher_${teacher.name}.csv`, data.config, mine, "teacher")
          }
        >
          <Download className="h-4 w-4" aria-hidden /> Export CSV
        </button>
      </PageTitle>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="max-w-xs flex-1">
          <label className="label" htmlFor="bt-teacher">Teacher</label>
          <select id="bt-teacher" className="input" value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        {teacher && (
          <p className="text-sm text-muted">
            Weekly load:{" "}
            <span className="font-mono font-semibold text-ink">
              {mine.length} / {teacher.weeklyHours}
            </span>{" "}
            periods · max/day {teacher.maxPerDay}
          </p>
        )}
      </div>
      {teacher && (
        <>
          <div className="card px-4 py-3">
            <RoutineGrid config={data.config} entries={mine} cellMode="teacher" />
          </div>
          <div className="card mt-4 px-5 py-4">
            <h2 className="mb-2 font-semibold">Daily load</h2>
            <div className="flex flex-wrap gap-4">
              {daily.map(({ day, count }) => (
                <div key={day} className="text-sm">
                  <span className="text-muted">{day.slice(0, 3)}: </span>
                  <span className="font-mono font-semibold">{count}</span>
                </div>
              ))}
              <div className="text-sm">
                <span className="text-muted">Total: </span>
                <span className="font-mono font-semibold">{mine.length}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
