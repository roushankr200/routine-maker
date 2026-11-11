import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Save, Wand2 } from "lucide-react";
import { errorMessage, fetchConfig, saveConfig } from "../api";
import { Banner, PageTitle } from "../components/ui";

/** FR4: working days, periods/day, lunch position. Saving clears the routine. */
export default function Setup() {
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
      <PageTitle title="Setup — Time Structure">
        <Link className="btn-ghost" to="/setup/wizard">
          <Wand2 className="h-4 w-4" aria-hidden /> Set up a new department
        </Link>
        <Link className="btn-accent" to="/setup/guided">
          <BookOpen className="h-4 w-4" aria-hidden /> Set up from syllabus (guided)
        </Link>
      </PageTitle>
      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}
      <div className="card mb-5 max-w-2xl border-teal-300 px-5 py-4">
        <h2 className="mb-1 font-semibold">New department? Start from its syllabus.</h2>
        <p className="text-sm text-muted">
          The institute (NIT Agartala) and this time grid are the same for every department.
          The <strong>guided setup</strong> preloads every subject from the official syllabus
          catalogue (codes, hours, credits) and walks you semester by semester through
          assigning them to teachers. For a department with no catalogue, the{" "}
          <strong>setup wizard</strong> asks only what changes — department name, how many
          classes, courses and teachers — checks the numbers, and then the rule engine builds
          that department's routine in the same master format.
        </p>
      </div>
      <form
        className="card max-w-2xl px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="dept">Department name</label>
              <input id="dept" className="input" value={department}
                onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="dept-short">Department short name (masthead)</label>
              <input id="dept-short" className="input font-mono" value={departmentShort}
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
            <label className="label" htmlFor="days">Working days (comma separated)</label>
            <input id="days" className="input" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="ppd">Hourly slots per day</label>
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
              <label className="label" htmlFor="dur">Grid slot length (mins)</label>
              <input id="dur" className="input" type="number" min={5} max={240} value={periodDuration}
                onChange={(e) => setPeriodDuration(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="start">Day start time</label>
              <input id="start" className="input" type="time" value={startTime}
                onChange={(e) => setStartTime(e.target.value)} />
              <p className="mt-1 text-xs text-muted">Period clock times on the master sheet are computed from this.</p>
            </div>
            <div>
              <label className="label" htmlFor="session">Session (sheet header)</label>
              <input id="session" className="input" value={session}
                onChange={(e) => setSession(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="wef">w.e.f. date (sheet header)</label>
              <input id="wef" className="input" placeholder="27/07/2026" value={effectiveFrom}
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
