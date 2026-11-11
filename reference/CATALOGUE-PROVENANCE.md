# Catalogue provenance — where the syllabus data came from

The syllabus catalogue (`server/src/catalog/*.ts` — one module per
department since v2.4) is the single source the unified setup flow
and the CSE seed are built from. It was extracted on 2026-11-11 from
the institute's published syllabus PDFs; the raw extractions are kept
in `reference/catalogue-raw/`. This note records the source of every
programme and every place where the data is NOT exactly what a
document prints, so nothing in the catalogue is a silent invention.
The CSE section below is the original v2.3 note; the v2.4 section at
the end covers all other departments and the faculty registry.

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


---

# v2.4 (2026-11-11) — all departments, faculty registry, ONE setup

The catalogue grew from CSE-only to all NITA departments that publish
a course structure, and a faculty registry was added so the unified
setup preloads BOTH courses and teachers from the live website. All
data below was extracted from nita.ac.in on 2026-11-11; raw
extractions live in `reference/catalogue-raw/` and
`reference/faculty-raw/`. Per-semester credit sums are pinned by
`server/tests/catalogues.test.ts`; faculty counts and derived codes
by `server/tests/faculty.test.ts`.

## Sources per department (courses)

| Dept | Programmes in catalogue | Source |
|---|---|---|
| CSE | B.Tech, MCA, M.Tech ×3 | see the CSE section above |
| Civil | B.Tech; M.Tech ×7 (Structural, Geotechnical, Transportation, Environmental, Water Resources, Hydroinformatics, Seismic) | B.Tech `https://nita.ac.in/UG_Syllabus_New_122_CivilEng10086.pdf`; M.Tech per-spec PDFs `SE_/GE_/TE_/EE_/WRE_/HIE_/SSE_CivilEng10086.pdf` at nita.ac.in |
| Electrical | B.Tech; M.Tech ×4 (Power Electronics & Drives, Instrumentation, Power System, Integrated Energy System) | B.Tech `https://nita.ac.in/ele_final_syl_btech_ElecEng10091.pdf`; M.Tech structure from the official PG brochure `https://nita.ac.in/Brouchure_PG_EE_ElecEng10091.pdf` (no per-spec syllabus PDFs exist) |
| ECE | B.Tech; M.Tech ×2 (CSSP, VLSI Design) | B.Tech `https://nita.ac.in/BTech_sylabus_ECE2021_ECE10092.pdf`; M.Tech `Syllabus_Communication_SignalProcessing_Aug24_ECE10092.pdf` and `MTech_Syllabus__VLSIDesign_Aug24_ECE10092.pdf` |
| EIE | M.Tech IoT and Sensor Systems ONLY | `https://nita.ac.in/DEPTUP_FILES_31-07-2026_CourseStructure-MTech-IoT-SensorSystem_EIE10093.pdf` + detailed syllabus PDF. **EIE B.Tech has NO syllabus PDF on the live site** (confirmed gap) — B.Tech EIE classes are built manually in the setup until the department publishes one |
| Mechanical | B.Tech; M.Tech ×5 (Material Science, Thermal Science, Manufacturing Technology, Automotive Engineering, Machine Design) | `https://nita.ac.in/Syllabus_BTech_ME_165Credit_MechEng10094.pdf` (B.Tech + all M.Tech structures in one document) |
| Production | B.Tech only | `https://nita.ac.in/Syllabus_BTech_PE_July2024_ProdEng10087.pdf` — prints titles, codes and elective pools but **NO L/T/P or credits anywhere** (see modelling rules) |
| Chemical | B.Tech; M.Tech (one combined PG structure) | `https://nita.ac.in/Syllabus_Chemical_UG_ChemEng10089.pdf`, `https://nita.ac.in/Syllabus_Chemical_PG_ChemEng10089.pdf` |
| Bio-Engineering | B.Tech; M.Tech | `https://nita.ac.in/BioDeptSyllabus_BTech_BioEng_June2019_BioEng10088.pdf`, `https://nita.ac.in/Syllabus_MTech_Bio_Sept24_BioEng10088.pdf` |
| Chemistry, Physics, Mathematics, MHSS, Education | NO catalogue | These units publish no B.Tech/M.Tech course structure of their own (their faculty teach into other departments' first-year/common subjects). They appear in the setup dropdown with faculty preload (except Education) and fully manual classes |

## Faculty registry sources

Names and designations are stored EXACTLY as printed on each
department's page `https://www.nita.ac.in/Department/Department_FacultyList.aspx?nDeptID=<id>`:
CSE `caasa` (25) · Civil `caaqm` (33) · EE `caasc` (23) · ECE `caase`
(17) · EIE `caasg` (10) · Mechanical `caasi` (31) · Production
`caaqo` (14) · Chemical `caaqs` (11) · Bio-Engineering `caaqq` (9) ·
Chemistry `caaso` (18) · Physics `caasm` (15) · Mathematics `caasq`
(19) · MHSS `caask` (12) — 237 people total. **Education has no
presence on the live site at all** (no faculty page): it is the 14th
registry unit with an empty faculty list, manual only.

Teacher short codes are DERIVED deterministically from the name
(initials of the name words, honorifics Dr./Prof./Mr./Mrs./Ms./Er.
dropped); when two people in one department derive the same base,
later ones (in website list order) get a digit suffix (SD, SD2, SD3…).
Codes are stable, unique per department, and the setup lets the user
edit any of them before creating the department. For preloaded
teachers the setup endpoint re-resolves name/designation from this
registry by code — client-sent names for them are ignored.

## Modelling rules applied uniformly (v2.4)

- **Weekly hours = L+T+P; sessionHours**: theory 2 (1 when the
  subject has exactly 1 weekly hour), labs min(P, 3) — P=2 → one 2h
  session, P=4 → two 2h sessions, P=6 → two 3h sessions — seminar =
  its P (2 or 3).
- **Integrated theory+lab rows** (EE and ECE print fractional P
  components like 2-1-1 or 3-0-1.5; Mech UME07C82 is 3-0-2): modelled
  as a SINGLE theory entry with weeklyHours = round(L+T+P). One
  uniform rule everywhere — the alternative (splitting a theory and
  a fractional lab entry) would fabricate lab sessions the documents
  do not schedule separately.
- **B.Tech Sem 1–2 for every department** is the common first-year
  structure (Group I/II) factored into `catalog/firstYear.ts` and
  shared by all B.Tech programmes (22/21 credits).
- **Civil M.Tech specs that print only class-hours/week** (Structural,
  Geotechnical, Environmental, Hydroinformatics, Seismic): theory
  L = class hours, T = 0, P = 0; labs P = 3; seminar P = 2.
  Transportation and Water Resources print real L-T-P and use it.
- **EE M.Tech hours** come from the brochure's uniform 28 h/week
  pattern: theory 3-1-0 (4 cr), labs 0-0-3 (2 cr), seminar 0-0-2
  (1 cr). The Sem-2 "Basic Core" elective options named in the
  brochure for Sem 1 could not be located for Sem 2 and are NOT
  modelled (Sem 2 carries the printed Core-I/Core-II/Elective-I/
  Elective-II slots); Sem-1's basic-core slot uses the 4-option pool
  the brochure prints.
- **Projects / viva / industrial training / tours are never
  timetabled** (timetabled = false) — including Hydroinformatics
  Minor Projects I/II, which print class hours but are project work.
  Hydroinformatics totals 25/25/20/40 = 110 credits exactly as
  printed.
- **Fractional credits (1.5, 2.5…) stay fractional**; the catalogue
  types carry `number | null` credits/hours.
- **Codes**: printed where the document prints them (Civil UCE/PCE,
  Mech UME, Chemical "×" cells → 0 contact hours as staged). Where a
  document prints NO codes (EE, ECE M.Tech, EIE, Mech M.Tech,
  Chemical B.Tech beyond templates), short codes are DERIVED from
  subject-title initials by a deterministic code book (same title →
  same code within a department; collisions get digit suffixes) and
  the printed code, when one exists for a row (e.g. Chemical's
  UCH05P06), is kept as `syllabusCode`. Production's printed codes
  are largely templates (UPE03XXX): the template is kept as
  `syllabusCode` and the display code is derived from the title.
- **Elective slots with NO printed pool** — Civil B.Tech Sem 4
  H.S.S Elective (UCE04E01) and Sem 5 Professional Elective-I
  (UCE05E01) — carry `electivePool = []`; the setup asks the user to
  type the chosen subject's code and title for those slots
  (`customPick`), and the server creates the subject from that entry.
- **Production B.Tech**: the official PDF publishes NO L/T/P/credits
  for Sem 3–8, so those catalogue entries carry null numbers and the
  programme is flagged `numbersRequired`. The setup REQUIRES the
  user to enter weekly hours, session hours and credits per subject;
  the server rejects the setup (400) without them and stores the
  USER-SUPPLIED numbers. Nothing was invented to fill the gap. (The
  common first year does publish numbers and is unaffected.)
- **Mechanical M.Tech Material Science** is the non-standard
  programme (28/20/12/20, VNIT-twinning pattern). Its Sem-2
  "elective pair" (a theory subject with a paired lab, 4 cr) is
  modelled as ONE elective slot whose pick is the theory subject —
  the paired lab is bundled into that pick (documented
  simplification; the slot's 3 weekly hours are the theory's).
  Thermal Science's elective pool includes three LAB options
  (0-0-3, 2 cr); picks of those resolve as lab subjects with their
  own hours/credits.
- **Civil PCE11P03** is printed as the seminar code for BOTH
  Structural and Geotechnical Sem 1, and PCE12E12 appears in two
  Structural pools with different titles — both kept as printed
  (subject documents are shared by short code across a department;
  first programme wins, as with CSE).

## Known source inconsistency (not silently fixed)

Civil M.Tech **Geotechnical Sem 2**: the PDF's printed total is 25
credits, but its own listed rows sum to 24 (4+4+4+4+2+2+3+1). The
catalogue is built from the rows, so the catalogue total is 24 and
`catalogues.test.ts` pins 24 with this note as the reason.
