import { CSE_CATALOGUE } from "./cse.js";
import { CatalogueDepartment } from "./types.js";

export * from "./types.js";
export { CSE_CATALOGUE };

/** All built-in syllabus catalogues, keyed by catalogue id ("CSE"). */
export const CATALOGUES: Record<string, CatalogueDepartment> = {
  [CSE_CATALOGUE.id]: CSE_CATALOGUE,
};

export function getCatalogue(id: string): CatalogueDepartment | null {
  return CATALOGUES[id.toUpperCase()] ?? null;
}

export function listCatalogues(): CatalogueDepartment[] {
  return Object.values(CATALOGUES);
}
