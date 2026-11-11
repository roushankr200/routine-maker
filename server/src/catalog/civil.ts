/**
 * The NIT Agartala Civil Engineering syllabus catalogue.
 *
 * Extracted 2026-11-11 from the official PDFs (raw extractions:
 * reference/catalogue-raw/civil-btech-structure.md and
 * civil-mtech-structure.md). B.Tech (New scheme)
 * https://nita.ac.in/UG_Syllabus_New_122_CivilEng10086.pdf — full
 * UCE codes printed; Sem 3–8 = 122 cr, Sem 1–2 the common first
 * year. Seven M.Tech specialisations, all PCE-coded, 80 cr each
 * EXCEPT Hydroinformatics (110 cr as printed: 25/25/20/40).
 *
 * Five M.Tech PDFs print only Credit + Class Hours/Week (no L-T-P
 * split): those subjects store the class hours as L (theory 4h),
 * labs as P=3, seminar as P=2 — weeklyHours is exact either way.
 * Transportation and Water Resources print real L-T-P.
 */

import { CodeBook, elective, opt, sub, RawSub } from "./build.js";
import { FIRST_YEAR_CODES, FIRST_YEAR_SEMESTERS } from "./firstYear.js";
import {
  CatalogueDepartment,
  CatalogueElectiveOption,
  CatalogueProgramme,
  CatalogueSubject,
} from "./types.js";

const book = new CodeBook(FIRST_YEAR_CODES);
/** Subject with a printed code (code = syllabusCode). */
const c = (code: string, title: string, ltp: [number, number, number], credits: number, extra?: Partial<RawSub>) =>
  sub({ code, title, ltp, credits, syllabusCode: code, ...extra });
/** Pool option with a printed code. */
const co = (code: string, title: string): CatalogueElectiveOption => opt(code, title, code);
/** Pool option with NO printed code (derived). */
const po = (title: string): CatalogueElectiveOption => book.option(title);

// ------------------------------------------------------------------ B.Tech
const POOL_A = [
  co("UCE07E01", "Reinforced Earth Structure"),
  co("UCE07E02", "Alternative Building Materials"),
  co("UCE07E03", "Pre Stressed Concrete Design"),
  co("UCE07E04", "Advanced RCC Design"),
  co("UCE07E05", "Ground Improvement Techniques"),
  co("UCE07E06", "Environmental Geotechnique"),
  co("UCE07E07", "Geotechnical Investigation and Practices"),
  co("UCE07E08", "Sustainability Concept in Geotechnical Engineering"),
];
const POOL_B = [
  co("UCE07E09", "Water Resources Planning and Management"),
  co("UCE07E10", "River Engineering and Flood Control"),
  co("UCE07E11", "Design of Hydraulics Structures"),
  co("UCE07E12", "Hydro Power Engineering"),
  co("UCE07E13", "Industrial Pollution and Control"),
  co("UCE07E14", "EIA and Auditing"),
  co("UCE07E15", "Water and Wastewater Treatment Process I"),
  co("UCE07E16", "Environmental Chemistry and Microbiology"),
];
const POOL_C = [
  co("UCE07E17", "Advanced Railway Engineering"),
  co("UCE07E18", "Advanced Transportation Engineering"),
  co("UCE07E19", "Hill Roads"),
  co("UCE07E20", "Urban Transport Planning"),
  co("UCE07E21", "Advanced Structural Analysis"),
  co("UCE07E22", "Numerical Methods and Applications in Civil Engineering"),
  co("UCE07E23", "Retrofitting and Rehabilitation of Structures"),
  co("UCE07E24", "Masonry Structures"),
];
const POOL_D = [
  co("UCE07E25", "Disaster Management and Mitigation"),
  co("UCE07E26", "Sustainable Engineering"),
  co("UCE07E27", "Air Pollution and Noise Pollution"),
  co("UCE07E28", "Municipal Solid Waste Management"),
  co("UCE07E29", "Rural Infrastructure Development"),
  co("UCE07E30", "Satellite Digital Image Analysis"),
  co("UCE07E31", "Civil Engineering Materials"),
  co("UCE07E32", "Data Structures & Programming Methodology"),
  co("UCE07E33", "Application of Machine Learning in Time-Series Analysis"),
  co("UCE07E34", "Soft Computing"),
];
const POOL_E = [
  co("UCE08E01", "Rock Mechanics & Tunnelling"),
  co("UCE08E02", "Seismology and Seismic Design of Foundation"),
  co("UCE08E03", "Geographic Information System and its Application"),
  co("UCE08E04", "Foundation Design and Detailing"),
  co("UCE08E05", "Stochastic Hydrology"),
  co("UCE08E06", "Computational Hydraulics"),
  co("UCE08E07", "Open Channel Flow and Sediment Transport"),
  co("UCE08E08", "Ground Water Development and Management"),
];
const POOL_F = [
  co("UCE08E09", "Air and Water Quality Modelling"),
  co("UCE08E10", "Global Warming and Climate Change"),
  co("UCE08E11", "Environmental Planning and Management"),
  co("UCE08E12", "Water and Wastewater Treatment Processes-II"),
  co("UCE08E13", "Traffic Safety Engineering"),
  co("UCE08E14", "Pavement Engineering"),
  co("UCE08E15", "Advanced Airport Planning and Design"),
  co("UCE08E16", "Pavement Materials and Construction"),
];
const POOL_G = [
  co("UCE08E17", "Finite Element Method of Structural Analysis"),
  co("UCE08E18", "Earthquake Resistant Design of Structures"),
  co("UCE08E19", "Bridge Engineering"),
  co("UCE08E20", "Geometric Design of Transportation Facilities"),
  co("UCE08E21", "Foundation in Problematic Soil, Under Ground Construction and Retaining Structure"),
  co("UCE08E22", "Applied Geomechanics"),
  co("UCE08E23", "Environmental Quality and Pollution Monitoring Techniques"),
  co("UCE08E24", "Rural Water Supply and Sanitation"),
  co("UCE08E25", "Computational Methods in Hydrology"),
  co("UCE08E26", "Water Shed Management"),
];

