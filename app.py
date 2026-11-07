"""Routine Maker — Flask app. Run: python app.py  |  Production: gunicorn app:app"""
import csv, io, os, time
from flask import Flask, g, render_template, request, redirect, url_for, flash, Response, abort
import db as dbmod
from db import get_conn, get_config, set_config, class_name, load_solver_data, validate_data, init_db
from solver import solve
from seed import load_demo

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "routine-maker-dev-key")

# Auto-init DB on fresh deploy (Render etc.) — creates file + tables if missing.
init_db()

def conn():
    if "db" not in g:
        g.db = get_conn()
    return g.db

@app.teardown_appcontext
def close_db(exc):
    c = g.pop("db", None)
    if c: c.close()

@app.context_processor
def inject_cfg():
    try: return {"cfg": get_config(conn())}
    except Exception: return {"cfg": {"days": [], "periods_per_day": 7, "lunch_after": 4}}

def rows(sql, args=()):
    return conn().execute(sql, args).fetchall()

def check_entry(c, entry_id, class_id, day, period, subject_id, teacher_id, exclude_lab_pair=False):
    """Validate one (or a lab pair) placement against H1-H8. Returns reason or None."""
    cfg = get_config(c)
    teacher = c.execute("SELECT * FROM teacher WHERE id=?", (teacher_id,)).fetchone()
    if not teacher: return "Teacher not found."
    subject = c.execute("SELECT * FROM subject WHERE id=?", (subject_id,)).fetchone()
    if not subject: return "Subject not found."
    if not c.execute("SELECT 1 FROM teacher_subject WHERE teacher_id=? AND subject_id=?", (teacher_id, subject_id)).fetchone():
        return f"{teacher['name']} cannot teach {subject['name']} (H6)."
    if c.execute("SELECT 1 FROM teacher_unavailable WHERE teacher_id=? AND day=? AND period=?", (teacher_id, day, period)).fetchone():
        return f"{teacher['name']} is unavailable at {day} P{period} (H7)."
    # How many periods does this move occupy? (lab pair detection by caller via group)
    clash_t = c.execute("SELECT r.*, cs.program, cs.year FROM routine_entry r JOIN class_section cs ON cs.id=r.class_id WHERE r.teacher_id=? AND r.day=? AND r.period=? AND r.id!=?", (teacher_id, day, period, entry_id)).fetchone()
    if clash_t: return f"{teacher['name']} already teaches {clash_t['program']} {clash_t['year']} at {day} P{period} (H1)."
    clash_c = c.execute("SELECT 1 FROM routine_entry WHERE class_id=? AND day=? AND period=? AND id!=?", (class_id, day, period, entry_id)).fetchone()
    if clash_c: return f"Class already has a period at {day} P{period} (H2)."
    day_count = c.execute("SELECT COUNT(*) FROM routine_entry WHERE teacher_id=? AND day=? AND id!=?", (teacher_id, day, entry_id)).fetchone()[0]
    if day_count + 1 > teacher["max_per_day"]: return f"{teacher['name']} would exceed max/day {teacher['max_per_day']} (H3)."
    week_count = c.execute("SELECT COUNT(*) FROM routine_entry WHERE teacher_id=? AND id!=?", (teacher_id, entry_id)).fetchone()[0]
    if week_count + 1 > teacher["weekly_hours"]: return f"{teacher['name']} would exceed weekly hours {teacher['weekly_hours']} (H4)."
    return None

# ---------------- Dashboard ----------------
@app.route("/")
def dashboard():
    c = conn()
    stats = {k: c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for k, t in
             [("teachers","teacher"),("subjects","subject"),("classes","class_section"),("entries","routine_entry")]}
    issues, warnings, _ = validate_data(c)
    last = c.execute("SELECT COUNT(*) n FROM routine_entry").fetchone()["n"]
    return render_template("dashboard.html", stats=stats, issues=issues, warnings=warnings, has_routine=last>0)

@app.route("/seed", methods=["POST"])
def seed():
    load_demo(conn()); flash("MCA demo data loaded: 9 teachers, 9 subjects, 3 classes. Now click Generate Routine."); return redirect(url_for("dashboard"))

@app.route("/clear-routine", methods=["POST"])
def clear_routine():
    conn().execute("DELETE FROM routine_entry"); conn().commit(); flash("Routine cleared."); return redirect(url_for("dashboard"))

