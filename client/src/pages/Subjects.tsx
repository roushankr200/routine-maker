import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteSubject, errorMessage, fetchSubjects, saveSubject } from "../api";
import type { Subject } from "../types";
import { Banner, PageTitle, SubjectChip } from "../components/ui";

const empty: Partial<Subject> = { name: "", code: "", type: "theory" };

export default function Subjects() {
  const qc = useQueryClient();
  const { data: subjects = [], error } = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const [form, setForm] = useState<Partial<Subject>>(empty);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (error) setFeedback({ kind: "error", text: errorMessage(error) });
  }, [error]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["subjects"] });
  const save = useMutation({
    mutationFn: () => saveSubject(form),
    onSuccess: () => {
      setFeedback({ kind: "success", text: "Subject saved." });
      setForm(empty);
      refresh();
    },
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });
  const remove = useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => refresh(),
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });

  return (
    <div>
      <PageTitle title="Subjects" />
      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}
      <form
        className="card mb-6 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="mb-3 font-semibold">{form.id ? "Edit subject" : "Add subject"}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="s-name">Name</label>
            <input id="s-name" className="input" required value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="s-code">Code</label>
            <input id="s-code" className="input font-mono" required value={form.code ?? ""}
              onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="s-type">Type</label>
            <select id="s-type" className="input" value={form.type ?? "theory"}
              onChange={(e) => setForm({ ...form, type: e.target.value as Subject["type"] })}>
              <option value="theory">Theory (1-period jobs)</option>
              <option value="lab">Lab (2 consecutive periods, H8)</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            <Plus className="h-4 w-4" aria-hidden /> {form.id ? "Save changes" : "Add subject"}
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
              <th className="th">Code</th>
              <th className="th">Name</th>
              <th className="th">Type</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id} className="border-b border-line">
                <td className="td"><SubjectChip code={s.code} type={s.type} /></td>
                <td className="td font-medium">{s.name}</td>
                <td className="td capitalize">{s.type}</td>
                <td className="td">
                  <div className="flex gap-1">
                    <button className="btn-ghost !min-h-[36px] px-2" aria-label={`Edit ${s.name}`}
                      onClick={() => setForm(s)}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button className="btn-danger !min-h-[36px] px-2" aria-label={`Delete ${s.name}`}
                      onClick={() => remove.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr><td className="td text-muted" colSpan={4}>No subjects yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