const BTECH: CatalogueProgramme = {
  programme: "B.Tech",
  semesters: [
    ...FIRST_YEAR_SEMESTERS,
    {
      semester: 3,
      subjects: [
        c("UCE03B01", "Mechanics of Solids", [2, 1, 0], 3),
        c("UCE03B02", "Engineering Geology", [3, 0, 0], 3),
        c("UCE03B03", "Mechanics of Fluid", [2, 1, 0], 3),
        c("UCE03B04", "Value Education, Ethics and Environmental Studies", [3, 0, 0], 3),
        c("UCE03C01", "Mathematics-III", [2, 1, 0], 3),
        c("UCE03C02", "Humanities-III", [2, 1, 0], 3),
        c("UCE03P01", "Engineering Geology Laboratory", [0, 0, 2], 1, { kind: "lab" }),
        c("UCE03P02", "Fluid Mechanics Laboratory", [0, 0, 2], 1, { kind: "lab" }),
        c("UCE03P03", "Civil Engineering Drawing", [0, 0, 3], 1.5, { kind: "lab" }),
      ],
    },
    {
      semester: 4,
      subjects: [
        c("UCE04B01", "Structural Analysis-I", [2, 1, 0], 3),
        c("UCE04B02", "Design of Structures-I", [2, 1, 0], 3),
        c("UCE04B03", "Data Structures and Numerical Methods", [2, 1, 0], 3),
        c("UCE04B04", "Building Materials, Construction and Services", [3, 0, 0], 3),
        c("UCE04B05", "Surveying", [2, 1, 0], 3),
        // NO pool printed for the H.S.S Elective — empty pool; the
        // setup asks the user to name the chosen subject.
        elective("UCE04E01", [2, 1, 0], 3, [], "UCE04E01"),
        c("UCE04P01", "Material Testing Laboratory", [0, 0, 2], 1, { kind: "lab" }),
        c("UCE04P02", "Surveying Field Works", [0, 0, 4], 2, { kind: "lab" }),
        c("UCE04P03", "Computer Programming Laboratory", [0, 0, 2], 1, { kind: "lab" }),
      ],
    },
    {
      semester: 5,
      subjects: [
        c("UCE05B01", "Structural Analysis-II", [2, 1, 0], 3),
        c("UCE05B02", "Design of Structures-II", [2, 1, 0], 3),
        c("UCE05B03", "Hydraulics and Hydraulic Machines", [2, 1, 0], 3),
        c("UCE05B04", "Transportation Engineering-I", [2, 1, 0], 3),
        c("UCE05B05", "Geotechnical Engineering-I", [2, 1, 0], 3),
        // NO pool printed for Professional Elective-I either.
        elective("UCE05E01", [2, 1, 0], 3, [], "UCE05E01"),
        c("UCE05P01", "Structural Analysis Laboratory", [0, 0, 2], 1, { kind: "lab" }),
        c("UCE05P02", "Hydraulic Laboratory", [0, 0, 2], 1, { kind: "lab" }),
        c("UCE05P03", "Transportation Laboratory", [0, 0, 2], 1, { kind: "lab" }),
        c("UCE05P04", "Geotechnical Laboratory", [0, 0, 2], 1, { kind: "lab" }),
      ],
    },
    {
      semester: 6,
      subjects: [
        c("UCE06B01", "Design of Structures-III", [2, 1, 0], 3),
        c("UCE06B02", "Structural Dynamics", [2, 1, 0], 3),
        c("UCE06B03", "Hydrology and Water Resources Engineering", [2, 1, 0], 3),
        c("UCE06B04", "Transportation Engineering-II", [2, 1, 0], 3),
        c("UCE06B05", "Geotechnical Engineering-II", [2, 1, 0], 3),
        c("UCE06B07", "Environmental Engineering", [2, 1, 0], 3),
        c("UCE06P01", "Design of Steel Structure Laboratory", [0, 0, 2], 1, { kind: "lab" }),
        c("UCE06P02", "Design of Concrete Structure Laboratory", [0, 0, 2], 1, { kind: "lab" }),
        c("UCE06P03", "Environmental Engineering Laboratory", [0, 0, 2], 1, { kind: "lab" }),
        c("UCE06P04", "Transportation Engineering Laboratory", [0, 0, 2], 1, { kind: "lab" }),
      ],
    },
    {
      semester: 7,
      subjects: [
        elective("Departmental Elective-I", [2, 1, 0], 3, POOL_A),
        elective("Departmental Elective-II", [2, 1, 0], 3, POOL_B),
        elective("Departmental Elective-III", [2, 1, 0], 3, POOL_C),
        elective("Open Elective", [2, 1, 0], 3, POOL_D),
        c("UCE07B01", "Construction Planning and Management", [2, 1, 0], 3),
        c("UCE07P01", "Structural Design and Drawing", [0, 0, 3], 1.5, { kind: "lab" }),
        c("UCE07P02", "Project-I", [0, 0, 4], 2, { kind: "project", timetabled: false }),
        c("UCE07P03", "Comprehensive Viva Voce", [0, 0, 0], 1, { kind: "viva", timetabled: false }),
        c("UCE07P04", "Seminar", [0, 0, 2], 2, { kind: "seminar" }),
      ],
    },
    {
      semester: 8,
      subjects: [
        elective("Departmental Elective-IV", [2, 1, 0], 3, POOL_E),
        elective("Departmental Elective-V", [2, 1, 0], 3, POOL_F),
        elective("Departmental Elective-VI", [2, 1, 0], 3, POOL_G),
        c("UCE08P01", "Project-II", [0, 0, 6], 3, { kind: "project", timetabled: false }),
        c("UCE08P02", "Comprehensive Viva Voce", [0, 0, 0], 1, { kind: "viva", timetabled: false }),
      ],
    },
  ],
};