# ---------------- Teachers (FR1, FR5) ----------------
@app.route("/teachers")
def teachers():
    ts = rows("SELECT * FROM teacher ORDER BY name")
    subs = rows("SELECT * FROM subject ORDER BY code")
    tsubs = {}
    for t in ts:
        tsubs[t["id"]] = [r[0] for r in conn().execute("SELECT subject_id FROM teacher_subject WHERE teacher_id=?", (t["id"],))]
    return render_template("teachers.html", teachers=ts, subjects=subs, tsubs=tsubs)

@app.route("/teachers/save", methods=["POST"])
def teacher_save():
    c = conn(); tid = request.form.get("id")
    name, desig = request.form["name"].strip(), request.form.get("designation","")
    mx, wk = int(request.form["max_per_day"]), int(request.form["weekly_hours"])
    if tid:
        c.execute("UPDATE teacher SET name=?,designation=?,max_per_day=?,weekly_hours=? WHERE id=?", (name, desig, mx, wk, tid))
        c.execute("DELETE FROM teacher_subject WHERE teacher_id=?", (tid,))
    else:
        tid = c.execute("INSERT INTO teacher(name,designation,max_per_day,weekly_hours) VALUES(?,?,?,?)", (name, desig, mx, wk)).lastrowid
    for sid in request.form.getlist("subjects"):
        c.execute("INSERT OR IGNORE INTO teacher_subject VALUES(?,?)", (tid, int(sid)))
    c.commit(); flash("Teacher saved."); return redirect(url_for("teachers"))

@app.route("/teachers/<int:tid>/delete", methods=["POST"])
def teacher_delete(tid):
    conn().execute("DELETE FROM teacher WHERE id=?", (tid,)); conn().commit(); flash("Teacher deleted."); return redirect(url_for("teachers"))

@app.route("/teachers/<int:tid>/availability", methods=["GET","POST"])
def availability(tid):
    c = conn(); t = c.execute("SELECT * FROM teacher WHERE id=?", (tid,)).fetchone() or abort(404)
    cfg = get_config(c)
    if request.method == "POST":
        c.execute("DELETE FROM teacher_unavailable WHERE teacher_id=?", (tid,))
        for key in request.form.getlist("blocked"):
            day, period = key.rsplit(":", 1)
            c.execute("INSERT OR IGNORE INTO teacher_unavailable VALUES(?,?,?)", (tid, day, int(period)))
        c.commit(); flash(f"Availability saved for {t['name']}."); return redirect(url_for("teachers"))
    blocked = {(r[0], r[1]) for r in c.execute("SELECT day,period FROM teacher_unavailable WHERE teacher_id=?", (tid,))}
    return render_template("availability.html", teacher=t, cfg=cfg, blocked=blocked)

# ---------------- Subjects (FR2) ----------------
@app.route("/subjects")
def subjects():
    return render_template("subjects.html", subjects=rows("SELECT * FROM subject ORDER BY code"))

@app.route("/subjects/save", methods=["POST"])
def subject_save():
    c = conn(); sid = request.form.get("id")
    if sid: c.execute("UPDATE subject SET name=?,code=?,type=? WHERE id=?", (request.form["name"], request.form["code"], request.form["type"], sid))
    else: c.execute("INSERT INTO subject(name,code,type) VALUES(?,?,?)", (request.form["name"], request.form["code"], request.form["type"]))
    c.commit(); flash("Subject saved."); return redirect(url_for("subjects"))

@app.route("/subjects/<int:sid>/delete", methods=["POST"])
def subject_delete(sid):
    conn().execute("DELETE FROM subject WHERE id=?", (sid,)); conn().commit(); flash("Subject deleted."); return redirect(url_for("subjects"))

# ---------------- Classes (FR3) ----------------
@app.route("/classes")
def classes():
    cs = rows("SELECT * FROM class_section ORDER BY program, year")
    out = []
    for cl in cs:
        reqs = rows("SELECT cs.hours, s.name, s.code, s.type, s.id sid FROM class_subject cs JOIN subject s ON s.id=cs.subject_id WHERE cs.class_id=? ORDER BY s.code", (cl["id"],))
        out.append({"row": cl, "name": class_name(cl), "reqs": reqs, "total": sum(r["hours"] for r in reqs)})
    return render_template("classes.html", classes=out, subjects=rows("SELECT * FROM subject ORDER BY code"))

