/**
 * The NIT Agartala Electrical Engineering syllabus catalogue.
 *
 * Extracted 2026-11-11 (reference/catalogue-raw/ee-btech-mtech-structure.md):
 * B.Tech (New) from https://nita.ac.in/ele_final_syl_btech_ElecEng10091.pdf
 * (165 cr = 43 first year + 122 Sem 3–8); the M.Tech structure comes
 * from the official PG brochure
 * https://nita.ac.in/Brouchure_PG_EE_ElecEng10091.pdf, which prints
 * NO L/T/P — hours are derived from its printed 28 class hrs/week
 * (theory/electives 4h, labs 3h, Sem 1 seminar 2h).
 *
 * NO subject codes are printed anywhere: all short codes derived.
 * Several B.Tech theory subjects are INTEGRATED theory+lab rows
 * (fractional P, e.g. 3-1-1.5): per the uniform rule each is a
 * SINGLE theory entry with weeklyHours = round(L+T+P).
 */

import { CodeBook, elective, sub, RawSub } from "./build.js";
import { FIRST_YEAR_CODES, FIRST_YEAR_SEMESTERS } from "./firstYear.js";
import { CatalogueDepartment, CatalogueProgramme } from "./types.js";

const book = new CodeBook(FIRST_YEAR_CODES);
const d = (raw: Omit<RawSub, "code">) => sub(book.derived(raw));
/** Integrated theory+lab row: single theory entry, rounded hours. */
const di = (raw: Omit<RawSub, "code">) =>
  sub(book.derived({ ...raw, weeklyHoursOverride: Math.round(raw.ltp[0] + raw.ltp[1] + raw.ltp[2]) }));

const BT_POOL = [
  "Special Topics in Electrical Engg. – I",
  "Special Topics in Electrical Engg. – II",
  "Analysis and Control of Electrical Machines",
  "Alternative Sources of Energy",
  "Embedded Control of Electric Drives",
  "Instrumentation & Measurement",
  "Artificial Intelligence Technique in Power Systems",
  "Computer Based Power System Analysis",
  "System Identification, Modelling and Simulation",
  "Control of Electric Drives",
  "Distribution System Engineering",
  "Industrial Drives",
  "High Voltage Engineering",
  "Electrical Wiring & Estimation",
  "Extra High Voltage AC and DC Transmission",
  "Pulse Width Modulation Technique",
  "Power System Protection",
  "Smart Grid Fundamentals with Renewable Integration",
  "Artificial Intelligence and Expert System",
  "Advanced Control Systems",
].map((t) => book.option(t));

const MT_POOL = [
  "Biomedical Instrumentation",
  "Advanced Control System",
  "Advanced Circuit Design",
  "Renewable Energy",
  "Pulse Width Modulation Techniques",
  "HVDC Transmission",
  "Flexible AC Transmission Systems (FACTS)",
  "Power System Planning",
  "High Voltage Engineering",
  "Advanced Power System",
  "Direct Energy Conversion",
  "Energy, Ecology & Environment",
  "Fundamentals of Energy Economics",
  "Power Plant Engineering",
  "Heat Transfer",
  "Power Generation Transmission & Distribution",
  "Smart Grid",
  "Digital Control",
].map((t) => book.option(t));

const BASIC_CORE_POOL = [
  "Advanced Mathematics",
  "Digital Signal Processing",
  "Embedded Systems",
  "Optoelectronic Instrumentation",
].map((t) => book.option(t));