// ------------------------------------------------------------------ M.Tech
/** Class-hours-only spec helper: L = printed class hours/week. */
const h = (code: string, title: string, hours: number, credits: number, extra?: Partial<RawSub>) =>
  sub({ code, title, ltp: [hours, 0, 0], credits, syllabusCode: code, ...extra });
const hLab = (code: string, title: string, credits: number) =>
  sub({ code, title, ltp: [0, 0, 3], credits, syllabusCode: code, kind: "lab" });
const hSeminar = (code: string, title = "Seminar") =>
  sub({ code, title, ltp: [0, 0, 2], credits: 1, syllabusCode: code, kind: "seminar" });
const nt = (code: string, title: string, credits: number, kind: "project" | "viva") =>
  sub({ code, title, ltp: [0, 0, 0], credits, syllabusCode: code, kind, timetabled: false });
const thesis = (code1: string, code2: string, cr1 = 10, cr2 = 20): CatalogueSubject[] => [
  nt(code1, "Project & Thesis-I", cr1, "project"),
  nt(code2, "Project & Thesis-II", cr2, "project"),
];

const STRUCTURAL: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Structural Engineering",
  semesters: [
    {
      semester: 1,
      subjects: [
        h("PCE11B01", "Theory of Elasticity and Plasticity", 4, 4),
        h("PCE11C01", "Structural Dynamics", 4, 4),
        h("PCE11C02", "Advanced Structural Analysis", 4, 4),
        elective("Elective Paper-I", [4, 0, 0], 4, [
          co("PCE11E01", "Advanced Design of R.C. Structures"),
          co("PCE11E02", "Advanced Design of Pre-stressed Concrete"),
          co("PCE11E03", "Tall Structures"),
          co("PCE11E04", "Structural Reliability"),
          co("PCE11E05", "Soil Structure Interaction"),
          co("PCE11E06", "Rock Mechanics"),
        ]),
        elective("Elective Paper-II", [4, 0, 0], 4, [
          co("PCE11E07", "Advanced Mathematics"),
          co("PCE11E08", "Numerical Method in Structural Analysis"),
          co("PCE11E09", "Construction Management and Quality Control"),
          co("PCE11E10", "Structural Masonry"),
          co("PCE11E11", "Advanced Concrete Technology"),
          co("PCE11E12", "Optimization in Engineering"),
          co("PCE11E13", "Mechanics of Composite Structures"),
        ]),
        hLab("PCE11P01", "Cement and Concrete Laboratory", 2),
        hLab("PCE11P02", "Stress Analysis Laboratory", 2),
        hSeminar("PCE11P03"),
      ],
    },
    {
      semester: 2,
      subjects: [
        h("PCE12B01", "Theory of Elastic Stability", 4, 4),
        h("PCE12C01", "Theory of Plates and Shells", 4, 4),
        elective("Elective Paper-III", [4, 0, 0], 4, [
          co("PCE12E01", "Seismic Analysis and Design of Structures"),
          co("PCE12E02", "Random Vibration"),
          co("PCE12E03", "Wind Engineering"),
          co("PCE12E04", "Advanced Design of Metal Structures"),
          co("PCE12E05", "Experimental Methods of Structural Analysis"),
          co("PCE12E06", "Bridge Engineering"),
          co("PCE12E10", "Behaviour of Concrete Structures"),
          // PCE12E12 is printed in BOTH Elective-III and Elective-IV
          // pools (different titles) — as printed; see provenance.
          co("PCE12E12", "Repair and Rehabilitation of Structures"),
        ]),
        elective("Elective Paper-IV", [4, 0, 0], 4, [
          co("PCE12E07", "Finite Element Method"),
          co("PCE12E08", "Structural Health Monitoring"),
          co("PCE12E11", "Nonlinear Analysis"),
          co("PCE12E12", "Advanced Solid Mechanics"),
        ]),
        nt("PCE12P01", "Project Preliminaries", 3, "project"),
        hLab("PCE12P02", "Structural Engineering Laboratory", 2),
        hLab("PCE12P03", "Computer Aided Design Laboratory", 2),
        nt("PCE12P04", "Comprehensive Viva-voce", 2, "viva"),
      ],
    },
    { semester: 3, subjects: [thesis("PCE13P01", "PCE14P01")[0]] },
    { semester: 4, subjects: [thesis("PCE13P01", "PCE14P01")[1]] },
  ],
};

