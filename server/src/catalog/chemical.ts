/**
 * The NIT Agartala Chemical Engineering syllabus catalogue.
 *
 * Extracted 2026-11-11 from the official PDFs (see
 * reference/CATALOGUE-PROVENANCE.md and
 * reference/catalogue-raw/chemical-btech-mtech-structure.md):
 * B.Tech https://nita.ac.in/Syllabus_Chemical_UG_ChemEng10089.pdf
 * (160 cr) and M.Tech https://nita.ac.in/Syllabus_Chemical_PG_ChemEng10089.pdf
 * (80 cr). The PDFs print subject codes only as TEMPLATES
 * (UCH03BXX, PCH01EXX), so short codes are derived from titles
 * (derived: true); the few fully printed codes (UCH05P06…) are kept
 * as syllabusCode. Sem 1–2 are the common first year.
 */

import { CodeBook, elective, sub, RawSub } from "./build.js";
import { FIRST_YEAR_CODES, FIRST_YEAR_SEMESTERS } from "./firstYear.js";
import { CatalogueDepartment, CatalogueProgramme } from "./types.js";

const book = new CodeBook(FIRST_YEAR_CODES);
const d = (raw: Omit<RawSub, "code">) => sub(book.derived(raw));

const BT_POOL = [
  "Material Science & Engineering",
  "Polymer Processing Engineering",
  "Biochemical and Bioprocess Engineering",
  "Computational Fluid Dynamics",
  "Environmental Engineering",
  "Process Modeling, Simulation and Optimization",
  "Petroleum and Petrochemical Engineering",
  "Advanced Separation Processes",
  "Entrepreneurship and Management",
  "Systems Biology",
  "Advanced Heat Transfer",
  "Green Chemistry and Processes",
].map((t) => book.option(t));

const MT_POOL = [
  "Advanced Process Modeling, Simulation and Optimization",
  "Modeling and Simulation of Bioprocess Engineering",
  "Petroleum and Petrochemical Engineering",
  "Computational Fluid Dynamics",
  "Polymer Processing Engineering",
  "Advanced Instrument Analysis in Chemical Engineering",
  "Entrepreneurship and Management",
  "Industrial Pollution Control",
  "Molecular Cell Biology",
  "Advanced Environmental Biotechnology",
  "Chemical Process Safety",
  "Advanced Process Control",
  "Systems Biology",
  "Bioenergy Engineering",
  "Project Engineering and Management",
].map((t) => book.option(t));

const EAA = () =>
  d({ title: "Extra Academic Activities", ltp: [0, 0, 3], credits: 0, kind: "other", timetabled: false });

