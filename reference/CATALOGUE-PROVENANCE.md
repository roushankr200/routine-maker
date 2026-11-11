# Catalogue provenance — where the syllabus data came from

The syllabus catalogue (`server/src/catalog/cse.ts`) is the single
source the guided setup flow and the CSE seed are built from. It was
extracted on 2026-11-11 from the institute's published syllabus PDFs;
the raw extractions are kept in `reference/catalogue-raw/`. This note
records the source of every programme and every place where the data
is NOT exactly what a document prints, so nothing in the catalogue is
a silent invention.

## Sources per programme

| Programme | Source | Status |
|---|---|---|
| B.Tech Sem 1–2 | `https://www.nita.ac.in/FinalSyllabus_1stYear_2021.pdf` — "Syllabus of B.Tech 1st Year" (68 pp, common Group I/II) | OFFICIAL |
| B.Tech Sem 3–8 | "UG Syllabus_New_122 Credits (3rd–8th semester)" — the official PDF is **DELETED from nita.ac.in** (BlobNotFound) and oldweb.nita.ac.in is unreachable, so an identical copy (Scribd document 608595755, "B.tech CSE 2021 Syllabus", 139 pp) was used | Copy, corroborated: cover title reads "COURSE STRUCTURE AND DETAILED SYLLABUS FOR B.TECH DEGREE IN CSE (3RD TO 8TH SEMESTER)" and its credit totals match the official filename — Sem 3–8 = 122 cr, Sem 1–2 = 43, total 165 |
| MCA Sem 1–6 | `https://nita.ac.in/Syllabus_MCA_CSE_CSE10090.pdf` (42 pp, batches admitted from 2016–17) | OFFICIAL; full subject codes printed (MCA01C01…) |
| M.Tech Artificial Intelligence | `https://nita.ac.in/MTechSyllabus_CSE_AI_CSE10090.pdf` (62 pp, updated 6 Sep 2021) | OFFICIAL |
| M.Tech Cyber Security | `https://nita.ac.in/MTechSyllabus_CSE_CyberSecurty_CSE10090.pdf` (44 pp; "CyberSecurty" spelling as published) | OFFICIAL |
| M.Tech Data Science & Engineering | `https://nita.ac.in/MTechSyllabus_CSE_DataScience_CSE10090.pdf` (60 pp) | OFFICIAL |

Per-semester credit sums in the catalogue equal the printed totals
(B.Tech 22/21/24/21/24/27/13/13 · MCA 25/26/25/26/24/14 · each
M.Tech specialisation 25/25/10/20) — pinned by
`server/tests/catalogue.test.ts`.

## Codes: printed vs derived

- **MCA** and **B.Tech Sem 3–8** syllabi print full subject codes
  (MCA01C01, UCS03B08…); those are stored as `syllabusCode`. Their
  short display codes come from the department routine sheet's
  legends (reference §6).
- **B.Tech Sem 1–2**: the first-year structure tables print NO codes.
  Only four codes could be verified from the document's detailed
  sections (UPH11B07, UPH12B09, UPH12P06, UCY11B10). All Sem 1–2
  short codes (EM1, PHY1, BEE, ITP…) are **derived** and flagged
  `derived: true` in the catalogue.
- **M.Tech (all three specialisations)**: the syllabi print NO subject
  codes anywhere. Every M.Tech short code (ADSA, MFCS, CRYPTO, DM,
  MFDS…) is **derived from the department routine sheet's legends**
  and flagged `derived: true`; Sem 1 was cross-checked against the
  ODD 2026 sheet and matches it exactly. `syllabusCode` is null.
- **Cyber Security elective "DH"**: the routine sheet lists DH as
  CYSEC's Elective-II, but the 2021 syllabus's 18-option elective
  pool does not expand it. The catalogue carries it as a pool option
  whose title is literally "DH (department sheet code; full title
  not in the 2021 syllabus pool)", flagged derived.