const GEOTECHNICAL: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Geotechnical Engineering",
  semesters: [
    {
      semester: 1,
      subjects: [
        h("PCE21B01", "Advanced Mathematics", 4, 4),
        h("PCE21C01", "Mechanics of Soil", 4, 4),
        h("PCE21C02", "Soil Dynamics and Machine Foundations", 4, 4),
        elective("Elective Paper-I", [4, 0, 0], 4, [
          co("PCE21E01", "Ground Improvement Technique"),
          co("PCE21E02", "Numerical Methods and Computer Programming in Engineering"),
          co("PCE21E03", "Elastic Analysis in Geotechnical Engineering"),
        ]),
        elective("Elective Paper-II", [4, 0, 0], 4, [
          co("PCE21E04", "Reinforced Soil Structures"),
          co("PCE21E05", "Rock Mechanics and Tunnelling"),
          co("PCE21E06", "Soil Investigation and Exploration"),
        ]),
        hLab("PCE21P01", "Soil Mechanics Laboratory", 2),
        hLab("PCE21P02", "Foundation Engineering Laboratory", 2),
        // Code printed as PCE11P03 in this PDF too (sic).
        hSeminar("PCE11P03"),
      ],
    },
    {
      semester: 2,
      subjects: [
        h("PCE22B01", "Finite Element Method", 4, 4),
        h("PCE22C01", "Advanced Foundation Design", 4, 4),
        h("PCE22C02", "Soil Structure Interaction", 4, 4),
        elective("Elective Paper-III", [4, 0, 0], 4, [
          co("PCE22E01", "Environmental Geotechnique"),
          co("PCE22E02", "Earthquake Geotechnical Engineering"),
          co("PCE22E03", "Computer Aided Design"),
        ]),
        hLab("PCE22P02", "Foundation Design and Drawing", 2),
        hLab("PCE22P03", "Computer Aided Geotechnical Design Laboratory", 2),
        nt("PCE22P01", "Project Preliminary", 3, "project"),
        nt("PCE22P04", "Comprehensive Viva-voce", 1, "viva"),
      ],
    },
    { semester: 3, subjects: [nt("PCE23P01", "Project & Thesis-I", 10, "project")] },
    { semester: 4, subjects: [nt("PCE23P04", "Project & Thesis-II", 20, "project")] },
  ],
};

