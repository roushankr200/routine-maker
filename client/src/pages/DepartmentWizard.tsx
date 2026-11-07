import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Play,
  Plus,
  RefreshCw,
  Scale,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  activateDepartment,
  errorMessage,
  generateRoutine,
  previewBalance,
  setupDepartment,
} from "../api";
import BalancePanel from "../components/BalancePanel";
import { Banner, PageTitle } from "../components/ui";
import { initialsCode } from "../utils/time";
import type { BalancePreviewPayload, DepartmentSetupResult, WizardPayload } from "../types";

/**
 * New Department setup wizard — question-first onboarding for any
 * NIT Agartala department.
 *
 * The institute (NIT Agartala) and the time grid (Mon–Fri, hourly grid
 * of 7 slots, 9:00–5:00, lunch 1–2 after P4) are PRODUCT CONSTANTS and
 * are never asked. The wizard only asks what varies per department:
 * its name, classes, courses, teachers and the weekly-hours mapping.
 * Nothing is written until Step 6 confirms: one POST creates a NEW
 * department ALONGSIDE the existing ones (multi-department storage) —
 * creating a department never deletes or replaces another one.
 */

const GRID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SLOTS_PER_WEEK = 35; // 5 days x 7 hourly slots — the fixed NITA grid

interface WClass {
  program: string;
  year: string;
  section: string;
}
interface WCourse {
  code: string;
  name: string;
  type: "theory" | "lab";
  sessionHours: number;
}
interface WTeacher {
  name: string;
  code: string;
  designation: string;
  maxPerDay: number;
  weeklyHours: number;
  subjects: string[]; // course codes
  unavailableDay: string; // "" = none
}

const STEPS = ["Department", "Classes", "Courses", "Teachers", "Mapping", "Review & Create"];

const emptyClass = (): WClass => ({ program: "B.Tech", year: "", section: "" });
const emptyCourse = (): WCourse => ({ code: "", name: "", type: "theory", sessionHours: 2 });
const emptyTeacher = (): WTeacher => ({
  name: "",
  code: "",
  designation: "",
  maxPerDay: 4,
  weeklyHours: 16,
  subjects: [],
  unavailableDay: "",
});

/** Resize a row list to the requested count (pad with fresh rows / truncate). */
function resized<T>(rows: T[], count: number, make: () => T): T[] {
  const n = Math.max(0, Math.min(60, Math.floor(count) || 0));
  if (n <= rows.length) return rows.slice(0, n);
  return [...rows, ...Array.from({ length: n - rows.length }, make)];
}

function CountPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <label className="label mb-0" htmlFor={`count-${label}`}>
        {label}
      </label>
      <input
        id={`count-${label}`}
        className="input w-24"
        type="number"
        min={0}
        max={60}
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-xs text-muted">rows are generated below — add or remove rows any time</span>
    </div>
  );
}

