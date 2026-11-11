/**
 * The NIT Agartala CSE syllabus catalogue.
 *
 * Data extracted 2026-11-11 from the institute's published syllabus
 * PDFs — see reference/CATALOGUE-PROVENANCE.md for the source of every
 * programme and the known caveats (chiefly: the official B.Tech
 * Sem 3–8 PDF has been deleted from nita.ac.in, so an identical
 * corroborated copy was used; the M.Tech syllabi print NO subject
 * codes, so their short codes come from the department routine
 * sheet's legends and are marked derived).
 *
 * The raw extractions this file was built from are kept in
 * reference/catalogue-raw/. Per-semester credit sums match the
 * printed totals (verified by server/tests/catalogue.test.ts).
 */

import {
  CatalogueDepartment,
  CatalogueElectiveOption,
  CatalogueKind,
  CatalogueSubject,
} from "./types.js";

interface RawSub {
  code: string;
  title: string;
  ltp: [number, number, number];
  credits: number;
  kind?: CatalogueKind;
  syllabusCode?: string | null;
  derived?: boolean;
  timetabled?: boolean;
  pool?: CatalogueElectiveOption[];
}

function sessionHoursFor(kind: CatalogueKind, weekly: number, P: number): number {
  if (kind === "lab") return P >= 3 ? 3 : 2;
  if (kind === "seminar") return weekly;
  return 2;
}

function sub(raw: RawSub): CatalogueSubject {
  const [L, T, P] = raw.ltp;
  const kind: CatalogueKind =
    raw.kind ?? (L === 0 && T === 0 && P > 0 ? "lab" : "theory");
  const timetabled = raw.timetabled ?? true;
  const weeklyHours = timetabled ? L + T + P : 0;
  return {
    key: raw.code,
    syllabusCode: raw.syllabusCode ?? null,
    shortCode: raw.code,
    title: raw.title,
    L,
    T,
    P,
    credits: raw.credits,
    kind,
    timetabled,
    ...(raw.derived ? { derived: true } : {}),
    weeklyHours,
    sessionHours: timetabled ? sessionHoursFor(kind, weeklyHours, P) : 0,
    ...(raw.pool ? { electivePool: raw.pool } : {}),
  };
}

function elective(
  slot: string,
  ltp: [number, number, number],
  credits: number,
  pool: CatalogueElectiveOption[],
): CatalogueSubject {
  return sub({ code: slot, title: slot, ltp, credits, kind: "elective", pool });
}

function opt(
  shortCode: string,
  title: string,
  syllabusCode: string | null,
  derived = false,
): CatalogueElectiveOption {
  return { syllabusCode, shortCode, title, ...(derived ? { derived: true } : {}) };
}