- **DSE electives**: the DSE PDF's elective list was not captured in
  the extraction, so the DSE pools contain only the sheet's two
  Sem 1 electives — NLP (E1) and IR (E2) — flagged derived. If the
  department publishes the full DSE elective list, the pool in
  `catalog/cse.ts` should be extended from it.
- Cyber Security's scheme tables print its elective slots as 3-1-0
  while its elective list prints 4-0-0 (both 4 credits). The
  catalogue follows the scheme tables (3-1-0, weeklyHours 4 either
  way, so the routine is unaffected).
- Cyber Security Sem 2 "Laboratory-IV" has a blank title in the
  syllabus (printed "()"); the catalogue titles it "Laboratory-IV
  (title blank in syllabus)".
- B.Tech Sem 5's Seminar carries the code UCS06P08 exactly as
  printed in the Sem 5 table.

## Routine-model decisions taken from the syllabi

- **Weekly hours = L+T+P** for every timetabled subject.
- **MCA labs are 0-0-6** (6 practical hours/week, 3 credits): in the
  block model that is weeklyHours 6 with sessionHours 3 — **two 3h
  lab sessions per week**. (The old hand-tuned seed ran them as a
  single 3h block; the catalogue, and now the seed, follow the
  syllabus.)
- **M.Tech labs are 0-0-2**: one 2h session (sessionHours 2).
- Non-timetabled items (project/thesis work, comprehensive viva,
  industrial training, NSS/NCC, MCA mini/major project) are in the
  catalogue with their credits — they count in semester credit
  totals and are shown greyed in the guided flow — but they never
  become routine subjects.

## Elective picks in the seed (documented simplification)

Combined parallel elective groups (reference §2/§8) remain v3. The
seed fixes one pick per elective slot per section, following the
routine sheet where it shows one:

- B.Tech Sem 5 Elective-I: **5A → DIP, 5B → CG** (the sheet also runs
  FC for the combined 5AB cohort; FC stays in the catalogue pool).
- B.Tech Sem 7: **7A → IR + CC, 7B → BD + SC** (Elective-III/IV).
- MCA Sem 5: **Elective-I → WCN, Elective-II → DIP** (as on the sheet).
- M.Tech AI Sem 1: **NLP + IR** · CYSEC: **ACN + DH** · DSE: **NLP + IR**
  (the sheet's picks).

## Shared subject codes across programmes

Subject documents are shared by short code across programmes (the
app's existing model — DCLD, DMS, AI, AI Lab, IR, ADSA, Seminar… are
single subjects taken by several classes, which keeps clash-checking
department-wide). Where programmes print DIFFERENT credits for one
shared code, the Subject row keeps the **first** programme's value
in seed order (B.Tech → MCA → M.Tech); the catalogue itself always
keeps the exact per-programme values:

- DCLD: B.Tech 3 cr (UCS03B09) stored; MCA prints 4 cr (MCA01C02).
- DMS: B.Tech 3 cr (UCS03B10) stored; MCA prints 4 cr (MCA01C03).
- DIP: B.Tech elective 3 cr (UCS05E02) stored; MCA prints 4 cr (MCA05E01).
- AI Lab: MCA 3 cr (MCA05L09, sessionHours 3) stored; M.Tech prints
  2 cr with 2h/week — in the M.Tech class it places as one unbroken
  2h remainder block under the shared subject.
- IR: B.Tech elective 3 cr (UCS07E09) stored; M.Tech prints 4 cr.

## First-year faculty in the seed

B.Tech Sem 1 is taught mainly by other departments (Basic Sciences
& Humanities, ME, EE, ECE) whose faculty the CSE routine sheet does
not list. The seed's ten first-year teachers (codes FYM, FYP, FYC,
FYE, FYME, FYEN, FYEL, FYEG, FYWS, DMF) are **generic placeholders**,
designated "First-year (other department)" — they exist so the
Sem 1 classes generate; they are not real named faculty. All other
seed faculty are the sheet's (§5 + PDF footer).
