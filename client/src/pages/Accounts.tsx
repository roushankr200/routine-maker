import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage, fetchAccounts, fetchClasses, fetchTeachers, linkAccount } from "../api";
import { Banner, PageTitle } from "../components/ui";

export default function Accounts() {
  const client = useQueryClient();
  const { data: accounts, error, isPending } = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const { data: teachers = [], error: teacherError } = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers });
  const { data: classes = [], error: classError } = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const [message, setMessage] = useState("");
  const update = useMutation({
    mutationFn: ({ id, memberId }: { id: string; memberId: string | null }) => linkAccount(id, memberId),
    onSuccess: () => { setMessage("Account updated."); void client.invalidateQueries({ queryKey: ["accounts"] }); },
  });
  const problem = error || teacherError || classError || update.error;

  return <div>
    <PageTitle title="Accounts" />
    <p className="mb-4 text-sm text-muted">Link each teacher to a faculty record and each student to a class in the active department.</p>
    {message && <Banner kind="success" text={message} />}
    {problem && <Banner kind="error" text={errorMessage(problem)} />}
    {isPending && <p className="text-muted">Loading accounts…</p>}
    {accounts?.length === 0 && <p className="card p-5">Teacher and student accounts will appear here after they sign up.</p>}
    {accounts && accounts.length > 0 && <ul className="card divide-y divide-line">
      {accounts.map((account) => {
        const options = account.role === "teacher" ? teachers : classes;
        const linkedElsewhere = account.memberId !== null && !options.some((item) => item.id === account.memberId);
        return <li className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr]" key={account.id}>
          <div><p className="font-semibold">{account.name}</p><p className="break-all text-sm text-muted">{account.email} · {account.role === "teacher" ? "Teacher" : "Student"}</p></div>
          <label><span className="label">{account.role === "teacher" ? "Faculty record" : "Class section"}</span>
            <select className="input" value={account.memberId ?? ""} disabled={update.isPending} onChange={(e) => {
              setMessage(""); update.mutate({ id: account.id, memberId: e.target.value || null });
            }}>
              <option value="">Unlinked</option>
              {linkedElsewhere && <option value={account.memberId!}>Linked to a record outside this list</option>}
              {options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </li>;
      })}
    </ul>}
  </div>;
}