// ------------------------------------------------------------ elective pools
const BTECH_E1: CatalogueElectiveOption[] = [
  opt("CG", "Computer Graphics", "UCS05E01"),
  opt("DIP", "Digital Image Processing", "UCS05E02"),
  opt("FC", "Foundation of Cryptography", "UCS05E03"),
];
const BTECH_E2: CatalogueElectiveOption[] = [
  opt("CNS", "Computer and Network Security", "UCS06E04", true),
  opt("DWDM", "Data Warehousing and Data Mining", "UCS06E05", true),
  opt("MC", "Mobile Computing", "UCS06E06", true),
];
const BTECH_E34: CatalogueElectiveOption[] = [
  opt("BD", "Big Data Analytics", "UCS07E07"),
  opt("CC", "Cloud Computing", "UCS07E08"),
  opt("IR", "Information Retrieval", "UCS07E09"),
  opt("PR", "Pattern Recognition", "UCS07E10"),
  opt("SC", "Soft Computing", "UCS07E11"),
  opt("USP", "Unix System Programming", "UCS07E12"),
];
const BTECH_E567: CatalogueElectiveOption[] = [
  opt("DL", "Deep Learning", "UCS08E13", true),
  opt("ERTS", "Embedded and Real Time System", "UCS08E14", true),
  opt("HCI", "Human Computer Interaction", "UCS08E15", true),
  opt("NLP", "Natural Language Processing", "UCS08E16", true),
  opt("PPL", "Principles of Programming Language", "UCS08E17", true),
  opt("WT", "Web Technology", "UCS08E18", true),
  opt("WSN", "Wireless Sensor Network", "UCS08E19", true),
  opt("AMLTS", "Application of Machine Learning in Time Series Analysis", "UCS08E20", true),
];
const MCA_E: CatalogueElectiveOption[] = [
  opt("DIP", "Digital Image Processing", "MCA05E01"),
  opt("E-COMM", "E-Commerce", "MCA05E02"),
  opt("IC", "Introduction to Cryptography", "MCA05E03"),
  opt("MC", "Mobile Computing", "MCA05E04"),
  opt("MMT", "Multimedia Technology", "MCA05E05"),
  opt("WCN", "Wireless Communication Network", "MCA05E06"),
];
const MTECH_AI_E1: CatalogueElectiveOption[] = [
  opt("SMA", "Stochastic Models and Applications", null, true),
  opt("NLP", "Natural Language Processing", null, true),
  opt("SC", "Soft Computing", null, true),
  opt("DM", "Data Mining", null, true),
  opt("PR", "Pattern Recognition", null, true),
];
const MTECH_AI_E2: CatalogueElectiveOption[] = [
  opt("ES", "Expert Systems", null, true),
  opt("CV", "Computer Vision", null, true),
  opt("WCN", "Wireless Communication Network", null, true),
  opt("IR", "Information Retrieval", null, true),
  opt("AICS", "AI for Cyber Security", null, true),
];
const MTECH_AI_E3: CatalogueElectiveOption[] = [
  opt("ABIS", "Agent Based Intelligent System", null, true),
  opt("DL", "Deep Learning", null, true),
  opt("DV", "Data Visualization", null, true),
  opt("HCI", "Human Computer Interaction", null, true),
  opt("ERTS", "Embedded and Realtime System", null, true),
];
const MTECH_CYBER_POOL: CatalogueElectiveOption[] = [
  opt("ACN", "Advanced Computer Networks", null, true),
  opt("ACRYP", "Advanced Cryptography", null, true),
  opt("CPR", "Cryptographic Protocols", null, true),
  opt("CCDF", "Cyber Crime and Digital Forensic", null, true),
  opt("SPCMS", "Security of Pervasive Computing and Mobile Systems", null, true),
  opt("INS", "Information and Network Security", null, true),
  opt("OSS", "Operating System Security", null, true),
  opt("DBS", "Database Security", null, true),
  opt("CNS", "Cyber and Network Security", null, true),
  opt("DWS", "Digital Watermarking and Steganography", null, true),
  opt("PDC", "Parallel and Distributed Computing", null, true),
  opt("WNC", "Wireless Networking and Computing", null, true),
  opt("CC", "Cloud Computing", null, true),
  opt("DWDM", "Data Warehousing and Data Mining", null, true),
  opt("SC", "Soft Computing", null, true),
  opt("HPC", "High Performance Computing", null, true),
  opt("EH", "Ethical Hacking", null, true),
  opt("WNS", "Wireless Network Security", null, true),
  // The department routine sheet's Elective-II pick for CYSEC. The 2021
  // syllabus pool does not expand it (see CATALOGUE-PROVENANCE.md).
  opt("DH", "DH (department sheet code; full title not in the 2021 syllabus pool)", null, true),
];
/** DSE elective titles were not captured from the PDF; the sheet's NLP/IR only. */
const MTECH_DSE_POOL: CatalogueElectiveOption[] = [
  opt("NLP", "Natural Language Processing", null, true),
  opt("IR", "Information Retrieval", null, true),
];