const TRANSPORTATION: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Transportation Engineering",
  semesters: [
    {
      semester: 1,
      subjects: [
        c("PCE31B01", "Pavement Materials", [3, 1, 0], 4),
        c("PCE31C01", "Urban Transportation Planning and Management", [3, 1, 0], 4),
        c("PCE31C02", "Traffic Engineering Operation & Management", [3, 1, 0], 4),
        elective("Elective Paper-I", [3, 1, 0], 4, [
          co("PCE31E01", "Advanced Mathematics"),
          co("PCE31E02", "Traffic Safety"),
          co("PCE31E03", "Highway Construction Practice"),
          co("PCE31E04", "Airport Planning & Design"),
        ]),
        elective("Elective Paper-II", [3, 1, 0], 4, [
          co("PCE31E05", "Intelligent Transportation System"),
          co("PCE31E06", "Geographical Information System & its Application"),
          co("PCE31E07", "Mechanics of Soil"),
          co("PCE31E08", "Railway Transportation System"),
        ]),
        c("PCE31P01", "Pavement Engineering Laboratory-I", [0, 0, 3], 2, { kind: "lab" }),
        c("PCE31P02", "Traffic Engineering Laboratory", [0, 0, 3], 2, { kind: "lab" }),
        c("PCE31P03", "Seminar", [0, 0, 2], 1, { kind: "seminar" }),
      ],
    },
    {
      semester: 2,
      subjects: [
        c("PCE32B01", "Analysis & Design of Pavements", [3, 1, 0], 4),
        elective("Elective Paper-III", [3, 1, 0], 4, [
          co("PCE32E01", "Geometric Design of Transportation Facilities"),
          co("PCE32E02", "Ecology & Environmental Impact Assessment"),
          co("PCE32E03", "Geo-environmental Engineering"),
        ]),
        // Codes repeat E01–E03 for Paper-IV in the source (sic).
        elective("Elective Paper-IV", [3, 1, 0], 4, [
          co("PCE32E01", "Bridge Engineering"),
          co("PCE32E02", "Pavement Evaluation, Rehabilitation and Maintenance"),
          co("PCE32E03", "Urban Mass Transit Planning, Operations and Management"),
        ]),
        elective("Elective Paper-V", [3, 1, 0], 4, [
          co("PCE32E04", "Ground Improvement Technique"),
          co("PCE32E05", "Finite Element Method"),
          co("PCE32E06", "Advanced Traffic Engineering"),
        ]),
        nt("PCE32P01", "Project Preliminaries", 4, "project"),
        c("PCE32P02", "Pavement Engineering Laboratory II", [0, 0, 4], 2, { kind: "lab" }),
        c("PCE32P03", "Computer Oriented Design Lab", [0, 0, 4], 2, { kind: "lab" }),
        nt("PCE32P04", "Comprehensive Viva-voce", 1, "viva"),
      ],
    },
    { semester: 3, subjects: [nt("PCE33P01", "Project & Thesis-I", 10, "project")] },
    { semester: 4, subjects: [nt("PCE34P01", "Project & Thesis-II", 20, "project")] },
  ],
};