const BTECH: CatalogueProgramme = {
  programme: "B.Tech",
  semesters: [
    ...FIRST_YEAR_SEMESTERS,
    {
      semester: 3,
      subjects: [
        d({ title: "Fluid Mechanics", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Chemical Process Calculations", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Chemical Engineering Thermodynamics I", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Engineering Mathematics-III", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Engineering Economics & Accountancy", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Machine Design", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Machine Drawing Lab", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        EAA(),
      ],
    },
    {
      semester: 4,
      subjects: [
        d({ title: "Process Heat Transfer", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Chemical Engineering Thermodynamics II", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Mechanical Operation", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Numerical Methods for Chemical Engineering", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Principles of Management", ltp: [3, 0, 0], credits: 3 }),
        elective("Elective-1", [3, 0, 0], 3, BT_POOL),
        d({ title: "Fluid Mechanics Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        d({ title: "Numerical Methods Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        EAA(),
      ],
    },
    {
      semester: 5,
      subjects: [
        d({ title: "Mass Transfer I", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Chemical Reaction Engineering I", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Process Dynamics & Instrumentation", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Energy Sources and Utilization", ltp: [3, 0, 0], credits: 3 }),
        elective("Elective-2", [3, 0, 0], 3, BT_POOL),
        d({ title: "Mechanical Operations Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab", syllabusCode: "UCH05P06" }),
        d({ title: "Heat Transfer Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab", syllabusCode: "UCH05P07" }),
        d({ title: "Energy Sources and Utilization Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        EAA(),
      ],
    },
    {
      semester: 6,
      subjects: [
        d({ title: "Mass Transfer II", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Chemical Reaction Engineering II", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Process Control", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Chemical Process Technology", ltp: [4, 0, 0], credits: 4 }),
        d({ title: "Project Engineering & Economics", ltp: [3, 1, 0], credits: 4 }),
        elective("Elective-3", [3, 0, 0], 3, BT_POOL),
        d({ title: "Chemical Reaction Engineering Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        d({ title: "Process Equipment Design & Drawing I", ltp: [0, 1, 2], credits: 1.5, kind: "lab" }),
        d({ title: "Mass Transfer Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        EAA(),
      ],
    },
    {
      semester: 7,
      subjects: [
        d({ title: "Transport Phenomena", ltp: [2, 1, 0], credits: 3 }),
        elective("Elective-4", [3, 0, 0], 3, BT_POOL),
        d({ title: "Process Safety Engineering", ltp: [2, 1, 0], credits: 3 }),
        elective("Elective-5", [3, 0, 0], 3, BT_POOL),
        d({ title: "Summer Training", ltp: [0, 0, 0], credits: 1.5, kind: "other", timetabled: false }),
        d({ title: "Project I", ltp: [0, 0, 6], credits: 2, kind: "project", timetabled: false }),
        d({ title: "Process Equipment Design & Drawing II", ltp: [0, 1, 2], credits: 1.5, kind: "lab" }),
        d({ title: "Process Control & Instrumentation Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
      ],
    },
    {
      semester: 8,
      subjects: [
        elective("Elective-6", [3, 0, 0], 3, BT_POOL),
        elective("Elective-7", [3, 0, 0], 3, BT_POOL),
        elective("Elective-8", [3, 0, 0], 3, BT_POOL),
        d({ title: "Comprehensive Viva Voce", ltp: [0, 0, 0], credits: 1, kind: "viva", timetabled: false, syllabusCode: "UCH08B20" }),
        d({ title: "Project-II", ltp: [0, 0, 9], credits: 3, kind: "project", timetabled: false, syllabusCode: "UCH08P20" }),
      ],
    },
  ],
};

const MTECH: CatalogueProgramme = {
  programme: "M.Tech",
  semesters: [
    {
      semester: 1,
      subjects: [
        d({ title: "Advanced Thermodynamics", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Advanced Transport Phenomena", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Advanced Numerical Methods in Chemical Engineering", ltp: [3, 1, 0], credits: 4 }),
        elective("Elective-1", [4, 0, 0], 4, MT_POOL),
        elective("Elective-2", [4, 0, 0], 4, MT_POOL),
        d({ title: "Analytical Instrument Laboratory", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Computer Aided Numerical Laboratory", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Seminar", ltp: [0, 0, 2], credits: 1, kind: "seminar" }),
      ],
    },
    {
      semester: 2,
      subjects: [
        d({ title: "Advanced Reactor Design and Analysis", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Advanced Separation Processes", ltp: [3, 1, 0], credits: 4 }),
        elective("Elective-3", [4, 0, 0], 4, MT_POOL),
        elective("Elective-4", [4, 0, 0], 4, MT_POOL),
        d({ title: "Computer Aided Process Equipment Design Laboratory", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "M.Tech Laboratory", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Comprehensive Viva", ltp: [0, 0, 0], credits: 2, kind: "viva", timetabled: false }),
        d({ title: "Project Preliminary", ltp: [0, 0, 0], credits: 3, kind: "project", timetabled: false }),
      ],
    },
    {
      semester: 3,
      subjects: [
        d({ title: "Project & Thesis (Part-1)", ltp: [0, 0, 0], credits: 10, kind: "project", timetabled: false }),
      ],
    },
    {
      semester: 4,
      subjects: [
        d({ title: "Project & Thesis (Part-2)", ltp: [0, 0, 0], credits: 20, kind: "project", timetabled: false }),
      ],
    },
  ],
};

export const CHEMICAL_CATALOGUE: CatalogueDepartment = {
  id: "CHEMICAL",
  name: "Chemical Engineering",
  shortName: "ChemE",
  programmes: [BTECH, MTECH],
};
