import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteClass,
  deleteClassSubject,
  errorMessage,
  fetchClasses,
  fetchSubjects,
  saveClass,
  saveClassSubject,
} from "../api";
import type { ClassSection } from "../types";
import { Banner, PageTitle } from "../components/ui";

const empty: Partial<ClassSection> = { program: "", year: "", section: "" };

export default function Classes() {
  const qc = useQueryClient();
  const { data: classes = [], error } = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const [form, setForm] = useState<Partial<ClassSection>>(empty);
  const [reqForm, setReqForm] = useState<Record<string, { subjectId: string; hours: number }>>({});
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (error) setFeedback({ kind: "error", text: errorMessage(error) });
  }, [error]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["classes"] });
  const onErr = (e: unknown) => setFeedback({ kind: "error", text: errorMessage(e) });
  const save = useMutation({
    mutationFn: () => saveClass(form),
    onSuccess: () => {
      setFeedback({ kind: "success", text: "Class saved." });
      setForm(empty);
      refresh();
    },
    onError: onErr,
  });
  const remove = useMutation({ mutationFn: deleteClass, onSuccess: refresh, onError: onErr });
  const saveReq = useMutation({
    mutationFn: (classId: string) => {
      const r = reqForm[classId];
      return saveClassSubject(classId, r.subjectId, r.hours);
    },
    onSuccess: () => {
      setFeedback({ kind: "success", text: "Class subject hours saved." });
      refresh();
    },
    onError: onErr,
  });
  const removeReq = useMutation({
    mutationFn: (v: { classId: string; subjectId: string }) =>
      deleteClassSubject(v.classId, v.subjectId),
    onSuccess: refresh,
    onError: onErr,
  });

  return (
    <div>
      <PageTitle title="Classes" />
      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}

      <form
        className="card mb-6 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="mb-3 font-semibold">{form.id ? "Edit class" : "Add class"}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="c-prog">Program</label>
            <input id="c-prog" className="input" required placeholder="B.Tech" value={form.program ?? ""}
              onChange={(e) => setForm({ ...form, program: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="c-year">Year / Semester</label>
            <input id="c-year" className="input" required placeholder="Sem 1" value={form.year ?? ""}
              onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="c-sec">Section (optional)</label>
            <input id="c-sec" className="input" placeholder="A" value={form.section ?? ""}
              onChange={(e) => setForm({ ...form, section: e.target.value })} />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            <Plus className="h-4 w-4" aria-hidden /> {form.id ? "Save changes" : "Add class"}
          </button>
          {form.id && (
            <button type="button" className="btn-ghost" onClick={() => setForm(empty)}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="space-y-4">
        {classes.map((c) => {
          const rf = reqForm[c.id] ?? { subjectId: subjects[0]?.id ?? "", hours: 4 };
          return (
            <div key={c.id} className="card px-5 py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {c.name}
                  <span className="ml-2 font-mono text-sm font-normal text-muted">
                    {c.totalHours} hrs/week required (H5)
                  </span>
                </h2>
                <div className="flex gap-1">
                  <button className="btn-ghost !min-h-[36px] px-2" aria-label={`Edit ${c.name}`}
                    onClick={() => setForm(c)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button className="btn-danger !min-h-[36px] px-2" aria-label={`Delete ${c.name}`}
                    onClick={() => remove.mutate(c.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
              <table className="mb-3 w-full border-collapse">
                <tbody>
                  {c.requirements.map((r) => (
                    <tr key={r.subjectId} className="border-b border-line">
                      <td className="td font-mono text-xs">{r.code}</td>
                      <td className="td">{r.name}</td>
                      <td className="td capitalize">{r.type}</td>
                      <td className="td font-mono">{r.hours} hrs</td>
                      <td className="td text-right">
                        <button className="btn-danger !min-h-[32px] px-2 text-xs"
                          aria-label={`Remove ${r.name} from ${c.name}`}
                          onClick={() => removeReq.mutate({ classId: c.id, subjectId: r.subjectId })}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {c.requirements.length === 0 && (
                    <tr><td className="td text-muted">No subjects assigned yet.</td></tr>
                  )}
                </tbody>
              </table>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (rf.subjectId) saveReq.mutate(c.id);
                }}
              >
                <div>
                  <label className="label" htmlFor={`cs-sub-${c.id}`}>Subject</label>
                  <select id={`cs-sub-${c.id}`} className="input"
                    value={rf.subjectId}
                    onChange={(e) => setReqForm({ ...reqForm, [c.id]: { ...rf, subjectId: e.target.value } })}>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`cs-hrs-${c.id}`}>Hours / week</label>
                  <input id={`cs-hrs-${c.id}`} className="input w-24" type="number" min={0} max={60}
                    value={rf.hours}
                    onChange={(e) => setReqForm({ ...reqForm, [c.id]: { ...rf, hours: Number(e.target.value) } })} />
                </div>
                <button type="submit" className="btn-ghost" disabled={saveReq.isPending || !rf.subjectId}>
                  Set hours
                </button>
              </form>
            </div>
          );
        })}
        {classes.length === 0 && <p className="text-muted">No classes yet.</p>}
      </div>
    </div>
  );
}
