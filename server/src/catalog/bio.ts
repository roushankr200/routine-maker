/**
 * The NIT Agartala Bio-Engineering syllabus catalogue.
 *
 * Extracted 2026-11-11 (reference/catalogue-raw/bio-btech-mtech-structure.md):
 * B.Tech Biotechnology & Biochemical Engineering
 * https://nita.ac.in/BioDeptSyllabus_BTech_BioEng_June2019_BioEng10088.pdf
 * (Sem 3–8 = 117 cr; Sem 1–2 the common first year, 160 total) and
 * M.Tech https://nita.ac.in/Syllabus_MTech_Bio_Sept24_BioEng10088.pdf
 * (80 cr). NO subject codes printed anywhere — derived from titles.
 */

import { CodeBook, elective, sub, RawSub } from "./build.js";
import { FIRST_YEAR_CODES, FIRST_YEAR_SEMESTERS } from "./firstYear.js";
import { CatalogueDepartment, CatalogueProgramme } from "./types.js";

const book = new CodeBook(FIRST_YEAR_CODES);
const d = (raw: Omit<RawSub, "code">) => sub(book.derived(raw));

const DEPT_POOL = [
  "Bioprocess Plant Design",
  "Thermodynamics in Biological Systems",
  "Metabolic Engineering & Systems Biology",
  "Genomics and Proteomics",
  "Protein Structure and Engineering",
  "Tissue Engineering",
  "Food Process Engineering",
  "Pharmaceutical Biotechnology",
  "Biological Waste Treatment",
  "Biostatistics",
  "Synthetic Biology",
  "Valorization of Biomass",
  "Molecular Basis of Diseases",
  "IPR and Biosafety",
  "Modelling and Simulation for Biological Systems",
  "Drug Design and Development",
].map((t) => book.option(t));

const OPEN_POOL = [
  "Biosensors",
  "Computational Fluid Dynamics in Biology",
  "Bio-Nanotechnology",
  "Biomaterials",
].map((t) => book.option(t));

const MT_POOL = [
  "Bioprocess Plant Design",
  "Biomedical Signal and Image Processing",
  "Animal Biotechnology",
  "Advanced Immunology and Immunotechnology",
  "Synthetic Biology",
  "Cancer Biology",
  "Protein Structure and Engineering",
  "Biological Waste Treatment",
  "Food Process Engineering",
  "Tissue Engineering",
  "Nanobiotechnology",
  "Biomaterials",
  "Advanced Molecular Biology",
  "Computational Fluid Dynamics in Biology",
  "IPR and Biosafety",
  "Advanced BioMEMS",
  "Advanced Biomechanics",
  "Advanced Biomedical Instrumentation",
  "Biosensors, Transducers and Measurement Devices",
  "Prosthetics and Orthotics",
  "Metabolic Process and Engineering",
  "Systems Biology",
  "Biostatistics",
  "Advanced Genetic Engineering",
  "Molecular Therapeutics",
  "Bioentrepreneurship",
  "Pharmaceutical Biotechnology",
  "Process Control & Instrumentation",
  "Environmental Biotechnology",
].map((t) => book.option(t));