// ------------------------------------------------------------------- B.Tech
// Sem 1-2: the common first-year syllabus prints NO codes in its
// structure tables; short codes are derived (only 4 syllabus codes
// could be verified from the document's detailed sections).
const BT_S1_G1 = [
  sub({ code: "EM1", title: "Engineering Mathematics-I", ltp: [2, 1, 0], credits: 3, derived: true }),
  sub({ code: "PHY1", title: "Engineering Physics-I", ltp: [2, 1, 0], credits: 3, syllabusCode: "UPH11B07", derived: true }),
  sub({ code: "CHE1", title: "Engineering Chemistry-I", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCY11B10", derived: true }),
  sub({ code: "BEE", title: "Basic Electrical Engineering", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "ENGM", title: "Engineering Mechanics", ltp: [3, 1, 0], credits: 4, derived: true }),
  sub({ code: "PCE", title: "Language (Professional Communication in English)", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "CHE Lab", title: "Engineering Chemistry Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "WS", title: "Workshop Practice", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "BEE Lab", title: "Basic Electrical Engineering Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "NSS", title: "NSS/NCC", ltp: [0, 0, 3], credits: 0, kind: "other", timetabled: false, derived: true }),
];
const BT_S1_G2 = [
  sub({ code: "EM1", title: "Engineering Mathematics-I", ltp: [2, 1, 0], credits: 3, derived: true }),
  sub({ code: "PHY1", title: "Engineering Physics-I", ltp: [2, 1, 0], credits: 3, syllabusCode: "UPH11B07", derived: true }),
  sub({ code: "CHE1", title: "Engineering Chemistry-I", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCY11B10", derived: true }),
  sub({ code: "BE", title: "Basic Electronics", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "DISM", title: "Disaster Management", ltp: [2, 0, 0], credits: 2, derived: true }),
  sub({ code: "ITP", title: "Introduction to Programming", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "PHY Lab", title: "Engineering Physics Lab", ltp: [0, 0, 2], credits: 1, syllabusCode: "UPH12P06", derived: true }),
  sub({ code: "EG", title: "Engineering Graphics", ltp: [1, 0, 2], credits: 2, derived: true }),
  sub({ code: "ITP Lab", title: "Computer Programming Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "BE Lab", title: "Basic Electronics Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "NSS", title: "NSS/NCC", ltp: [0, 0, 3], credits: 0, kind: "other", timetabled: false, derived: true }),
];
const BT_S2_G1 = [
  sub({ code: "EM2", title: "Engineering Mathematics-II", ltp: [2, 1, 0], credits: 3, derived: true }),
  sub({ code: "PHY2", title: "Engineering Physics-II", ltp: [2, 1, 0], credits: 3, syllabusCode: "UPH12B09", derived: true }),
  sub({ code: "CHE2", title: "Engineering Chemistry-II", ltp: [2, 0, 0], credits: 2, derived: true }),
  sub({ code: "BE", title: "Basic Electronics", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "DISM", title: "Disaster Management", ltp: [2, 0, 0], credits: 2, derived: true }),
  sub({ code: "ITP", title: "Introduction to Programming", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "PHY Lab", title: "Engineering Physics Lab", ltp: [0, 0, 2], credits: 1, syllabusCode: "UPH12P06", derived: true }),
  sub({ code: "EG", title: "Engineering Graphics", ltp: [1, 0, 2], credits: 2, derived: true }),
  sub({ code: "ITP Lab", title: "Computer Programming Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "BE Lab", title: "Basic Electronics Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
];
const BT_S2_G2 = [
  sub({ code: "EM2", title: "Engineering Mathematics-II", ltp: [2, 1, 0], credits: 3, derived: true }),
  sub({ code: "PHY2", title: "Engineering Physics-II", ltp: [2, 1, 0], credits: 3, syllabusCode: "UPH12B09", derived: true }),
  sub({ code: "CHE2", title: "Engineering Chemistry-II", ltp: [2, 0, 0], credits: 2, derived: true }),
  sub({ code: "BEE", title: "Basic Electrical Engineering", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "ENGM", title: "Engineering Mechanics", ltp: [3, 1, 0], credits: 4, derived: true }),
  sub({ code: "PCE", title: "Language (Professional Communication in English)", ltp: [3, 0, 0], credits: 3, derived: true }),
  sub({ code: "CHE Lab", title: "Engineering Chemistry Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "WS", title: "Workshop Practice", ltp: [0, 0, 2], credits: 1, derived: true }),
  sub({ code: "BEE Lab", title: "Basic Electrical Engineering Lab", ltp: [0, 0, 2], credits: 1, derived: true }),
];

const BTECH = {
  programme: "B.Tech",
  semesters: [
    { semester: 1, groups: { I: BT_S1_G1, II: BT_S1_G2 } },
    { semester: 2, groups: { I: BT_S2_G1, II: BT_S2_G2 } },
    {
      semester: 3,
      subjects: [
        sub({ code: "DCN", title: "Data Communication", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCS03B07" }),
        sub({ code: "DSPM", title: "Data Structure and Programming Methodology", ltp: [3, 1, 0], credits: 4, syllabusCode: "UCS03B08" }),
        sub({ code: "DCLD", title: "Digital Circuit and Logic Design", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCS03B09" }),
        sub({ code: "DMS", title: "Discrete Mathematical Structures", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCS03B10" }),
        sub({ code: "EM3", title: "Engineering Mathematics-III", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCS03C16" }),
        sub({ code: "IGT", title: "Introduction to Graph Theory", ltp: [3, 1, 0], credits: 4, syllabusCode: "UCS03B11" }),
        sub({ code: "DSPM Lab", title: "Data Structure & Programming Methodology Laboratory", ltp: [0, 0, 3], credits: 2, syllabusCode: "UCS03P13" }),
        sub({ code: "DCLD Lab", title: "Digital Circuit and Logic Design Laboratory", ltp: [0, 0, 3], credits: 2, syllabusCode: "UCS03P11" }),
      ],
    },
    {
      semester: 4,
      subjects: [
        sub({ code: "FLAT", title: "Formal Language and Automata Theory", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCS04C17" }),
        sub({ code: "DAA", title: "Design and Analysis of Algorithm", ltp: [3, 1, 0], credits: 4, syllabusCode: "UCS04C15" }),
        sub({ code: "EM4", title: "Engineering Mathematics-IV", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCS04B06" }),
        sub({ code: "MPMC", title: "Microprocessor & Microcontroller", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCS04B05", derived: true }),
        sub({ code: "OOP", title: "Object Oriented Programming", ltp: [3, 1, 0], credits: 4, syllabusCode: "UCS04C18" }),
        sub({ code: "DAA Lab", title: "Design and Analysis of Algorithm Laboratory", ltp: [0, 0, 3], credits: 2, syllabusCode: "UCS04P13" }),
        sub({ code: "OOP Lab", title: "Object Oriented Programming Laboratory", ltp: [0, 0, 3], credits: 2, syllabusCode: "UCS04P14" }),
      ],
    },
    {
      semester: 5,
      subjects: [
        sub({ code: "CAO", title: "Computer Architecture and Organization", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCS05B10" }),
        sub({ code: "DBMS", title: "Database Management System", ltp: [3, 1, 0], credits: 4, syllabusCode: "UCS05B11" }),
        sub({ code: "EEC", title: "Engineering Economics and Costing", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCS05C03" }),
        sub({ code: "OS", title: "Operating System", ltp: [3, 1, 0], credits: 4, syllabusCode: "UCS05B12" }),
        elective("Elective-I", [3, 0, 0], 3, BTECH_E1),
        sub({ code: "CAO Lab", title: "Computer Architecture and Organization Laboratory", ltp: [0, 0, 3], credits: 2, syllabusCode: "UCS05P05" }),
        sub({ code: "DBMS Lab", title: "Database Management System Laboratory", ltp: [0, 0, 3], credits: 2, syllabusCode: "UCS05P06" }),
        sub({ code: "OS Lab", title: "Operating System Laboratory", ltp: [0, 0, 3], credits: 2, syllabusCode: "UCS05P07" }),
        // Code as printed in the syllabus (UCS06P08, in the Sem 5 table).
        sub({ code: "Seminar", title: "Seminar", ltp: [0, 0, 2], credits: 1, kind: "seminar", syllabusCode: "UCS06P08" }),
      ],
    },
    {
      semester: 6,
      subjects: [
        sub({ code: "AI", title: "Artificial Intelligence", ltp: [3, 1, 0], credits: 4, syllabusCode: "UCS06B13" }),
        sub({ code: "CD", title: "Compiler Design", ltp: [3, 1, 0], credits: 4, syllabusCode: "UCS06B14" }),
        sub({ code: "CN", title: "Computer Network", ltp: [3, 1, 0], credits: 4, syllabusCode: "UCS06B15" }),
        sub({ code: "MME", title: "Management and Managerial Economics", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCS06C04" }),
        sub({ code: "SE", title: "Software Engineering", ltp: [3, 0, 0], credits: 3, syllabusCode: "UCS06B16" }),
        elective("Elective-II", [3, 0, 0], 3, BTECH_E2),
        sub({ code: "CD Lab", title: "Compiler Design Laboratory", ltp: [0, 0, 3], credits: 2, syllabusCode: "UCS06P09" }),
        sub({ code: "CN Lab", title: "Computer Network Laboratory", ltp: [0, 0, 3], credits: 2, syllabusCode: "UCS06P10" }),
        sub({ code: "SE Lab", title: "Software Engineering Laboratory", ltp: [0, 0, 3], credits: 2, syllabusCode: "UCS06P11" }),
      ],
    },
    {
      semester: 7,
      subjects: [
        sub({ code: "ML", title: "Machine Learning", ltp: [3, 1, 0], credits: 4, syllabusCode: "UCS07B01" }),
        sub({ code: "IPR", title: "Intellectual Property Rights", ltp: [1, 0, 0], credits: 0, syllabusCode: "UCS07B02" }),
        elective("Elective-III", [3, 0, 0], 3, BTECH_E34),
        elective("Elective-IV", [3, 0, 0], 3, BTECH_E34),
        sub({ code: "Project-I", title: "Project-I", ltp: [0, 0, 4], credits: 2, kind: "project", timetabled: false, syllabusCode: "UCS07P12" }),
        sub({ code: "IndTrain", title: "Industrial Training", ltp: [0, 0, 0], credits: 1, kind: "project", timetabled: false, syllabusCode: "UCS07P13" }),
      ],
    },
    {
      semester: 8,
      subjects: [
        elective("Elective-V", [3, 0, 0], 3, BTECH_E567),
        elective("Elective-VI", [3, 0, 0], 3, BTECH_E567),
        elective("Elective-VII", [3, 0, 0], 3, BTECH_E567),
        sub({ code: "Project-II", title: "Project-II", ltp: [0, 0, 9], credits: 3, kind: "project", timetabled: false, syllabusCode: "UCS08P15" }),
        sub({ code: "Viva", title: "Comprehensive Viva Voce", ltp: [0, 0, 0], credits: 1, kind: "viva", timetabled: false, syllabusCode: "UCS08P16" }),
      ],
    },
  ],
};

// ---------------------------------------------------------------------- MCA
// Full codes ARE printed in the MCA syllabus. Labs are 0-0-6: 6
// practical hours/week -> two 3h sessions in the block model.
const MCA = {
  programme: "MCA",
  semesters: [
    {
      semester: 1,
      subjects: [
        sub({ code: "DFS", title: "Data and File Structure", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA01C01" }),
        sub({ code: "DCLD", title: "Digital Circuit and Logic Design", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA01C02" }),
        sub({ code: "DMS", title: "Discrete Mathematical Structure", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA01C03" }),
        sub({ code: "PMP", title: "Principles of Management and Practices", ltp: [3, 0, 0], credits: 3, syllabusCode: "MCA01H01" }),
        sub({ code: "WT", title: "Web Technology", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA01C04" }),
        sub({ code: "DFS Lab", title: "Data Structure Laboratory", ltp: [0, 0, 6], credits: 3, syllabusCode: "MCA01L01" }),
        sub({ code: "WT Lab", title: "Web Technology Laboratory", ltp: [0, 0, 6], credits: 3, syllabusCode: "MCA01L02" }),
      ],
    },
    {
      semester: 2,
      subjects: [
        sub({ code: "COA", title: "Computer Organization and Architecture", ltp: [4, 0, 0], credits: 4, syllabusCode: "MCA02C05" }),
        sub({ code: "DBMS", title: "Database Management System", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA02C06" }),
        sub({ code: "GTC", title: "Graph Theory and Combinatorics", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA02C07" }),
        sub({ code: "MF", title: "Mathematical Foundations", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA02M01" }),
        sub({ code: "OOP", title: "Object Oriented Programming", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA02C08" }),
        sub({ code: "DBMS Lab", title: "Database Management System Laboratory", ltp: [0, 0, 6], credits: 3, syllabusCode: "MCA02L03" }),
        sub({ code: "OOP Lab", title: "Object Oriented Programming Laboratory", ltp: [0, 0, 6], credits: 3, syllabusCode: "MCA02L04" }),
      ],
    },
    {
      semester: 3,
      subjects: [
        sub({ code: "CETW", title: "Communicative English and Technical Writing", ltp: [0, 2, 1], credits: 3, syllabusCode: "MCA03H02" }),
        sub({ code: "DMDW", title: "Data Mining and Data Warehousing", ltp: [4, 0, 0], credits: 4, syllabusCode: "MCA03C10" }),
        sub({ code: "DAA", title: "Design and Analysis of Algorithm", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA03C11" }),
        sub({ code: "NM", title: "Numerical Methods", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA03M02" }),
        sub({ code: "SE", title: "Software Engineering", ltp: [4, 0, 0], credits: 4, syllabusCode: "MCA03C12" }),
        sub({ code: "DAA Lab", title: "Design and Analysis of Algorithm Laboratory", ltp: [0, 0, 6], credits: 3, syllabusCode: "MCA03L05" }),
        sub({ code: "SE Lab", title: "Software Engineering Laboratory", ltp: [0, 0, 6], credits: 3, syllabusCode: "MCA03L06" }),
      ],
    },
    {
      semester: 4,
      subjects: [
        sub({ code: "CN", title: "Computer Network", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA04C13" }),
        sub({ code: "FLAT", title: "Formal Language and Automata Theory", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA04C14" }),
        sub({ code: "MIS", title: "Management Information System", ltp: [4, 0, 0], credits: 4, syllabusCode: "MCA04C15" }),
        sub({ code: "OS", title: "Operating System", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA04C16" }),
        sub({ code: "OR", title: "Operational Research", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA04M03" }),
        sub({ code: "CN Lab", title: "Computer Network Laboratory", ltp: [0, 0, 6], credits: 3, syllabusCode: "MCA04L07" }),
        sub({ code: "OS Lab", title: "Operating System Laboratory", ltp: [0, 0, 6], credits: 3, syllabusCode: "MCA04L08" }),
      ],
    },
    {
      semester: 5,
      subjects: [
        sub({ code: "AI", title: "Artificial Intelligence", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA05C17" }),
        sub({ code: "CD", title: "Compiler Design", ltp: [3, 1, 0], credits: 4, syllabusCode: "MCA05C18" }),
        elective("Elective-I", [4, 0, 0], 4, MCA_E),
        elective("Elective-II", [4, 0, 0], 4, MCA_E),
        sub({ code: "AI Lab", title: "Artificial Intelligence Laboratory", ltp: [0, 0, 6], credits: 3, syllabusCode: "MCA05L09" }),
        sub({ code: "CD Lab", title: "Compiler Design Laboratory", ltp: [0, 0, 6], credits: 3, syllabusCode: "MCA05L10" }),
        sub({ code: "MiniProject", title: "Mini Project", ltp: [0, 0, 2], credits: 2, kind: "project", timetabled: false, syllabusCode: "MCA05P01" }),
      ],
    },
    {
      semester: 6,
      subjects: [
        sub({ code: "MajorProject", title: "Major Project", ltp: [0, 0, 10], credits: 10, kind: "project", timetabled: false, syllabusCode: "MCA06P02" }),
        sub({ code: "Viva", title: "Comprehensive Viva", ltp: [0, 0, 0], credits: 4, kind: "viva", timetabled: false, syllabusCode: "MCA06V01" }),
      ],
    },
  ],
};

// ------------------------------------------------------------------- M.Tech
// The M.Tech syllabi print NO subject codes: every shortCode below is
// derived from the department routine sheet's legends (derived: true),
// Sem 1 cross-checked against the ODD 2026 sheet.
const MTECH_AI = {
  programme: "M.Tech",
  specialisation: "Artificial Intelligence",
  semesters: [
    {
      semester: 1,
      subjects: [
        sub({ code: "ADSA", title: "Advanced Data Structures and Algorithms", ltp: [3, 1, 0], credits: 4, derived: true }),
        sub({ code: "AI", title: "Artificial Intelligence", ltp: [3, 1, 0], credits: 4, derived: true }),
        sub({ code: "CM", title: "Computational Methods of Optimization", ltp: [3, 1, 0], credits: 4, derived: true }),
        elective("Elective-I", [4, 0, 0], 4, MTECH_AI_E1),
        elective("Elective-II", [4, 0, 0], 4, MTECH_AI_E2),
        sub({ code: "ADSA Lab", title: "Laboratory I (Advanced Data Structures and Algorithms)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "AI Lab", title: "Laboratory II (Artificial Intelligence)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "Seminar", title: "Seminar", ltp: [0, 0, 1], credits: 1, kind: "seminar", derived: true }),
      ],
    },
    {
      semester: 2,
      subjects: [
        sub({ code: "RA", title: "Robotics and Automation", ltp: [3, 1, 0], credits: 4, derived: true }),
        sub({ code: "ML", title: "Machine Learning", ltp: [3, 1, 0], credits: 4, derived: true }),
        sub({ code: "CLA", title: "Computational Linear Algebra", ltp: [3, 1, 0], credits: 4, derived: true }),
        elective("Elective-III", [4, 0, 0], 4, MTECH_AI_E3),
        sub({ code: "RA Lab", title: "Laboratory I (Robotics and Automation Lab)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "ML Lab", title: "Laboratory II (Machine Learning)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "ProjPrelim", title: "Project Preliminaries", ltp: [0, 0, 3], credits: 3, kind: "project", timetabled: false, derived: true }),
        sub({ code: "Viva", title: "Comprehensive Viva", ltp: [0, 0, 2], credits: 2, kind: "viva", timetabled: false, derived: true }),
      ],
    },
    {
      semester: 3,
      subjects: [
        sub({ code: "Thesis-I", title: "Project and Thesis Work – I", ltp: [0, 0, 10], credits: 10, kind: "project", timetabled: false, derived: true }),
      ],
    },
    {
      semester: 4,
      subjects: [
        sub({ code: "Thesis-II", title: "Project and Thesis Work – II", ltp: [0, 0, 20], credits: 20, kind: "project", timetabled: false, derived: true }),
      ],
    },
  ],
};

const MTECH_CYBER = {
  programme: "M.Tech",
  specialisation: "Cyber Security",
  semesters: [
    {
      semester: 1,
      subjects: [
        sub({ code: "ADSA", title: "Advanced Data Structures and Algorithms", ltp: [3, 1, 0], credits: 4, derived: true }),
        sub({ code: "MFCS", title: "Mathematical Foundation of Computer Science", ltp: [3, 1, 0], credits: 4, derived: true }),
        sub({ code: "CRYPTO", title: "Principles of Cryptography", ltp: [3, 1, 0], credits: 4, derived: true }),
        // Scheme tables print the slots as 3-1-0 (the elective list says 4-0-0).
        elective("Elective-I", [3, 1, 0], 4, MTECH_CYBER_POOL),
        elective("Elective-II", [3, 1, 0], 4, MTECH_CYBER_POOL),
        sub({ code: "ADSA Lab", title: "Laboratory-I (Advanced Data Structures and Algorithms)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "Crypto Lab", title: "Laboratory-II (Cryptography)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "Seminar", title: "Seminar", ltp: [0, 0, 1], credits: 1, kind: "seminar", derived: true }),
      ],
    },
    {
      semester: 2,
      subjects: [
        sub({ code: "ISRM", title: "Information Security & Risk Management", ltp: [3, 1, 0], credits: 4, derived: true }),
        sub({ code: "DSP", title: "Design of Secure Protocols", ltp: [3, 1, 0], credits: 4, derived: true }),
        elective("Elective-III", [3, 1, 0], 4, MTECH_CYBER_POOL),
        elective("Elective-IV", [3, 1, 0], 4, MTECH_CYBER_POOL),
        sub({ code: "CSDF Lab", title: "Laboratory-III (Cyber Security & Digital Forensic)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "Lab-IV", title: "Laboratory-IV (title blank in syllabus)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "ProjPrelim", title: "Project Preliminary", ltp: [0, 0, 3], credits: 3, kind: "project", timetabled: false, derived: true }),
        sub({ code: "Viva", title: "Comprehensive Viva", ltp: [0, 0, 2], credits: 2, kind: "viva", timetabled: false, derived: true }),
      ],
    },
    {
      semester: 3,
      subjects: [
        sub({ code: "Thesis-1", title: "Project and Thesis – 1", ltp: [0, 0, 10], credits: 10, kind: "project", timetabled: false, derived: true }),
      ],
    },
    {
      semester: 4,
      subjects: [
        sub({ code: "Thesis-2", title: "Project and Thesis – 2", ltp: [0, 0, 20], credits: 20, kind: "project", timetabled: false, derived: true }),
      ],
    },
  ],
};

const MTECH_DSE = {
  programme: "M.Tech",
  specialisation: "Data Science & Engineering",
  semesters: [
    {
      semester: 1,
      subjects: [
        sub({ code: "ADSA", title: "Advanced Data Structures and Algorithms", ltp: [3, 1, 0], credits: 4, derived: true }),
        sub({ code: "DM", title: "Data Mining", ltp: [3, 1, 0], credits: 4, derived: true }),
        sub({ code: "MFDS", title: "Mathematical Foundations for Data Science", ltp: [3, 1, 0], credits: 4, derived: true }),
        elective("Elective-I", [4, 0, 0], 4, MTECH_DSE_POOL),
        elective("Elective-II", [4, 0, 0], 4, MTECH_DSE_POOL),
        sub({ code: "ADSA Lab", title: "Laboratory I (Advanced Data Structures and Algorithms)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "DSF Lab", title: "Laboratory II (Data Science Foundation)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "Seminar", title: "Seminar", ltp: [0, 0, 1], credits: 1, kind: "seminar", derived: true }),
      ],
    },
    {
      semester: 2,
      subjects: [
        sub({ code: "ML", title: "Machine Learning", ltp: [3, 1, 0], credits: 4, derived: true }),
        sub({ code: "BD", title: "Big Data Analytics", ltp: [3, 1, 0], credits: 4, derived: true }),
        elective("Elective-III", [4, 0, 0], 4, MTECH_DSE_POOL),
        elective("Elective-IV", [4, 0, 0], 4, MTECH_DSE_POOL),
        sub({ code: "ML Lab", title: "Laboratory-I (Machine Learning Lab)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "DSI Lab", title: "Laboratory-II (Data Science Implementation)", ltp: [0, 0, 2], credits: 2, derived: true }),
        sub({ code: "ProjPrelim", title: "Project Preliminaries", ltp: [0, 0, 3], credits: 3, kind: "project", timetabled: false, derived: true }),
        sub({ code: "Viva", title: "Comprehensive Viva", ltp: [0, 0, 2], credits: 2, kind: "viva", timetabled: false, derived: true }),
      ],
    },
    {
      semester: 3,
      subjects: [
        sub({ code: "Thesis-I", title: "Project and Thesis – I", ltp: [0, 0, 10], credits: 10, kind: "project", timetabled: false, derived: true }),
      ],
    },
    {
      semester: 4,
      subjects: [
        sub({ code: "Thesis-II", title: "Project and Thesis – II", ltp: [0, 0, 20], credits: 20, kind: "project", timetabled: false, derived: true }),
      ],
    },
  ],
};

export const CSE_CATALOGUE: CatalogueDepartment = {
  id: "CSE",
  name: "Computer Science and Engineering",
  shortName: "CSE",
  programmes: [BTECH, MCA, MTECH_AI, MTECH_CYBER, MTECH_DSE],
};
