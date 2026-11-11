import { CSE_CATALOGUE } from "./cse.js";
import { CIVIL_CATALOGUE } from "./civil.js";
import { EE_CATALOGUE } from "./electrical.js";
import { ECE_CATALOGUE } from "./ece.js";
import { EIE_CATALOGUE } from "./eie.js";
import { MECH_CATALOGUE } from "./mechanical.js";
import { PROD_CATALOGUE } from "./production.js";
import { CHEMICAL_CATALOGUE } from "./chemical.js";
import { BIO_CATALOGUE } from "./bio.js";
import { CatalogueDepartment } from "./types.js";

export * from "./types.js";
export * from "./faculty.js";
export * from "./departments.js";
export { CSE_CATALOGUE };

/** All built-in syllabus catalogues, keyed by catalogue id. */
export const CATALOGUES: Record<string, CatalogueDepartment> = {
  [CSE_CATALOGUE.id]: CSE_CATALOGUE,
  [CIVIL_CATALOGUE.id]: CIVIL_CATALOGUE,
  [EE_CATALOGUE.id]: EE_CATALOGUE,
  [ECE_CATALOGUE.id]: ECE_CATALOGUE,
  [EIE_CATALOGUE.id]: EIE_CATALOGUE,
  [MECH_CATALOGUE.id]: MECH_CATALOGUE,
  [PROD_CATALOGUE.id]: PROD_CATALOGUE,
  [CHEMICAL_CATALOGUE.id]: CHEMICAL_CATALOGUE,
  [BIO_CATALOGUE.id]: BIO_CATALOGUE,
};

export function getCatalogue(id: string): CatalogueDepartment | null {
  return CATALOGUES[id.toUpperCase()] ?? null;
}

export function listCatalogues(): CatalogueDepartment[] {
  return Object.values(CATALOGUES);
}
