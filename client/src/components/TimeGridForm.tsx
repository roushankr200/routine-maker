import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { errorMessage, fetchConfig, saveConfig } from "../api";
import { Banner } from "./ui";

/**
 * The institute time grid (FR4): working days, periods/day, lunch
 * position. The grid is a product constant — the same for every
 * department — so it lives at the bottom of the unified Setup page
 * rather than as its own flow. Saving clears the routine.
 */
export default function TimeGridForm() {
  const { data, error } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });
  const [days, setDays] = useState("");
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [lunchAfter, setLunchAfter] = useState<number>(4);
  const [periodDuration, setPeriodDuration] = useState(60);
  const [startTime, setStartTime] = useState("09:00");
  const [session, setSession] = useState("ODD 2026");
  const [effectiveFrom, setEffectiveFrom] = useState("27/07/2026");
  const [department, setDepartment] = useState("Computer Science and Engineering");
  const [departmentShort, setDepartmentShort] = useState("CSE");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (data) {
      setDays(data.days.join(", "));
      setPeriodsPerDay(data.periodsPerDay);
      setLunchAfter(data.lunchAfter ?? 0);
      setPeriodDuration(data.periodDuration ?? 60);
      setStartTime(data.startTime ?? "09:00");
      setSession(data.session ?? "ODD 2026");
      setEffectiveFrom(data.effectiveFrom ?? "27/07/2026");
      setDepartment(data.department ?? "Computer Science and Engineering");
      setDepartmentShort(data.departmentShort ?? "CSE");
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
        startTime,
        session,
        effectiveFrom,
        department,
        departmentShort,
      }),
    onSuccess: (r) => setFeedback({ kind: "success", text: (r.data as { message: string }).message }),
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });

  return (
    <div>
      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="grid-dept">Department name</label>
              <input id="grid-dept" className="input" value={department}
                onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="grid-dept-short">Department short name (masthead)</label>
              <input id="grid-dept-short" className="input font-mono" value={departmentShort}
                onChange={(e) => setDepartmentShort(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted">
            Institute is fixed: <strong>NIT Agartala</strong>. The time grid below is the
            institute-fixed NITA standard (Mon–Fri, hourly grid of 7 slots, 9:00 AM–5:00 PM,
            lunch 1:00–2:00 after P4) — the same for every department. Sessions are blocks
            merged across these hourly slots (theory 1–2h, labs 2–3h; set per subject).
          </p>
          <div>
            <label className="label" htmlFor="grid-days">Working days (comma separated)</label>
            <input id="grid-days" className="input" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="grid-ppd">Hourly slots per day</label>
              <input id="grid-ppd" className="input" type="number" min={1} max={12} value={periodsPerDay}
                onChange={(e) => setPeriodsPerDay(Number(e.target.value))} />
            </div>
            <div>
              <label className="label" htmlFor="grid-lunch">Lunch after period (0 = none)</label>
              <input id="grid-lunch" className="input" type="number" min={0} max={12} value={lunchAfter}
                onChange={(e) => setLunchAfter(Number(e.target.value))} />
              <p className="mt-1 text-xs text-muted">Labs never span this break (H8).</p>
            </div>
            <div>
              <label className="label" htmlFor="grid-dur">Grid slot length (mins)</label>
              <input id="grid-dur" className="input" type="number" min={5} max={240} value={periodDuration}
                onChange={(e) => setPeriodDuration(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="grid-start">Day start time</label>
              <input id="grid-start" className="input" type="time" value={startTime}
                onChange={(e) => setStartTime(e.target.value)} />
              <p className="mt-1 text-xs text-muted">Period clock times on the master sheet are computed from this.</p>
            </div>
            <div>
              <label className="label" htmlFor="grid-session">Session (sheet header)</label>
              <input id="grid-session" className="input" value={session}
                onChange={(e) => setSession(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="grid-wef">w.e.f. date (sheet header)</label>
              <input id="grid-wef" className="input" placeholder="27/07/2026" value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)} />
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
