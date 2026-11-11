/**
 * The NIT Agartala Mechanical Engineering syllabus catalogue.
 *
 * Extracted 2026-11-11 (reference/catalogue-raw/mechanical-btech-mtech-structure.md).
 * B.Tech https://nita.ac.in/Syllabus_BTech_ME_165Credit_MechEng10094.pdf
 * — FULL UME codes printed; Sem 3–8 = 122 cr, Sem 1–2 the common
 * first year; labs are P=2 (2h sessions). Five M.Tech
 * specialisations (80 cr each) print NO codes — derived:
 * Material Science (28/20/12/20 — non-standard, VNIT twinning),
 * Thermal Science, Manufacturing Technology, Automotive
 * Engineering, Machine Design (25/25/10/20).
 */

import { CodeBook, elective, sub, RawSub } from "./build.js";
import { FIRST_YEAR_CODES, FIRST_YEAR_SEMESTERS } from "./firstYear.js";
import {
  CatalogueDepartment,
  CatalogueElectiveOption,
  CatalogueProgramme,
} from "./types.js";

const book = new CodeBook(FIRST_YEAR_CODES);
const d = (raw: Omit<RawSub, "code">) => sub(book.derived(raw));
const c = (code: string, title: string, ltp: [number, number, number], credits: number, extra?: Partial<RawSub>) =>
  sub({ code, title, ltp, credits, syllabusCode: code, ...extra });
const co = (code: string, title: string): CatalogueElectiveOption => ({
  syllabusCode: code,
  shortCode: code,
  title,
});

