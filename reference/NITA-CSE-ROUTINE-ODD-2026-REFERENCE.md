# Reference: NIT Agartala CSE Department Master Routine — ODD 2026

Source file: `~/workspace/user/files/intermediate__CSEMaster.TheoryLab.Routine.ODD.2026.pdf`
(CSE DEPARTMENT CLASS ROUTINE (NITA), ODD 2026, w.e.f 27/07/2026)
Use: this is the real-world format the Routine Maker must be able to represent and generate.

## 1. Time grid and session blocks (verified visually on the sheet, MON/TUE tables)

- Days: Monday–Friday. The grid columns are HOURLY: 9–10, 10–11, 11–12, 12–1 | Lunch 1–2 | 2–3, 3–4, 4–5 — 7 hourly slots/day.
- Entries MERGE across hours: a session is a BLOCK of consecutive hours, never a single fixed period. There is no "60-minute class" unit on this sheet — the hour is only the grid unit.
- THEORY sessions: 1 hour OR 2 consecutive hours — 2h is very common:
  - `DMS - 3A - AH - 210` Mon 9:00–11:00 (2h) · `EM3 - 3A` Mon 11:00–1:00 (2h) · `WT - 1MCA - AS - 119` Tue 9:00–11:00 (2h)
  - 1h singles exist too: `SEMINAR` 10–11 · `NM` 11–12 · `E-Comm` 12–1
- LAB sessions: 2 or 3 consecutive hours:
  - 3h blocks anchored in the morning 9–12 (Tue: DSPM Lab + DCLD Lab run in parallel for the 3A groups) or, more often, the full afternoon block 2:00–5:00 (Mon: DBMS Lab 5A1 + OS Lab 5A2; 3rd-sem-A labs 2–5)
  - 2h labs exist: Mon `WT Lab` + `DFS Lab` (1MCA) 11:00–1:00 · Tue `AI Lab` (5MCA) 11:00–1:00
- No session ever crosses the lunch break: blocks sit inside the morning segment (9–1) or the afternoon segment (2–5). A 3h block can therefore only start at 9:00, 10:00 or 2:00.
- Modelling consequence (implemented in the solver): every subject has a session length — `sessionHours`: theory 1|2 (default 2), lab 2|3 (default 3) — and a class's weekly hours split into sessions of that length plus one shorter remainder session when they don't divide evenly (theory 3h @2 → 2h + 1h).

## 2. Entry notation (grammar of one cell)

- Theory: `SUBJECT - SECTION-TEACHERCODE - ROOM`
  e.g. `DBMS - 5A-SN-G07`, `CD - 5MCA-PB-G17`, `WCN (Elective 1) - 5MCA-MKDB - 106`
- Lab: `SUBJECT Lab - GROUP - TEACHER1, TEACHER2, Sch - ROOM`
  e.g. `DBMS Lab - 5A1 - RD, VD, Sch - 215`, `AI Lab - 5MCA-DJB, MP, Sch - 216`
  - Lab groups are split halves of a section: 5A1 / 5A2, 3MCA1 / 3MCA2. While one half is in Lab A, the other half is in Lab B (parallel labs).
  - `Sch` = a PhD/M.Tech scholar assists — a placeholder co-teacher, not a named faculty.
  - `XX` = teacher not yet assigned (e.g. `NM - 3MCA-XX - 108`). The model must allow unassigned slots.
- Electives can be **combined across programs**: `DIP (Elective 2): MCA 5th + BTMT7 - TP - 119` — one class, two cohorts, one teacher, one room.
- Elective groups run in parallel: 5th-sem Elective 1 (FC) and Elective 2 (DIP) are timetabled in the same slots for the combined 5AB cohort.

## 3. Cohorts sharing one master grid (clash scope is department-wide)

- B.Tech CSE: 3A, 3B, 5A, 5B, 7A, 7B (+ combined elective groups 5AB, 7AB)
- MCA: 1st, 3rd, 5th sem
- M.Tech: 1st CYSEC, 1st DSE, 1st AI (shared classes: ADSA/ADSA Lab are "ALL" specializations)
- Others on the same grid: BTMT 7th/9th, MBA 1st — rooms and teachers are shared across all of them, so clash-checking must be global, not per-program.

