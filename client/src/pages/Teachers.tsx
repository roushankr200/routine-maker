import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteTeacher,
  errorMessage,
  fetchSubjects,
  fetchTeachers,
  saveTeacher,
} from "../api";
import type { Teacher } from "../types";
import { Banner, PageTitle } from "../components/ui";

const empty: Partial<Teacher> = { name: "", designation: "", maxPerDay: 4, weeklyHours: 16, subjects: [] };

export default function Teachers() {
  const qc = useQueryClient();
  const { data: teachers = [], error } = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const [form, setForm] = useState<Partial<Teacher>>(empty);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const codeOf = (id: string) => subjects.find((s) => s.id === id)?.code ?? "?";
  const refresh = () => qc.invalidateQueries({ queryKey: ["teachers"] });
  const save = useMutation({
    mutationFn: () => saveTeacher(form),
    onSuccess: () => {
      setFeedback({ kind: "success", text: "Teacher saved." });
      setForm(empty);
      refresh();
    },
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });
  const remove = useMutation({
    mutationFn: deleteTeacher,
    onSuccess: () => refresh(),
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });

  useEffect(() => {
    if (error) setFeedback({ kind: "error", text: errorMessage(error) });
  }, [error]);

  const toggleSubject = (id: string) =>
    setForm((f) => ({
      ...f,
      subjects: f.subjects?.includes(id)
        ? f.subjects.filter((s) => s !== id)
        : [...(f.subjects ?? []), id],
    }));

  return (
    <div>
      <PageTitle title="Teachers" />
      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}

      <form
        className="card mb-6 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="mb-3 font-semibold">{form.id ? "Edit teacher" : "Add teacher"}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="t-name">Name</label>
            <input id="t-name" className="input" required value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="t-desig">Designation</label>
            <input id="t-desig" className="input" value={form.designation ?? ""}
              onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="t-max">Max classes / day (H3)</label>
            <input id="t-max" className="input" type="number" min={0} max={20} required
              value={form.maxPerDay ?? 4}
              onChange={(e) => setForm({ ...form, maxPerDay: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label" htmlFor="t-week">Weekly hours (H4)</label>
            <input id="t-week" className="input" type="number" min={0} max={80} required
              value={form.weeklyHours ?? 16}
              onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })} />
          </div>
        </div>
        <fieldset className="mt-4">
          <legend className="label">Can teach (H6 eligibility)</legend>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <label key={s.id}
                className="flex min-h-[36px] cursor-pointer items-center gap-2 rounded-md border border-teal-200 bg-white px-3 py-1 text-sm has-[:checked]:bg-teal-50">
                <input type="checkbox" checked={form.subjects?.includes(s.id) ?? false}
                  onChange={() => toggleSubject(s.id)} />
                <span className="font-mono text-xs">{s.code}</span> {s.name}
              </label>
            ))}
            {subjects.length === 0 && <span className="text-sm text-muted">Add subjects first.</span>}
          </div>
        </fieldset>
        <div className="mt-4 flex gap-2">
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            <Plus className="h-4 w-4" aria-hidden /> {form.id ? "Save changes" : "Add teacher"}
          </button>
          {form.id && (
            <button type="button" className="btn-ghost" onClick={() => setForm(empty)}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-primary/60">
              <th className="th">Name</th>
              <th className="th">Designation</th>
              <th className="th">Max/day</th>
              <th className="th">Weekly hrs</th>
              <th className="th">Can teach</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id} className="border-b border-line">
                <td className="td font-medium">{t.name}</td>
                <td className="td text-muted">{t.designation}</td>
                <td className="td font-mono">{t.maxPerDay}</td>
                <td className="td font-mono">{t.weeklyHours}</td>
                <td className="td">
                  <span className="font-mono text-xs">{t.subjects.map(codeOf).join(", ") || "—"}</span>
                </td>
                <td className="td">
                  <div className="flex gap-1">
                    <button className="btn-ghost !min-h-[36px] px-2" aria-label={`Edit ${t.name}`}
                      onClick={() => setForm(t)}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <Link className="btn-ghost !min-h-[36px] px-2" aria-label={`Availability for ${t.name}`}
                      to={`/teachers/${t.id}/availability`}>
                      <CalendarOff className="h-4 w-4" aria-hidden />
                    </Link>
                    <button className="btn-danger !min-h-[36px] px-2" aria-label={`Delete ${t.name}`}
                      onClick={() => remove.mutate(t.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr><td className="td text-muted" colSpan={6}>No teachers yet — add one above or load demo data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
