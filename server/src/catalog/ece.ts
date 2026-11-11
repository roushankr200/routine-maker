/**
 * The NIT Agartala ECE syllabus catalogue.
 *
 * Extracted 2026-11-11 (reference/catalogue-raw/ece-btech-mtech-structure.md):
 * B.Tech https://nita.ac.in/BTech_sylabus_ECE2021_ECE10092.pdf
 * (Sem 3–8 = 120 cr; Sem 1–2 the common first year), M.Tech
 * Communication Systems & Signal Processing
 * https://nita.ac.in/Syllabus_Communication_SignalProcessing_Aug24_ECE10092.pdf
 * and M.Tech VLSI Design
 * https://nita.ac.in/MTech_Syllabus__VLSIDesign_Aug24_ECE10092.pdf
 * (80 cr each). NO subject codes printed anywhere — derived.
 *
 * Most B.Tech rows are INTEGRATED theory+lab (e.g. 3-0-2): per the
 * uniform rule each is a SINGLE theory entry with
 * weeklyHours = round(L+T+P).
 */

import { CodeBook, elective, sub, RawSub } from "./build.js";
import { FIRST_YEAR_CODES, FIRST_YEAR_SEMESTERS } from "./firstYear.js";
import { CatalogueDepartment, CatalogueProgramme } from "./types.js";

const book = new CodeBook(FIRST_YEAR_CODES);
const d = (raw: Omit<RawSub, "code">) => sub(book.derived(raw));
const di = (raw: Omit<RawSub, "code">) =>
  sub(book.derived({ ...raw, weeklyHoursOverride: Math.round(raw.ltp[0] + raw.ltp[1] + raw.ltp[2]) }));

const DEPT_POOL = [
  "Advanced Digital Systems",
  "Computer Architecture",
  "Embedded System Design",
  "Advanced Semiconductor Devices",
  "Advanced Control System",
  "Low Power VLSI Circuits",
  "Industrial Electronics",
  "Detection and Estimation Theory",
  "Radar & Navigation Systems",
  "Smart Antenna",
  "RF Circuits & Systems",
  "Electronic System Design",
  "Wireless Networks",
  "Internet of Things",
  "Adaptive Signal Processing",
].map((t) => book.option(t));

const OPEN_POOL = [
  "Digital Image Processing",
  "Machine Learning & Artificial Intelligence",
  "Fuzzy Logic and Neural Network",
  "Laser and Nonlinear Optics",
  "Nano-Technology",
  "Cryptography & Network Security",
  "Biomedical Signal Processing",
  "Operating Systems",
  "Computational Electromagnetics",
  "Digital Speech Processing",
  "Object Oriented Programming",
  "Robotics",
  "Smart Grid Communication",
  "VLSI for Wireless Communication",
].map((t) => book.option(t));

const BTECH: CatalogueProgramme = {
  programme: "B.Tech",
  semesters: [
    ...FIRST_YEAR_SEMESTERS,
    {
      semester: 3,
      subjects: [
        d({ title: "Mathematics-III", ltp: [3, 0, 0], credits: 3 }),
        di({ title: "Data Structures & Algorithm", ltp: [3, 0, 2], credits: 4 }),
        di({ title: "Semiconductor Theory & Devices", ltp: [4, 0, 2], credits: 5 }),
        di({ title: "Analog System Analysis & Design-I", ltp: [3, 0, 2], credits: 4 }),
        di({ title: "Network Theory", ltp: [4, 0, 2], credits: 5 }),
        d({ title: "Signals & Systems", ltp: [3, 1, 0], credits: 4 }),
      ],
    },
    {
      semester: 4,
      subjects: [
        d({ title: "Economics for Engineers", ltp: [3, 0, 0], credits: 3 }),
        di({ title: "Analog System Analysis and Design-II", ltp: [3, 0, 2], credits: 4 }),
        di({ title: "Electromagnetic Theory", ltp: [3, 1, 2], credits: 5 }),
        d({ title: "Probability Theory and Stochastic Process", ltp: [3, 0, 0], credits: 3 }),
        di({ title: "Digital Electronics & Systems", ltp: [4, 0, 2], credits: 5 }),
        di({ title: "Control Engineering", ltp: [4, 0, 2], credits: 5 }),
      ],
    },
    {
      semester: 5,
      subjects: [
        d({ title: "Industrial Management", ltp: [3, 0, 0], credits: 3 }),
        di({ title: "Analog and Digital Communication", ltp: [4, 0, 2], credits: 5 }),
        di({ title: "Electronic Instrumentation", ltp: [4, 0, 2], credits: 5 }),
        di({ title: "Digital Signal Processing", ltp: [4, 0, 2], credits: 5 }),
        di({ title: "Microprocessor and Microcontroller", ltp: [4, 0, 2], credits: 5 }),
      ],
    },
    {
      semester: 6,
      subjects: [
        di({ title: "Microwave Engineering", ltp: [4, 0, 2], credits: 5 }),
        di({ title: "Optical Fibre", ltp: [4, 0, 2], credits: 5 }),
        di({ title: "VLSI Design", ltp: [3, 0, 2], credits: 4 }),
        d({ title: "Information Theory & Coding", ltp: [3, 0, 0], credits: 3 }),
        di({ title: "Data Communication & Networks", ltp: [3, 0, 2], credits: 4 }),
      ],
    },
    {
      semester: 7,
      subjects: [
        di({ title: "Wireless Communication", ltp: [3, 0, 2], credits: 4 }),
        elective("Elective-I", [3, 0, 0], 3, DEPT_POOL),
        elective("Elective-II", [3, 0, 0], 3, DEPT_POOL),
        d({ title: "Project Preliminary", ltp: [0, 0, 3], credits: 2, kind: "project", timetabled: false }),
        d({ title: "Industrial Training and Seminar", ltp: [0, 0, 2], credits: 1, kind: "seminar" }),
      ],
    },
    {
      semester: 8,
      subjects: [
        elective("Elective-IV", [3, 0, 0], 3, DEPT_POOL),
        // Elective-V/VI are printed "Departmental/Open": combined pool.
        elective("Elective-V", [3, 0, 0], 3, [...DEPT_POOL, ...OPEN_POOL]),
        elective("Elective-VI", [3, 0, 0], 3, [...DEPT_POOL, ...OPEN_POOL]),
        d({ title: "Project", ltp: [0, 0, 9], credits: 3, kind: "project", timetabled: false }),
        d({ title: "Comprehensive Viva", ltp: [0, 0, 0], credits: 1, kind: "viva", timetabled: false }),
      ],
    },
  ],
};