## 4. Rooms seen in this routine

Theory rooms: 210, 109, 108, 119, 106, 203, 213, G07, G17
Lab rooms: 208, 118, 214, 215, 117, 107, 326, 222, 216, 209

## 5. Faculty abbreviation → name (from the PDF footer)

| Code | Name | Code | Name |
|---|---|---|---|
| MKDB | Dr. Mrinal Kanti Debbarma | DJB | Dr. Dhrubajyoti Bhowmik |
| RD | Dr. Ranjita Das | PB | Dr. Prashant Bhardwaj |
| DB | Dr. Diptendu Bhattacharya | SDB | Dr. Swapan Debbarma |
| KC | Dr. Kunal Chakma | NDB | Dr. Nikhil Debbarma |
| AJ | Dr. Anupam Jamatia | SD | Dr. Suman Deb |
| JKL | Dr. Jayakumar L | AK | Dr. Awnish Kumar |
| SN | Dr. Suyel Nama Sudra | KKD | Dr. Kishore Kumar Dhar |
| NK | Dr. Nirmalya Kar | DRP | Dr. Dwijen Rudrapal |
| TDB | Mr. Tribid Debbarma | SmD | Dr. Smita Das |
| AS | Dr. Amit Bikram Choudhury (also listed ABC) | GK | Dr. Gyanabati Khuraijam |
| BD | Mr. Bidyasagar Debnath | TP | Tapas (technical staff) |

Technical assistants / staff used in labs: SS – Suman Saha, VD – Viki Datta, MP – Malay Paul, SB – Saikat Bhattacharjee, DC – Dhurjati Chakraborty, JD – Joydip Deb, MB – Mandira Bhowmik, PBN – Pritam Banik, Sch – scholar (unnamed).

⚠️ The source itself is inconsistent: Amit Bikram Choudhury appears as both `AS` and `ABC` (EEC teacher). Teacher-code uniqueness cannot be assumed — dedupe by person, not code.

## 6. Subject legend (abbreviation = full name)

- **MCA 5th sem:** AI = Artificial Intelligence, CD = Compiler Design, E-COMM = E-Commerce, WCN (E1) = Wireless Communication Network, DIP (E2) = Digital Image Processing, AI Lab, CD Lab
- **MCA 3rd sem:** CETW = Communicative English and Technical Writing, DMDW = Data Mining and Data Warehousing, DAA = Design and Analysis of Algorithms, NM = Numerical Methods, SE = Software Engineering, DAA Lab, SE Lab
- **MCA 1st sem:** DFS = Data and File Structure, DCLD = Digital Circuit and Logic Design, DMS = Discrete Mathematical Structure, PMP = Principles of Management and Practices, WT = Web Technology, DFS Lab, WT Lab
- **B.Tech 5th sem:** CAO, DBMS, EEC = Engineering Economics and Costing, OS, FC (E1) = Foundation of Cryptography, DIP (E2), CG (E3); DBMS/OS/CAO Labs, Seminar
- **B.Tech 3rd sem:** DSPM = Data Structure and Programming Methodology, DCLD, DMS, EM3 = Engineering Mathematics III, IGT = Introduction to Graph Theory, DCN = Data Communication; DSPM/DCLD Labs
- **B.Tech 7th sem:** ML; electives IR (E1), CC (E2) = Cloud Computing, BD (E3) = Big Data Analytics, SC (E4) = Soft Computing
- **M.Tech 1st:** CYSEC: MFCS, CRYPTO, ACN (E1), DH (E2), Crypto Lab, Seminar · DSE: DM, MFDS, NLP (E1), IR (E2), DSF Lab, ADSA Lab, Seminar · AI: ADSA, AI, CM = Computational Methods of Optimization, NLP (E1), IR (E2), AI Lab, Seminar

## 7. Worked example — MCA 5th semester week (Roushan's batch)

