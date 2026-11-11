/**
 * Faculty registry — the department-wise faculty lists published on
 * nita.ac.in (each department's FacultyList page), extracted
 * 2026-11-11; names and designations are EXACTLY as printed (raw
 * extractions: reference/faculty-raw/). The unified setup preloads a
 * department's teachers from here — the server re-resolves names and
 * designations from this registry, never from the client.
 *
 * Teacher short codes are NOT printed on the site; they are derived
 * deterministically from the name's initials (honorifics dropped),
 * collisions resolved by appending 2, 3, … in list order. Codes are
 * unique and stable per department.
 */

export interface FacultyMember {
  name: string;
  designation: string;
}

const F = (name: string, designation: string): FacultyMember => ({ name, designation });

export const FACULTY: Record<string, FacultyMember[]> = {
  CSE: [
    F("Dr. Ashim Saha", "HOD & Associate Professor"),
    F("Dr. Diptendu Bhattacharya", "Professor"),
    F("Prof. Mrinal Kanti Deb Barma", "Professor"),
    F("Dr. Dwijen Rudrapal", "Associate Professor"),
    F("Dr. Kunal Chakma", "Associate Professor"),
    F("Dr. Nirmalya Kar", "Associate Professor"),
    F("Dr. Suman Deb", "Associate Professor"),
    F("Dr. SWAPAN DEBBARMA", "Associate Professor"),
    F("Dr. Abhishek Hazra", "Assistant Professor"),
    F("Dr. Anupam Jamatia", "Assistant Professor"),
    F("Dr. Awnish Kumar", "Assistant Professor"),
    F("Dr. Jayakumar L", "Assistant Professor"),
    F("Dr. Kamal Das", "Assistant Professor"),
    F("Dr. Kamanasish Bhattacharjee", "Assistant Professor"),
    F("Dr. Nikhil Debbarma", "Assistant Professor"),
    F("Dr. Rajesh Basak", "Assistant Professor"),
    F("Dr. Ranjita Das", "Assistant Professor"),
    F("Dr. Smita Das", "Assistant Professor"),
    F("Dr. Suyel Namasudra", "Assistant Professor"),
    F("Mr. Tribid Debbarma", "Assistant Professor"),
    F("Dr. Dhrubajyoti Bhowmik", "Assistant Professor (Contractual)"),
    F("Dr. Kishore Kumar Dhar", "Assistant Professor (Contractual)"),
    F("Dr. Prashant Bhardwaj", "Assistant Professor (Contractual)"),
    F("Dr. Tannistha Pal", "Assistant Professor (Contractual)"),
    F("Dr. Munesh Chandra", "Associate Professor (In Lien)"),
  ],
  CIVIL: [
    F("Dr. PARTHA PRATIM SARKAR", "Professor & HOD"),
    F("Dr. Deb Dulal Tripura", "Professor"),
    F("Prof. Manish Pal", "Professor"),
    F("Prof. Rajib Saha", "Professor"),
    F("Dr. RAMA DEBBARMA", "Professor"),
    F("Prof. RATUL DAS", "Professor"),
    F("Prof. RICHI PRASAD SHARMA", "Professor"),
    F("Dr. Sima Ghosh", "Professor"),
    F("Prof. SUJIT KUMAR PAL", "Professor"),
    F("Prof. UMESH MISHRA", "Professor"),
    F("Dr. Animesh Debnath", "Associate Professor"),
    F("Dr. Dipankar Sarkar", "Associate Professor"),
    F("Dr. Gopinandan Dey", "Associate Professor"),
    F("Dr. Joyanta Pal", "Associate Professor"),
    F("Dr. Mrinmoy Majumder", "Associate Professor"),
    F("Dr. Surajit Das", "Associate Professor"),
    F("Dr. Sushant Kumar Biswal", "Associate Professor"),
    F("Dr. Tara Sen", "Associate Professor"),
    F("Dr. Dhirendra Kumar Pandey", "Assistant Professor"),
    F("Dr. Lipika Halder", "Assistant Professor"),
    F("Dr. Litan Dey", "Assistant Professor"),
    F("Dr. Manu S Nadesan", "Assistant Professor"),
    F("Dr. Nilotpal Debbarma", "Assistant Professor"),
    F("Dr. Sagarika Panigrahi", "Assistant Professor"),
    F("Dr. SANJAY PAUL", "Assistant Professor"),
    F("Dr. Saurav Kumar", "Assistant Professor"),
    F("Dr. Debashish Karmakar", "Assistant Professor (Contractual)"),
    F("Mrs. DIPIKA DEBNATH", "Assistant Professor (Contractual)"),
    F("Mrs. Nabanita Bhowmik", "Assistant Professor (Contractual)"),
    F("Mrs. Nabina Khanam", "Assistant Professor (Contractual)"),
    F("Mr. RATNADEEP MODAK", "Assistant Professor (Contractual)"),
    F("Mr. Subhajit Deb", "Assistant Professor (Contractual)"),
    F("Dr. Tilottama Chakraborty", "Assistant Professor (Contractual)"),
  ],
  EE: [
    F("Dr. Sumita Deb", "HOD & Associate Professor"),
    F("Prof. Ardhendu Saha", "Professor"),
    F("Dr. Arvind Kumar Jain", "Professor"),
    F("Prof. Priyanath Das", "Professor"),
    F("Dr. Bikram Das", "Associate Professor"),
    F("Dr. Rup Narayan Ray", "Associate Professor"),
    F("Dr. Subhadeep Bhattacharjee", "Associate Professor"),
    F("Dr. Abanishwar Chakrabarti", "Assistant Professor"),
    F("Dr. Anindita Jamatia", "Assistant Professor"),
    F("Dr. JOYASHREE DAS", "Assistant Professor"),
    F("Dr. Karuna Kiran", "Assistant Professor"),
    F("Dr. Minakshi Deb Barma", "Assistant Professor"),
    F("Dr. Nabamita Goswami", "Assistant Professor"),
    F("Dr. P. Padmagirisan", "Assistant Professor"),
    F("Dr. Prabir Ranjan Kasari", "Assistant Professor"),
    F("Dr. Prasenjit Debnath", "Assistant Professor"),
    F("Dr. Sadhan Gope", "Assistant Professor"),
    F("Dr. Shailendra Singh", "Assistant Professor"),
    F("Dr. Arup Ratan Bhowmik", "Assistant Professor (Contractual)"),
    F("Dr. Diptanu Das", "Assistant Professor (Contractual)"),
    F("Mr. DIPTANU DEY", "Assistant Professor (Contractual)"),
    F("Dr. Nivedita Laskar", "Assistant Professor (Contractual)"),
    F("Dr. SHARMISTHA SHARMA", "Assistant Professor (Contractual)"),
  ],
  ECE: [
    F("Dr. Tamasi Moyra Panua", "HOD & Associate Professor"),
    F("Dr. Dibyendu Ghoshal", "Professor"),
    F("Dr. Sambhu Nath Pradhan", "Professor"),
    F("Dr. Atanu Chowdhury", "Associate Professor"),
    F("Dr. Mitra Barun Sarkar", "Associate Professor"),
    F("Dr. Ashish Kumar Padhan", "Assistant Professor"),
    F("Dr. BIMAN DEBBARMA", "Assistant Professor"),
    F("Dr. Chittotosh Ganguly", "Assistant Professor"),
    F("Dr. Goutam Kumar Gupta", "Assistant Professor"),
    F("Dr. Kamalesh Debnath", "Assistant Professor"),
    F("Mr. MANIK BHOWMIK", "Assistant Professor"),
    F("Dr. Shikha Maurya", "Assistant Professor"),
    F("Dr. Somnath Roy Choudhury", "Assistant Professor"),
    F("Dr. Abhishek Nag", "Assistant Professor (Contractual)"),
    F("Dr. Apangshu Das", "Assistant Professor (Contractual)"),
    F("Dr. Priyanka Choudhury", "Assistant Professor (Contractual)"),
    F("Dr. Smita Banik", "Assistant Professor (Contractual)"),
  ],
  EIE: [
    F("Debanjan Acharyya", "HOD & Assistant Professor"),
    F("Jayanta Kumar Rakshit", "Associate Professor"),
    F("Debangana Das", "Assistant Professor"),
    F("Krishanu Nath", "Assistant Professor"),
    F("Rupam Gupta Roy", "Assistant Professor"),
    F("SUBIR DAS", "Assistant Professor"),
    F("Yogesh Kumar Sariya", "Assistant Professor"),
    F("APARUPA KAR", "Temp. Assistant Professor (Contractual)"),
    F("PRIYANKA DEY", "Temp. Assistant Professor (Contractual)"),
    F("Priyanka Goswami", "Technical-cum-Teaching Assistant (Contractual)"),
  ],
  MECH: [
    F("Dr. Ajay Biswas", "HOD & Associate Professor"),
    F("Prof. Ajoy Kumar Das", "Professor"),
    F("Prof. John Deb Barma", "Professor"),
    F("Prof. Prasun Chakraborti", "Professor"),
    F("Dr. PRITAM DAS", "Professor"),
    F("Dr. Rajsekhar Panua", "Professor"),
    F("Dr. Ranjan Das", "Professor"),
    F("Prof. SWAPAN BHAUMIK", "Professor"),
    F("Dr. Abhik Majumder", "Associate Professor"),
    F("Dr. Arindam Majumder", "Associate Professor"),
    F("Dr. Barnik Saha Roy", "Associate Professor"),
    F("Dr. Jawahar Paulraj", "Associate Professor"),
    F("Dr. Madhujit Deb", "Associate Professor"),
    F("Dr. Pankaj Kumar Das", "Associate Professor"),
    F("Dr. Subrata Kumar Ghosh", "Associate Professor"),
    F("Dr. Ankuran Saha", "Assistant Professor"),
    F("Dr. Dipak Chandra Das", "Assistant Professor"),
    F("Dr. Paramvir Singh", "Assistant Professor"),
    F("Dr. Pinku Debnath", "Assistant Professor"),
    F("Dr. R K Bhogendro Meitei", "Assistant Professor"),
    F("Dr. Rahul Banerjee", "Assistant Professor"),
    F("Dr. Rajdeep Ghosh", "Assistant Professor"),
    F("Dr. Rajdeep Paul", "Assistant Professor"),
    F("Dr. RAVIVARMAN R", "Assistant Professor"),
    F("Dr. Sagnik Pal", "Assistant Professor"),
    F("Mr. Arindam Sinha", "Assistant Professor (Contractual)"),
    F("Dr. Ashis Acharjee", "Assistant Professor (Contractual)"),
    F("Dr. DURBADAL DEBROY", "Assistant Professor (Contractual)"),
    F("Dr. Joydeep Roy", "Assistant Professor (Contractual)"),
    F("Mrs. Moutoshi Singha Roy", "Assistant Professor (Contractual)"),
    F("Dr. Manish Bhargava", "Associate Professor (In Lien)"),
  ],
  PROD: [
    F("Dr. UTTAM KUMAR MANDAL", "HOD & Associate Professor"),
    F("Prof. Rabindra Narayan Mahapatra", "Professor"),
    F("Prof. Ram Naresh Rai", "Professor"),
    F("Dr. Kishan Choudhuri", "Associate Professor"),
    F("Dr. Neeraj Sharma", "Associate Professor"),
    F("Dr. Swarup Paul", "Associate Professor"),
    F("Dr. VIDYUT DEY", "Associate Professor"),
    F("Dr. Nabarun Biswas", "Assistant Professor"),
    F("Dr. Nitish Kumar Mahto", "Assistant Professor"),
    F("Dr. Prakash Kumar Sahu", "Assistant Professor"),
    F("Dr. Prasenjit Dutta", "Assistant Professor"),
    F("Dr. Sujoy Chakraborty", "Assistant Professor"),
    F("Dr. Uttam Kumar Mohanty", "Assistant Professor"),
    F("Dr. Debashis Podder", "Assistant Professor (Contractual)"),
  ],
  CHEMICAL: [
    F("Dr. Ajay Kumar Manna", "HOD & Associate Professor"),
    F("Dr. Kalyan Gayen", "Associate Professor"),
    F("Dr. Soma Nag", "Associate Professor"),
    F("Dr. SRIMANTA RAY", "Associate Professor"),
    F("Dr. Tarun Kanti Bandyopadhyay", "Associate Professor"),
    F("Dr. Bibhab Kumar Lodh", "Assistant Professor"),
    F("Dr. Mamidi Suresh", "Assistant Professor"),
    F("Dr. Mriganka Sekhar Manna", "Assistant Professor"),
    F("Dr. Ravi Prakash", "Assistant Professor"),
    F("Dr. Vikash Singh", "Assistant Professor"),
    F("Dr. Swarup Biswas", "Assistant Professor (Contractual)"),
  ],
  BIO: [
    F("Dr. Tarun Kanti Bandyopadhyay", "HOD & Associate Professor"),
    F("Dr. Abhijit Chatterjee", "Assistant Professor"),
    F("Dr. Biswanath Bhunia", "Assistant Professor"),
    F("Dr. Deeplina Das", "Assistant Professor"),
    F("Dr. Muthusivaramapandian M", "Assistant Professor"),
    F("Dr. N. Vignesh", "Assistant Professor"),
    F("Dr. Padmanaban V C", "Assistant Professor"),
    F("Mrs. HRIJUTA DATTA", "Assistant Professor (Contractual)"),
    F("Dr. Tridib Kumar Bhowmick", "Assistant Professor (Contractual)"),
  ],
  CHEMISTRY: [
    F("Dr. Mithun Roy", "HOD & Associate Professor"),
    F("Prof. Mitali Saha", "Professor"),
    F("Prof. TARUN KUMAR MISRA", "Professor"),
    F("Dr. SAROJ KUMAR DAS", "Associate Professor"),
    F("Dr. Abhishek Koner", "Assistant Professor"),
    F("Dr. Anannya Saha", "Assistant Professor"),
    F("Dr. Arindam Modak", "Assistant Professor"),
    F("Dr. Ratul Paul", "Assistant Professor"),
    F("Dr. Sriram Kumar", "Assistant Professor"),
    F("Dr. VENKATA BHARAT NISHTALA", "Assistant Professor"),
    F("Dr. Chanchal Bhaumik", "Assistant Professor (Contractual)"),
    F("Dr. Chitraniva Datta", "Assistant Professor (Contractual)"),
    F("Dr. Jhinuk De", "Assistant Professor (Contractual)"),
    F("Dr. Manas Roy", "Assistant Professor (Contractual)"),
    F("Dr. MANOJIT ROY", "Assistant Professor (Contractual)"),
    F("Dr. Sajal Kundu", "Assistant Professor (Contractual)"),
    F("Dr. Subhojit Das", "Assistant Professor (Contractual)"),
    F("Dr. Susanta Ghanta", "Assistant Professor (Contractual)"),
  ],
  PHYSICS: [
    F("Dr. Vivek Kumar Anand", "HOD & Associate Professor"),
    F("Prof. Aparna Nath", "Professor"),
    F("Dr. Biswajit Saha", "Associate Professor"),
    F("Dr. Suvra Prakash Mondal", "Associate Professor"),
    F("Dr. Anshuman Mondal", "Assistant Professor"),
    F("Dr. Antu Laha", "Assistant Professor"),
    F("Dr. MAROJU SUMAN KALYAN", "Assistant Professor"),
    F("Dr. Prosenjit Haldar", "Assistant Professor"),
    F("Dr. Rahul Debnath", "Assistant Professor"),
    F("Dr. Biswajit Paul", "Assistant Professor (Contractual)"),
    F("Dr. MANASH KUMAR PAUL", "Assistant Professor (Contractual)"),
    F("Dr. Santanu Chakraborty", "Assistant Professor (Contractual)"),
    F("Dr. Saswati Roy", "Assistant Professor (Contractual)"),
    F("Dr. Thingujam Kiranmala Devi", "Assistant Professor (Contractual)"),
    F("Mr. Subharaj Paul", "Teaching Assistant (Contractual)"),
  ],
  MATHS: [
    F("Dr. Uttam Kumar Bera", "Professor & HOD"),
    F("Dr. APU KUMAR SAHA", "Professor"),
    F("Dr. Baby Bhattacharya", "Professor"),
    F("Prof. DEBASISH BHATTACHARYA", "Professor"),
    F("Prof. PARITOSH BHATTACHARYA", "Professor"),
    F("Dr. Amrita Mandal", "Assistant Professor"),
    F("Dr. Birojit Das", "Assistant Professor"),
    F("Dr. Kalyani Debnath", "Assistant Professor"),
    F("Dr. Krushnachandra Panigrahy", "Assistant Professor"),
    F("Dr. Pasupathi R", "Assistant Professor"),
    F("Dr. Supriyo Dutta", "Assistant Professor"),
    F("Dr. Abhijit Baidya", "Assistant Professor (Contractual)"),
    F("Dr. Jayanta Debnath", "Assistant Professor (Contractual)"),
    F("Dr. Jayasree Chakraborty", "Assistant Professor (Contractual)"),
    F("Dr. Mantu Das", "Assistant Professor (Contractual)"),
    F("Dr. Pinki Majumder", "Assistant Professor (Contractual)"),
    F("Dr. Sayanta Chakraborty", "Assistant Professor (Contractual)"),
    F("Dr. SUDIPA CHOUDHURY", "Assistant Professor (Contractual)"),
    F("Dr. Susmita Roy", "Assistant Professor (Contractual)"),
  ],
  MHSS: [
    F("Dr. Anirban Dutta", "HOD & Associate Professor"),
    F("Prof. Debasis Neogi", "Professor"),
    F("Dr. Gyanabati Khuraijam", "Associate Professor"),
    F("Dr. Nancy Sharma", "Assistant Professor"),
    F("Dr. Priyadarshi Ranjan", "Assistant Professor"),
    F("Dr. RAJIB MALLIK", "Assistant Professor"),
    F("Dr. AMIT BIKRAM CHOWDHURY", "Assistant Professor (Contractual)"),
    F("Dr. Anuradha Nongmaithem", "Assistant Professor (Contractual)"),
    F("Dr. KAJU NATH", "Assistant Professor (Contractual)"),
    F("Dr. SONIT DUTTA", "Assistant Professor (Contractual)"),
    F("Mr. BIDYASAGAR DEBNATH", "Teaching Assistant"),
    F("Mr. NABENDU DEBNATH", "Teaching Assistant"),
  ],
  // Education has NO department/faculty page on the live site.
  EDUCATION: [],
};