@app.route("/classes/save", methods=["POST"])
def class_save():
    c = conn(); cid = request.form.get("id")
    if cid: c.execute("UPDATE class_section SET program=?,year=?,section=? WHERE id=?", (request.form["program"], request.form["year"], request.form.get("section",""), cid))
    else: c.execute("INSERT INTO class_section(program,year,section) VALUES(?,?,?)", (request.form["program"], request.form["year"], request.form.get("section","")))
    c.commit(); flash("Class saved."); return redirect(url_for("classes"))

@app.route("/classes/<int:cid>/delete", methods=["POST"])
def class_delete(cid):
    conn().execute("DELETE FROM class_section WHERE id=?", (cid,)); conn().commit(); flash("Class deleted."); return redirect(url_for("classes"))

@app.route("/classes/<int:cid>/subject", methods=["POST"])
def class_subject_save(cid):
    c = conn(); sid, hrs = int(request.form["subject_id"]), int(request.form["hours"])
    c.execute("INSERT INTO class_subject VALUES(?,?,?) ON CONFLICT(class_id,subject_id) DO UPDATE SET hours=excluded.hours", (cid, sid, hrs))
    c.commit(); flash("Class subject hours saved."); return redirect(url_for("classes"))

@app.route("/classes/<int:cid>/subject/<int:sid>/delete", methods=["POST"])
def class_subject_delete(cid, sid):
    conn().execute("DELETE FROM class_subject WHERE class_id=? AND subject_id=?", (cid, sid)); conn().commit(); return redirect(url_for("classes"))

# ---------------- Setup (FR4) ----------------
@app.route("/setup", methods=["GET","POST"])
def setup():
    c = conn(); cfg = get_config(c)
    if request.method == "POST":
        days = [d.strip() for d in request.form["days"].split(",") if d.strip()]
        lunch = request.form.get("lunch_after"); lunch = int(lunch) if lunch else None
        set_config(c, days, int(request.form["periods_per_day"]), lunch, int(request.form.get("period_duration", 50)))
        c.commit(); flash("Time structure saved. Existing routine was cleared (grid changed)."); return redirect(url_for("setup"))
    return render_template("setup.html", cfg=cfg, days_str=", ".join(cfg["days"]))

# ---------------- Generate (FR6) ----------------
@app.route("/generate", methods=["POST"])
def generate():
    c = conn(); teachers, subjects, cs, cfg = load_solver_data(c)
    t0 = time.time(); result = solve(teachers, subjects, cs, cfg, time_limit=10.0); elapsed = time.time()-t0
    c.execute("DELETE FROM routine_entry")
    for e in result.entries():
        c.execute("INSERT INTO routine_entry(class_id,subject_id,teacher_id,day,period) VALUES(?,?,?,?,?)",
                  (e["class_id"], e["subject_id"], e["teacher_id"], e["day"], e["period"]))
    c.commit()
    total_periods = sum(r["hours"] for r in [{"hours": x["hours"]} for x in cs])
    placed_periods = len(result.entries())
    if result.success:
        flash(f"✅ Routine generated: {placed_periods}/{total_periods} periods placed ({len(result.placements)}/{result.total_jobs} jobs) in {elapsed:.2f}s, search nodes {result.nodes}. Zero hard-rule violations.")
    else:
        msgs = "; ".join(f"class {u['class_id']} subject {subjects[u['subject_id']]['name']}: {u['reason']}" for u in result.unplaced[:5])
        flash(f"⚠️ Partial: {placed_periods}/{total_periods} periods placed in {elapsed:.2f}s. Unplaced: {msgs}")
    return redirect(url_for("routine_master"))

# ---------------- Views (FR7) ----------------
def grid_for(filter_sql="", args=()):
    c = conn(); cfg = get_config(c)
    entries = rows(f"""SELECT r.*, s.name sname, s.code scode, s.type stype, t.name tname, cs.program, cs.year, cs.section
                       FROM routine_entry r JOIN subject s ON s.id=r.subject_id JOIN teacher t ON t.id=r.teacher_id
                       JOIN class_section cs ON cs.id=r.class_id {filter_sql}""", args)
    return cfg, entries

