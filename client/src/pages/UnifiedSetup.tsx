import { useEffect, useMemo, useRef, useState } from "react";
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
  Trash2,
  Users,
} from "lucide-react";
import {
  activateDepartment,
  errorMessage,
  fetchCatalogue,
  fetchFaculty,
  fetchRegistry,
  generateRoutine,
  setupGuided,
} from "../api";
import { Banner, PageTitle } from "../components/ui";
import TimeGridForm from "../components/TimeGridForm";
import type {
  CatalogueSubject,
  CustomSubjectPayload,
  GuidedSetupPayload,
  GuidedSetupResult,
} from "../types";

/**
 * THE setup (v2.4) — one page replacing the old guided setup and the
 * manual wizard.
 *
 * Step 1 picks the department from a dropdown of all 14 NITA units
 * (or "Other"): the website faculty list preloads into the teacher
 * pool (untick to exclude, codes editable, more teachers addable by
 * hand) and, where NITA publishes a course structure, the syllabus
 * catalogue preloads every subject (code, hours, credits). The flow
 * then walks semester by semester assigning subjects to teachers,
 * gated at 100% per semester; manual subjects can be added to any
 * class, and departments without a catalogue build their classes by
 * hand in this same page. Creating ADDS the department alongside the
 * existing ones (POST /api/setup/guided).
 */

const SPEC_SHORT_OVERRIDES: Record<string, string> = {
  "Artificial Intelligence": "AI",
  "Cyber Security": "CYSEC",
  "Data Science & Engineering": "DSE",
};
export function specShort(spec?: string): string {
  if (!spec) return "";
  if (SPEC_SHORT_OVERRIDES[spec]) return SPEC_SHORT_OVERRIDES[spec];
  return spec
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w))
    .map((w) => w.replace(/[^A-Za-z]/g, "")[0] ?? "")
    .join("")
    .toUpperCase();
}

interface GTeacher {
  name: string;
  code: string;
  designation: string;
  weeklyHours: number;
  /** Set for website-preloaded teachers (server re-resolves the name). */
  facultyCode?: string;
  included: boolean;
}
interface SubjectNumbers {
  weeklyHours: number;
  sessionHours: number;
  credits: number;
}
interface GAssignment {
  teacherCode: string; // "" = unassigned, "XX" = no teacher yet
  electivePick?: string;
  customPick?: { shortCode: string; title: string };
  numbers?: Partial<SubjectNumbers>;
}
interface QueueClass {
  classKey: string;
  section: string;
  group?: "I" | "II";
  subjects: CatalogueSubject[];
  customs: CustomSubjectPayload[];
  custom: boolean;
}
interface QueueEntry {
  entryKey: string;
  programme: string;
  specialisation?: string;
  semester: number;
  classes: QueueClass[];
}
interface ManualClass {
  id: number;
  programme: string;
  semester: number;
  section: string;
}

const programmeKey = (programme: string, specialisation?: string) =>
  specialisation ? `${programme}:${specialisation}` : programme;
const OTHER = "__other__";

function kindChip(kind: string) {
  const styles: Record<string, string> = {
    theory: "bg-teal-100 text-teal-900",
    lab: "bg-orange-100 text-orange-800",
    elective: "bg-amber-100 text-amber-900",
    seminar: "bg-slate-200 text-slate-700",
    manual: "bg-violet-100 text-violet-900",
  };
  return (
    <span className={`chip ${styles[kind] ?? "bg-slate-100 text-slate-700"}`}>{kind}</span>
  );
}