const CSSP_E1 = [
  "Antenna Theory and Design",
  "Smart Antenna",
  "Microwave & Millimeter Wave Devices",
  "Radar Signal Processing",
  "Microwave Circuits, Systems and Application",
  "Cryptography & Network Security",
].map((t) => book.option(t));
const CSSP_E2 = [
  "Light Wave Technology",
  "MIMO Communication Systems",
  "Optical Communication Systems",
  "Electromagnetic Metamaterials",
  "Advanced Control System",
  "Digital Control System",
].map((t) => book.option(t));
const CSSP_E3 = [
  "Advanced Microwave Circuits",
  "Fundamentals of Antenna and Design",
  "Remote Sensing and Navigational Systems",
  "Optoelectronic Devices & Circuits",
  "Laser Science & Technology",
  "Metaheuristic Algorithms & their applications",
  "Electromagnetic Interference & Compatibility",
].map((t) => book.option(t));

const VLSI_POOL = [
  "VLSI Testing and Testability",
  "Embedded Systems and IOT",
  "VLSI Signal Processing",
  "Optoelectronics Device and Circuits",
  "Semiconductor Memories",
  "VLSI Interconnects",
  "Laser Science and Technology",
  "VLSI Based Chip Design for Signal and Image Processing",
  "Technology CAD",
  "Nanoelectronics Devices",
  "Synthesis and Characterization of Nanomaterials",
  "An Introduction to Electronic Systems Packaging",
  "Advanced Computer Architecture and Processor Design",
  "Hardware Security",
  "MEMS and Microsystems",
  "Logic Synthesis and Verification",
  "Mixed Mode VLSI Circuit Design",
  "Metaheuristic Algorithms and their applications",
].map((t) => book.option(t));

function thesisSemesters(): CatalogueProgramme["semesters"] {
  return [
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
  ];
}

const MTECH_CSSP: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Communication Systems & Signal Processing",
  semesters: [
    {
      semester: 1,
      subjects: [
        d({ title: "Linear Algebra & Stochastic Processes", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Advanced Digital Signal Processing", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Advanced Digital Communication", ltp: [3, 1, 0], credits: 4 }),
        elective("Elective-I", [3, 1, 0], 4, CSSP_E1),
        elective("Elective-II", [3, 1, 0], 4, CSSP_E2),
        d({ title: "Laboratory-I (Advanced Digital Communication Lab)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Laboratory-II (Advanced DSP Lab)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Seminar", ltp: [0, 0, 2], credits: 1, kind: "seminar" }),
      ],
    },
    {
      semester: 2,
      subjects: [
        d({ title: "Estimation and Detection Theory", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Mobile Communication", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Switching & Communication Networks", ltp: [3, 1, 0], credits: 4 }),
        elective("Elective-III", [3, 1, 0], 4, CSSP_E3),
        d({ title: "Laboratory-III (Optical Fibre Communication / Wireless Communication Lab)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Laboratory-IV (Advanced RF Lab)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Project Preliminary", ltp: [0, 0, 6], credits: 3, kind: "project", timetabled: false }),
        d({ title: "Comprehensive Viva-Voce", ltp: [0, 0, 0], credits: 2, kind: "viva", timetabled: false }),
      ],
    },
    ...thesisSemesters(),
  ],
};

const MTECH_VLSI: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "VLSI Design",
  semesters: [
    {
      semester: 1,
      subjects: [
        d({ title: "Digital VLSI Circuits", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Analog VLSI Circuits", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Semiconductor Device Modeling", ltp: [3, 1, 0], credits: 4 }),
        elective("Elective-I", [3, 1, 0], 4, VLSI_POOL),
        elective("Elective-II", [3, 1, 0], 4, VLSI_POOL),
        d({ title: "Laboratory-I (Microelectronics Lab)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Laboratory-II (FPGA Design and Simulation Lab)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Seminar", ltp: [0, 0, 2], credits: 1, kind: "seminar" }),
      ],
    },
    {
      semester: 2,
      subjects: [
        d({ title: "VLSI Fabrication Technology", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "CAD of VLSI System", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Low Power VLSI Design", ltp: [3, 1, 0], credits: 4 }),
        elective("Elective-III", [3, 1, 0], 4, VLSI_POOL),
        d({ title: "Laboratory-III (ASIC Design and Simulation Lab)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Laboratory-IV (Signal Processing and Embedded Systems Lab)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Project Preliminary", ltp: [0, 0, 3], credits: 3, kind: "project", timetabled: false }),
        d({ title: "Comprehensive Viva-Voce", ltp: [0, 0, 0], credits: 2, kind: "viva", timetabled: false }),
      ],
    },
    ...thesisSemesters(),
  ],
};

export const ECE_CATALOGUE: CatalogueDepartment = {
  id: "ECE",
  name: "Electronics and Communication Engineering",
  shortName: "ECE",
  programmes: [BTECH, MTECH_CSSP, MTECH_VLSI],
};
