import axios from "axios";
import type {
  BalanceReport,
  CatalogListResponse,
  CatalogueDepartment,
  ClassSection,
  DashboardData,
  DepartmentsResponse,
  FacultyDeptResponse,
  GenerateResult,
  GuidedSetupPayload,
  GuidedSetupResult,
  RegistryDepartment,
  RoutineEntry,
  ScheduleConfig,
  Subject,
  Teacher,
  ValidationData,
} from "./types";

export const api = axios.create({ baseURL: "/api" });

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error ?? err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

// Dashboard / seed
export const fetchDashboard = () => api.get<DashboardData>("/dashboard").then((r) => r.data);
export const seedDemo = () =>
  api
    .post<{ message: string; counts: { teachers: number; subjects: number; classes: number } }>(
      "/seed",
    )
    .then((r) => r.data);

// Departments — several departments coexist; switching never deletes.
export const fetchDepartments = () =>
  api.get<DepartmentsResponse>("/departments").then((r) => r.data);
export const activateDepartment = (id: string) =>
  api.post<{ message: string }>(`/departments/${id}/activate`).then((r) => r.data);
export const deleteDepartment = (id: string) =>
  api.delete<{ message: string }>(`/departments/${id}`).then((r) => r.data);
export const clearRoutine = () => api.post<{ message: string }>("/routine/clear").then((r) => r.data);
export const generateRoutine = () =>
  api.post<GenerateResult>("/routine/generate").then((r) => r.data);

// Teachers
export const fetchTeachers = () => api.get<Teacher[]>("/teachers").then((r) => r.data);
export const saveTeacher = (t: Partial<Teacher>) =>
  t.id ? api.put(`/teachers/${t.id}`, t) : api.post("/teachers", t);
export const deleteTeacher = (id: string) => api.delete(`/teachers/${id}`);
export const fetchAvailability = (id: string) =>
  api.get<{ teacher: { id: string; name: string }; blocked: string[] }>(
    `/teachers/${id}/availability`,
  ).then((r) => r.data);
export const saveAvailability = (id: string, blocked: string[]) =>
  api.put(`/teachers/${id}/availability`, { blocked });

// Subjects
export const fetchSubjects = () => api.get<Subject[]>("/subjects").then((r) => r.data);
export const saveSubject = (s: Partial<Subject>) =>
  s.id ? api.put(`/subjects/${s.id}`, s) : api.post("/subjects", s);
export const deleteSubject = (id: string) => api.delete(`/subjects/${id}`);

// Classes
export const fetchClasses = () => api.get<ClassSection[]>("/classes").then((r) => r.data);
export const saveClass = (c: Partial<ClassSection>) =>
  c.id ? api.put(`/classes/${c.id}`, c) : api.post("/classes", c);
export const deleteClass = (id: string) => api.delete(`/classes/${id}`);
export const saveClassSubject = (classId: string, subjectId: string, hours: number) =>
  api.post(`/classes/${classId}/subjects`, { subjectId, hours });
export const deleteClassSubject = (classId: string, subjectId: string) =>
  api.delete(`/classes/${classId}/subjects/${subjectId}`);

// Config
export const fetchConfig = () => api.get<ScheduleConfig>("/config").then((r) => r.data);
export const saveConfig = (cfg: ScheduleConfig) => api.put("/config", cfg);

// Department registry + website faculty lists (nita.ac.in preloads).
export const fetchRegistry = () =>
  api.get<{ departments: RegistryDepartment[] }>("/faculty").then((r) => r.data.departments);
export const fetchFaculty = (deptId: string) =>
  api.get<FacultyDeptResponse>(`/faculty/${deptId}`).then((r) => r.data);

// Syllabus catalogues + the ONE unified setup (creates an ADDITIONAL
// department — nothing is ever deleted).
export const fetchCatalogList = () =>
  api.get<CatalogListResponse>("/catalog").then((r) => r.data);
export const fetchCatalogue = (id: string) =>
  api.get<CatalogueDepartment>(`/catalog/${id}`).then((r) => r.data);
export const setupGuided = (payload: GuidedSetupPayload) =>
  api.post<GuidedSetupResult>("/setup/guided", payload).then((r) => r.data);

// Routine
export const fetchRoutine = () =>
  api.get<{ config: ScheduleConfig; entries: RoutineEntry[] }>("/routine").then((r) => r.data);
export const moveEntry = (entryId: string, day: string, period: number) =>
  api.post<{ message: string }>("/routine/move", { entryId, day, period }).then((r) => r.data);
export const swapEntries = (entryA: string, entryB: string) =>
  api.post<{ message: string }>("/routine/swap", { entryA, entryB }).then((r) => r.data);

// Validation
export const fetchValidation = () => api.get<ValidationData>("/validation").then((r) => r.data);

// Load balance — coverage (hours left per subject) + suggested teacher loads
export const fetchBalance = () => api.get<BalanceReport>("/balance").then((r) => r.data);
