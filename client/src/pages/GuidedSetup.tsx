import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  ListChecks,
  Play,
  Plus,
  Users,
} from "lucide-react";
import {
  activateDepartment,
  errorMessage,
  fetchCatalogue,
  generateRoutine,
  setupGuided,
} from "../api";
import { Banner, PageTitle } from "../components/ui";
import type {
  CatalogueSubject,
  GuidedSetupPayload,
  GuidedSetupResult,
} from "../types";

/**
 * Guided setup — set up a department FROM ITS SYLLABUS.
 *
 * Subjects are never typed in: the official syllabus catalogue
 * preloads every subject (code, syllabus code, L-T-P hours, credits)
 * for the chosen department. The flow walks semester by semester —
 * department -> programmes/session -> for each semester, assign every
 * preloaded subject to a teacher (or "XX" = no teacher yet) and pick
 * each section's electives — and only then creates the department
 * (POST /api/setup/guided, which re-resolves everything from the
 * server-side catalogue). The teacher pool carries across semesters;
 * the side panel shows each teacher's accumulated weekly load live.
 * Creating a department ADDS it alongside the existing ones.
 */

const SPEC_SHORT: Record<string, string> = {
  "Artificial Intelligence": "AI",
  "Cyber Security": "CYSEC",
  "Data Science & Engineering": "DSE",
};

interface GTeacher {
  name: string;
  code: string;
  weeklyHours: number;
}
interface GAssignment {
  teacherCode: string; // "" = unassigned, "XX" = no teacher yet
  electivePick?: string;
}
interface QueueClass {
  classKey: string;
  section: string;
  group?: "I" | "II";
  subjects: CatalogueSubject[];
}
interface QueueEntry {
  entryKey: string;
  programme: string;
  specialisation?: string;
  semester: number;
  classes: QueueClass[];
}

const programmeKey = (programme: string, specialisation?: string) =>
  specialisation ? `${programme}:${specialisation}` : programme;

function kindChip(kind: CatalogueSubject["kind"]) {
  const styles: Record<string, string> = {
    theory: "bg-teal-100 text-teal-900",
    lab: "bg-orange-100 text-orange-800",
    elective: "bg-amber-100 text-amber-900",
    seminar: "bg-slate-200 text-slate-700",
  };
  return (
    <span className={`chip ${styles[kind] ?? "bg-slate-100 text-slate-700"}`}>{kind}</span>
  );
}