const BTECH: CatalogueProgramme = {
  programme: "B.Tech",
  semesters: [
    ...FIRST_YEAR_SEMESTERS,
    {
      semester: 3,
      subjects: [
        c("UME03B07", "Basic Engineering Thermodynamics", [3, 0, 0], 3),
        c("UME03B08", "Engineering Materials", [3, 0, 0], 3),
        c("UME03B09", "Fluid Mechanics-I", [3, 0, 0], 3),
        c("UME03C14", "Mathematics-III", [3, 0, 0], 3),
        c("UME03C15", "Applied Electrical and Electronics Engineering", [3, 0, 0], 3),
        c("UME03B10", "Strength of Materials", [3, 0, 0], 3),
        c("UME03P14", "M.E Lab-I (Applied Mechanics Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME03P15", "M.E Lab-I (Strength of Materials Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME03P19", "Applied Electrical & Electronics Lab", [0, 0, 2], 1, { kind: "lab" }),
        c("UME03P16", "M.E Lab-II (Machine Drawing Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME03P17", "M.E Lab-II (Material Science Lab)", [0, 0, 2], 1, { kind: "lab" }),
        // Listed under Laboratories in the structure table (its
        // detail page says 0 cr — the structure-table 1 cr is used).
        c("UME03P20", "Professional Ethics", [0, 0, 2], 1, { kind: "lab" }),
      ],
    },
    {
      semester: 4,
      subjects: [
        c("UME04C07", "Applied Thermodynamics", [3, 0, 0], 3),
        c("UME04C08", "Kinematics of Machine", [3, 0, 0], 3),
        c("UME04C09", "Fluid Mechanics-II", [3, 0, 0], 3),
        c("UME04C10", "Manufacturing Technology-I", [3, 0, 0], 3),
        c("UME04B15", "Numerical Methods & Computer Programming", [3, 0, 0], 3),
        c("UME04C11", "Design of Machine Elements-I", [3, 0, 0], 3),
        c("UME04P18", "ME Lab-III (Primary Manufacturing Processes Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME04P19", "ME Lab-III (Computer Programming Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME04P20", "ME Lab-IV (Fluid Mechanics Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME04P21", "ME Lab-IV (Design of Machine Elements Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME04P22", "Soft Skill Development", [0, 0, 2], 1, { kind: "lab" }),
      ],
    },
    {
      semester: 5,
      subjects: [
        c("UME05C01", "Heat & Mass Transfer", [3, 0, 0], 3),
        c("UME05C02", "Design of Machine Elements-II", [3, 0, 0], 3),
        c("UME05C03", "Manufacturing Technology-II", [3, 0, 0], 3),
        c("UME05C04", "Fluid Machinery", [3, 0, 0], 3),
        c("UME05C06", "Vibration and Control", [3, 0, 0], 3),
        c("UME05C05", "Mechanical Measurement & Instrumentation", [3, 0, 0], 3),
        c("UME05P30", "ME Lab-V (Vibration Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME05P31", "ME Lab-V (Machine Design Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME05P32", "ME Lab-VI (Mechanical Measurement & Instrumentation Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME05P33", "ME Lab-VI (Machining & Machine Tool Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME05P28", "ME Lab-VII (Heat & Mass Transfer Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME05P29", "ME Lab-VII (Fluid Machinery Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME05P27", "Minor Project-I", [0, 0, 3], 1, { kind: "project", timetabled: false }),
      ],
    },
    {
      semester: 6,
      subjects: [
        c("UME06C01", "Dynamics of Machines", [3, 0, 0], 3),
        c("UME06C03", "Advanced Manufacturing Processes", [3, 0, 0], 3),
        c("UME06C02", "Refrigeration & Air Conditioning", [3, 0, 0], 3),
        c("UME06C04", "I.C. Engines", [3, 0, 0], 3),
        c("UME06C06", "Thermal Power Engineering", [3, 0, 0], 3),
        c("UME06C05", "Industrial Engineering & Management", [3, 0, 0], 3),
        c("UME06B23", "Environmental Engineering (Mandatory)", [1, 0, 0], 0),
        c("UME06P31", "ME Lab-VII (Refrigeration & AC Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME06P32", "ME Lab-VII (Thermal Power Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME06P33", "ME Lab-IX (Advanced Manufacturing Process Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME06P34", "ME Lab-IX (I.C Engines Lab)", [0, 0, 2], 1, { kind: "lab" }),
        c("UME06P30", "Minor Project-II", [0, 0, 3], 1, { kind: "project", timetabled: false }),
        d({ title: "Industrial Tour", ltp: [0, 0, 0], credits: 0, kind: "other", timetabled: false }),
      ],
    },
    {
      semester: 7,
      subjects: [
        elective("Elective-I", [3, 0, 0], 3, [
          co("UME07E03", "Power Plant Engineering"),
          co("UME07E04", "Industrial Tribology"),
        ]),
        elective("Elective-II", [3, 0, 0], 3, [
          co("UME07E05", "Automobile Engineering"),
          co("UME07E06", "Product Design for Manufacturability and Assembly"),
        ]),
        // Integrated 3-0-2 row: single theory entry, weeklyHours 5.
        c("UME07C82", "Mechanical System Design & Industrial Automation", [3, 0, 2], 4, {
          weeklyHoursOverride: 5,
        }),
        c("UME07B91", "Entrepreneurship Development", [1, 0, 0], 1),
        d({ title: "Industrial Training & Seminar", ltp: [0, 0, 2], credits: 1, kind: "seminar" }),
        c("UME07P102", "Major Project-I", [0, 0, 6], 2, { kind: "project", timetabled: false }),
      ],
    },
    {
      semester: 8,
      subjects: [
        elective("Elective-III", [3, 0, 0], 3, [
          co("UME08E51", "Computational Fluid Dynamics"),
          co("UME08E52", "Additive Manufacturing"),
        ]),
        elective("Elective-IV", [3, 0, 0], 3, [
          co("UME08E53", "Powder Metallurgy"),
          co("UME08E54", "CAD and Geometric Modeling"),
        ]),
        elective("Elective-V", [3, 0, 0], 3, [
          co("UME08E55", "Advanced Machine Design"),
          co("UME08E56", "Boundary Layer Theory"),
        ]),
        c("UME08P100", "Viva-Voce", [0, 0, 0], 1, { kind: "viva", timetabled: false }),
        c("UME08P101", "Major Project-II", [0, 0, 9], 3, { kind: "project", timetabled: false }),
      ],
    },
  ],
};

// ------------------------------------------------------------------ M.Tech
function thesis(cr1: number, cr2: number): CatalogueProgramme["semesters"] {
  return [
    {
      semester: 3,
      subjects: [d({ title: "Project and Thesis-1", ltp: [0, 0, 0], credits: cr1, kind: "project", timetabled: false })],
    },
    {
      semester: 4,
      subjects: [d({ title: "Project and Thesis-2", ltp: [0, 0, 0], credits: cr2, kind: "project", timetabled: false })],
    },
  ];
}
const seminarTW = () =>
  d({ title: "Technical Writing and Seminar", ltp: [0, 0, 2], credits: 1, kind: "seminar" });
const prelim = () =>
  d({ title: "Project Preliminary", ltp: [0, 0, 6], credits: 3, kind: "project", timetabled: false });
const viva2 = () =>
  d({ title: "Comprehensive Viva Voce", ltp: [0, 0, 0], credits: 2, kind: "viva", timetabled: false });
const theory4 = (title: string) => d({ title, ltp: [3, 1, 0], credits: 4 });
const lab2 = (title: string) => d({ title, ltp: [0, 0, 3], credits: 2, kind: "lab" });
const poolOf = (titles: string[]) => titles.map((t) => book.option(t));