const BTECH: CatalogueProgramme = {
  programme: "B.Tech",
  semesters: [
    ...FIRST_YEAR_SEMESTERS,
    {
      semester: 3,
      subjects: [
        d({ title: "Engineering Mathematics III", ltp: [3, 1, 0], credits: 4 }),
        di({ title: "Electrical Measurement and Measuring Instruments", ltp: [2, 1, 1], credits: 4 }),
        di({ title: "Network Analysis", ltp: [3, 1, 1], credits: 5 }),
        di({ title: "Digital Electronics", ltp: [3, 0, 1], credits: 4 }),
        di({ title: "Object Oriented Programming", ltp: [2, 0, 1.5], credits: 3.5 }),
        d({ title: "Signals & Systems", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Seminar (Soft Skilled based)", ltp: [0, 0, 0], credits: 0, kind: "seminar", timetabled: false }),
      ],
    },
    {
      semester: 4,
      subjects: [
        di({ title: "Electrical Machine-I", ltp: [3, 1, 1.5], credits: 5.5 }),
        d({ title: "Power System-I", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Data Structure & Algorithm", ltp: [2, 1, 0], credits: 3 }),
        di({ title: "Numerical Methods and Analysis", ltp: [3, 1, 1], credits: 5 }),
        di({ title: "Analog Electronics", ltp: [3, 1, 1], credits: 5 }),
        // The syllabus prints no pool for Elective-I; the extraction
        // records it drawing on the common Electives II–V list.
        elective("Elective-I", [3, 0, 0], 3, BT_POOL),
        d({ title: "Seminar (Soft Skilled)", ltp: [0, 0, 0], credits: 0, kind: "seminar", timetabled: false }),
      ],
    },
    {
      semester: 5,
      subjects: [
        di({ title: "Electrical Machine-II", ltp: [3, 1, 1.5], credits: 5.5 }),
        di({ title: "Power Electronics", ltp: [3, 1, 1.5], credits: 5.5 }),
        di({ title: "Microprocessors and Microcontroller", ltp: [3, 0, 1], credits: 4 }),
        di({ title: "Control System-I", ltp: [3, 1, 1], credits: 5 }),
        d({ title: "Electromagnetic Field Theory", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Seminar", ltp: [0, 0, 1], credits: 1, kind: "seminar" }),
      ],
    },
    {
      semester: 6,
      subjects: [
        di({ title: "Power System II", ltp: [3, 1, 1.5], credits: 5.5 }),
        di({ title: "Digital Signal Processing", ltp: [3, 0, 1], credits: 4 }),
        di({ title: "Industrial Instrumentation", ltp: [3, 1, 1], credits: 5 }),
        di({ title: "Principle of Communication", ltp: [3, 0, 1], credits: 4 }),
        d({ title: "Industrial Visit/Internship", ltp: [0, 0, 0], credits: 0, kind: "other", timetabled: false }),
        d({ title: "Seminar", ltp: [0, 0, 1], credits: 1, kind: "seminar" }),
      ],
    },
    {
      semester: 7,
      subjects: [
        di({ title: "Electrical Drives", ltp: [3, 0, 1.5], credits: 4.5 }),
        d({ title: "Engineering Economics", ltp: [3, 0, 0], credits: 3 }),
        elective("Elective II", [3, 0, 0], 3, BT_POOL),
        elective("Elective III", [3, 0, 0], 3, BT_POOL),
        d({ title: "Project-I", ltp: [0, 0, 2], credits: 2, kind: "project", timetabled: false }),
        d({ title: "Seminar", ltp: [0, 0, 1], credits: 1, kind: "seminar" }),
      ],
    },
    {
      semester: 8,
      subjects: [
        d({ title: "Industrial Management", ltp: [3, 0, 0], credits: 3 }),
        elective("Elective IV", [3, 0, 0], 3, BT_POOL),
        elective("Elective V", [3, 0, 0], 3, BT_POOL),
        d({ title: "Grand Viva", ltp: [0, 0, 0], credits: 1, kind: "viva", timetabled: false }),
        d({ title: "Project-II", ltp: [0, 0, 3], credits: 3, kind: "project", timetabled: false }),
      ],
    },
  ],
};

interface SpecDef {
  specialisation: string;
  s1Core: [string, string];
  s1Labs: [string, string];
  s2Core: [string, string];
  s2Labs: [string, string];
}
const SPECS: SpecDef[] = [
  {
    specialisation: "Power Electronics & Drives",
    s1Core: ["Advanced Power Electronics", "Modelling and Analysis of Electrical Machine and Drives"],
    s1Labs: ["Power Electronics Lab", "Electrical Machine Lab"],
    s2Core: ["Switched Mode Power Supplies", "Advanced Electrical Drives"],
    s2Labs: ["Power Electronics Lab II", "Electrical Drives Lab"],
  },
  {
    specialisation: "Instrumentation",
    s1Core: ["Industrial Instrumentation", "Analog Signal Processing"],
    s1Labs: ["Instrumentation Lab-I", "Digital Signal Processing Lab"],
    s2Core: ["Optical Engineering and Laser Instrumentation", "Process Control and Instrumentation"],
    s2Labs: ["Instrumentation Lab-II", "Optoelectronics and Instrumentation Lab"],
  },
  {
    specialisation: "Power System",
    s1Core: ["Power System Operation & Economics", "Power System Stability & Control"],
    s1Labs: ["Power System Simulation Lab-I", "Power System Protection Lab"],
    s2Core: ["Power System Protection", "Distributed Generation Systems"],
    s2Labs: ["Power System Simulation Lab-II", "Power Electronics Lab"],
  },
  {
    specialisation: "Integrated Energy System",
    s1Core: ["Renewable Energy", "Energy Conservation"],
    s1Labs: ["Energy Lab-I", "Power System Simulation Lab"],
    s2Core: ["Operation & Control of Electrical Energy Systems", "Distributed Generation Systems"],
    s2Labs: ["Energy Lab-II", "Power Electronics Lab"],
  },
];

function mtechSpec(spec: SpecDef): CatalogueProgramme {
  return {
    programme: "M.Tech",
    specialisation: spec.specialisation,
    semesters: [
      {
        semester: 1,
        subjects: [
          elective("Basic Core", [3, 1, 0], 4, BASIC_CORE_POOL),
          d({ title: spec.s1Core[0], ltp: [3, 1, 0], credits: 4 }),
          d({ title: spec.s1Core[1], ltp: [3, 1, 0], credits: 4 }),
          elective("Elective Paper-I", [3, 1, 0], 4, MT_POOL),
          elective("Elective Paper-II", [3, 1, 0], 4, MT_POOL),
          d({ title: spec.s1Labs[0], ltp: [0, 0, 3], credits: 2, kind: "lab" }),
          d({ title: spec.s1Labs[1], ltp: [0, 0, 3], credits: 2, kind: "lab" }),
          d({ title: "Seminar", ltp: [0, 0, 2], credits: 1, kind: "seminar" }),
        ],
      },
      {
        semester: 2,
        subjects: [
          d({ title: spec.s2Core[0], ltp: [3, 1, 0], credits: 4 }),
          d({ title: spec.s2Core[1], ltp: [3, 1, 0], credits: 4 }),
          elective("Elective Paper-I", [3, 1, 0], 4, MT_POOL),
          elective("Elective Paper-II", [3, 1, 0], 4, MT_POOL),
          d({ title: spec.s2Labs[0], ltp: [0, 0, 3], credits: 2, kind: "lab" }),
          d({ title: spec.s2Labs[1], ltp: [0, 0, 3], credits: 2, kind: "lab" }),
          d({ title: "Project Preliminary", ltp: [0, 0, 0], credits: 3, kind: "project", timetabled: false }),
          d({ title: "Comprehensive Viva", ltp: [0, 0, 0], credits: 2, kind: "viva", timetabled: false }),
        ],
      },
      {
        semester: 3,
        subjects: [
          d({ title: "Project & Thesis-I", ltp: [0, 0, 0], credits: 10, kind: "project", timetabled: false }),
        ],
      },
      {
        semester: 4,
        subjects: [
          d({ title: "Project & Thesis-II", ltp: [0, 0, 0], credits: 20, kind: "project", timetabled: false }),
        ],
      },
    ],
  };
}

export const EE_CATALOGUE: CatalogueDepartment = {
  id: "EE",
  name: "Electrical Engineering",
  shortName: "EE",
  programmes: [BTECH, ...SPECS.map(mtechSpec)],
};