const ENV_GROUP = [
  "Remote Sensing and GIS in Environmental Engineering",
  "Hydraulics & Water Resources Engineering",
  "Water Distribution and Wastewater Collection System Design",
  "Air and Water Quality Modelling",
  "Environmental Planning and Management",
  "Industrial Pollution Control",
  "Advanced Environmental Biotechnology",
  "Management of Water Resources",
  "Renewable Energy System",
  "Geo-environmental Engineering",
].map((t) => po(t));

const ENVIRONMENTAL: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Environmental Engineering",
  semesters: [
    {
      semester: 1,
      subjects: [
        h("PCE41C01", "Water and Wastewater Treatment Processes-I", 4, 4),
        h("PCE41C02", "Applied Environmental Chemistry and Microbiology", 4, 4),
        h("PCE41C03", "Air and Noise Pollution & Control", 4, 4),
        elective("Elective Paper-I", [4, 0, 0], 4, [
          co("PCE41E01-01", "Optimization Technique"),
          co("PCE41E01-02", "Advanced Mathematics"),
          co("PCE41E01-03", "Computational Fluid Dynamics"),
          co("PCE41E01-04", "Global Warming and Climate Change"),
        ]),
        elective("Elective Paper-II", [4, 0, 0], 4, ENV_GROUP),
        hLab("PCE41P01", "Water Pollution Laboratory-I", 2),
        hLab("PCE41P02", "Computer Laboratory", 2),
        hSeminar("PCE41P03"),
      ],
    },
    {
      semester: 2,
      subjects: [
        h("PCE42C01", "Water and Wastewater Treatment Processes-II", 4, 4),
        h("PCE42C02", "Solid and Hazardous Waste Management", 4, 4),
        h("PCE42C03", "Ecology & Environmental Impact Assessment", 4, 4),
        elective("Elective Paper-III", [4, 0, 0], 4, ENV_GROUP),
        hLab("PCE42P01", "Water Pollution Laboratory-II", 2),
        hLab("PCE42P02", "Air Pollution Laboratory", 2),
        nt("PCE42P03", "Comprehensive Viva-voce", 2, "viva"),
        nt("PCE42P04", "Project Preliminaries", 3, "project"),
      ],
    },
    { semester: 3, subjects: [nt("PCE43P01", "Project and Thesis-I", 10, "project")] },
    { semester: 4, subjects: [nt("PCE44P01", "Project and Thesis-II", 20, "project")] },
  ],
};