| Day | Classes (as printed; the source tags AI/CD/E-Comm as "3MCA" in places — the subjects are 5th-sem MCA per the legend) |
|---|---|
| Mon | E-Comm – MKDB – 119 · CD – PB – G17 |
| Tue | AI Lab – DJB, MP, Sch – 216 · DIP (E2, with BTMT 7th) – TP – 119 |
| Wed | CD – PB – 109 · WCN (E1) – MKDB – 106 |
| Thu | E-Comm – MKDB – 119 · AI – DJB – 213 |
| Fri | WCN (E1) – MKDB – 106 · DIP (E2, with BTMT 7th) – TP – 119 · CD Lab – PB, SS, Sch – 117 |

Teachers: AI + AI Lab → DJB (Dr. Dhrubajyoti Bhowmik); CD + CD Lab → PB (Dr. Prashant Bhardwaj); E-Comm + WCN → MKDB (Dr. Mrinal Kanti Debbarma); DIP → TP.

## 8. Design implications for Routine Maker

1. One master grid for the whole department — teacher/room clash checks are global across programs.
2. Sections split into lab groups (A1/A2) that run different labs in parallel in the same block.
3. A lab session has 2–3 staff (faculty + technical assistant + scholar placeholder).
4. Electives merge cohorts across programs into one class (MCA 5th + BTMT 7th).
5. Slots can exist with teacher = XX (unassigned) — generation must tolerate and surface them.
6. Rooms are typed: theory rooms vs lab rooms (200-series numbers used for both here — type must come from data, not the number).
7. Teacher identity ≠ teacher code (AS/ABC duplicate) — store a canonical teacher with alias codes.

## 9. Built-in seed coverage (Routine Maker implementation note)

Historical (v2.2): the seed covered this sheet's department — B.Tech Sem 3/5/7 (A + B), MCA Sem 1/3/5, M.Tech Sem 1 CYSEC/DSE/AI — 12 classes, 54 subjects, 32 faculty, 270 h / 141 sessions.

**Current seed (2026-11-11)** is derived from the syllabus catalogue (see `reference/CATALOGUE-PROVENANCE.md`): 14 classes (the sheet's 12 plus B.Tech Sem 1 Group I + Group II), 69 subjects, 42 teachers (the 32 + 10 generic first-year placeholders). Weekly hours are the syllabi's L+T+P: MCA labs are 0-0-6 → two 3h sessions (MCA = 31h/31h/28h), M.Tech Sem 1 = 25h. Electives are a fixed pick per section (B.Tech 5A = DIP, 5B = CG — FC stays in the catalogue pool unpicked; 7A = IR + CC, 7B = BD + SC; MCA 5 = WCN + DIP; M.Tech AI = NLP + IR, CYSEC = ACN + DH, DSE = NLP + IR) instead of combined parallel elective groups (§2/§8 items 2–4 remain v3); B.Tech 7th sem has **no lab** — the sheet itself lists only ML + electives for 7th sem, so none was invented; rooms and lab-group splits (A1/A2) are not modelled (v3 roadmap). `XX` placeholders ARE now modelled — via the guided setup's hidden placeholder teacher. Generation: **346/346 hours, 180/180 sessions, 0 unplaced**.

## 10. Multi-department storage (Routine Maker implementation note)

Departments coexist in one workspace. Each department is a
`Department` document (name, shortName, session, effectiveFrom); every
teacher / subject / class / class-subject / unavailability / routine
entry carries that department's id, and all endpoints operate on the
**active** department only (the active id is kept on the singleton
Config; the institute-fixed grid stays in Config, shared — the
masthead's department line is merged from the active department).
Creating a department via the wizard **never deletes** an existing
one; the CSE demo reload (`POST /api/seed`) refreshes only CSE's own
scoped data. The only removal path is the explicit
`DELETE /api/departments/:id` (refused for the last remaining
department). A wizard submission whose department name already exists
(case-insensitive) is rejected with `409` + the existing id so the UI
can offer switching instead of overwriting. Routines are generated
and stored per department — generating ECE's routine cannot disturb
CSE's.