@app.route("/routine")
def routine_master():
    cfg, entries = grid_for()
    classes = rows("SELECT * FROM class_section ORDER BY program, year")
    by = {}
    for e in entries: by[(e["class_id"], e["day"], e["period"])] = e
    return render_template("routine_master.html", cfg=cfg, classes=classes, by=by, class_name=class_name, entries=entries)

@app.route("/routine/class/<int:cid>")
def routine_class(cid):
    c = conn(); cl = c.execute("SELECT * FROM class_section WHERE id=?", (cid,)).fetchone() or abort(404)
    cfg, entries = grid_for("WHERE r.class_id=?", (cid,))
    by = {(e["day"], e["period"]): e for e in entries}
    return render_template("routine_class.html", cfg=cfg, cl=cl, name=class_name(cl), by=by)

@app.route("/routine/teacher/<int:tid>")
def routine_teacher(tid):
    c = conn(); t = c.execute("SELECT * FROM teacher WHERE id=?", (tid,)).fetchone() or abort(404)
    cfg, entries = grid_for("WHERE r.teacher_id=?", (tid,))
    by = {(e["day"], e["period"]): e for e in entries}
    daily = {d: sum(1 for e in entries if e["day"]==d) for d in cfg["days"]}
    return render_template("routine_teacher.html", cfg=cfg, teacher=t, by=by, daily=daily, total=len(entries),
                           all_teachers=rows("SELECT * FROM teacher ORDER BY name"))

@app.route("/routine/teachers")
def routine_teachers_index():
    ts = rows("SELECT * FROM teacher ORDER BY name")
    if ts: return redirect(url_for("routine_teacher", tid=ts[0]["id"]))
    flash("No teachers yet."); return redirect(url_for("dashboard"))

# ---------------- Manual edit / swap (FR8) ----------------
@app.route("/routine/move", methods=["POST"])
def routine_move():
    """Move one entry to a new day/period (form on master view). Validates first."""
    c = conn(); eid = int(request.form["entry_id"]); day = request.form["day"]; period = int(request.form["period"])
    e = c.execute("SELECT * FROM routine_entry WHERE id=?", (eid,)).fetchone() or abort(404)
    reason = check_entry(c, eid, e["class_id"], day, period, e["subject_id"], e["teacher_id"])
    if reason: flash(f"❌ Move rejected: {reason}"); return redirect(url_for("routine_master"))
    c.execute("UPDATE routine_entry SET day=?,period=? WHERE id=?", (day, period, eid)); c.commit()
    flash("✅ Move applied — no rule broken."); return redirect(url_for("routine_master"))

@app.route("/routine/swap", methods=["POST"])
def routine_swap():
    """Swap day/period of two entries of the SAME class (keeps H2/H5; checks teacher rules)."""
    c = conn(); a_id, b_id = int(request.form["entry_a"]), int(request.form["entry_b"])
    a = c.execute("SELECT * FROM routine_entry WHERE id=?", (a_id,)).fetchone(); b = c.execute("SELECT * FROM routine_entry WHERE id=?", (b_id,)).fetchone()
    if not a or not b: flash("❌ Swap rejected: entry not found."); return redirect(url_for("routine_master"))
    if a["class_id"] != b["class_id"]: flash("❌ Swap rejected: swap is supported within the same class (use Move for single entries)."); return redirect(url_for("routine_master"))
    # Temporarily lift both, validate each in the other's slot, restore on failure.
    a_slot, b_slot = (a["day"], a["period"]), (b["day"], b["period"])
    c.execute("UPDATE routine_entry SET day='__tmp__',period=-1 WHERE id=?", (a_id,))
    c.execute("UPDATE routine_entry SET day='__tmp__',period=-2 WHERE id=?", (b_id,))
    r1 = check_entry(c, a_id, a["class_id"], b_slot[0], b_slot[1], a["subject_id"], a["teacher_id"])
    r2 = None
    if not r1:
        c.execute("UPDATE routine_entry SET day=?,period=? WHERE id=?", (b_slot[0], b_slot[1], a_id))
        r2 = check_entry(c, b_id, b["class_id"], a_slot[0], a_slot[1], b["subject_id"], b["teacher_id"])
    if r1 or r2:
        c.execute("UPDATE routine_entry SET day=?,period=? WHERE id=?", (a_slot[0], a_slot[1], a_id))
        c.execute("UPDATE routine_entry SET day=?,period=? WHERE id=?", (b_slot[0], b_slot[1], b_id))
        c.commit(); flash(f"❌ Swap rejected: {r1 or r2}"); return redirect(url_for("routine_master"))
    c.execute("UPDATE routine_entry SET day=?,period=? WHERE id=?", (a_slot[0], a_slot[1], b_id)); c.commit()
    flash("✅ Swap applied — no rule broken."); return redirect(url_for("routine_master"))