export default function GuidedSetup() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: catalogue, error } = useQuery({
    queryKey: ["catalogue", "CSE"],
    queryFn: () => fetchCatalogue("CSE"),
  });

  // Step A state
  const [deptName, setDeptName] = useState("");
  const [deptShort, setDeptShort] = useState("");
  const [session, setSession] = useState("ODD 2026");
  const [effectiveFrom, setEffectiveFrom] = useState("27/07/2026");
  const [parity, setParity] = useState<"odd" | "even">("odd");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(["B.Tech", "MCA", "M.Tech:Artificial Intelligence", "M.Tech:Cyber Security", "M.Tech:Data Science & Engineering"]),
  );
  const [sections, setSections] = useState<Record<string, number>>({});

  // Teacher pool + assignments (persist across semester steps)
  const [teachers, setTeachers] = useState<GTeacher[]>([]);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newMax, setNewMax] = useState(24);
  const [assignments, setAssignments] = useState<Record<string, Record<string, GAssignment>>>({});

  const [step, setStep] = useState(0); // 0 = setup, 1..N = queue entries, N+1 = review
  const [feedback, setFeedback] = useState<{ kind: "success" | "error" | "warning"; text: string } | null>(null);
  const [result, setResult] = useState<GuidedSetupResult | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);

  // ------------------------------------------------------------ queue build
  const { queue, skipped } = useMemo(() => {
    const q: QueueEntry[] = [];
    const sk: string[] = [];
    if (!catalogue) return { queue: q, skipped: sk };
    const order = ["B.Tech", "M.Tech", "MCA"];
    const programmes = [...catalogue.programmes].sort(
      (a, b) => order.indexOf(a.programme) - order.indexOf(b.programme),
    );
    for (const prog of programmes) {
      const key = programmeKey(prog.programme, prog.specialisation);
      if (!selected.has(key)) continue;
      for (const semEntry of [...prog.semesters].sort((a, b) => a.semester - b.semester)) {
        const sem = semEntry.semester;
        if ((sem % 2 === 1) !== (parity === "odd")) continue;
        const year = Math.ceil(sem / 2);
        const allSubjects = semEntry.groups
          ? [...semEntry.groups.I, ...semEntry.groups.II]
          : (semEntry.subjects ?? []);
        if (allSubjects.every((s) => !s.timetabled)) {
          sk.push(
            `${prog.programme}${prog.specialisation ? ` ${SPEC_SHORT[prog.specialisation] ?? prog.specialisation}` : ""} Sem ${sem} — project/viva only, nothing to assign`,
          );
          continue;
        }
        const classes: QueueClass[] = [];
        if (semEntry.groups) {
          for (const g of ["I", "II"] as const) {
            classes.push({
              classKey: `${key}|${sem}|Group ${g}`,
              section: `Group ${g}`,
              group: g,
              subjects: semEntry.groups[g],
            });
          }
        } else {
          const count = sections[`${key}|${year}`] ?? (prog.programme === "B.Tech" ? 2 : 1);
          for (let i = 0; i < count; i++) {
            let section: string;
            if (prog.programme === "M.Tech") {
              const base = SPEC_SHORT[prog.specialisation ?? ""] ?? prog.specialisation ?? "";
              section = count === 1 ? base : `${base}-${String.fromCharCode(65 + i)}`;
            } else if (prog.programme === "MCA" && count === 1) {
              section = "";
            } else {
              section = String.fromCharCode(65 + i);
            }
            classes.push({
              classKey: `${key}|${sem}|${section || "-"}`,
              section,
              subjects: semEntry.subjects ?? [],
            });
          }
        }
        q.push({
          entryKey: `${key}|${sem}`,
          programme: prog.programme,
          specialisation: prog.specialisation,
          semester: sem,
          classes,
        });
      }
    }
    return { queue: q, skipped: sk };
  }, [catalogue, selected, parity, sections]);

  // ---------------------------------------------------------------- helpers
  const getAssignment = (classKey: string, subjectKey: string): GAssignment =>
    assignments[classKey]?.[subjectKey] ?? { teacherCode: "" };
  const setAssignment = (classKey: string, subjectKey: string, patch: Partial<GAssignment>) =>
    setAssignments((prev) => ({
      ...prev,
      [classKey]: {
        ...(prev[classKey] ?? {}),
        [subjectKey]: { ...(prev[classKey]?.[subjectKey] ?? { teacherCode: "" }), ...patch },
      },
    }));

  const entryProgress = (entry: QueueEntry) => {
    let total = 0;
    let done = 0;
    for (const cls of entry.classes) {
      for (const s of cls.subjects) {
        if (!s.timetabled) continue;
        total++;
        const a = getAssignment(cls.classKey, s.key);
        if (a.teacherCode !== "" && (s.kind !== "elective" || a.electivePick)) done++;
      }
    }
    return { total, done, complete: total > 0 && done === total };
  };

  const loads = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of queue) {
      for (const cls of entry.classes) {
        for (const s of cls.subjects) {
          if (!s.timetabled) continue;
          const a = assignments[cls.classKey]?.[s.key];
          if (a && a.teacherCode && a.teacherCode !== "XX") {
            map.set(a.teacherCode, (map.get(a.teacherCode) ?? 0) + s.weeklyHours);
          }
        }
      }
    }
    return map;
  }, [queue, assignments]);

  const overMax = teachers.filter((t) => (loads.get(t.code) ?? 0) > t.weeklyHours);

  const addTeacher = () => {
    const name = newName.trim();
    const code = newCode.trim().toUpperCase();
    if (!name || !code) return;
    if (code === "XX") {
      setFeedback({ kind: "error", text: 'Teacher code "XX" is reserved — it means "no teacher yet".' });
      return;
    }
    if (teachers.some((t) => t.code.toUpperCase() === code)) {
      setFeedback({ kind: "error", text: `Teacher code "${code}" is already in the pool.` });
      return;
    }
    setTeachers((prev) => [...prev, { name, code, weeklyHours: newMax }]);
    setNewName("");
    setNewCode("");
    setFeedback(null);
  };

  const create = useMutation({
    mutationFn: () => {
      const payload: GuidedSetupPayload = {
        catalogueId: "CSE",
        department: {
          name: deptName || catalogue?.name || "",
          short: deptShort || catalogue?.shortName || "",
          session,
          effectiveFrom,
        },
        teachers: teachers.map((t) => ({
          name: t.name,
          code: t.code,
          maxPerDay: 5,
          weeklyHours: t.weeklyHours,
        })),
        classes: queue.flatMap((entry) =>
          entry.classes.map((cls) => ({
            programme: entry.programme,
            specialisation: entry.specialisation,
            semester: entry.semester,
            section: cls.section,
            group: cls.group,
            assignments: cls.subjects
              .filter((s) => s.timetabled)
              .map((s) => {
                const a = getAssignment(cls.classKey, s.key);
                return {
                  key: s.key,
                  teacherCode: a.teacherCode,
                  ...(s.kind === "elective" ? { electivePick: a.electivePick } : {}),
                };
              }),
          })),
        ),
      };
      return setupGuided(payload);
    },
    onSuccess: (r) => {
      setResult(r);
      setFeedback({ kind: "success", text: r.message });
      qc.invalidateQueries();
    },
    onError: (e) => {
      const resp = (e as { response?: { status?: number; data?: { departmentId?: string; problems?: string[] } } }).response;
      if (resp?.status === 409 && resp.data?.departmentId) {
        setConflictId(resp.data.departmentId);
        setFeedback({
          kind: "warning",
          text: "A department with this name already exists. Switch to it instead — guided setup never overwrites an existing department.",
        });
        return;
      }
      if (resp?.data?.problems?.length) {
        setFeedback({ kind: "error", text: resp.data.problems.join(" ") });
        return;
      }
      setFeedback({ kind: "error", text: errorMessage(e) });
    },
  });
  const generate = useMutation({
    mutationFn: generateRoutine,
    onSuccess: (r) => setFeedback({ kind: r.success ? "success" : "warning", text: r.message }),
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });
  const switchDept = useMutation({
    mutationFn: (id: string) => activateDepartment(id),
    onSuccess: () => navigate("/"),
    onError: (e) => setFeedback({ kind: "error", text: errorMessage(e) }),
  });

  if (error) return <Banner kind="error" text={errorMessage(error)} />;
  if (!catalogue) return <p className="text-muted">Loading the syllabus catalogue…</p>;

  const totalSteps = queue.length + 2;
  const currentEntry = step >= 1 && step <= queue.length ? queue[step - 1] : null;
  const isReview = step === queue.length + 1;

  // ------------------------------------------------------------- Step A UI
  const renderSetup = () => (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="card px-5 py-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <GraduationCap className="h-5 w-5" aria-hidden /> Department & session
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="g-name">Department name</label>
            <input id="g-name" className="input" value={deptName}
              placeholder={catalogue.name}
              onChange={(e) => setDeptName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="g-short">Short name (masthead)</label>
            <input id="g-short" className="input font-mono" value={deptShort}
              placeholder={catalogue.shortName}
              onChange={(e) => setDeptShort(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="g-session">Session (sheet header)</label>
            <input id="g-session" className="input" value={session}
              onChange={(e) => setSession(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="g-wef">w.e.f. date</label>
            <input id="g-wef" className="input" value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="g-parity">Session type</label>
            <select id="g-parity" className="input" value={parity}
              onChange={(e) => setParity(e.target.value as "odd" | "even")}>
              <option value="odd">Odd semesters (1, 3, 5, 7)</option>
              <option value="even">Even semesters (2, 4, 6, 8)</option>
            </select>
          </div>
        </div>

        <h3 className="mb-2 mt-6 font-semibold">Programmes in this department</h3>
        <div className="grid gap-2">
          {catalogue.programmes.map((p) => {
            const key = programmeKey(p.programme, p.specialisation);
            const years = [...new Set(p.semesters.map((s) => Math.ceil(s.semester / 2)))].sort();
            return (
              <div key={key} className="rounded-md border border-line px-3 py-2">
                <label className="flex cursor-pointer items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(key);
                        else next.delete(key);
                        return next;
                      })
                    }
                  />
                  {p.programme}
                  {p.specialisation ? ` — ${p.specialisation}` : ""}
                </label>
                {selected.has(key) && (
                  <div className="mt-2 flex flex-wrap gap-4 pl-6">
                    {years.map((y) => {
                      const isFirstYearGroups = p.programme === "B.Tech" && y === 1;
                      const skey = `${key}|${y}`;
                      return (
                        <label key={y} className="flex items-center gap-2 text-sm text-muted">
                          Year {y} sections:
                          {isFirstYearGroups ? (
                            <span className="font-medium text-ink">2 — Group I + Group II (from the syllabus)</span>
                          ) : (
                            <input
                              type="number"
                              min={1}
                              max={6}
                              className="input w-16"
                              value={sections[skey] ?? (p.programme === "B.Tech" ? 2 : 1)}
                              onChange={(e) =>
                                setSections((prev) => ({
                                  ...prev,
                                  [skey]: Math.max(1, Math.min(6, Number(e.target.value) || 1)),
                                }))
                              }
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {skipped.length > 0 && (
          <p className="mt-4 text-sm text-muted">
            Auto-skipped (no subjects to assign): {skipped.join(" · ")}
          </p>
        )}
      </div>
      {renderTeacherPanel()}
    </div>
  );

  // -------------------------------------------------------- teacher panel
  const renderTeacherPanel = () => (
    <div className="card h-fit px-4 py-4 lg:sticky lg:top-4">
      <h3 className="mb-2 flex items-center gap-2 font-semibold">
        <Users className="h-4 w-4" aria-hidden /> Teacher pool
      </h3>
      <p className="mb-3 text-xs text-muted">
        Add each teacher once — the pool carries across all semesters. Loads below update
        live as you assign subjects.
      </p>
      <div className="grid gap-2">
        <input className="input" placeholder="Full name" value={newName}
          onChange={(e) => setNewName(e.target.value)} />
        <div className="flex gap-2">
          <input className="input font-mono" placeholder="Code (DJB)" value={newCode}
            onChange={(e) => setNewCode(e.target.value)} />
          <input className="input w-24" type="number" min={1} max={80} value={newMax}
            title="Weekly max hours"
            onChange={(e) => setNewMax(Number(e.target.value))} />
        </div>
        <button type="button" className="btn-ghost" onClick={addTeacher}>
          <Plus className="h-4 w-4" aria-hidden /> Add teacher
        </button>
      </div>
      <ul className="mt-3 space-y-1">
        {teachers.map((t) => {
          const load = loads.get(t.code) ?? 0;
          const over = load > t.weeklyHours;
          return (
            <li key={t.code} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-mono font-semibold">{t.code}</span>{" "}
                <span className="text-muted">{t.name}</span>
              </span>
              <span className={`font-mono text-xs ${over ? "font-bold text-red-700" : "text-muted"}`}>
                {load}/{t.weeklyHours}h{over ? " OVER" : ""}
              </span>
            </li>
          );
        })}
        {teachers.length === 0 && <li className="text-sm text-muted">No teachers yet.</li>}
      </ul>
    </div>
  );

  // ------------------------------------------------------- semester screen
  const renderEntry = (entry: QueueEntry) => {
    const progress = entryProgress(entry);
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="card mb-4 px-5 py-3">
            <h2 className="font-semibold">
              {entry.programme}
              {entry.specialisation ? ` — ${entry.specialisation}` : ""} · Semester {entry.semester}
            </h2>
            <p className="text-sm text-muted">
              {progress.done}/{progress.total} subjects assigned
              {progress.complete ? " — complete, continue to the next semester." : " — assign every subject (or mark XX) to continue."}
            </p>
          </div>
          {entry.classes.map((cls) => {
            const credits = cls.subjects.reduce((s, x) => s + x.credits, 0);
            return (
              <div key={cls.classKey} className="card mb-4 overflow-x-auto px-5 py-4">
                <h3 className="mb-1 font-semibold">
                  {entry.programme} Sem {entry.semester}
                  {cls.section ? ` — ${cls.section}` : ""}
                </h3>
                <p className="mb-3 text-xs text-muted">
                  Semester total: <span className="font-mono font-semibold text-ink">{credits} credits</span>{" "}
                  (from the syllabus, including project/viva items below)
                </p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-primary/60">
                      <th className="th">Subject</th>
                      <th className="th">Hours/wk</th>
                      <th className="th">Credits</th>
                      <th className="th">Elective pick</th>
                      <th className="th">Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cls.subjects.filter((s) => s.timetabled).map((s) => {
                      const a = getAssignment(cls.classKey, s.key);
                      return (
                        <tr key={s.key} className="border-b border-line">
                          <td className="td">
                            <span className="font-mono font-semibold">{s.shortCode}</span>{" "}
                            {kindChip(s.kind)}
                            <div className="text-[13px]">{s.title}</div>
                            {s.syllabusCode && (
                              <div className="font-mono text-[11px] text-muted">{s.syllabusCode}</div>
                            )}
                          </td>
                          <td className="td font-mono">{s.weeklyHours}h</td>
                          <td className="td font-mono">{s.credits}</td>
                          <td className="td">
                            {s.kind === "elective" ? (
                              <select
                                className="input min-w-[180px]"
                                value={a.electivePick ?? ""}
                                onChange={(e) =>
                                  setAssignment(cls.classKey, s.key, { electivePick: e.target.value || undefined })
                                }
                              >
                                <option value="">Choose elective…</option>
                                {(s.electivePool ?? []).map((o) => (
                                  <option key={o.shortCode} value={o.shortCode}>
                                    {o.shortCode} — {o.title}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="td">
                            <select
                              className="input min-w-[160px]"
                              value={a.teacherCode}
                              onChange={(e) =>
                                setAssignment(cls.classKey, s.key, { teacherCode: e.target.value })
                              }
                            >
                              <option value="">Assign teacher…</option>
                              {teachers.map((t) => (
                                <option key={t.code} value={t.code}>
                                  {t.code} — {t.name}
                                </option>
                              ))}
                              <option value="XX">XX — no teacher yet</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {cls.subjects.some((s) => !s.timetabled) && (
                  <p className="mt-3 text-xs text-muted">
                    Not timetabled (project/viva — in the syllabus, never on the routine):{" "}
                    {cls.subjects
                      .filter((s) => !s.timetabled)
                      .map((s) => `${s.title} (${s.credits} cr)`)
                      .join(" · ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {renderTeacherPanel()}
      </div>
    );
  };

  // -------------------------------------------------------------- review
  const renderReview = () => (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="card px-5 py-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <ListChecks className="h-5 w-5" aria-hidden /> Review & create
        </h2>
        {result ? (
          <div>
            <p className="mb-3 flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              {result.message}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link className="btn-primary" to="/">Go to Dashboard</Link>
              <button className="btn-accent" onClick={() => generate.mutate()} disabled={generate.isPending}>
                <Play className="h-4 w-4" aria-hidden /> Generate routine now
              </button>
              <Link className="btn-ghost" to="/routine">View master routine</Link>
            </div>
          </div>
        ) : (
          <>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-primary/60">
                  <th className="th">Semester</th>
                  <th className="th">Classes</th>
                  <th className="th">Subjects</th>
                  <th className="th">Credits</th>
                  <th className="th">Teachers used</th>
                  <th className="th">XX</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((entry) => {
                  let subjectCount = 0;
                  let credits = 0;
                  let xx = 0;
                  const used = new Set<string>();
                  for (const cls of entry.classes) {
                    credits += cls.subjects.reduce((s, x) => s + x.credits, 0);
                    for (const s of cls.subjects) {
                      if (!s.timetabled) continue;
                      subjectCount++;
                      const a = getAssignment(cls.classKey, s.key);
                      if (a.teacherCode === "XX") xx++;
                      else if (a.teacherCode) used.add(a.teacherCode);
                    }
                  }
                  return (
                    <tr key={entry.entryKey} className="border-b border-line">
                      <td className="td font-medium">
                        {entry.programme}
                        {entry.specialisation ? ` ${SPEC_SHORT[entry.specialisation] ?? ""}` : ""} Sem {entry.semester}
                      </td>
                      <td className="td font-mono">{entry.classes.length}</td>
                      <td className="td font-mono">{subjectCount}</td>
                      <td className="td font-mono">{credits}</td>
                      <td className="td font-mono">{used.size}</td>
                      <td className="td font-mono">{xx}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {overMax.length > 0 && (
              <p className="mt-3 text-sm font-medium text-red-700">
                Over their weekly max: {overMax.map((t) => `${t.code} (${loads.get(t.code)}/${t.weeklyHours}h)`).join(", ")}.
                Go back and rebalance before creating — the server rejects over-max assignments.
              </p>
            )}
            {conflictId && (
              <div className="mt-3">
                <button className="btn-ghost" onClick={() => switchDept.mutate(conflictId)}>
                  Switch to the existing department
                </button>
              </div>
            )}
            <button
              className="btn-primary mt-4"
              disabled={create.isPending || teachers.length === 0 || overMax.length > 0}
              onClick={() => create.mutate()}
            >
              <BookOpen className="h-4 w-4" aria-hidden /> Create department & classes
            </button>
            {teachers.length === 0 && (
              <p className="mt-2 text-sm text-muted">Add at least one teacher to the pool first.</p>
            )}
          </>
        )}
      </div>
      {renderTeacherPanel()}
    </div>
  );

  const currentComplete = currentEntry ? entryProgress(currentEntry).complete : true;

  return (
    <div>
      <PageTitle title="Guided setup — from the syllabus">
        <Link className="btn-ghost" to="/setup/wizard">
          Manual wizard instead
        </Link>
      </PageTitle>
      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Subjects come preloaded from the official {catalogue.shortName} syllabus — with their
        codes, weekly hours and <strong>credits</strong>. You only add the teachers and assign
        each subject, semester by semester. Nothing is created until the final review, and
        creating never deletes an existing department.
      </p>

      {/* Stepper */}
      <div className="no-print mb-5 flex flex-wrap items-center gap-1 text-xs font-medium">
        <span className={`rounded-full px-2.5 py-1 ${step === 0 ? "bg-primary text-white" : "bg-teal-100 text-teal-900"}`}>
          1 · Department
        </span>
        {queue.map((entry, i) => (
          <span key={entry.entryKey} className="flex items-center gap-1">
            <span aria-hidden>→</span>
            <span className={`rounded-full px-2.5 py-1 ${step === i + 1 ? "bg-primary text-white" : "bg-teal-100 text-teal-900"}`}>
              {entry.programme}
              {entry.specialisation ? ` ${SPEC_SHORT[entry.specialisation] ?? ""}` : ""} Sem {entry.semester}
            </span>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span aria-hidden>→</span>
          <span className={`rounded-full px-2.5 py-1 ${isReview ? "bg-primary text-white" : "bg-teal-100 text-teal-900"}`}>
            Review & Create
          </span>
        </span>
      </div>

      {step === 0 && renderSetup()}
      {currentEntry && renderEntry(currentEntry)}
      {isReview && renderReview()}

      {/* Nav */}
      {!result && (
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            className="btn-ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </button>
          <span className="text-sm text-muted">
            Step {step + 1} of {totalSteps}
          </span>
          {!isReview ? (
            <button
              type="button"
              className="btn-primary"
              disabled={(step === 0 && (selected.size === 0 || queue.length === 0)) || (currentEntry !== null && !currentComplete)}
              onClick={() => setStep((s) => Math.min(queue.length + 1, s + 1))}
            >
              {currentEntry ? "Next semester" : "Start assigning"} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
