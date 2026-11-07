import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Download, MoveRight, Printer } from "lucide-react";
import {
  errorMessage,
  fetchClasses,
  fetchRoutine,
  fetchSubjects,
  fetchTeachers,
  moveEntry,
  swapEntries,
} from "../api";
import type { RoutineEntry } from "../types";
import { Banner, PageTitle, sessionBlocks } from "../components/ui";
import { exportMasterCsv } from "../utils/csv";
import { initialsCode, lunchRange, periodRange, sessionRange, sheetSubjectLabel } from "../utils/time";

/**
 * The department MASTER SHEET, modelled on the real NITA CSE master
 * routine (ODD 2026 — see reference/NITA-CSE-ROUTINE-ODD-2026-REFERENCE.md):
 * one table per day, rows = classes/sections, columns = hourly slots
 * headed by clock times with a LUNCH column, compact sheet notation in
 * cells (`AI - DJB`), and SESSIONS MERGED ACROSS THEIR HOURS exactly
 * like the real sheet (a 2h theory block spans 9:00–11:00, a 3h lab
 * block spans 2:00–5:00). Faculty + subject legends below the sheet,
 * like the real sheet's footer. Prints as the notice-board document.
 */
export default function MasterRoutine() {
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["routine"], queryFn: fetchRoutine });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [moveId, setMoveId] = useState("");
  const [moveDay, setMoveDay] = useState("");
  const [movePeriod, setMovePeriod] = useState(1);
  const [swapA, setSwapA] = useState("");
  const [swapB, setSwapB] = useState("");

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const cellText = (e: RoutineEntry) =>
    `${sheetSubjectLabel(e.subjectCode, e.subjectType)} - ${e.teacherCode || initialsCode(e.teacherName)}`;

  /**
   * All sessions in the routine (one item per block, identified by its
   * first entry's id) — the unit the Move/Swap controls operate on.
   */
  const sessions = useMemo(() => {
    if (!data) return [];
    const out: Array<{ id: string; entry: RoutineEntry; day: string; start: number; length: number }> = [];
    for (const c of classes) {
      for (const day of data.config.days) {
        const mine = entries.filter((e) => e.classId === c.id);
        for (const b of sessionBlocks(mine, day).values()) {
          out.push({ id: b.entry.id, entry: b.entry, day, start: b.start, length: b.length });
        }
      }
    }
    return out;
  }, [data, entries, classes]);
  const entryLabel = (id: string) => {
    const s = sessions.find((x) => x.id === id);
    if (!s || !data) return "";
    return `${s.entry.className} · ${cellText(s.entry)} · ${s.day} ${sessionRange(data.config, s.start, s.length)}`;
  };

  /** Legends, exactly like the real sheet's footer: only what the routine uses. */
  const facultyLegend = useMemo(() => {
    const used = new Map<string, { code: string; name: string }>();
    for (const e of entries) {
      if (!used.has(e.teacherId)) {
        const t = teachers.find((x) => x.id === e.teacherId);
        used.set(e.teacherId, {
          code: t?.code || e.teacherCode || initialsCode(e.teacherName),
          name: t?.name ?? e.teacherName,
        });
      }
    }
    return [...used.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [entries, teachers]);
  const subjectLegend = useMemo(() => {
    const used = new Map<string, { code: string; name: string }>();
    for (const e of entries) {
      if (!used.has(e.subjectId)) {
        const s = subjects.find((x) => x.id === e.subjectId);
        used.set(e.subjectId, { code: s?.code ?? e.subjectCode, name: s?.name ?? e.subjectName });
      }
    }
    return [...used.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [entries, subjects]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["routine"] });
  const onErr = (e: unknown) => setFeedback({ kind: "error", text: errorMessage(e) });
  const move = useMutation({
    mutationFn: () => moveEntry(moveId, moveDay || (data?.config.days[0] ?? "Monday"), movePeriod),
    onSuccess: (r) => {
      setFeedback({ kind: "success", text: r.message });
      refresh();
    },
    onError: onErr,
  });
  const swap = useMutation({
    mutationFn: () => swapEntries(swapA, swapB),
    onSuccess: (r) => {
      setFeedback({ kind: "success", text: r.message });
      refresh();
    },
    onError: onErr,
  });

  if (error) return <Banner kind="error" text={errorMessage(error)} />;
  if (!data) return <p className="text-muted">Loading…</p>;

  const config = data.config;
  const periods = Array.from({ length: config.periodsPerDay }, (_, i) => i + 1);
  const lunch = lunchRange(config);
  const byKey = new Map(entries.map((e) => [`${e.classId}|${e.day}|${e.period}`, e]));

  /** Render one day's sheet: rows = classes, columns = hourly slots + lunch. */
  const daySheet = (day: string) => {
    // Pre-compute session merges for every class: any block (theory or
    // lab) renders as ONE cell spanning its hours, like the real sheet.
    const consumed = new Set<string>();
    const span = new Map<string, number>();
    for (const c of classes) {
      const mine = entries.filter((e) => e.classId === c.id);
      for (const b of sessionBlocks(mine, day).values()) {
        if (b.length > 1) {
          span.set(`${c.id}|${b.start}`, b.length);
          for (let i = 1; i < b.length; i++) consumed.add(`${c.id}|${b.start + i}`);
        }
      }
    }
    return (
      <section key={day} className="sheet-day mb-6">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-widest text-primary-dark">{day}</h3>
        <div className="overflow-x-auto">
          <table className="sheet-table">
            <thead>
              <tr>
                <th className="text-left">Class</th>
                {periods.map((p) => (
                  <Fragment key={p}>
                    <th>
                      P{p}
                      <span className="block font-mono text-[11px] font-normal normal-case">
                        {periodRange(config, p)}
                      </span>
                    </th>
                    {config.lunchAfter === p && lunch && (
                      <th className="sheet-lunch-head">
                        LUNCH
                        <span className="block font-mono text-[11px] font-normal normal-case">{lunch}</span>
                      </th>
                    )}
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {classes.map((c, rowIdx) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap font-semibold">{c.name}</td>
                  {periods.map((p) => {
                    const key = `${c.id}|${p}`;
                    const cells = [];
                    if (!consumed.has(key)) {
                      const e = byKey.get(`${c.id}|${day}|${p}`);
                      cells.push(
                        <td
                          key={p}
                          colSpan={span.get(key) ?? 1}
                          className={
                            e
                              ? `sheet-cell ${e.subjectType === "lab" ? "sheet-lab" : ""} ${e.id === moveId ? "sheet-selected" : ""}`
                              : "sheet-cell text-center text-slate-300"
                          }
                        >
                          {e ? (
                            <button
                              type="button"
                              className="block h-full w-full cursor-pointer px-1 py-0.5 text-center font-mono text-[13px] font-medium"
                              title={`${e.subjectName} — ${e.teacherName} · ${e.day} ${sessionRange(config, p, span.get(key) ?? 1)}. Click to select the whole session for Move.`}
                              onClick={() => {
                                setMoveId(e.id);
                                setFeedback(null);
                              }}
                            >
                              {cellText(e)}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>,
                      );
                    }
                    // The merged LUNCH column hangs off the lunchAfter period
                    // in the first row only — even if that period was merged
                    // into a lab cell in this row.
                    if (config.lunchAfter === p && lunch && rowIdx === 0) {
                      cells.push(
                        <td key="lunch" rowSpan={classes.length} className="sheet-lunch-body">
                          LUNCH
                        </td>,
                      );
                    }
                    return <Fragment key={p}>{cells}</Fragment>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <div>
      <PageTitle title="Master Routine">
        <button
          className="btn-ghost no-print"
          onClick={() => exportMasterCsv(config, entries, classes)}
          disabled={entries.length === 0}
        >
          <Download className="h-4 w-4" aria-hidden /> Export master CSV
        </button>
        <button className="btn-ghost no-print" onClick={() => window.print()} disabled={entries.length === 0}>
          <Printer className="h-4 w-4" aria-hidden /> Print master sheet
        </button>
      </PageTitle>
      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}

      {/* Formal sheet header — the real NITA sheet's masthead. The
          institute is a product constant (NIT Agartala, always); only
          the department line varies, from Config. */}
      <div className="master-doc card mb-6 px-5 py-4 text-center">
        <p className="text-lg font-bold uppercase tracking-wide">National Institute of Technology Agartala</p>
        <p className="font-semibold uppercase tracking-wide text-primary-dark">
          {(config.departmentShort ?? "CSE").toUpperCase()} Department Class Routine (NITA)
        </p>
        <p className="mt-1 font-mono text-sm text-muted">
          {config.session ?? "ODD 2026"}, w.e.f. {config.effectiveFrom ?? "27/07/2026"}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted">No routine generated yet — load data and click Generate on the Dashboard.</p>
      ) : (
        <>
          {/* Manual editing (FR8): click a cell to select it for Move; Swap via selects. */}
          <div className="card no-print mb-6 grid gap-4 px-5 py-4 lg:grid-cols-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (moveId) move.mutate();
              }}
            >
              <h2 className="mb-2 flex items-center gap-2 font-semibold">
                <MoveRight className="h-4 w-4" aria-hidden /> Move a session
              </h2>
              <p className="mb-2 text-xs text-muted">
                Tip: click any cell in the sheet to select its session here. The whole block
                (all its hours) moves together and is clash-checked over its full span.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <label className="label" htmlFor="mv-entry">Session</label>
                  <select id="mv-entry" className="input" value={moveId} onChange={(e) => setMoveId(e.target.value)}>
                    <option value="">Select session…</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>{entryLabel(s.id)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="mv-day">Day</label>
                  <select id="mv-day" className="input" value={moveDay || config.days[0]}
                    onChange={(e) => setMoveDay(e.target.value)}>
                    {config.days.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="mv-period">Start period</label>
                  <input id="mv-period" className="input w-20" type="number" min={1}
                    max={config.periodsPerDay} value={movePeriod}
                    onChange={(e) => setMovePeriod(Number(e.target.value))} />
                </div>
                <button type="submit" className="btn-primary" disabled={!moveId || move.isPending}>
                  Move
                </button>
              </div>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (swapA && swapB && swapA !== swapB) swap.mutate();
              }}
            >
              <h2 className="mb-2 flex items-center gap-2 font-semibold">
                <ArrowLeftRight className="h-4 w-4" aria-hidden /> Swap two sessions (same class)
              </h2>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <label className="label" htmlFor="sw-a">Session A</label>
                  <select id="sw-a" className="input" value={swapA} onChange={(e) => setSwapA(e.target.value)}>
                    <option value="">Select…</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>{entryLabel(s.id)}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[180px] flex-1">
                  <label className="label" htmlFor="sw-b">Session B</label>
                  <select id="sw-b" className="input" value={swapB} onChange={(e) => setSwapB(e.target.value)}>
                    <option value="">Select…</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>{entryLabel(s.id)}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn-primary"
                  disabled={!swapA || !swapB || swapA === swapB || swap.isPending}>
                  Swap
                </button>
              </div>
            </form>
          </div>

          <div className="master-doc card px-4 py-4">
            {config.days.map((day) => daySheet(day))}

            {/* Legends — the real sheet's footer. */}
            <div className="grid gap-6 border-t-2 border-primary/50 pt-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-primary-dark">
                  Faculty
                </h3>
                <ul className="space-y-1 text-[13px]">
                  {facultyLegend.map((f) => (
                    <li key={f.code + f.name}>
                      <span className="font-mono font-semibold">{f.code}</span>
                      <span className="text-muted"> = </span>
                      {f.name}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-primary-dark">
                  Subjects
                </h3>
                <ul className="space-y-1 text-[13px]">
                  {subjectLegend.map((s) => (
                    <li key={s.code}>
                      <span className="font-mono font-semibold">{s.code}</span>
                      <span className="text-muted"> = </span>
                      {s.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-muted">
              Generated by Routine Maker — {config.department ?? "Computer Science and Engineering"},
              NIT Agartala. Hard rules H1–H8 enforced by the solver.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