const THERMAL_POOL: CatalogueElectiveOption[] = [
  ...poolOf([
    "Computational Methods in Fluid Flow and Heat Transfer",
    "Design of Thermal System",
    "Two Phase Flow and Heat Transfer",
    "Design of Combustion Engine",
    "Finite Element Methods",
    "Computational Fluid Dynamics",
    "Alternative Fuels and Energy Systems",
    "Compressible Flow",
    "Engine Combustion and Emissions",
  ]),
  // The same pool's lab options (0-0-3, 2 cr) — picks resolve as labs.
  ...[
    "FEM Modeling and Analysis Laboratory",
    "Two Phase Flow and Heat Transfer Laboratory",
    "Computation Methods in Fluid Flow and Heat Transfer Lab",
  ].map((t) => ({
    ...book.option(t),
    type: "lab" as const,
    weeklyHours: 3,
    sessionHours: 3,
    credits: 2,
  })),
];

const THERMAL: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Thermal Science and Engineering",
  semesters: [
    {
      semester: 1,
      subjects: [
        theory4("Advanced Mathematics for Engineers"),
        theory4("Viscous Fluid Mechanics"),
        theory4("Advance Thermodynamics"),
        theory4("Conduction and Radiation"),
        elective("Elective-I", [3, 1, 0], 4, THERMAL_POOL),
        lab2("Experimental Methods in Thermal Engineering"),
        lab2("Computational Fluid Dynamics Laboratory"),
        seminarTW(),
      ],
    },
    {
      semester: 2,
      subjects: [
        theory4("Convective Heat and Mass Transfer"),
        elective("Elective-II", [3, 1, 0], 4, THERMAL_POOL),
        elective("Elective-III", [3, 1, 0], 4, THERMAL_POOL),
        elective("Elective-IV", [3, 1, 0], 4, THERMAL_POOL),
        lab2("Convective Heat and Mass Transfer Laboratory"),
        lab2("Lab – Laboratory based on Elective Subjects"),
        prelim(),
        viva2(),
      ],
    },
    ...thesis(10, 20),
  ],
};

const MANUFACTURING: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Manufacturing Technology",
  semesters: [
    {
      semester: 1,
      subjects: [
        theory4("Physics of Manufacturing Processes"),
        theory4("Numerical Analysis and Computer Programming"),
        theory4("Advanced Material and Processing"),
        elective("Elective I", [3, 1, 0], 4, poolOf(["Metal Casting", "Laser Technology"])),
        elective("Elective II", [3, 1, 0], 4, poolOf([
          "Production Planning and Control",
          "Quality Systems Engineering",
          "Supply Chain Management",
          "Advanced Optimization Techniques",
        ])),
        lab2("CAD/CAM Laboratory"),
        lab2("Welding Laboratory"),
        seminarTW(),
      ],
    },
    {
      semester: 2,
      subjects: [
        theory4("Machining Science"),
        theory4("Non-Conventional Machining Processes"),
        elective("Elective III", [3, 1, 0], 4, poolOf([
          "Product Design & Development",
          "Additive Manufacturing Technology",
          "Modeling and Simulation of Manufacturing Processes",
          "Welding Technology",
        ])),
        elective("Elective IV", [3, 1, 0], 4, poolOf([
          "Metal Cutting",
          "Machine Tool Design",
          "Ergonomics and Industrial Manufacturing",
          "Robotics",
        ])),
        lab2("Robotics and Mechatronics Laboratory"),
        lab2("Non Traditional Machining Laboratory"),
        prelim(),
        viva2(),
      ],
    },
    ...thesis(10, 20),
  ],
};

const AUTOMOTIVE: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Automotive Engineering",
  semesters: [
    {
      semester: 1,
      subjects: [
        theory4("Advanced Mathematics for Engineers"),
        theory4("Engine Combustion and Emissions"),
        theory4("Automotive Transmission"),
        elective("Elective-I", [3, 1, 0], 4, poolOf([
          "Viscous Fluid Mechanics",
          "Advance Thermodynamics",
          "Advanced Materials and Processing",
        ])),
        elective("Elective-II", [3, 1, 0], 4, poolOf([
          "Computational Fluid Dynamics",
          "Finite Element Method",
          "Numerical Analysis and Computer Programming",
          "Engine Management Systems",
        ])),
        lab2("Automotive Systems Laboratory"),
        lab2("CAD/CAM Laboratory"),
        seminarTW(),
      ],
    },
    {
      semester: 2,
      subjects: [
        theory4("Vehicle Dynamics"),
        theory4("Automotive Chassis and Body Engineering"),
        elective("Elective-III", [3, 1, 0], 4, poolOf([
          "Alternative Fuels and Energy Systems",
          "Advanced Vibration",
          "Computational Methods in Fluid Flow and Heat Transfer",
        ])),
        elective("Elective-IV", [3, 1, 0], 4, poolOf([
          "Automotive Materials and Component Manufacturing",
          "Engine Design and Development",
          "Electric and Hybrid Vehicles",
          "Product Design and Development",
        ])),
        prelim(),
        lab2("Automotive Simulation and Analysis Laboratory"),
        lab2("Robotics and Mechatronics Laboratory"),
        viva2(),
      ],
    },
    ...thesis(10, 20),
  ],
};