# ---------------- Validation (FR10) ----------------
@app.route("/validation")
def validation():
    issues, warnings, detail = validate_data(conn())
    teachers, subjects, cs, cfg = load_solver_data(conn())
    demand = {}
    for r in cs: demand[r["subject_id"]] = demand.get(r["subject_id"], 0) + r["hours"]
    report = []
    for sid, d in sorted(demand.items(), key=lambda x: subjects[x[0]]["code"]):
        elig = [t for t in teachers.values() if sid in t["subjects"]]
        report.append({"subject": subjects[sid], "demand": d, "capacity": sum(t["weekly_hours"] for t in elig),
                       "teachers": ", ".join(t["name"] for t in elig) or "—"})
    placed = {}
    for r in rows("SELECT subject_id, COUNT(*) n FROM routine_entry GROUP BY subject_id"): placed[r["subject_id"]] = r["n"]
    return render_template("validation.html", issues=issues, warnings=warnings, report=report, placed=placed)

# ---------------- Export (FR9) ----------------
def csv_response(filename, header, data_rows):
    buf = io.StringIO(); w = csv.writer(buf); w.writerow(header); w.writerows(data_rows)
    return Response(buf.getvalue(), mimetype="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})

@app.route("/export/master.csv")
def export_master():
    cfg, entries = grid_for()
    classes = rows("SELECT * FROM class_section ORDER BY program, year")
    by = {(e["class_id"], e["day"], e["period"]): e for e in entries}
    out = []
    for cl in classes:
        for d in cfg["days"]:
            row = [class_name(cl), d]
            for p in range(1, cfg["periods_per_day"]+1):
                e = by.get((cl["id"], d, p)); row.append(f"{e['scode']} ({e['tname']})" if e else "")
                if cfg["lunch_after"] == p: row.append("LUNCH")
            out.append(row)
    header = ["Class", "Day"] + [x for p in range(1, cfg["periods_per_day"]+1) for x in ([f"P{p}"] + (["Break"] if cfg["lunch_after"]==p else []))]
    return csv_response("master_routine.csv", header, out)

@app.route("/export/class/<int:cid>.csv")
def export_class(cid):
    c = conn(); cl = c.execute("SELECT * FROM class_section WHERE id=?", (cid,)).fetchone() or abort(404)
    cfg, entries = grid_for("WHERE r.class_id=?", (cid,)); by = {(e["day"], e["period"]): e for e in entries}
    out = [[d] + [ (f"{by[(d,p)]['scode']} ({by[(d,p)]['tname']})" if (d,p) in by else "") for p in range(1, cfg["periods_per_day"]+1)] for d in cfg["days"]]
    return csv_response(f"routine_class_{cid}.csv", ["Day"]+[f"P{p}" for p in range(1, cfg["periods_per_day"]+1)], out)

@app.route("/export/teacher/<int:tid>.csv")
def export_teacher(tid):
    c = conn(); t = c.execute("SELECT * FROM teacher WHERE id=?", (tid,)).fetchone() or abort(404)
    cfg, entries = grid_for("WHERE r.teacher_id=?", (tid,)); by = {(e["day"], e["period"]): e for e in entries}
    out = [[d] + [ (f"{by[(d,p)]['scode']} ({by[(d,p)]['program']} {by[(d,p)]['year']})" if (d,p) in by else "") for p in range(1, cfg["periods_per_day"]+1)] for d in cfg["days"]]
    return csv_response(f"routine_teacher_{tid}.csv", ["Day"]+[f"P{p}" for p in range(1, cfg["periods_per_day"]+1)], out)

@app.route("/print/class/<int:cid>")
def print_class(cid):
    return routine_class(cid)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
