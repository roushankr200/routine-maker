import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { errorMessage, fetchConfig, saveConfig } from "../api";
import { Banner, PageTitle } from "../components/ui";

/** FR4: working days, periods/day, lunch position. Saving clears the routine. */
export default function Setup() {
  const { data, error } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });
  const [days, setDays] = useState("");
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [lunchAfter, setLunchAfter] = useState<number>(4);
  const [periodDuration, setPeriodDuration] = useState(50);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (data) {
      setDays(data.days.join(", "));
      setPeriodsPerDay(data.periodsPerDay);
      setLunchAfter(data.lunchAfter ?? 0);
      setPeriodDuration(data.periodDuration ?? 50);
    }
  }, [data]);
  useEffect(() => {
    if (error) setFeedback({ kind: "error", text: errorMessage(error) });
  }, [error]);

  const save = useMutation({
    mutationFn: () =>
      saveConfig({
        days: days.split(",").map((d) => d.trim()).filter(Boolean),
        periodsPerDay,
        lunchAfter,
        periodDuration,
      }),
    onSuccess: (r) => setFeedback({ kind: "success", text: (r.data as { message: string }).message }),
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });

  return (
    <div>
      <PageTitle title="Setup — Time Structure" />
      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}
      <form
        className="card max-w-2xl px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4">
          <div>
            <label className="label" htmlFor="days">Working days (comma separated)</label>
            <input id="days" className="input" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="ppd">Periods per day</label>
              <input id="ppd" className="input" type="number" min={1} max={12} value={periodsPerDay}
                onChange={(e) => setPeriodsPerDay(Number(e.target.value))} />
            </div>
            <div>
              <label className="label" htmlFor="lunch">Lunch after period (0 = none)</label>
              <input id="lunch" className="input" type="number" min={0} max={12} value={lunchAfter}
                onChange={(e) => setLunchAfter(Number(e.target.value))} />
              <p className="mt-1 text-xs text-muted">Labs never span this break (H8).</p>
            </div>
            <div>
              <label className="label" htmlFor="dur">Period duration (mins)</label>
              <input id="dur" className="input" type="number" min={5} max={240} value={periodDuration}
                onChange={(e) => setPeriodDuration(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <button type="submit" className="btn-primary mt-5" disabled={save.isPending}>
          <Save className="h-4 w-4" aria-hidden /> Save time structure
        </button>
        <p className="mt-2 text-xs text-muted">
          Saving a new grid clears the generated routine — it no longer fits the old grid.
        </p>
      </form>
    </div>
  );
}