export default function DepartmentWizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  // Step 1 — department identity
  const [deptName, setDeptName] = useState("");
  const [deptShort, setDeptShort] = useState("");
  const [session, setSession] = useState("ODD 2026");
  const [effectiveFrom, setEffectiveFrom] = useState("27/07/2026");

  // Steps 2–4 — content rows
  const [classes, setClasses] = useState<WClass[]>([emptyClass()]);
  const [courses, setCourses] = useState<WCourse[]>([emptyCourse()]);
  const [teachers, setTeachers] = useState<WTeacher[]>([emptyTeacher()]);

  // Step 5 — weekly hours per (class, course); missing key = suggestion
  const [hours, setHours] = useState<Record<string, number>>({});
  const hourKey = (ci: number, code: string) => `${ci}|${code.toUpperCase()}`;
  const suggested = (c: WCourse) => (c.type === "lab" ? 3 : 4);
  const hourAt = (ci: number, c: WCourse) => hours[hourKey(ci, c.code)] ?? suggested(c);

  const [result, setResult] = useState<DepartmentSetupResult | null>(null);
  const [genFeedback, setGenFeedback] = useState<string | null>(null);

  // ---------------------------------------------------------- validation
  const courseCodes = useMemo(
    () => courses.map((c) => c.code.trim().toUpperCase()).filter(Boolean),
    [courses],
  );

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!deptName.trim()) return "Give the department its full name (e.g. Electronics and Communication Engineering).";
      if (!deptShort.trim()) return "Give the department a short name for the masthead (e.g. ECE).";
      if (!session.trim()) return "Session is required (e.g. ODD 2026).";
    }
    if (s === 1) {
      if (classes.length === 0) return "Add at least one class/section.";
      const seen = new Set<string>();
      for (const [i, c] of classes.entries()) {
        if (!c.program.trim() || !c.year.trim())
          return `Class ${i + 1}: program and semester/year are required.`;
        const key = `${c.program}|${c.year}|${c.section}`.toLowerCase();
        if (seen.has(key)) return `Class ${i + 1} duplicates an earlier class (same program, semester and section).`;
        seen.add(key);
      }
    }
    if (s === 2) {
      if (courses.length === 0) return "Add at least one course.";
      const seen = new Set<string>();
      for (const [i, c] of courses.entries()) {
        if (!c.code.trim() || !c.name.trim()) return `Course ${i + 1}: code and full name are required.`;
        const key = c.code.trim().toUpperCase();
        if (seen.has(key)) return `Duplicate course code "${c.code}" — codes must be unique.`;
        seen.add(key);
        if (c.type === "theory" && (c.sessionHours < 1 || c.sessionHours > 2))
          return `Course ${c.code}: theory sessions are 1 or 2 hours.`;
        if (c.type === "lab" && (c.sessionHours < 2 || c.sessionHours > 3))
          return `Course ${c.code}: lab sessions are 2 or 3 hours.`;
      }
    }
    if (s === 3) {
      if (teachers.length === 0) return "Add at least one teacher.";
      const seen = new Set<string>();
      for (const [i, t] of teachers.entries()) {
        if (!t.name.trim()) return `Teacher ${i + 1}: name is required.`;
        const key = t.code.trim().toUpperCase();
        if (key) {
          if (seen.has(key)) return `Faculty code "${t.code}" is used twice — codes print on the master sheet and must be unique.`;
          seen.add(key);
        }
        for (const code of t.subjects) {
          if (!courseCodes.includes(code.toUpperCase()))
            return `Teacher ${t.name} is marked for course "${code}", which no longer exists in Step 3.`;
        }
      }
    }
    if (s === 4) {
      for (const [ci, c] of classes.entries()) {
        const total = courses.reduce((sum, course) => sum + (hourAt(ci, course) || 0), 0);
        if (total > SLOTS_PER_WEEK)
          return `${c.program} ${c.year}${c.section ? ` ${c.section}` : ""} needs ${total}h but the fixed grid has only ${SLOTS_PER_WEEK} hours per week. Reduce some hours (0 = course not taken).`;
      }
    }
    return null;
  }

  // -------------------------------------------- review (step 6) checks
  const review = useMemo(() => {
    const demandBySubject = courses.map((course) => {
      const demand = classes.reduce((sum, _c, ci) => sum + (hourAt(ci, course) || 0), 0);
      const eligible = teachers.filter((t) =>
        t.subjects.some((code) => code.toUpperCase() === course.code.trim().toUpperCase()),
      );
      const capacity = eligible.reduce((sum, t) => sum + (t.weeklyHours || 0), 0);
      return { course, demand, eligible, capacity };
    });
    const demandByClass = classes.map((c, ci) => ({
      cls: c,
      total: courses.reduce((sum, course) => sum + (hourAt(ci, course) || 0), 0),
    }));
    const issues: string[] = [];
    const warnings: string[] = [];
    for (const d of demandBySubject) {
      if (d.demand > 0 && d.eligible.length === 0)
        issues.push(`${d.course.code} (${d.course.name}) needs ${d.demand}h/week but NO teacher can teach it. Go back to Step 4 and assign it.`);
      else if (d.demand > d.capacity)
        issues.push(`${d.course.code} needs ${d.demand}h/week but its teachers' combined weekly cap is ${d.capacity}h. Add a teacher or raise weekly hours in Step 4.`);
      if (d.demand === 0) warnings.push(`${d.course.code} is not taken by any class (0h everywhere) — it will be saved but unused.`);
    }
    for (const d of demandByClass) {
      if (d.total > SLOTS_PER_WEEK)
        issues.push(`${d.cls.program} ${d.cls.year} needs ${d.total}h — more than the ${SLOTS_PER_WEEK}h grid.`);
    }
    for (const t of teachers) {
      if (t.subjects.length === 0) warnings.push(`Teacher ${t.name || "(unnamed)"} can teach no course yet.`);
    }
    return { demandBySubject, demandByClass, issues, warnings };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, courses, teachers, hours]);

  // ------------------------------------------------------------- submit
  const buildPayload = (): WizardPayload => ({
    department: {
      name: deptName.trim(),
      short: deptShort.trim().toUpperCase(),
      session: session.trim(),
      effectiveFrom: effectiveFrom.trim(),
    },
    classes: classes.map((c) => ({
      program: c.program.trim(),
      year: c.year.trim(),
      section: c.section.trim(),
    })),
    subjects: courses.map((c) => ({
      name: c.name.trim(),
      code: c.code.trim(),
      type: c.type,
      sessionHours: c.sessionHours,
    })),
    teachers: teachers.map((t) => ({
      name: t.name.trim(),
      code: t.code.trim(),
      designation: t.designation.trim(),
      maxPerDay: t.maxPerDay,
      weeklyHours: t.weeklyHours,
      subjects: t.subjects.filter((code) => courseCodes.includes(code.toUpperCase())),
      unavailableDay: t.unavailableDay || null,
    })),
    classSubjects: classes.flatMap((_, ci) =>
      courses.map((course) => ({
        classIndex: ci,
        subjectCode: course.code.trim(),
        hours: hourAt(ci, course) || 0,
      })),
    ),
  });

  // ------------------------------------------ coverage & balance panel
  // Live preview (POST /api/balance/preview, debounced) shown on the
  // Teachers and Mapping steps: per course, the required hours still
  // LEFT to cover; per teacher, the suggested load — under-loaded
  // teachers are flagged so subjects can be redistributed to balance.
  const previewPayload: BalancePreviewPayload = {
    classes: classes.map((c) => ({
      program: c.program.trim(),
      year: c.year.trim(),
      section: c.section.trim(),
    })),
    subjects: courses
      .filter((c) => c.code.trim())
      .map((c) => ({
        name: c.name.trim(),
        code: c.code.trim(),
        type: c.type,
        sessionHours: c.sessionHours,
      })),
    teachers: teachers.map((t) => ({
      name: t.name.trim(),
      code: t.code.trim(),
      designation: t.designation.trim(),
      maxPerDay: t.maxPerDay,
      weeklyHours: t.weeklyHours,
      subjects: t.subjects.filter((code) => courseCodes.includes(code.toUpperCase())),
      unavailableDay: t.unavailableDay || null,
    })),
    classSubjects: classes.flatMap((_, ci) =>
      courses
        .filter((c) => c.code.trim())
        .map((course) => ({
          classIndex: ci,
          subjectCode: course.code.trim(),
          hours: hourAt(ci, course) || 0,
        })),
    ),
  };
  const canPreview = previewPayload.subjects.length > 0 && previewPayload.teachers.length > 0;
  const previewJson = JSON.stringify(previewPayload);
  const [debouncedPreviewJson, setDebouncedPreviewJson] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedPreviewJson(previewJson), 400);
    return () => clearTimeout(id);
  }, [previewJson]);
  const balanceQuery = useQuery({
    queryKey: ["balance-preview", debouncedPreviewJson],
    queryFn: () => previewBalance(JSON.parse(debouncedPreviewJson) as BalancePreviewPayload),
    enabled: canPreview && debouncedPreviewJson !== "" && (step === 3 || step === 4),
    retry: false,
  });

  const balanceCard = (note?: string) => (
    <div className="card mt-4 px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Scale className="h-5 w-5 text-primary" aria-hidden /> Coverage &amp; balance
        </h2>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => balanceQuery.refetch()}
          disabled={!canPreview || balanceQuery.isFetching}
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
        </button>
      </div>
      {!canPreview ? (
        <p className="text-sm text-muted">
          Give every course a code in Step 3 and keep at least one teacher here — the hours-left
          coverage and the suggested load per teacher appear in this panel.
        </p>
      ) : balanceQuery.isPending || balanceQuery.isFetching ? (
        <p className="text-sm text-muted">Computing coverage…</p>
      ) : balanceQuery.error ? (
        <p className="text-sm text-red-700">{errorMessage(balanceQuery.error)}</p>
      ) : balanceQuery.data ? (
        <BalancePanel report={balanceQuery.data} note={note} />
      ) : null}
    </div>
  );

  const [existsDept, setExistsDept] = useState<{ id: string; name: string; shortName: string } | null>(null);
  const create = useMutation({
    mutationFn: () => setupDepartment(buildPayload()),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries();
    },
    onError: (e) => {
      // 409: a department with this name already exists — never
      // overwrite it; offer switching to it instead.
      const resp = (e as { response?: { status?: number; data?: { departmentId?: string; department?: { id: string; name: string; shortName: string } } } }).response;
      if (resp?.status === 409 && resp.data?.department) {
        setExistsDept(resp.data.department);
        setStepError(null);
        return;
      }
      setStepError(errorMessage(e));
    },
  });
  const switchToExisting = useMutation({
    mutationFn: (id: string) => activateDepartment(id),
    onSuccess: () => {
      qc.clear();
      navigate("/");
      window.location.reload();
    },
    onError: (e) => setStepError(errorMessage(e)),
  });

  const generate = useMutation({
    mutationFn: generateRoutine,
    onSuccess: (r) => {
      qc.invalidateQueries();
      if (r.success) navigate("/routine");
      else setGenFeedback(r.message);
    },
    onError: (e) => setGenFeedback(errorMessage(e)),
  });

  const next = () => {
    const err = validateStep(step);
    if (err) return setStepError(err);
    setStepError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => {
    setStepError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  // -------------------------------------------------------------- render
  if (result) {
    return (
      <div>
        <PageTitle title="Department created" />
        <Banner kind="success" text={result.message} />
        <div className="card max-w-2xl px-5 py-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />
            {result.counts.classes} classes · {result.counts.subjects} courses ·{" "}
            {result.counts.teachers} teachers · {result.counts.classSubjects} mappings
          </h2>
          {result.validation.issues.length > 0 ? (
            <>
              <p className="mb-2 text-sm font-medium text-red-800">
                The data was saved, but these problems will block a full routine:
              </p>
              <ul className="mb-3 list-inside list-disc text-sm text-red-900">
                {result.validation.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mb-3 text-sm text-muted">
              Validation is clean — demand fits teacher capacity and the {result.validation.slotsPerWeek}h
              grid. Generate the routine now, or fix details any time on the Teachers / Subjects /
              Classes pages.
            </p>
          )}
          {genFeedback && <Banner kind="warning" text={genFeedback} />}
          <div className="flex flex-wrap gap-2">
            <button className="btn-accent" onClick={() => generate.mutate()} disabled={generate.isPending}>
              <Play className="h-4 w-4" aria-hidden /> Generate Routine
            </button>
            <Link className="btn-ghost" to="/validation">
              Open Validation
            </Link>
            <Link className="btn-ghost" to="/">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Set up a new department">
        <Link className="btn-ghost" to="/setup">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Setup
        </Link>
      </PageTitle>

      {/* Progress */}
      <ol className="mb-5 flex flex-wrap gap-1" aria-label="Wizard progress">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => i < step && (setStepError(null), setStep(i))}
              className={`flex min-h-[40px] items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-200 ${
                i === step
                  ? "bg-teal-50 font-semibold text-primary-dark"
                  : i < step
                    ? "text-ink hover:bg-teal-50/60"
                    : "text-muted"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs ${
                  i === step ? "bg-primary text-white" : "bg-teal-100 text-primary-dark"
                }`}
              >
                {i + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      {stepError && <Banner kind="error" text={stepError} />}

      {/* ------------------------------------------------ Step 1 */}
      {step === 0 && (
        <div className="card max-w-2xl px-5 py-4">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <Building2 className="h-5 w-5 text-primary" aria-hidden /> Which department?
          </h2>
          <p className="mb-4 text-sm text-muted">
            Institute is fixed: <strong>NIT Agartala</strong>. The time grid is also fixed for
            every department — Mon–Fri, 7 hourly slots, 9:00 AM–5:00 PM, lunch 1:00–2:00 after
            P4. Only the department's own content is asked here.
          </p>
          <div className="grid gap-4">
            <div>
              <label className="label" htmlFor="w-dept">Department name</label>
              <input id="w-dept" className="input" placeholder="Electronics and Communication Engineering"
                value={deptName} onChange={(e) => setDeptName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="w-short">Short name (masthead)</label>
                <input id="w-short" className="input font-mono" placeholder="ECE" maxLength={12}
                  value={deptShort} onChange={(e) => setDeptShort(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="w-session">Session</label>
                <input id="w-session" className="input" placeholder="ODD 2026"
                  value={session} onChange={(e) => setSession(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="w-wef">w.e.f. date</label>
                <input id="w-wef" className="input" placeholder="27/07/2026"
                  value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Step 2 */}
      {step === 1 && (
        <div className="card px-5 py-4">
          <h2 className="mb-1 font-semibold">How many classes/sections?</h2>
          <p className="mb-4 text-sm text-muted">
            One row per class that appears on the master sheet — e.g. B.Tech, 5th semester, Section A.
          </p>
          <CountPicker label="Number of classes" value={classes.length}
            onChange={(n) => setClasses((rows) => resized(rows, n, emptyClass))} />
          <div className="grid gap-3">
            {classes.map((c, i) => (
              <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <div>
                  <label className="label" htmlFor={`wc-p-${i}`}>Program</label>
                  <input id={`wc-p-${i}`} className="input" placeholder="B.Tech"
                    value={c.program}
                    onChange={(e) => setClasses((rows) => rows.map((r, j) => (j === i ? { ...r, program: e.target.value } : r)))} />
                </div>
                <div>
                  <label className="label" htmlFor={`wc-y-${i}`}>Semester / year</label>
                  <input id={`wc-y-${i}`} className="input" placeholder="5th"
                    value={c.year}
                    onChange={(e) => setClasses((rows) => rows.map((r, j) => (j === i ? { ...r, year: e.target.value } : r)))} />
                </div>
                <div>
                  <label className="label" htmlFor={`wc-s-${i}`}>Section</label>
                  <input id={`wc-s-${i}`} className="input" placeholder="A"
                    value={c.section}
                    onChange={(e) => setClasses((rows) => rows.map((r, j) => (j === i ? { ...r, section: e.target.value } : r)))} />
                </div>
                <button type="button" className="btn-danger" aria-label={`Remove class ${i + 1}`}
                  onClick={() => setClasses((rows) => rows.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost mt-4"
            onClick={() => setClasses((rows) => [...rows, emptyClass()])}>
            <Plus className="h-4 w-4" aria-hidden /> Add a class
          </button>
        </div>
      )}

      {/* ------------------------------------------------ Step 3 */}
      {step === 2 && (
        <div className="card px-5 py-4">
          <h2 className="mb-1 font-semibold">How many courses?</h2>
          <p className="mb-4 text-sm text-muted">
            Courses are the department's subjects. Session length is how long one sitting runs on
            the hourly grid: theory 1–2h (usually 2), labs 2–3h (usually 3).
          </p>
          <CountPicker label="Number of courses" value={courses.length}
            onChange={(n) => setCourses((rows) => resized(rows, n, emptyCourse))} />
          <div className="grid gap-3">
            {courses.map((c, i) => (
              <div key={i} className="grid items-end gap-3 sm:grid-cols-[110px_1fr_130px_130px_auto]">
                <div>
                  <label className="label" htmlFor={`ws-code-${i}`}>Code</label>
                  <input id={`ws-code-${i}`} className="input font-mono" placeholder="DSP"
                    value={c.code}
                    onChange={(e) => setCourses((rows) => rows.map((r, j) => (j === i ? { ...r, code: e.target.value } : r)))} />
                </div>
                <div>
                  <label className="label" htmlFor={`ws-name-${i}`}>Full name</label>
                  <input id={`ws-name-${i}`} className="input" placeholder="Digital Signal Processing"
                    value={c.name}
                    onChange={(e) => setCourses((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
                </div>
                <div>
                  <label className="label" htmlFor={`ws-type-${i}`}>Type</label>
                  <select id={`ws-type-${i}`} className="input" value={c.type}
                    onChange={(e) => {
                      const type = e.target.value as WCourse["type"];
                      setCourses((rows) => rows.map((r, j) => (j === i ? { ...r, type, sessionHours: type === "lab" ? 3 : 2 } : r)));
                    }}>
                    <option value="theory">Theory</option>
                    <option value="lab">Lab</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`ws-sh-${i}`}>Session length</label>
                  <select id={`ws-sh-${i}`} className="input" value={c.sessionHours}
                    onChange={(e) => setCourses((rows) => rows.map((r, j) => (j === i ? { ...r, sessionHours: Number(e.target.value) } : r)))}>
                    {c.type === "lab" ? (
                      <>
                        <option value={2}>2 hours</option>
                        <option value={3}>3 hours</option>
                      </>
                    ) : (
                      <>
                        <option value={1}>1 hour</option>
                        <option value={2}>2 hours</option>
                      </>
                    )}
                  </select>
                </div>
                <button type="button" className="btn-danger" aria-label={`Remove course ${i + 1}`}
                  onClick={() => setCourses((rows) => rows.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost mt-4"
            onClick={() => setCourses((rows) => [...rows, emptyCourse()])}>
            <Plus className="h-4 w-4" aria-hidden /> Add a course
          </button>
        </div>
      )}

      {/* ------------------------------------------------ Step 4 */}
      {step === 3 && (
        <div className="card px-5 py-4">
          <h2 className="mb-1 font-semibold">How many teachers?</h2>
          <p className="mb-4 text-sm text-muted">
            Tick every course each teacher can teach — the solver only assigns a course to a
            teacher who is ticked for it (rule H6). Limits are in hours: max per day and max per week.
          </p>
          <CountPicker label="Number of teachers" value={teachers.length}
            onChange={(n) => setTeachers((rows) => resized(rows, n, emptyTeacher))} />
          <div className="grid gap-4">
            {teachers.map((t, i) => (
              <fieldset key={i} className="rounded-md border border-line px-4 py-3">
                <legend className="px-1 text-sm font-semibold">Teacher {i + 1}</legend>
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_110px_110px_110px_150px_auto]">
                  <div>
                    <label className="label" htmlFor={`wt-name-${i}`}>Name</label>
                    <input id={`wt-name-${i}`} className="input" placeholder="Dr. Jane Roy"
                      value={t.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setTeachers((rows) => rows.map((r, j) =>
                          j === i
                            ? { ...r, name, code: !r.code || r.code === initialsCode(r.name) ? initialsCode(name) : r.code }
                            : r,
                        ));
                      }} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`wt-code-${i}`}>Code</label>
                    <input id={`wt-code-${i}`} className="input font-mono" placeholder="JR" maxLength={12}
                      value={t.code}
                      onChange={(e) => setTeachers((rows) => rows.map((r, j) => (j === i ? { ...r, code: e.target.value } : r)))} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`wt-max-${i}`}>Max hrs/day</label>
                    <input id={`wt-max-${i}`} className="input" type="number" min={0} max={20}
                      value={t.maxPerDay}
                      onChange={(e) => setTeachers((rows) => rows.map((r, j) => (j === i ? { ...r, maxPerDay: Number(e.target.value) } : r)))} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`wt-week-${i}`}>Max hrs/week</label>
                    <input id={`wt-week-${i}`} className="input" type="number" min={0} max={80}
                      value={t.weeklyHours}
                      onChange={(e) => setTeachers((rows) => rows.map((r, j) => (j === i ? { ...r, weeklyHours: Number(e.target.value) } : r)))} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`wt-off-${i}`}>Day off (optional)</label>
                    <select id={`wt-off-${i}`} className="input" value={t.unavailableDay}
                      onChange={(e) => setTeachers((rows) => rows.map((r, j) => (j === i ? { ...r, unavailableDay: e.target.value } : r)))}>
                      <option value="">None</option>
                      {GRID_DAYS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="btn-danger" aria-label={`Remove teacher ${i + 1}`}
                    onClick={() => setTeachers((rows) => rows.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="mt-3">
                  <span className="label">Can teach</span>
                  {courses.some((c) => c.code.trim()) ? (
                    <div className="flex flex-wrap gap-2">
                      {courses.filter((c) => c.code.trim()).map((c) => {
                        const code = c.code.trim();
                        const checked = t.subjects.some((s) => s.toUpperCase() === code.toUpperCase());
                        return (
                          <label key={code}
                            className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors duration-200 ${
                              checked ? "border-primary bg-teal-50 font-medium" : "border-line hover:bg-teal-50/60"
                            }`}>
                            <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={checked}
                              onChange={(e) =>
                                setTeachers((rows) => rows.map((r, j) =>
                                  j === i
                                    ? { ...r, subjects: e.target.checked ? [...r.subjects, code] : r.subjects.filter((s) => s.toUpperCase() !== code.toUpperCase()) }
                                    : r,
                                ))
                              } />
                            <span className="font-mono text-xs">{code}</span>
                            <span className="text-xs text-muted">{c.type === "lab" ? "Lab" : "Theory"}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">Give every course a code in Step 3 first — courses appear here as tick boxes.</p>
                  )}
                </div>
              </fieldset>
            ))}
          </div>
          <button type="button" className="btn-ghost mt-4"
            onClick={() => setTeachers((rows) => [...rows, emptyTeacher()])}>
            <Plus className="h-4 w-4" aria-hidden /> Add a teacher
          </button>
        </div>
      )}

      {/* ------------------------------------------------ Step 5 */}
      {step === 4 && (
        <div className="card px-5 py-4">
          <h2 className="mb-1 font-semibold">Weekly hours — which class takes which course?</h2>
          <p className="mb-4 text-sm text-muted">
            Hours per week for every class × course. Suggestions are prefilled (theory 4h, lab 3h);
            set <strong>0</strong> where a class does not take a course. A class can use at most{" "}
            {SLOTS_PER_WEEK}h — the fixed grid of 5 days × 7 slots.
          </p>
          <div className="grid gap-5">
            {classes.map((c, ci) => {
              const total = courses.reduce((sum, course) => sum + (hourAt(ci, course) || 0), 0);
              return (
                <fieldset key={ci} className="rounded-md border border-line px-4 py-3">
                  <legend className="px-1 text-sm font-semibold">
                    {c.program} {c.year}
                    {c.section ? ` — Section ${c.section}` : ""}{" "}
                    <span className={`ml-2 font-mono text-xs ${total > SLOTS_PER_WEEK ? "font-bold text-red-700" : "text-muted"}`}>
                      total {total}h / {SLOTS_PER_WEEK}h
                    </span>
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {courses.map((course) => (
                      <div key={course.code || course.name} className="flex items-center justify-between gap-3">
                        <label className="text-sm" htmlFor={`wm-${ci}-${course.code}`}>
                          <span className="font-mono text-xs font-semibold">{course.code || "?"}</span>{" "}
                          <span className="text-muted">{course.name}</span>
                        </label>
                        <input id={`wm-${ci}-${course.code}`} className="input w-20" type="number" min={0} max={35}
                          value={hourAt(ci, course)}
                          onChange={(e) =>
                            setHours((h) => ({ ...h, [hourKey(ci, course.code)]: Number(e.target.value) }))
                          } />
                      </div>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
          <div className="mt-4 rounded-md bg-teal-50 px-4 py-3 text-sm">
            <span className="font-semibold">Course demand so far: </span>
            {review.demandBySubject.map((d) => (
              <span key={d.course.code} className="mr-3 whitespace-nowrap">
                <span className="font-mono text-xs font-semibold">{d.course.code}</span> {d.demand}h
                <span className="text-muted"> (capacity {d.capacity}h)</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Step 6 */}
      {step === 5 && (
        <div className="grid gap-4">
          <div className="card px-5 py-4">
            <h2 className="mb-2 font-semibold">Review</h2>
            <dl className="grid gap-1 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Department</dt><dd className="font-medium">{deptName} ({deptShort.toUpperCase()}) — NIT Agartala</dd></div>
              <div><dt className="text-muted">Session</dt><dd className="font-medium">{session}, w.e.f. {effectiveFrom || "—"}</dd></div>
              <div><dt className="text-muted">Time grid (fixed)</dt><dd className="font-medium">Mon–Fri · 7 hourly slots · 9:00 AM–5:00 PM · lunch 1:00–2:00</dd></div>
              <div><dt className="text-muted">Content</dt><dd className="font-medium">{classes.length} classes · {courses.length} courses · {teachers.length} teachers</dd></div>
            </dl>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-primary/60">
                    <th className="th">Course</th>
                    <th className="th text-center">Demand (h/wk)</th>
                    <th className="th text-center">Teacher capacity (h/wk)</th>
                    <th className="th">Eligible teachers</th>
                  </tr>
                </thead>
                <tbody>
                  {review.demandBySubject.map((d) => (
                    <tr key={d.course.code} className="border-b border-line">
                      <td className="td"><span className="font-mono text-xs font-semibold">{d.course.code}</span> {d.course.name}</td>
                      <td className="td text-center font-mono">{d.demand}</td>
                      <td className="td text-center font-mono">{d.capacity}</td>
                      <td className="td">{d.eligible.map((t) => t.name).join(", ") || <span className="font-medium text-red-700">none</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted">
              Class totals:{" "}
              {review.demandByClass.map((d) => `${d.cls.program} ${d.cls.year}${d.cls.section ? ` ${d.cls.section}` : ""} = ${d.total}h`).join(" · ")}
            </p>
          </div>

          {review.issues.length > 0 && (
            <div className="card border-red-300 px-5 py-4">
              <h2 className="mb-2 font-semibold text-red-800">Problems to fix before a full routine is possible</h2>
              <ul className="list-inside list-disc text-sm text-red-900">
                {review.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}
          {review.warnings.length > 0 && (
            <div className="card px-5 py-4">
              <h2 className="mb-2 font-semibold">Notes</h2>
              <ul className="list-inside list-disc text-sm text-muted">
                {review.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <Banner
            kind="info"
            text="This creates a new department alongside your existing ones — nothing is deleted. Your other departments (including the built-in NITA CSE) keep all their teachers, courses, classes and routines, and you can switch between departments any time from the sidebar."
          />
          {existsDept && (
            <div className="card border-amber-300 px-5 py-4">
              <h2 className="mb-1 font-semibold">A department with this name already exists</h2>
              <p className="mb-3 text-sm text-muted">
                {existsDept.name} ({existsDept.shortName}) is already saved — it was NOT
                overwritten. Switch to it to view or edit its data, or go back and give this
                new department a different name.
              </p>
              <button
                type="button"
                className="btn-primary"
                disabled={switchToExisting.isPending}
                onClick={() => switchToExisting.mutate(existsDept.id)}
              >
                Switch to {existsDept.shortName}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Coverage & balance — live on the Teachers and Mapping steps */}
      {step === 3 &&
        balanceCard(
          "Required hours come from the Step 5 mapping — prefilled suggestions (theory 4h, lab 3h per class) until you edit them there.",
        )}
      {step === 4 && balanceCard()}

      {/* ------------------------------------------------ Nav */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-ghost" onClick={back} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn-primary" onClick={next}>
            Next: {STEPS[step + 1]} <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="btn-accent"
            disabled={create.isPending}
            onClick={() => {
              const err = validateStep(4) ?? validateStep(3) ?? validateStep(2) ?? validateStep(1) ?? validateStep(0);
              if (err) return setStepError(err);
              setStepError(null);
              create.mutate();
            }}
          >
            <Wand2 className="h-4 w-4" aria-hidden />
            {create.isPending ? "Creating…" : `Create ${deptShort ? deptShort.toUpperCase() : "department"} department`}
          </button>
        )}
      </div>
    </div>
  );
}