const WATER_RESOURCES: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Water Resources Engineering",
  semesters: [
    {
      semester: 1,
      subjects: [
        c("PCE51CB01", "Free Surface Flow", [3, 1, 0], 4),
        c("PCE51C01", "Applied Hydrology", [3, 1, 0], 4),
        c("PCE51C02", "Advanced Mathematics", [3, 1, 0], 4),
        elective("Elective Paper-I", [3, 1, 0], 4, [
          co("PCE51E01", "Advanced Fluid Mechanics"),
          co("PCE51E02", "River Engineering"),
          co("PCE51E03", "Geo-Hydraulics"),
        ]),
        elective("Elective Paper-II", [3, 1, 0], 4, [
          co("PCE51E04", "Hydropower Engineering"),
          co("PCE51E05", "Water Resources Systems, Analysis, Planning & Management"),
          co("PCE51E06", "Geographical Information Systems & its Applications"),
        ]),
        c("PCE51P01", "Hydraulic and Water Resources Engg. Lab-I", [0, 0, 3], 2, { kind: "lab" }),
        c("PCE51P02", "Computer Applications in Free Surface Flow and Applied Hydrology", [0, 0, 3], 2, { kind: "lab" }),
        c("PCE51P03", "Seminar", [0, 0, 2], 1, { kind: "seminar" }),
      ],
    },
    {
      semester: 2,
      subjects: [
        c("PCE52CB01", "Advanced Computational Hydraulics", [3, 1, 0], 4),
        c("PCE52C01", "Hydraulics of Sediment Transport", [3, 1, 0], 4),
        c("PCE52C02", "Hydraulic Structure", [3, 1, 0], 4),
        elective("Elective Paper-III", [3, 1, 0], 4, [
          co("PCE52E01", "Viscous Fluid Flow"),
          co("PCE52E02", "Transient Flow Analysis"),
          co("PCE52E03", "Integrated Watershed Management"),
        ]),
        nt("PCE52P01", "Project Preliminaries", 3, "project"),
        c("PCE52P02", "Hydraulics and Water Resources Engg. Lab-II", [0, 0, 3], 2, { kind: "lab" }),
        c("PCE52P03", "Computer Applications in Water Resources Engineering", [0, 0, 3], 2, { kind: "lab" }),
        nt("PCE52P04", "Comprehensive Viva-voce", 2, "viva"),
      ],
    },
    { semester: 3, subjects: [nt("PCE53P01", "Project & Thesis-I", 10, "project")] },
    { semester: 4, subjects: [nt("PCE54P04", "Project & Thesis-II", 20, "project")] },
  ],
};

const HYDRO_GROUP = [
  "Energy Management in Water Industry",
  "Climate Change and Water Resources",
  "Water Quality Modeling and Management",
  "Application of Geo-Informatics in Water Resource Management",
  "Systems Analysis in Water Resources",
  "Underwater Remote Sensing and Life Cycle Assessment",
  "GIS Applications in Monitoring and Management of Ground Water",
  "Power Plant Engineering",
  "Renewable Energy System",
  "Advance Hydropower Engineering",
  "Hydrology and Hydraulic Instruments",
  "Internet of Things Applications in Agriculture",
  "Optimization Technique",
  "Smart-Instrumentation in Water Resources Applications",
  "Image Processing",
  "Hydraulic Structure Engineering",
  "River Engineering",
  "Smart Monitoring and Management of Pipe Network",
  "Free Surface Flow",
  "Computational Fluid Dynamics",
].map((t) => po(t));

