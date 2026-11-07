import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Download, MoveRight } from "lucide-react";
import { errorMessage, fetchClasses, fetchRoutine, moveEntry, swapEntries } from "../api";
import { Banner, PageTitle, RoutineGrid } from "../components/ui";
import { exportMasterCsv } from "../utils/csv";

export default function MasterRoutine() {
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["routine"], queryFn: fetchRoutine });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [moveId, setMoveId] = useState("");
  const [moveDay, setMoveDay] = useState("");
  const [movePeriod, setMovePeriod] = useState(1);
  const [swapA, setSwapA] = useState("");
  const [swapB, setSwapB] = useState("");

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const entryLabel = (id: string) => {
    const e = entries.find((x) => x.id === id);
    return e ? `${e.className} · ${e.subjectCode} · ${e.day} P${e.period} (${e.teacherName})` : "";
  };

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

  return (
    <div>
      <PageTitle title="Master Routine">
        <button
          className="btn-ghost"
          onClick={() => exportMasterCsv(data.config, entries, classes)}
          disabled={entries.length === 0}
        >
          <Download className="h-4 w-4" aria-hidden /> Export master CSV
        </button>
      </PageTitle>
      {feedback && <Banner kind={feedback.kind} text={feedback.text} />}

      {entries.length === 0 ? (
        <p className="text-muted">No routine generated yet — load data and click Generate on the Dashboard.</p>
      ) : (
        <>
          {/* Manual editing (FR8): move / swap with instant clash check */}
          <div className="card no-print mb-6 grid gap-4 px-5 py-4 lg:grid-cols-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (moveId) move.mutate();
              }}
            >
              <h2 className="mb-2 flex items-center gap-2 font-semibold">
                <MoveRight className="h-4 w-4" aria-hidden /> Move a period
              </h2>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <label className="label" htmlFor="mv-entry">Entry</label>
                  <select id="mv-entry" className="input" value={moveId} onChange={(e) => setMoveId(e.target.value)}>
                    <option value="">Select entry…</option>
                    {entries.map((e) => (
                      <option key={e.id} value={e.id}>{entryLabel(e.id)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="mv-day">Day</label>
                  <select id="mv-day" className="input" value={moveDay || data.config.days[0]}
                    onChange={(e) => setMoveDay(e.target.value)}>
                    {data.config.days.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="mv-period">Period</label>
                  <input id="mv-period" className="input w-20" type="number" min={1}
                    max={data.config.periodsPerDay} value={movePeriod}
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
                <ArrowLeftRight className="h-4 w-4" aria-hidden /> Swap two periods (same class)
              </h2>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <label className="label" htmlFor="sw-a">Entry A</label>
                  <select id="sw-a" className="input" value={swapA} onChange={(e) => setSwapA(e.target.value)}>
                    <option value="">Select…</option>
                    {entries.map((e) => (
                      <option key={e.id} value={e.id}>{entryLabel(e.id)}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[180px] flex-1">
                  <label className="label" htmlFor="sw-b">Entry B</label>
                  <select id="sw-b" className="input" value={swapB} onChange={(e) => setSwapB(e.target.value)}>
                    <option value="">Select…</option>
                    {entries.map((e) => (
                      <option key={e.id} value={e.id}>{entryLabel(e.id)}</option>
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

          <div className="space-y-6">
            {classes.map((c) => (
              <section key={c.id} className="card px-4 py-3">
                <h2 className="mb-2 font-semibold">{c.name}</h2>
                <RoutineGrid
                  config={data.config}
                  entries={entries.filter((e) => e.classId === c.id)}
                  cellMode="master"
                />
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