const HONORIFICS = new Set([
  "dr", "dr.", "prof", "prof.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.",
  "miss", "shri", "smt", "sri",
]);

/** Initials of a person's name, honorifics dropped ("Dr. P. Padmagirisan" -> "PP"). */
export function deriveTeacherCodeBase(name: string): string {
  const tokens = name.split(/\s+/).filter(Boolean);
  let code = "";
  for (const tok of tokens) {
    if (HONORIFICS.has(tok.toLowerCase())) continue;
    const letter = tok.replace(/[^A-Za-z]/g, "")[0];
    if (letter) code += letter.toUpperCase();
  }
  return code || "T";
}

/** Assign unique codes down a list, in order: base, base2, base3, … */
export function assignTeacherCodes(members: FacultyMember[]): Array<FacultyMember & { code: string }> {
  const taken = new Set<string>();
  return members.map((m) => {
    const base = deriveTeacherCodeBase(m.name);
    let code = base;
    let n = 2;
    while (taken.has(code)) {
      code = `${base}${n}`;
      n++;
    }
    taken.add(code);
    return { ...m, code };
  });
}

const codedCache = new Map<string, Array<FacultyMember & { code: string }>>();

/** A department's faculty with their derived codes (registry order). */
export function facultyWithCodes(deptId: string): Array<FacultyMember & { code: string }> | null {
  const key = deptId.toUpperCase();
  if (!(key in FACULTY)) return null;
  if (!codedCache.has(key)) codedCache.set(key, assignTeacherCodes(FACULTY[key]));
  return codedCache.get(key)!;
}

/** Look up one registry member by department + derived code. */
export function findFaculty(deptId: string, code: string): (FacultyMember & { code: string }) | null {
  const list = facultyWithCodes(deptId);
  if (!list) return null;
  return list.find((m) => m.code.toUpperCase() === code.toUpperCase()) ?? null;
}