const MACHINE_DESIGN: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Machine Design",
  semesters: [
    {
      semester: 1,
      subjects: [
        theory4("Advanced Machine Design"),
        theory4("Computer Aided Design"),
        theory4("Analysis and Synthesis of Mechanism"),
        elective("Elective-I", [3, 1, 0], 4, poolOf([
          "Advanced Mathematics for Engineers",
          "Soft Computing",
          "Artificial Intelligence",
        ])),
        elective("Elective-II", [3, 1, 0], 4, poolOf([
          "Finite Element Methods",
          "Experimental Stress Analysis for Design",
          "Advanced Mechanics of Solids",
        ])),
        lab2("Modeling and Analysis Laboratory"),
        lab2("Computer Aided Design Laboratory"),
        seminarTW(),
      ],
    },
    {
      semester: 2,
      subjects: [
        theory4("Machine Tool Design"),
        theory4("Advanced Vibration"),
        elective("Elective-III", [3, 1, 0], 4, poolOf([
          "Robotics",
          "Tribological System Design",
          "Robotics and Automation",
          "Applied Computational Methods",
          "Design Optimization",
        ])),
        elective("Elective-IV", [3, 1, 0], 4, poolOf([
          "Product Design & Development",
          "Design of Combustion Engine",
          "Mechanics of Composite Materials",
          "Fracture Mechanics",
        ])),
        lab2("Machine Tool Laboratory"),
        lab2("Advanced Vibration Laboratory"),
        prelim(),
        viva2(),
      ],
    },
    ...thesis(10, 20),
  ],
};

const MATERIAL_SCIENCE: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Material Science and Engineering",
  semesters: [
    {
      semester: 1,
      subjects: [
        theory4("Thermodynamics of Materials"),
        theory4("Structure & Characterization of Materials"),
        theory4("Polymer Engineering"),
        theory4("Ceramic Engineering"),
        theory4("Numerical Methods and Applied Statistics"),
        theory4("Physical Metallurgy"),
        lab2("Structure & Characterization of Materials Lab"),
        lab2("Physical Metallurgy Lab"),
      ],
    },
    {
      semester: 2,
      subjects: [
        d({ title: "Design & Selection of Materials", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Phase Transformation of Materials", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Comprehensive Viva", ltp: [0, 0, 0], credits: 1, kind: "viva", timetabled: false }),
        // ONE slot for the theory+lab pair (4 cr): the pick is the
        // theory subject; its paired lab is bundled (simplification
        // recorded in the provenance note).
        elective("Elective Pair", [3, 0, 0], 4, poolOf([
          "Non Destructive Evaluation",
          "Process Modeling and Simulation",
        ])),
        elective("Elective-I", [3, 0, 0], 3, poolOf([
          "Advance Composite Materials",
          "Powder Metallurgy",
          "Deformation Behavior of Materials",
          "Alloy & Special Steels",
          "Biomaterials",
          "Corrosion Process and Control",
          "Advanced Ceramics",
          "Failure Analysis of Engineering Materials",
          "Welding & Joining",
          "Defect in Crystalline Materials",
        ])),
        elective("Elective-II", [3, 0, 0], 3, poolOf([
          "Advance Composite Materials",
          "Powder Metallurgy",
          "Deformation Behavior of Materials",
          "Alloy & Special Steels",
          "Biomaterials",
          "Corrosion Process and Control",
          "Advanced Ceramics",
          "Failure Analysis of Engineering Materials",
          "Welding & Joining",
          "Defect in Crystalline Materials",
        ])),
        elective("Elective-III", [3, 0, 0], 3, poolOf([
          "Advance Composite Materials",
          "Powder Metallurgy",
          "Deformation Behavior of Materials",
          "Alloy & Special Steels",
          "Biomaterials",
          "Corrosion Process and Control",
          "Advanced Ceramics",
          "Failure Analysis of Engineering Materials",
          "Welding & Joining",
          "Defect in Crystalline Materials",
        ])),
      ],
    },
    ...thesis(12, 20),
  ],
};

export const MECH_CATALOGUE: CatalogueDepartment = {
  id: "MECH",
  name: "Mechanical Engineering",
  shortName: "ME",
  programmes: [BTECH, MATERIAL_SCIENCE, THERMAL, MANUFACTURING, AUTOMOTIVE, MACHINE_DESIGN],
};