export default function UnifiedSetup() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: registry } = useQuery({ queryKey: ["registry"], queryFn: fetchRegistry });
  const [deptChoice, setDeptChoice] = useState<string>("");
  const registryEntry = registry?.find((d) => d.id === deptChoice);
  const hasCatalogue = !!registryEntry?.hasCatalogue;
  const isManualMode = deptChoice === OTHER || (!!registryEntry && !hasCatalogue);

  const { data: catalogue } = useQuery({
    queryKey: ["catalogue", deptChoice],
    queryFn: () => fetchCatalogue(deptChoice),
    enabled: hasCatalogue,
  });
  const { data: facultyData } = useQuery({
    queryKey: ["faculty", deptChoice],
    queryFn: () => fetchFaculty(deptChoice),
    enabled: !!registryEntry,
  });

  // Step A state
  const [deptName, setDeptName] = useState("");
  const [deptShort, setDeptShort] = useState("");
  const [session, setSession] = useState("ODD 2026");
  const [effectiveFrom, setEffectiveFrom] = useState("27/07/2026");
  const [parity, setParity] = useState<"odd" | "even">("odd");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sections, setSections] = useState<Record<string, number>>({});

  // Teacher pool + assignments + manual additions (persist across steps)
  const [teachers, setTeachers] = useState<GTeacher[]>([]);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newMax, setNewMax] = useState(24);
  const [assignments, setAssignments] = useState<Record<string, Record<string, GAssignment>>>({});
  const [customByClass, setCustomByClass] = useState<Record<string, CustomSubjectPayload[]>>({});
  const [manualClasses, setManualClasses] = useState<ManualClass[]>([]);
  const [mcProgramme, setMcProgramme] = useState("");
  const [mcSemester, setMcSemester] = useState(1);
  const [mcSection, setMcSection] = useState("");
  const nextManualId = useRef(1);

  const [step, setStep] = useState(0); // 0 = setup, 1..N = queue entries, N+1 = review
  const [feedback, setFeedback] = useState<{ kind: "success" | "error" | "warning"; text: string } | null>(null);
  const [result, setResult] = useState<GuidedSetupResult | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);

  // Department picked: prefill identity; drop the previous
  // department's faculty preloads (manual teachers stay).
  useEffect(() => {
    setStep(0);
    setAssignments({});
    setCustomByClass({});
    setSections({});
    setManualClasses([]);
    if (registryEntry) {
      setDeptName(registryEntry.name);
      setDeptShort(registryEntry.shortName);
    } else if (deptChoice === OTHER) {
      setDeptName("");
      setDeptShort("");
    }
    setTeachers((prev) => prev.filter((t) => !t.facultyCode));
    seededFor.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptChoice]);

  // Faculty list arrived: seed the pool (once per department).
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!facultyData || seededFor.current === deptChoice) return;
    seededFor.current = deptChoice;
    setTeachers((prev) => [
      ...prev.filter((t) => !t.facultyCode),
      ...facultyData.faculty.map((m) => ({
        name: m.name,
        code: m.code,
        designation: m.designation,
        weeklyHours: 24,
        facultyCode: m.code,
        included: true,
      })),
    ]);
  }, [facultyData, deptChoice]);

  // Catalogue arrived: tick every programme by default.
  useEffect(() => {
    if (catalogue) {
      setSelected(new Set(catalogue.programmes.map((p) => programmeKey(p.programme, p.specialisation))));
    }
  }, [catalogue]);

  // ------------------------------------------------------------ queue build
  const { queue, skipped } = useMemo(() => {
    const q: QueueEntry[] = [];
    const sk: string[] = [];
    if (isManualMode) {
      const byKey = new Map<string, QueueEntry>();
      for (const mc of manualClasses) {
        const classKey = `manual|${mc.id}`;
        const entryKey = `${mc.programme}|${mc.semester}`;
        if (!byKey.has(entryKey)) {
          byKey.set(entryKey, {
            entryKey,
            programme: mc.programme,
            semester: mc.semester,
            classes: [],
          });
          q.push(byKey.get(entryKey)!);
        }
        byKey.get(entryKey)!.classes.push({
          classKey,
          section: mc.section,
          subjects: [],
          customs: customByClass[classKey] ?? [],
          custom: true,
        });
      }
      return { queue: q, skipped: sk };
    }
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
            `${prog.programme}${prog.specialisation ? ` ${specShort(prog.specialisation)}` : ""} Sem ${sem} — project/viva only, nothing to assign`,
          );
          continue;
        }
        const classes: QueueClass[] = [];
        if (semEntry.groups) {
          for (const g of ["I", "II"] as const) {
            const classKey = `${key}|${sem}|Group ${g}`;
            classes.push({
              classKey,
              section: `Group ${g}`,
              group: g,
              subjects: semEntry.groups[g],
              customs: customByClass[classKey] ?? [],
              custom: false,
            });
          }
        } else {
          const count = sections[`${key}|${year}`] ?? (prog.programme === "B.Tech" ? 2 : 1);
          for (let i = 0; i < count; i++) {
            let section: string;
            if (prog.programme === "M.Tech") {
              const base = specShort(prog.specialisation) || (prog.specialisation ?? "");
              section = count === 1 ? base : `${base}-${String.fromCharCode(65 + i)}`;
            } else if (prog.programme === "MCA" && count === 1) {
              section = "";
            } else {
              section = String.fromCharCode(65 + i);
            }
            const classKey = `${key}|${sem}|${section || "-"}`;
            classes.push({
              classKey,
              section,
              subjects: semEntry.subjects ?? [],
              customs: customByClass[classKey] ?? [],
              custom: false,
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
  }, [catalogue, selected, parity, sections, customByClass, manualClasses, isManualMode]);

  // ---------------------------------------------------------------- helpers
  const includedTeachers = teachers.filter((t) => t.included);
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

  const numbersComplete = (a: GAssignment): a is GAssignment & { numbers: SubjectNumbers } => {
    const n = a.numbers;
    return (
      !!n &&
      typeof n.weeklyHours === "number" && n.weeklyHours >= 1 &&
      typeof n.sessionHours === "number" && n.sessionHours >= 1 && n.sessionHours <= 3 &&
      n.sessionHours <= n.weeklyHours &&
      typeof n.credits === "number" && n.credits >= 0
    );
  };
  const subjectDone = (classKey: string, s: CatalogueSubject): boolean => {
    const a = getAssignment(classKey, s.key);
    if (!a.teacherCode) return false;
    if (s.kind === "elective") {
      const pool = s.electivePool ?? [];
      if (pool.length > 0) {
        if (!a.electivePick) return false;
      } else if (!a.customPick?.shortCode.trim() || !a.customPick?.title.trim()) {
        return false;
      }
    }
    if (s.weeklyHours === null && !numbersComplete(a)) return false;
    return true;
  };
  const subjectHours = (classKey: string, s: CatalogueSubject): number => {
    const a = getAssignment(classKey, s.key);
    return a.numbers?.weeklyHours ?? s.weeklyHours ?? 0;
  };

  const entryProgress = (entry: QueueEntry) => {
    let total = 0;
    let done = 0;
    let hasEmptyClass = false;
    for (const cls of entry.classes) {
      const classTotal =
        cls.subjects.filter((s) => s.timetabled).length + cls.customs.length;
      if (cls.custom && cls.customs.length === 0) hasEmptyClass = true;
      total += classTotal;
      for (const s of cls.subjects) {
        if (!s.timetabled) continue;
        if (subjectDone(cls.classKey, s)) done++;
      }
      for (const c of cls.customs) {
        if (getAssignment(cls.classKey, c.shortCode).teacherCode) done++;
      }
    }
    return { total, done, complete: !hasEmptyClass && total > 0 && done === total, hasEmptyClass };
  };

  const loads = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of queue) {
      for (const cls of entry.classes) {
        for (const s of cls.subjects) {
          if (!s.timetabled) continue;
          const a = assignments[cls.classKey]?.[s.key];
          if (a && a.teacherCode && a.teacherCode !== "XX") {
            map.set(a.teacherCode, (map.get(a.teacherCode) ?? 0) + subjectHours(cls.classKey, s));
          }
        }
        for (const c of cls.customs) {
          const a = assignments[cls.classKey]?.[c.shortCode];
          if (a && a.teacherCode && a.teacherCode !== "XX") {
            map.set(a.teacherCode, (map.get(a.teacherCode) ?? 0) + c.weeklyHours);
          }
        }
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, assignments]);

  const overMax = includedTeachers.filter((t) => (loads.get(t.code) ?? 0) > t.weeklyHours);
  const allComplete = queue.length > 0 && queue.every((e) => entryProgress(e).complete);

  const renameTeacherCode = (oldCode: string, newCode: string) => {
    setTeachers((prev) => prev.map((t) => (t.code === oldCode ? { ...t, code: newCode } : t)));
    setAssignments((prev) => {
      const next: typeof prev = {};
      for (const [classKey, bySubject] of Object.entries(prev)) {
        next[classKey] = Object.fromEntries(
          Object.entries(bySubject).map(([k, a]) => [
            k,
            a.teacherCode === oldCode ? { ...a, teacherCode: newCode } : a,
          ]),
        );
      }
      return next;
    });
  };

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
    setTeachers((prev) => [...prev, { name, code, designation: "", weeklyHours: newMax, included: true }]);
    setNewName("");
    setNewCode("");
    setFeedback(null);
  };

  const addCustomSubject = (cls: QueueClass, draft: CustomSubjectPayload) => {
    const code = draft.shortCode.trim().toUpperCase();
    if (!code || !draft.title.trim()) {
      setFeedback({ kind: "error", text: "A manual subject needs a code and a title." });
      return false;
    }
    if (
      cls.subjects.some((s) => s.key === code) ||
      cls.customs.some((c) => c.shortCode === code)
    ) {
      setFeedback({ kind: "error", text: `Subject code "${code}" already exists in this class.` });
      return false;
    }
    setCustomByClass((prev) => ({
      ...prev,
      [cls.classKey]: [...(prev[cls.classKey] ?? []), { ...draft, shortCode: code }],
    }));
    setFeedback(null);
    return true;
  };
  const removeCustomSubject = (cls: QueueClass, code: string) => {
    setCustomByClass((prev) => ({
      ...prev,
      [cls.classKey]: (prev[cls.classKey] ?? []).filter((c) => c.shortCode !== code),
    }));
  };

  const addManualClass = () => {
    const programme = mcProgramme.trim();
    if (!programme) {
      setFeedback({ kind: "error", text: "A class needs a programme name (e.g. B.Sc.-M.Sc. (Integrated))." });
      return;
    }
    setManualClasses((prev) => [
      ...prev,
      { id: nextManualId.current++, programme, semester: mcSemester, section: mcSection.trim() },
    ]);
    setMcSection("");
    setFeedback(null);
  };

  // ----------------------------------------------------------------- create
  const create = useMutation({
    mutationFn: () => {
      const payload: GuidedSetupPayload = {
        ...(hasCatalogue ? { catalogueId: deptChoice } : {}),
        ...(registryEntry && teachers.some((t) => t.included && t.facultyCode)
          ? { facultyDeptId: deptChoice }
          : {}),
        department: {
          name: deptName || registryEntry?.name || "",
          short: deptShort || registryEntry?.shortName || "",
          session,
          effectiveFrom,
        },
        teachers: includedTeachers.map((t) =>
          t.facultyCode
            ? { facultyCode: t.facultyCode, code: t.code, weeklyHours: t.weeklyHours }
            : {
                name: t.name,
                code: t.code,
                designation: t.designation,
                maxPerDay: 5,
                weeklyHours: t.weeklyHours,
              },
        ),
        classes: queue.flatMap((entry) =>
          entry.classes.map((cls) => ({
            programme: entry.programme,
            specialisation: entry.specialisation,
            semester: entry.semester,
            section: cls.section,
            group: cls.group,
            ...(cls.custom ? { custom: true } : {}),
            ...(cls.customs.length ? { customSubjects: cls.customs } : {}),
            assignments: [
              ...cls.subjects
                .filter((s) => s.timetabled)
                .map((s) => {
                  const a = getAssignment(cls.classKey, s.key);
                  return {
                    key: s.key,
                    teacherCode: a.teacherCode,
                    ...(s.kind === "elective" && (s.electivePool ?? []).length > 0
                      ? { electivePick: a.electivePick }
                      : {}),
                    ...(s.kind === "elective" && (s.electivePool ?? []).length === 0 && a.customPick
                      ? { customPick: a.customPick }
                      : {}),
                    ...(s.weeklyHours === null && a.numbers
                      ? {
                          weeklyHours: a.numbers.weeklyHours,
                          sessionHours: a.numbers.sessionHours,
                          credits: a.numbers.credits,
                        }
                      : {}),
                  };
                }),
              ...cls.customs.map((c) => ({
                key: c.shortCode,
                teacherCode: getAssignment(cls.classKey, c.shortCode).teacherCode,
              })),
            ],
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
          text: "A department with this name already exists. Switch to it instead — setup never overwrites an existing department.",
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

  const totalSteps = queue.length + 2;
  const currentEntry = step >= 1 && step <= queue.length ? queue[step - 1] : null;
  const isReview = step === queue.length + 1 && queue.length > 0;

  const preloadInfo = () => {
    if (!deptChoice) return "Pick the department — its teachers (and courses, where NITA publishes them) preload automatically.";
    if (deptChoice === OTHER)
      return "A department not on the NITA website list — teachers and courses are added manually in this same setup.";
    if (!registryEntry) return "";
    if (registryEntry.id === "EDUCATION")
      return "Education has no listing on the NITA website — teachers and courses are added manually in this same setup.";
    if (registryEntry.hasCatalogue)
      return `${registryEntry.facultyCount} teachers will load from nita.ac.in · course catalogue available (${catalogue ? catalogue.programmes.map((p) => p.programme + (p.specialisation ? ` ${specShort(p.specialisation)}` : "")).join(", ") : "…"}).`;
    return `${registryEntry.facultyCount} teachers will load from nita.ac.in · no published course structure — faculty preloads, courses are added manually in this same setup.`;
  };

  // ------------------------------------------------------------- Step A UI
  const renderSetup = () => (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="card px-5 py-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <GraduationCap className="h-5 w-5" aria-hidden /> Department & session
          </h2>
          <div className="grid gap-4">
            <div>
              <label className="label" htmlFor="u-dept">Department</label>
              <select
                id="u-dept"
                className="input"
                value={deptChoice}
                onChange={(e) => setDeptChoice(e.target.value)}
              >
                <option value="">Choose a department…</option>
                {(registry ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.shortName} — {d.name}
                  </option>
                ))}
                <option value={OTHER}>Other department (enter manually)</option>
              </select>
              <p aria-live="polite" className="mt-2 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
                {preloadInfo()}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="u-name">Department name</label>
                <input id="u-name" className="input" value={deptName}
                  placeholder={registryEntry?.name ?? "e.g. Physics"}
                  onChange={(e) => setDeptName(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="u-short">Short name (masthead)</label>
                <input id="u-short" className="input font-mono" value={deptShort}
                  placeholder={registryEntry?.shortName ?? "PHY"}
                  onChange={(e) => setDeptShort(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="u-session">Session (sheet header)</label>
                <input id="u-session" className="input" value={session}
                  onChange={(e) => setSession(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="u-wef">w.e.f. date</label>
                <input id="u-wef" className="input" value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="u-parity">Session type</label>
                <select id="u-parity" className="input" value={parity}
                  onChange={(e) => setParity(e.target.value as "odd" | "even")}>
                  <option value="odd">Odd semesters (1, 3, 5, 7)</option>
                  <option value="even">Even semesters (2, 4, 6, 8)</option>
                </select>
              </div>
            </div>
          </div>

          {hasCatalogue && catalogue && (
            <>
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
                        {p.numbersRequired && (
                          <span className="chip bg-amber-100 text-amber-900">
                            syllabus prints no hours/credits — you enter them per subject
                          </span>
                        )}
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
            </>
          )}

          {isManualMode && (
            <>
              <h3 className="mb-2 mt-6 font-semibold">Classes (added by hand)</h3>
              <p className="mb-3 text-sm text-muted">
                This department has no published course structure, so its classes are built
                here: add each class, then add its subjects on the assignment screens that
                follow — the same 100% gate applies.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <label className="label" htmlFor="mc-prog">Programme</label>
                  <input id="mc-prog" className="input" value={mcProgramme}
                    placeholder="e.g. B.Sc.-M.Sc. (Integrated)"
                    onChange={(e) => setMcProgramme(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="mc-sem">Semester</label>
                  <input id="mc-sem" className="input w-20" type="number" min={1} max={12}
                    value={mcSemester} onChange={(e) => setMcSemester(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} />
                </div>
                <div>
                  <label className="label" htmlFor="mc-sec">Section</label>
                  <input id="mc-sec" className="input w-20" value={mcSection}
                    placeholder="A" onChange={(e) => setMcSection(e.target.value)} />
                </div>
                <button type="button" className="btn-ghost" onClick={addManualClass}>
                  <Plus className="h-4 w-4" aria-hidden /> Add class
                </button>
              </div>
              <ul className="mt-3 space-y-1">
                {manualClasses.map((mc) => (
                  <li key={mc.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {mc.programme} · Sem {mc.semester}
                      {mc.section ? ` — ${mc.section}` : ""}{" "}
                      <span className="text-muted">
                        ({(customByClass[`manual|${mc.id}`] ?? []).length} subjects added so far)
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1"
                      aria-label={`Remove ${mc.programme} Sem ${mc.semester}`}
                      onClick={() => setManualClasses((prev) => prev.filter((m) => m.id !== mc.id))}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
                {manualClasses.length === 0 && (
                  <li className="text-sm text-muted">No classes yet — add at least one to continue.</li>
                )}
              </ul>
            </>
          )}
        </div>

        <details className="card mt-5 px-5 py-4">
          <summary className="cursor-pointer font-semibold">
            Institute time grid (same for every department)
          </summary>
          <div className="mt-4">
            <TimeGridForm />
          </div>
        </details>
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
        {registryEntry && registryEntry.facultyCount > 0
          ? "Preloaded from nita.ac.in — untick anyone who should not be in this department's pool; codes are editable. "
          : ""}
        The pool carries across all semesters; loads update live as you assign subjects.
      </p>
      <ul className="max-h-[380px] space-y-1 overflow-auto pr-1">
        {teachers.map((t) => {
          const load = loads.get(t.code) ?? 0;
          const over = t.included && load > t.weeklyHours;
          return (
            <li key={`${t.facultyCode ?? "manual"}-${t.name}-${t.code}`} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={t.included}
                aria-label={`Include ${t.name} in the pool`}
                onChange={(e) =>
                  setTeachers((prev) =>
                    prev.map((x) => (x === t ? { ...x, included: e.target.checked } : x)),
                  )
                }
              />
              <input
                className="input w-[74px] px-1.5 py-0.5 font-mono text-xs"
                value={t.code}
                aria-label={`Short code for ${t.name}`}
                onChange={(e) => {
                  const next = e.target.value.toUpperCase().replace(/\s/g, "");
                  if (next && next !== t.code) renameTeacherCode(t.code, next);
                }}
              />
              <span className={`min-w-0 flex-1 ${t.included ? "" : "opacity-50"}`}>
                <span className="block truncate">{t.name}</span>
                {t.designation && <span className="block truncate text-[11px] text-muted">{t.designation}</span>}
              </span>
              <span className={`font-mono text-xs ${over ? "font-bold text-red-700" : "text-muted"}`}>
                {load}/{t.weeklyHours}h{over ? " OVER" : ""}
              </span>
              {!t.facultyCode && (
                <button
                  type="button"
                  className="btn-ghost px-1.5 py-0.5"
                  aria-label={`Remove ${t.name}`}
                  onClick={() => setTeachers((prev) => prev.filter((x) => x !== t))}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </li>
          );
        })}
        {teachers.length === 0 && <li className="text-sm text-muted">No teachers yet.</li>}
      </ul>
      <div className="mt-3 grid gap-2 border-t border-line pt-3">
        <span className="text-xs font-semibold text-muted">Add teacher manually</span>
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
    </div>
  );

  // ------------------------------------------------------- semester screen
  const teacherOptions = (value: string) => (
    <>
      <option value="">Assign teacher…</option>
      {includedTeachers.map((t) => (
        <option key={t.code} value={t.code}>
          {t.code} — {t.name}
        </option>
      ))}
      <option value="XX">XX — no teacher yet</option>
      {value && value !== "XX" && !includedTeachers.some((t) => t.code === value) && (
        <option value={value}>{value} (excluded from pool)</option>
      )}
    </>
  );

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
              {progress.hasEmptyClass
                ? " — a manual class has no subjects yet: add at least one below."
                : progress.complete
                  ? " — complete, continue to the next semester."
                  : " — assign every subject (or mark XX) to continue."}
            </p>
          </div>
          {entry.classes.map((cls) => (
            <ClassBlock
              key={cls.classKey}
              entry={entry}
              cls={cls}
              getAssignment={getAssignment}
              setAssignment={setAssignment}
              teacherOptions={teacherOptions}
              addCustomSubject={addCustomSubject}
              removeCustomSubject={removeCustomSubject}
            />
          ))}
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
                    credits += cls.subjects.reduce((sum, x) => sum + (x.credits ?? 0), 0);
                    credits += cls.customs.reduce((sum, x) => sum + x.credits, 0);
                    for (const s of cls.subjects) {
                      if (!s.timetabled) continue;
                      subjectCount++;
                      const a = getAssignment(cls.classKey, s.key);
                      if (a.teacherCode === "XX") xx++;
                      else if (a.teacherCode) used.add(a.teacherCode);
                    }
                    for (const c of cls.customs) {
                      subjectCount++;
                      const a = getAssignment(cls.classKey, c.shortCode);
                      if (a.teacherCode === "XX") xx++;
                      else if (a.teacherCode) used.add(a.teacherCode);
                    }
                  }
                  return (
                    <tr key={entry.entryKey} className="border-b border-line">
                      <td className="td font-medium">
                        {entry.programme}
                        {entry.specialisation ? ` ${specShort(entry.specialisation)}` : ""} Sem {entry.semester}
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
            {!allComplete && (
              <p className="mt-3 text-sm font-medium text-amber-800">
                Some semesters are not fully assigned yet — go back and finish them
                (Create unlocks at 100%).
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
              disabled={create.isPending || includedTeachers.length === 0 || overMax.length > 0 || !allComplete}
              onClick={() => create.mutate()}
            >
              <BookOpen className="h-4 w-4" aria-hidden /> Create department & classes
            </button>
            {includedTeachers.length === 0 && (
              <p className="mt-2 text-sm text-muted">Include at least one teacher in the pool first.</p>
            )}
          </>
        )}
      </div>
      {renderTeacherPanel()}
    </div>
  );

  const currentComplete = currentEntry ? entryProgress(currentEntry).complete : true;
  const stepAComplete =
    !!deptChoice &&
    (hasCatalogue ? !!catalogue && selected.size > 0 && queue.length > 0 : manualClasses.length > 0);

  return (
    <div>
      <PageTitle title="Set up a department" />
      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}
      <p className="mb-4 max-w-3xl text-sm text-muted">
        One setup for every department: pick it from the list and its teachers preload from
        nita.ac.in, its subjects from the official syllabus (codes, hours,{" "}
        <strong>credits</strong>) where one is published. You assign each subject to a teacher,
        semester by semester; subjects can also be added by hand to any class. Nothing is
        created until the final review, and creating never deletes an existing department.
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
              {entry.specialisation ? ` ${specShort(entry.specialisation)}` : ""} Sem {entry.semester}
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
              disabled={(step === 0 && !stepAComplete) || (currentEntry !== null && !currentComplete)}
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

// ------------------------------------------------------------ class block
interface ClassBlockProps {
  entry: QueueEntry;
  cls: QueueClass;
  getAssignment: (classKey: string, subjectKey: string) => GAssignment;
  setAssignment: (classKey: string, subjectKey: string, patch: Partial<GAssignment>) => void;
  teacherOptions: (value: string) => React.ReactNode;
  addCustomSubject: (cls: QueueClass, draft: CustomSubjectPayload) => boolean;
  removeCustomSubject: (cls: QueueClass, code: string) => void;
}

function ClassBlock({
  entry,
  cls,
  getAssignment,
  setAssignment,
  teacherOptions,
  addCustomSubject,
  removeCustomSubject,
}: ClassBlockProps) {
  const [draft, setDraft] = useState({ code: "", title: "", kind: "theory" as CustomSubjectPayload["kind"], hours: 3, session: 2, credits: 3 });
  const credits = cls.subjects.reduce((s, x) => s + (x.credits ?? 0), 0);
  return (
    <div className="card mb-4 overflow-x-auto px-5 py-4">
      <h3 className="mb-1 font-semibold">
        {entry.programme} Sem {entry.semester}
        {cls.section ? ` — ${cls.section}` : ""}
      </h3>
      {cls.subjects.length > 0 && (
        <p className="mb-3 text-xs text-muted">
          Semester total: <span className="font-mono font-semibold text-ink">{credits} credits</span>{" "}
          (from the syllabus, including project/viva items below)
        </p>
      )}
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
            const needsNumbers = s.weeklyHours === null;
            const pool = s.electivePool ?? [];
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
                <td className="td font-mono">
                  {needsNumbers ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="number" min={1} max={35} className="input w-16 px-1.5 py-0.5"
                        aria-label={`Weekly hours for ${s.shortCode}`}
                        placeholder="hrs"
                        value={a.numbers?.weeklyHours ?? ""}
                        onChange={(e) =>
                          setAssignment(cls.classKey, s.key, {
                            numbers: { ...a.numbers, weeklyHours: Number(e.target.value) || undefined },
                          })
                        }
                      />
                      <span className="text-muted">sess</span>
                      <input
                        type="number" min={1} max={3} className="input w-14 px-1.5 py-0.5"
                        aria-label={`Session hours for ${s.shortCode}`}
                        placeholder="1–3"
                        value={a.numbers?.sessionHours ?? ""}
                        onChange={(e) =>
                          setAssignment(cls.classKey, s.key, {
                            numbers: { ...a.numbers, sessionHours: Number(e.target.value) || undefined },
                          })
                        }
                      />
                    </span>
                  ) : (
                    `${s.weeklyHours}h`
                  )}
                </td>
                <td className="td font-mono">
                  {needsNumbers ? (
                    <input
                      type="number" min={0} max={40} step="0.5" className="input w-16 px-1.5 py-0.5"
                      aria-label={`Credits for ${s.shortCode}`}
                      placeholder="cr"
                      value={a.numbers?.credits ?? ""}
                      onChange={(e) =>
                        setAssignment(cls.classKey, s.key, {
                          numbers: { ...a.numbers, credits: e.target.value === "" ? undefined : Number(e.target.value) },
                        })
                      }
                    />
                  ) : (
                    s.credits
                  )}
                </td>
                <td className="td">
                  {s.kind === "elective" ? (
                    pool.length > 0 ? (
                      <select
                        className="input min-w-[180px]"
                        value={a.electivePick ?? ""}
                        onChange={(e) =>
                          setAssignment(cls.classKey, s.key, { electivePick: e.target.value || undefined })
                        }
                      >
                        <option value="">Choose elective…</option>
                        {pool.map((o) => (
                          <option key={o.shortCode} value={o.shortCode}>
                            {o.shortCode} — {o.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="flex min-w-[220px] flex-col gap-1">
                        <input
                          className="input px-2 py-1"
                          placeholder="Code of the chosen subject"
                          value={a.customPick?.shortCode ?? ""}
                          onChange={(e) =>
                            setAssignment(cls.classKey, s.key, {
                              customPick: { shortCode: e.target.value, title: a.customPick?.title ?? "" },
                            })
                          }
                        />
                        <input
                          className="input px-2 py-1"
                          placeholder="Title (no list in the syllabus — type it)"
                          value={a.customPick?.title ?? ""}
                          onChange={(e) =>
                            setAssignment(cls.classKey, s.key, {
                              customPick: { shortCode: a.customPick?.shortCode ?? "", title: e.target.value },
                            })
                          }
                        />
                      </span>
                    )
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
                    {teacherOptions(a.teacherCode)}
                  </select>
                </td>
              </tr>
            );
          })}
          {cls.customs.map((c) => {
            const a = getAssignment(cls.classKey, c.shortCode);
            return (
              <tr key={c.shortCode} className="border-b border-line bg-violet-50/40">
                <td className="td">
                  <span className="font-mono font-semibold">{c.shortCode}</span> {kindChip("manual")}
                  <div className="text-[13px]">{c.title}</div>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-red-700 underline"
                    onClick={() => removeCustomSubject(cls, c.shortCode)}
                  >
                    remove
                  </button>
                </td>
                <td className="td font-mono">{c.weeklyHours}h</td>
                <td className="td font-mono">{c.credits}</td>
                <td className="td"><span className="text-slate-300">—</span></td>
                <td className="td">
                  <select
                    className="input min-w-[160px]"
                    value={a.teacherCode}
                    onChange={(e) =>
                      setAssignment(cls.classKey, c.shortCode, { teacherCode: e.target.value })
                    }
                  >
                    {teacherOptions(a.teacherCode)}
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
            .map((s) => `${s.title} (${s.credits ?? 0} cr)`)
            .join(" · ")}
        </p>
      )}
      {/* Add a subject manually */}
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
        <span className="w-full text-xs font-semibold text-muted">Add a subject manually to this class</span>
        <input className="input w-24 font-mono" placeholder="Code" value={draft.code}
          onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} />
        <input className="input min-w-[180px] flex-1" placeholder="Title" value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        <select className="input w-28" value={draft.kind}
          onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as CustomSubjectPayload["kind"] }))}>
          <option value="theory">theory</option>
          <option value="lab">lab</option>
          <option value="seminar">seminar</option>
        </select>
        <label className="text-xs text-muted">
          hrs/wk
          <input className="input ml-1 w-16" type="number" min={1} max={35} value={draft.hours}
            onChange={(e) => setDraft((d) => ({ ...d, hours: Number(e.target.value) }))} />
        </label>
        <label className="text-xs text-muted">
          session
          <input className="input ml-1 w-16" type="number" min={1} max={3} value={draft.session}
            onChange={(e) => setDraft((d) => ({ ...d, session: Number(e.target.value) }))} />
        </label>
        <label className="text-xs text-muted">
          credits
          <input className="input ml-1 w-16" type="number" min={0} max={40} step="0.5" value={draft.credits}
            onChange={(e) => setDraft((d) => ({ ...d, credits: Number(e.target.value) }))} />
        </label>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            if (
              addCustomSubject(cls, {
                shortCode: draft.code,
                title: draft.title,
                kind: draft.kind,
                weeklyHours: draft.hours,
                sessionHours: draft.session,
                credits: draft.credits,
              })
            ) {
              setDraft({ code: "", title: "", kind: "theory", hours: 3, session: 2, credits: 3 });
            }
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add subject
        </button>
      </div>
    </div>
  );
}
