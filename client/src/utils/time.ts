import type { ScheduleConfig } from "../types";

/**
 * Clock-time labels for the master sheet, computed the way the real
 * NITA sheet works: the grid is HOURLY — column 1 starts at
 * `startTime`, every grid column spans `periodDuration` minutes (the
 * grid unit, 60 min at NITA), and lunch occupies one grid slot in the
 * clock after the `lunchAfter` column — so with 09:00 + 60 min and
 * lunch after P4: columns 9:00–10:00 … 12:00–1:00, LUNCH 1:00–2:00,
 * 2:00–3:00 … 4:00–5:00. Teaching SESSIONS are blocks merged across
 * these hourly columns (theory 1–2h, labs 2–3h) — use sessionRange()
 * for a block's start–end label.
 */

export function parseStart(startTime: string | undefined): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((startTime ?? "09:00").trim());
  if (!m) return 9 * 60;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutes since midnight -> "9:00" / "1:00" / "12:30" (12-hour, no AM/PM — the sheet's own style). */
export function fmtTime(mins: number): string {
  const t = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(t / 60);
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = t % 60;
  return mm === 0 ? `${h}:00` : `${h}:${String(mm).padStart(2, "0")}`;
}

function duration(config: ScheduleConfig): number {
  return config.periodDuration ?? 60;
}

/** Clock minutes at which period `p` (1-based) starts. */
export function periodStart(config: ScheduleConfig, p: number): number {
  const dur = duration(config);
  let start = parseStart(config.startTime) + (p - 1) * dur;
  if (config.lunchAfter !== null && config.lunchAfter !== undefined && p > config.lunchAfter) {
    start += dur; // lunch takes one period-length slot in the clock
  }
  return start;
}

export function periodRange(config: ScheduleConfig, p: number): string {
  const s = periodStart(config, p);
  return `${fmtTime(s)}–${fmtTime(s + duration(config))}`;
}

/**
 * Start–end clock label for a whole session block beginning at period
 * `start` and running `length` hourly slots (a session never crosses
 * lunch, so its end is simply start + length grid units).
 * e.g. sessionRange(cfg, 1, 2) = "9:00–11:00", (cfg, 5, 3) = "2:00–5:00".
 */
export function sessionRange(config: ScheduleConfig, start: number, length: number): string {
  const s = periodStart(config, start);
  return `${fmtTime(s)}–${fmtTime(s + length * duration(config))}`;
}

export function lunchRange(config: ScheduleConfig): string | null {
  if (config.lunchAfter === null || config.lunchAfter === undefined || config.lunchAfter < 1) {
    return null;
  }
  const s = parseStart(config.startTime) + config.lunchAfter * duration(config);
  return `${fmtTime(s)}–${fmtTime(s + duration(config))}`;
}

/** Cell label for a subject code the way the sheet prints it: labs carry "Lab". */
export function sheetSubjectLabel(code: string, type: "theory" | "lab"): string {
  if (type === "lab" && !/lab/i.test(code)) return `${code} Lab`;
  return code;
}

/** Fallback faculty code from a name when no code is stored: initials minus honorifics. */
export function initialsCode(name: string): string {
  const honorifics = new Set(["dr", "prof", "mr", "mrs", "ms", "miss", "shri", "smt"]);
  return name
    .split(/\s+/)
    .map((w) => w.replace(/\./g, ""))
    .filter((w) => w && !honorifics.has(w.toLowerCase()))
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
