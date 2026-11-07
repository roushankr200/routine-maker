import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { errorMessage, fetchAvailability, fetchConfig, saveAvailability } from "../api";
import { Banner, PageTitle } from "../components/ui";

/** FR5: block full days or single periods for one teacher (H7). */
export default function Availability() {
  const { id = "" } = useParams();
  const { data, error } = useQuery({ queryKey: ["availability", id], queryFn: () => fetchAvailability(id) });
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (data) setBlocked(new Set(data.blocked));
  }, [data]);
  useEffect(() => {
    if (error) setFeedback({ kind: "error", text: errorMessage(error) });
  }, [error]);

  const save = useMutation({
    mutationFn: () => saveAvailability(id, [...blocked]),
    onSuccess: () => setFeedback({ kind: "success", text: `Availability saved for ${data?.teacher.name}.` }),
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });

  if (!data || !config) return <p className="text-muted">Loading…</p>;

  const toggle = (key: string) =>
    setBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const periods = Array.from({ length: config.periodsPerDay }, (_, i) => i + 1);

  return (
    <div>
      <PageTitle title={`Availability — ${data.teacher.name}`}>
        <Link className="btn-ghost" to="/teachers">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to teachers
        </Link>
        <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4" aria-hidden /> Save availability
        </button>
      </PageTitle>
      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}
      <p className="mb-4 text-sm text-muted">
        Tick the slots where this teacher is unavailable — the solver will never place them there
        (H7). Use the Day row to block a whole day.
      </p>
      <div className="card overflow-x-auto px-4 py-3">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-primary/60">
              <th className="th">Day</th>
              <th className="th text-center">Whole day</th>
              {periods.map((p) => (
                <th key={p} className="th text-center">P{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.days.map((day) => (
              <tr key={day} className="border-b border-line">
                <td className="td font-medium">{day}</td>
                <td className="td text-center">
                  <input type="checkbox" aria-label={`Block all of ${day}`}
                    checked={blocked.has(`${day}|null`)}
                    onChange={() => toggle(`${day}|null`)} />
                </td>
                {periods.map((p) => (
                  <td key={p} className="td text-center">
                    <input type="checkbox" aria-label={`Block ${day} period ${p}`}
                      checked={blocked.has(`${day}|${p}`) || blocked.has(`${day}|null`)}
                      disabled={blocked.has(`${day}|null`)}
                      onChange={() => toggle(`${day}|${p}`)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
