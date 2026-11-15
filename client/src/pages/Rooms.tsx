import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage, fetchRooms, saveRoom } from "../api";
import { Banner, PageTitle } from "../components/ui";
import type { Room } from "../types";

const empty = { id: "", number: "", floor: 0, capacity: 30, type: "theory" as Room["type"] };

export default function Rooms() {
  const client = useQueryClient();
  const { data: rooms, error, isPending } = useQuery({ queryKey: ["rooms"], queryFn: fetchRooms });
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState("");
  const save = useMutation({ mutationFn: saveRoom, onSuccess: () => {
    setMessage(form.id ? "Room updated." : "Room added.");
    setForm(empty);
    void client.invalidateQueries({ queryKey: ["rooms"] });
    void client.invalidateQueries({ queryKey: ["routine"] });
  } });

  return <div>
    <PageTitle title="Rooms" />
    <p className="mb-4 text-sm text-muted">The timetable uses these rooms across departments. Each session needs enough seats and the right room type.</p>
    {message && <Banner kind="success" text={message} />}
    {(error || save.error) && <Banner kind="error" text={errorMessage(error || save.error)} />}
    <form className="card mb-5 p-5" onSubmit={(event) => { event.preventDefault(); setMessage(""); save.mutate(form); }}>
      <h2 className="mb-3 font-semibold">{form.id ? `Edit room ${form.number}` : "Add a room"}</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <label><span className="label">Room number</span><input className="input" required maxLength={24} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></label>
        <label><span className="label">Floor (0 = ground)</span><input className="input" type="number" min={0} max={30} required value={Number.isNaN(form.floor) ? "" : form.floor} onChange={(e) => setForm({ ...form, floor: e.target.valueAsNumber })} /></label>
        <label><span className="label">Seats</span><input className="input" type="number" min={1} max={10000} required value={Number.isNaN(form.capacity) ? "" : form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.valueAsNumber })} /></label>
        <label><span className="label">Room type</span><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Room["type"] })}>
          <option value="theory">Classroom</option><option value="lab">Lab</option>
        </select></label>
      </div>
      <div className="mt-4 flex gap-2"><button className="btn-primary" disabled={save.isPending}>{form.id ? "Save changes" : "Add room"}</button>
        {form.id && <button type="button" className="btn-ghost" onClick={() => { setForm(empty); save.reset(); }}>Cancel</button>}</div>
    </form>
    {isPending && <p className="text-muted">Loading rooms…</p>}
    {rooms && <div className="card overflow-x-auto"><table className="w-full border-collapse">
      <thead><tr><th className="th">Room</th><th className="th">Floor</th><th className="th">Type</th><th className="th">Seats</th><th className="th"><span className="sr-only">Edit</span></th></tr></thead>
      <tbody>{rooms.map((room) => <tr key={room.id} className="border-t border-line">
        <td className="td font-mono font-semibold">{room.number}</td><td className="td">{room.floor === 0 ? "Ground" : room.floor}</td>
        <td className="td">{room.type === "lab" ? "Lab" : "Classroom"}</td><td className="td font-mono">{room.capacity}</td>
        <td className="td text-right"><button type="button" className="btn-ghost" aria-label={`Edit room ${room.number}`} onClick={() => {
          setMessage(""); save.reset(); setForm(room); window.scrollTo({ top: 0 });
        }}>Edit</button></td>
      </tr>)}</tbody>
    </table></div>}
  </div>;
}
