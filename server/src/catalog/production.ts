/**
 * The NIT Agartala Production Engineering catalogue — B.Tech only,
 * and NUMBERS-FREE by necessity.
 *
 * The official PDF (https://nita.ac.in/Syllabus_BTech_PE_July2024_ProdEng10087.pdf,
 * 38 pp) is a detailed syllabus with NO course-structure table: it
 * prints no L/T/P, no credits and no semester totals for any subject
 * (reference/catalogue-raw/production-btech-structure.md). The
 * catalogue therefore carries titles, the printed codes (several
 * are literal "UPE03XXX" templates — kept as syllabusCode, with
 * short codes derived from titles) and the elective pools, with
 * weeklyHours / sessionHours / credits all NULL. The programme is
 * flagged `numbersRequired`: the unified setup collects the numbers
 * from the user per subject. Nothing here is invented.
 *
 * Production M.Tech (Computer Integrated Manufacturing) has NO
 * syllabus PDF on the live site — not catalogued (manual path).
 * Sem 1–2 are the common first year (which DOES publish numbers).
 */

import { CodeBook } from "./build.js";
import { FIRST_YEAR_CODES, FIRST_YEAR_SEMESTERS } from "./firstYear.js";
import {
  CatalogueDepartment,
  CatalogueKind,
  CatalogueProgramme,
  CatalogueSubject,
} from "./types.js";

const book = new CodeBook(FIRST_YEAR_CODES);

/**
 * A Production subject. `printed` is the code exactly as the PDF
 * prints it (possibly a template); when it is a template the short
 * code is derived from the title instead.
 */
function ps(
  printed: string,
  title: string,
  kind: CatalogueKind,
  timetabled = true,
): CatalogueSubject {
  const isTemplate = printed.includes("XXX");
  const code = isTemplate ? book.codeFor(title) : printed;
  return {
    key: code,
    syllabusCode: printed,
    shortCode: code,
    title,
    L: 0,
    T: 0,
    P: 0,
    credits: null,
    kind,
    timetabled,
    ...(isTemplate ? { derived: true } : {}),
    weeklyHours: null,
    sessionHours: null,
  };
}

function electiveSlot(printed: string, title: string, poolTitles: string[]): CatalogueSubject {
  const s = ps(printed, title, "elective");
  s.electivePool = poolTitles.map((t) => book.option(t));
  return s;
}

const BTECH: CatalogueProgramme = {
  programme: "B.Tech",
  numbersRequired: true,
  semesters: [
    ...FIRST_YEAR_SEMESTERS,
    {
      semester: 3,
      subjects: [
        ps("UPE03XXX", "Engineering Thermodynamics", "theory"),
        ps("UPE03B02", "Solid Mechanics", "theory"),
        ps("UPE03XXX", "Fluid Mechanics", "theory"),
        ps("UPE03B04", "Manufacturing Processes I", "theory"),
        ps("UPE03B05", "Electrical Machines", "theory"),
        ps("UPE03P11", "Solid Mechanics Laboratory", "lab"),
        ps("UPE03P12", "Fluid Mechanics Laboratory", "lab"),
        ps("UPE03XXX", "Workshop Process", "lab"),
        ps("UPE03P14", "Electrical Machines Laboratory", "lab"),
      ],
    },
    {
      semester: 4,
      subjects: [
        ps("UPE04B06", "Thermal Power Engineering", "theory"),
        ps("UPE04XXX", "Numerical Methods for Computing", "theory"),
        ps("UPE04B08", "Plant Layout & Material Handling", "theory"),
        ps("UPE04B09", "Measurement and Instrumentation", "theory"),
        ps("UPE04B10", "Mechanics of Machines", "theory"),
        ps("UPE04B11", "Engineering Materials", "theory"),
        ps("UPE04P15", "Thermal Power Engineering Laboratory", "lab"),
        ps("UPE04P16", "Mechanics of Machines Laboratory", "lab"),
        ps("UPE04P17", "Measurements and Instrumentation Laboratory", "lab"),
      ],
    },
    {
      semester: 5,
      subjects: [
        ps("UPE05B13", "Machining Principles and Technology", "theory"),
        ps("UPE05B14", "Design of Machine Elements", "theory"),
        ps("UPE05B15", "Ergonomics and Work System Design", "theory"),
        ps("UPE05XXX", "Production Planning and Control", "theory"),
        ps("UPE05B17", "Computer Aided Design and Manufacturing", "theory"),
        ps("UPE05P19", "Machining Principles and Technology Laboratory", "lab"),
        ps("UPE05P20", "CAD/CAM Laboratory", "lab"),
        ps("UPE05P21", "Ergonomics and Work System Design Laboratory", "lab"),
        ps("UPE05P22", "Design Practice", "lab"),
      ],
    },
    {
      semester: 6,
      subjects: [
        ps("UPE06B18", "Manufacturing Process II", "theory"),
        ps("UPE06B19", "Machine Tool System", "theory"),
        ps("UPE06B20", "Operations Research", "theory"),
        ps("UPE06XXX", "Automation, CNC and Robotics", "theory"),
        electiveSlot("UPE06B22", "Elective I", [
          "Optoelectronics and Laser Materials Processing",
          "Management Information System (MIS)",
          "Total Quality Management",
          "Fluid Machinery",
        ]),
        ps("UPE06P23", "Manufacturing Process-II Lab", "lab"),
        ps("UPE06P24", "Machine Tool System Laboratory", "lab"),
        ps("UPE06XXX", "Automation and Condition Monitoring Laboratory", "lab"),
        ps("UPE06P26", "Seminar on Assigned Topics", "seminar"),
      ],
    },
    {
      semester: 7,
      subjects: [
        ps("UPE07B23", "Reliability Engineering and Plant Maintenance", "theory"),
        ps("UPE07B24", "Non-Traditional Manufacturing", "theory"),
        ps("UPE07B25", "Production and Quality Management", "theory"),
        ps("UPE07B26", "Financial Management and Costing", "theory"),
        electiveSlot("UPE07B27", "Elective II", [
          "Enterprise Resource Planning",
          "Nanotechnology",
          "Non Conventional Energy",
          "Rapid Prototyping",
        ]),
        ps("UPE07P28", "Non-Traditional Manufacturing Laboratory", "lab"),
        ps("UPE07XXX", "Mini Project", "project", false),
        ps("UPE07P30", "Industrial Training", "other", false),
      ],
    },
    {
      semester: 8,
      subjects: [
        ps("UPE08B30", "Entrepreneurship Development", "theory"),
        ps("UPE08XXX", "Professional Ethics", "theory"),
        electiveSlot("UPE08B32", "Elective", [
          "Project Planning and Appraisal",
          "Supply Chain Management",
          "Managerial Economics",
          "Soft Computing in Decision Technology",
          "Mechatronics and Modern Control",
        ]),
        ps("UPE08XXX", "Project", "project", false),
        ps("UPE08P35", "Comprehensive Viva Voce", "viva", false),
      ],
    },
  ],
};

export const PROD_CATALOGUE: CatalogueDepartment = {
  id: "PROD",
  name: "Production Engineering",
  shortName: "PE",
  programmes: [BTECH],
};
