/**
 * Shared catalogue-building helpers.
 *
 * Every department module is written as compact raw rows; `sub()`
 * turns a row into a full CatalogueSubject applying the house
 * modelling rules (reference/CATALOGUE-PROVENANCE.md):
 *
 *   weeklyHours   = L+T+P for timetabled subjects, 0 otherwise
 *                   (an explicit override exists for integrated
 *                   theory+lab rows, whose hours are rounded)
 *   sessionHours  theory/elective: 2 (1 when weeklyHours is 1)
 *                 lab: P=2 -> 2, P=3 -> 3, P=4 -> two 2h sessions,
 *                      P=6 -> two 3h sessions
 *                 seminar: its weekly hours (the P value, 1–3)
 *
 * `CodeBook` derives deterministic short codes from subject titles
 * for the many syllabi that print no codes: initials of the title's
 * significant words (roman numerals become digits), collisions
 * resolved by appending 2, 3, … in declaration order. The same title
 * always yields the same code within a department, so a subject
 * shared across programmes stays one subject.
 */

import {
  CatalogueElectiveOption,
  CatalogueKind,
  CatalogueSubject,
} from "./types.js";

export interface RawSub {
  code: string;
  title: string;
  ltp: [number, number, number];
  credits: number;
  kind?: CatalogueKind;
  syllabusCode?: string | null;
  derived?: boolean;
  timetabled?: boolean;
  pool?: CatalogueElectiveOption[];
  /** Integrated theory+lab rows: weeklyHours = round(L+T+P). */
  weeklyHoursOverride?: number;
}

export function sessionHoursFor(kind: CatalogueKind, weekly: number, P: number): number {
  if (kind === "lab") {
    if (P === 4) return 2; // one 4h lab runs as two 2h sessions
    return Math.min(Math.max(Math.round(P), 2), 3);
  }
  if (kind === "seminar") return weekly;
  return weekly <= 1 ? 1 : 2;
}

export function sub(raw: RawSub): CatalogueSubject {
  const [L, T, P] = raw.ltp;
  const kind: CatalogueKind =
    raw.kind ?? (L === 0 && T === 0 && P > 0 ? "lab" : "theory");
  const timetabled = raw.timetabled ?? true;
  const weeklyHours = timetabled ? (raw.weeklyHoursOverride ?? L + T + P) : 0;
  return {
    key: raw.code,
    syllabusCode: raw.syllabusCode ?? null,
    shortCode: raw.code,
    title: raw.title,
    L,
    T,
    P,
    credits: raw.credits,
    kind,
    timetabled,
    ...(raw.derived ? { derived: true } : {}),
    weeklyHours,
    sessionHours: timetabled ? sessionHoursFor(kind, weeklyHours, P) : 0,
    ...(raw.pool ? { electivePool: raw.pool } : {}),
  };
}

export function elective(
  slot: string,
  ltp: [number, number, number],
  credits: number,
  pool: CatalogueElectiveOption[],
  syllabusCode: string | null = null,
): CatalogueSubject {
  return sub({ code: slot, title: slot, ltp, credits, kind: "elective", pool, syllabusCode });
}

export function opt(
  shortCode: string,
  title: string,
  syllabusCode: string | null,
  derived = false,
): CatalogueElectiveOption {
  return { syllabusCode, shortCode, title, ...(derived ? { derived: true } : {}) };
}

// ---------------------------------------------------------- derived codes
const STOPWORDS = new Set(["and", "of", "the", "in", "for", "a", "an", "to"]);
const ROMAN: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
};

export function deriveBaseCode(title: string): string {
  const tokens = title
    .replace(/[()]/g, " ")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  let code = "";
  for (const tok of tokens) {
    if (STOPWORDS.has(tok.toLowerCase())) continue;
    const upper = tok.toUpperCase();
    if (ROMAN[upper] !== undefined && tokens.length > 1) {
      code += String(ROMAN[upper]);
    } else if (/^\d+$/.test(tok)) {
      code += tok;
    } else {
      code += upper[0];
    }
    if (code.length >= 6) break;
  }
  return code || "SUB";
}

/**
 * Deterministic per-department code book. Seed it with title->code
 * pairs that must be reused verbatim (the common first year's codes),
 * then ask it for a code per new title in declaration order.
 */
export class CodeBook {
  private byTitle = new Map<string, string>();
  private usedBy = new Map<string, string>();

  constructor(seed: Array<readonly [string, string]> = []) {
    for (const [title, code] of seed) this.register(title, code);
  }

  private register(title: string, code: string): string {
    const key = title.trim().toLowerCase();
    this.byTitle.set(key, code);
    if (!this.usedBy.has(code)) this.usedBy.set(code, key);
    return code;
  }

  codeFor(title: string): string {
    const key = title.trim().toLowerCase();
    const existing = this.byTitle.get(key);
    if (existing) return existing;
    const base = deriveBaseCode(title);
    let code = base;
    let n = 2;
    while (this.usedBy.has(code) && this.usedBy.get(code) !== key) {
      code = `${base}${n}`;
      n++;
    }
    return this.register(title, code);
  }

  /** An elective-pool option with a derived code. */
  option(title: string): CatalogueElectiveOption {
    return opt(this.codeFor(title), title, null, true);
  }

  /** A raw subject row whose code is derived from its title. */
  derived(raw: Omit<RawSub, "code">): RawSub {
    return { ...raw, code: this.codeFor(raw.title), derived: true };
  }
}
