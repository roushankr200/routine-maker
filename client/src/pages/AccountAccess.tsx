import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin } from "lucide-react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { currentAccount, errorMessage, fetchMyRoutine, login, logout, signup } from "../api";
import { Banner, sessionBlocks } from "../components/ui";
import type { Account } from "../types";
import { sessionRange } from "../utils/time";

export function SignOut() {
  const [error, setError] = useState("");
  return <>
    <button className="btn-ghost" type="button" onClick={() => {
      void logout().then(() => window.location.assign("/login")).catch((problem) => setError(errorMessage(problem)));
    }}>Sign out</button>
    {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
  </>;
}

export function AccountGate() {
  const { data, error, isPending } = useQuery({ queryKey: ["account"], queryFn: currentAccount, retry: false });
  if (isPending) return <p className="p-6 text-muted">Checking your session…</p>;
  if (!data) {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 401) return <Navigate to="/login" replace />;
    return <div className="mx-auto max-w-xl p-6"><Banner kind="error" text={errorMessage(error)} /></div>;
  }
  return data.role === "admin" ? <Outlet /> : <PersonalRoutine account={data} />;
}

export default function AccountAccess() {
  const registration = useLocation().pathname === "/signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Account["role"]>("student");
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (registration) await signup({ email, password, name, role, adminCode });
      else await login({ email, password });
      window.location.assign("/");
    } catch (problem) {
      setError(errorMessage(problem));
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-teal-50 via-white to-orange-50 p-5">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-primary-dark p-3 text-white"><CalendarDays size={23} aria-hidden /></div>
          <div><p className="font-mono text-lg font-semibold text-primary-dark">Routine Maker</p><p className="text-sm text-muted">NIT Agartala</p></div>
        </div>
        <form className="card space-y-4 border-t-4 border-t-primary p-6 sm:p-8" onSubmit={submit}>
          <h1 className="text-2xl font-semibold">{registration ? "Create your account" : "Sign in"}</h1>
          {error && <Banner kind="error" text={error} />}
          {registration && <div><label className="label" htmlFor="account-name">Full name</label><input id="account-name" className="input" autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} required /></div>}
          <div><label className="label" htmlFor="account-email">Email</label><input id="account-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="label" htmlFor="account-password">Password</label><input id="account-password" className="input" type="password" autoComplete={registration ? "new-password" : "current-password"} minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {registration && <div>
            <label className="label" htmlFor="account-role">Account type</label>
            <select id="account-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Account["role"])}>
              <option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Administrator</option>
            </select>
            {role === "admin" ? <div className="mt-4"><label className="label" htmlFor="admin-code">Administrator signup code</label>
              <input id="admin-code" className="input" type="password" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} required autoComplete="off" /></div>
              : <p className="mt-2 text-sm text-muted">An administrator links your account to your timetable.</p>}
          </div>}
          <button className="btn-primary w-full" disabled={submitting}>{submitting ? "Please wait…" : registration ? "Create account" : "Sign in"}</button>
          <p className="text-center text-sm text-muted">
            {registration ? "Already registered? " : "New to Routine Maker? "}
            <Link className="font-semibold text-primary-dark underline" to={registration ? "/login" : "/signup"} onClick={() => setError("")}>
              {registration ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function PersonalRoutine({ account }: { account: Account }) {
  const { data, error, isPending } = useQuery({ queryKey: ["my-routine", account.id], queryFn: fetchMyRoutine });
  const config = data?.config;
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <div><p className="font-mono font-semibold text-primary-dark">Routine Maker</p><p className="text-sm text-muted">{account.name} · {account.role === "teacher" ? "Teacher" : "Student"}</p></div>
          <SignOut />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-7">
        <h1 className="mb-1 text-2xl font-semibold">My timetable</h1>
        {config && <p className="mb-5 text-sm text-muted">{config.department} · {config.session}{config.effectiveFrom ? ` · Effective ${config.effectiveFrom}` : ""}</p>}
        {isPending && <p className="mt-4 text-muted">Loading timetable…</p>}
        {error && <Banner kind="error" text={errorMessage(error)} />}
        {data && !data.linked && <div className="card mt-4 p-5">Your account is waiting to be linked by an administrator.</div>}
        {data?.linked && data.entries.length === 0 && <div className="card mt-4 p-5">Your timetable will appear when an administrator generates it.</div>}
        {config && data && data.entries.length > 0 && <div className="space-y-4">
          {config.days.map((day) => {
            const blocks = [...sessionBlocks(data.entries, day).values()];
            return <section key={day} className="card overflow-hidden">
              <h2 className="border-b border-line bg-teal-50 px-5 py-3 font-semibold">{day}</h2>
              {blocks.length === 0 ? <p className="px-5 py-3 text-sm text-muted">No sessions</p> :
                <ul className="divide-y divide-line">{blocks.map(({ entry, start, length }) => (
                  <li key={entry.id} className="grid items-start gap-2 px-5 py-3 sm:grid-cols-[9rem_1fr_9rem]">
                    <span className="font-mono text-sm text-primary-dark">{sessionRange(config, start, length)}</span>
                    <div><p className="font-semibold">{entry.subjectName}</p><p className="text-sm text-muted">{entry.subjectCode} · {account.role === "teacher" ? entry.className : entry.teacherName}</p></div>
                    <div><p className="flex items-center gap-1 font-semibold"><MapPin size={15} aria-hidden /> {entry.subjectType === "lab" ? "Lab" : "Room"} {entry.roomNumber}</p>
                      <p className="ml-5 text-sm text-muted">{entry.roomFloor === 0 ? "Ground floor" : `Floor ${entry.roomFloor}`}</p></div>
                  </li>
                ))}</ul>}
            </section>;
          })}
        </div>}
      </main>
    </div>
  );
}
