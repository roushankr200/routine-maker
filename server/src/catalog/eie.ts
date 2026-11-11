/**
 * The NIT Agartala EIE syllabus catalogue — M.Tech only.
 *
 * The department's B.Tech syllabus is NOT published on the live
 * site (confirmed gap, 2026-11-11), so EIE has no B.Tech programme
 * here; B.Tech classes go through the manual path of the unified
 * setup. The M.Tech in IoT and Sensor Systems structure is from the
 * official PDFs (reference/catalogue-raw/eie-mtech-structure.md):
 * https://nita.ac.in/DEPTUP_FILES_31-07-2026_CourseStructure-MTech-IoT-SensorSystem_EIE10093.pdf
 * — 80 cr (25/25/10/20). No subject codes printed (the detailed
 * syllabus uses the template PGEIXXX) — codes derived from titles.
 */

import { CodeBook, elective, sub, RawSub } from "./build.js";
import { FIRST_YEAR_CODES } from "./firstYear.js";
import { CatalogueDepartment, CatalogueProgramme } from "./types.js";

const book = new CodeBook(FIRST_YEAR_CODES);
const d = (raw: Omit<RawSub, "code">) => sub(book.derived(raw));

const E1 = ["Flexible and Wearable Sensors", "Agricultural Sensors", "Fibre Optic Sensors and Photonics", "RF and Microwave Sensors"].map((t) => book.option(t));
const E2 = ["Graph Theory and Optimization", "Fog and Edge Computing", "Machine Learning and AI", "Neuromorphic Computing and Design"].map((t) => book.option(t));
const E3 = ["MEMS Fabrication Technology", "Industrial IoT", "IC Testing and Testability", "Cyber Physical System"].map((t) => book.option(t));
const E4 = ["Wireless Sensor Networks", "IoT Security and Trust", "System Dynamics and Control Systems", "Robotics and Control"].map((t) => book.option(t));

const MTECH_IOT: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "IoT and Sensor Systems",
  semesters: [
    {
      semester: 1,
      subjects: [
        d({ title: "Smart Sensors", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "IoT Fundamentals and Architecture", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Signal Processing and Data Analytics", ltp: [3, 1, 0], credits: 4 }),
        elective("Elective-I", [3, 1, 0], 4, E1),
        elective("Elective-II", [3, 1, 0], 4, E2),
        d({ title: "Laboratory-I (Smart Sensors Lab)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Laboratory-II (Signal Processing and Data Analytics Lab)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Seminar", ltp: [0, 0, 2], credits: 1, kind: "seminar" }),
      ],
    },
    {
      semester: 2,
      subjects: [
        d({ title: "Embedded Systems Design", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Analog and Digital Interfacing Circuits", ltp: [3, 1, 0], credits: 4 }),
        elective("Elective-III", [3, 1, 0], 4, E3),
        elective("Elective-IV", [3, 1, 0], 4, E4),
        d({ title: "Laboratory-III (Embedded Systems Design)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Laboratory-IV (Analog and Digital Interfacing Circuits)", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Mini Project and Presentation", ltp: [0, 0, 3], credits: 3, kind: "project", timetabled: false }),
        d({ title: "Comprehensive Viva-voce", ltp: [0, 0, 0], credits: 2, kind: "viva", timetabled: false }),
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

export const EIE_CATALOGUE: CatalogueDepartment = {
  id: "EIE",
  name: "Electronics and Instrumentation Engineering",
  shortName: "EIE",
  programmes: [MTECH_IOT],
};