const BTECH: CatalogueProgramme = {
  programme: "B.Tech",
  semesters: [
    ...FIRST_YEAR_SEMESTERS,
    {
      semester: 3,
      subjects: [
        d({ title: "Biochemistry", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Microbiology", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Biochemical Reaction Engineering", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Heat & Mass Transfer in Biological Systems", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Engineering Mathematics-III", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Engineering Economics and Accountancy", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Biochemistry Laboratory", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Microbiology Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        d({ title: "Biochemical Reaction Engineering Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
      ],
    },
    {
      semester: 4,
      subjects: [
        d({ title: "Molecular Biology & Genetics", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Recombinant DNA Technology", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Transport Phenomena in Biological Systems", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Bioprocess Engineering", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Principles of Management and Managerial Economics", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Recombinant DNA Technology Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        d({ title: "Mass Transfer Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        d({ title: "Fluid Mechanics Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        d({ title: "Bioprocess Engineering Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
      ],
    },
    {
      semester: 5,
      subjects: [
        d({ title: "Immunology and Immunotechnology", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Bioinformatics and Computational Biology", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Downstream Processing", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Biochemical Process Calculation", ltp: [2, 1, 0], credits: 3 }),
        elective("Departmental Elective-I", [3, 0, 0], 3, DEPT_POOL),
        elective("Departmental Elective-II", [3, 0, 0], 3, DEPT_POOL),
        d({ title: "Bioinformatics and Computational Biology Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        d({ title: "Heat Transfer Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
      ],
    },
    {
      semester: 6,
      subjects: [
        d({ title: "Process Biotechnology", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Bioprocess Instrumentation & Control", ltp: [2, 1, 0], credits: 3 }),
        d({ title: "Animal Biotechnology", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Intellectual Property Right (IPR)", ltp: [1, 0, 0], credits: 0 }),
        elective("Departmental Elective-III", [3, 0, 0], 3, DEPT_POOL),
        elective("Departmental Elective-IV", [3, 0, 0], 3, DEPT_POOL),
        elective("Departmental Elective-V", [3, 0, 0], 3, DEPT_POOL),
        d({ title: "Downstream Processing Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
        d({ title: "Immunotechnology Laboratory", ltp: [0, 0, 3], credits: 1.5, kind: "lab" }),
      ],
    },
    {
      semester: 7,
      subjects: [
        d({ title: "Environmental Biotechnology", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Plant Biotechnology", ltp: [3, 0, 0], credits: 3 }),
        d({ title: "Biophysical and Bioanalytical Techniques", ltp: [2, 1, 0], credits: 3 }),
        elective("Departmental Elective-VI", [3, 0, 0], 3, DEPT_POOL),
        elective("Open Elective-I", [3, 0, 0], 3, OPEN_POOL),
        d({ title: "Project-I", ltp: [0, 0, 6], credits: 2, kind: "project", timetabled: false }),
        d({ title: "Seminar", ltp: [0, 0, 3], credits: 1, kind: "seminar" }),
      ],
    },
    {
      semester: 8,
      subjects: [
        elective("Departmental Elective-VII", [3, 0, 0], 3, DEPT_POOL),
        elective("Departmental Elective-VIII", [3, 0, 0], 3, DEPT_POOL),
        elective("Open Elective-II", [3, 0, 0], 3, OPEN_POOL),
        d({ title: "Project-II", ltp: [0, 0, 6], credits: 3, kind: "project", timetabled: false }),
        d({ title: "Comprehensive Viva", ltp: [0, 0, 0], credits: 1, kind: "viva", timetabled: false }),
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
        d({ title: "Bioanalytical Techniques", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Biotechnology and Biochemical Engineering Principles", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Genomics and Proteomics", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Applied Bioinformatics", ltp: [3, 1, 0], credits: 4 }),
        elective("Elective 1", [3, 1, 0], 4, MT_POOL),
        d({ title: "Bioanalytical Techniques Lab", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Applied Bioinformatics Lab", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Seminar", ltp: [0, 0, 2], credits: 1, kind: "seminar" }),
      ],
    },
    {
      semester: 2,
      subjects: [
        d({ title: "Bioreactor Design and Analysis", ltp: [3, 1, 0], credits: 4 }),
        d({ title: "Bioseparation Technology", ltp: [3, 1, 0], credits: 4 }),
        elective("Elective 2", [3, 1, 0], 4, MT_POOL),
        elective("Elective 3 (Open)", [3, 1, 0], 4, MT_POOL),
        d({ title: "Biotechnology and Biochemical Engineering Lab", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Bioprocess and Bioseparation Technology Lab", ltp: [0, 0, 3], credits: 2, kind: "lab" }),
        d({ title: "Project Preliminary", ltp: [0, 0, 6], credits: 3, kind: "project", timetabled: false }),
        d({ title: "Comprehensive Viva Voce", ltp: [0, 0, 0], credits: 2, kind: "viva", timetabled: false }),
      ],
    },
    {
      semester: 3,
      subjects: [
        d({ title: "Project and Thesis-1", ltp: [0, 0, 0], credits: 10, kind: "project", timetabled: false }),
      ],
    },
    {
      semester: 4,
      subjects: [
        d({ title: "Project and Thesis-2", ltp: [0, 0, 0], credits: 20, kind: "project", timetabled: false }),
      ],
    },
  ],
};

export const BIO_CATALOGUE: CatalogueDepartment = {
  id: "BIO",
  name: "Bio-Engineering",
  shortName: "BioE",
  programmes: [BTECH, MTECH],
};