const HYDROINFORMATICS: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Hydroinformatics Engineering",
  semesters: [
    {
      semester: 1,
      subjects: [
        h("PCE61B01", "Artificial Intelligence and Data Science in Water Resource Development", 4, 4),
        h("PCE61C01", "Principle of Water Resources Engineering", 4, 4),
        elective("Elective-I", [4, 0, 0], 4, HYDRO_GROUP),
        elective("Elective-II", [4, 0, 0], 4, HYDRO_GROUP),
        elective("Elective-III", [4, 0, 0], 4, HYDRO_GROUP),
        hLab("PCE61P01", "Application Software Laboratory", 2),
        // Printed with 3 class hrs; project per the house rule.
        nt("PCE61P02", "Minor Project-I", 2, "project"),
        hSeminar("PCE61P03"),
      ],
    },
    {
      semester: 2,
      subjects: [
        h("PCE62B01", "Design of Water Resources System", 4, 4),
        h("PCE62C01", "Advanced Hydrology", 4, 4),
        h("PCE62C02", "Advance Hydropower Engineering", 4, 4),
        elective("Elective-IV", [4, 0, 0], 4, HYDRO_GROUP),
        hLab("PCE62P04", "Water Quality, Hydrology and Hydraulic Instruments Laboratory", 2),
        nt("PCE62P05", "Minor Project-II", 2, "project"),
        nt("PCE62P06", "Project Preliminary", 3, "project"),
        nt("PCE62P07", "Comprehensive Viva-voce", 2, "viva"),
      ],
    },
    // As printed: this specialisation's thesis semesters carry
    // 20 + 40 credits (programme total 110, not 80).
    { semester: 3, subjects: [nt("PCE63P01", "Project & Thesis-I", 20, "project")] },
    { semester: 4, subjects: [nt("PCE64P02", "Project & Thesis-II", 40, "project")] },
  ],
};

const SEISMIC: CatalogueProgramme = {
  programme: "M.Tech",
  specialisation: "Seismic Engineering",
  semesters: [
    {
      semester: 1,
      subjects: [
        h("PCE71B01", "Advanced Engineering Geology and Geo-Hazard Management", 4, 4),
        h("PCE71C01", "Dynamics of Systems", 4, 4),
        h("PCE71C02", "Numerical Methods", 4, 4),
        elective("Elective Paper I", [4, 0, 0], 4, [
          co("PCE71E01", "GIS and Remote Sensing"),
          co("PCE71E02", "Structural Reliability"),
          co("PCE71E03", "Seismic Microzonation"),
        ]),
        elective("Elective Paper II", [4, 0, 0], 4, [
          co("PCE71E04", "Ground Improvement Techniques"),
          co("PCE71E05", "Engineering Application of Geophysical Techniques"),
          co("PCE71E06", "Seismic Hazard & Risk Assessment"),
        ]),
        hLab("PCE71P01", "Advanced Dynamics Laboratory", 2),
        hLab("PCE71P02", "Characterization of Rock and Fault", 2),
        hSeminar("PCE71P03"),
      ],
    },
    {
      semester: 2,
      subjects: [
        h("PCE72B01", "Advanced Seismology", 4, 4),
        h("PCE72C01", "Geotechnical Earthquake Engineering", 4, 4),
        h("PCE72C02", "Seismic Analysis and Design of Structures", 4, 4),
        elective("Elective Paper III", [4, 0, 0], 4, [
          co("PCE72E01", "Soil-Structure Interaction"),
          co("PCE72E02", "Finite Element Method"),
          co("PCE72E03", "Seismic Slope Stability: Earth Dam and Retaining Wall"),
        ]),
        hLab("PCE72P01", "Software Application Lab", 2),
        hLab("PCE72P02", "Digital Image Processing and Seismic Signal Processing Lab", 2),
        nt("PCE72P03", "Project Preliminary", 3, "project"),
        nt("PCE72P04", "Comprehensive Viva-voce", 2, "viva"),
      ],
    },
    { semester: 3, subjects: [nt("PCE73P06", "Project & Thesis-I", 10, "project")] },
    { semester: 4, subjects: [nt("PCE74P01", "Project & Thesis-II", 20, "project")] },
  ],
};

export const CIVIL_CATALOGUE: CatalogueDepartment = {
  id: "CIVIL",
  name: "Civil Engineering",
  shortName: "CE",
  programmes: [
    BTECH,
    STRUCTURAL,
    GEOTECHNICAL,
    TRANSPORTATION,
    ENVIRONMENTAL,
    WATER_RESOURCES,
    HYDROINFORMATICS,
    SEISMIC,
  ],
};
