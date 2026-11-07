"""Database layer — SQLite via stdlib sqlite3. No ORM, no server."""
import json, os, sqlite3
BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("ROUTINE_DB", os.path.join(BASE, "routine.db"))
DEFAULT_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

SCHEMA = """
CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY CHECK(id=1), days TEXT NOT NULL, periods_per_day INTEGER NOT NULL, lunch_after INTEGER, period_duration INTEGER DEFAULT 50);
CREATE TABLE IF NOT EXISTS teacher (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, designation TEXT DEFAULT '', max_per_day INTEGER NOT NULL DEFAULT 4, weekly_hours INTEGER NOT NULL DEFAULT 16);
CREATE TABLE IF NOT EXISTS subject (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('theory','lab')));
CREATE TABLE IF NOT EXISTS class_section (id INTEGER PRIMARY KEY AUTOINCREMENT, program TEXT NOT NULL, year TEXT NOT NULL, section TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS teacher_subject (teacher_id INTEGER REFERENCES teacher(id) ON DELETE CASCADE, subject_id INTEGER REFERENCES subject(id) ON DELETE CASCADE, PRIMARY KEY(teacher_id,subject_id));
CREATE TABLE IF NOT EXISTS class_subject (class_id INTEGER REFERENCES class_section(id) ON DELETE CASCADE, subject_id INTEGER REFERENCES subject(id) ON DELETE CASCADE, hours INTEGER NOT NULL, PRIMARY KEY(class_id,subject_id));
CREATE TABLE IF NOT EXISTS teacher_unavailable (teacher_id INTEGER REFERENCES teacher(id) ON DELETE CASCADE, day TEXT NOT NULL, period INTEGER, PRIMARY KEY(teacher_id,day,period));
CREATE TABLE IF NOT EXISTS time_slot (day TEXT NOT NULL, period INTEGER NOT NULL, is_break INTEGER DEFAULT 0, PRIMARY KEY(day,period));
CREATE TABLE IF NOT EXISTS routine_entry (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER REFERENCES class_section(id) ON DELETE CASCADE, subject_id INTEGER REFERENCES subject(id) ON DELETE CASCADE, teacher_id INTEGER REFERENCES teacher(id) ON DELETE CASCADE, day TEXT NOT NULL, period INTEGER NOT NULL);
"""

def rebuild_time_slots(conn, cfg):
    conn.execute("DELETE FROM time_slot")
    for d in cfg["days"]:
        for p in range(1, cfg["periods_per_day"]+1):
            conn.execute("INSERT INTO time_slot(day,period,is_break) VALUES(?,?,0)", (d,p))

def init_db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = get_conn()
    conn.executescript(SCHEMA)
    row = conn.execute("SELECT * FROM config WHERE id=1").fetchone()
    if row is None:
        cfg = {"days": DEFAULT_DAYS, "periods_per_day": 7, "lunch_after": 4, "period_duration": 50}
        conn.execute("INSERT INTO config(id,days,periods_per_day,lunch_after,period_duration) VALUES(1,?,?,?,?)",
                     (json.dumps(cfg["days"]), cfg["periods_per_day"], cfg["lunch_after"], cfg["period_duration"]))
        rebuild_time_slots(conn, cfg)
    conn.commit(); conn.close()

def get_config(conn):
    r = conn.execute("SELECT * FROM config WHERE id=1").fetchone()
    return {"days": json.loads(r["days"]), "periods_per_day": r["periods_per_day"],
            "lunch_after": r["lunch_after"], "period_duration": r["period_duration"]}

def set_config(conn, days, periods, lunch_after, duration=50):
    conn.execute("UPDATE config SET days=?,periods_per_day=?,lunch_after=?,period_duration=? WHERE id=1",
                 (json.dumps(days), periods, lunch_after, duration))
    rebuild_time_slots(conn, {"days": days, "periods_per_day": periods})
    conn.execute("DELETE FROM routine_entry")  # grid changed -> routine invalid

def class_name(row):
    s = f" {row['section']}" if row["section"] else ""
    return f"{row['program']} {row['year']}{s}".strip()

def load_solver_data(conn):
    teachers, subjects = {}, {}
    for r in conn.execute("SELECT * FROM teacher"):
        subs = {x[0] for x in conn.execute("SELECT subject_id FROM teacher_subject WHERE teacher_id=?", (r["id"],))}
        unav = {(x[0], x[1]) for x in conn.execute("SELECT day,period FROM teacher_unavailable WHERE teacher_id=?", (r["id"],))}
        teachers[r["id"]] = {"id": r["id"], "name": r["name"], "max_per_day": r["max_per_day"],
                             "weekly_hours": r["weekly_hours"], "subjects": subs, "unavailable": unav}
    for r in conn.execute("SELECT * FROM subject"):
        subjects[r["id"]] = {"id": r["id"], "name": r["name"], "code": r["code"], "type": r["type"]}
    cs = [{"class_id": r["class_id"], "subject_id": r["subject_id"], "hours": r["hours"]}
          for r in conn.execute("SELECT * FROM class_subject")]
    return teachers, subjects, cs, get_config(conn)

def validate_data(conn):
    teachers, subjects, cs, cfg = load_solver_data(conn)
    issues, warnings = [], []
    slots_per_week = len(cfg["days"]) * cfg["periods_per_day"]
    demand_by_subject, demand_by_class = {}, {}
    for row in cs:
        demand_by_subject[row["subject_id"]] = demand_by_subject.get(row["subject_id"], 0) + row["hours"]
        demand_by_class[row["class_id"]] = demand_by_class.get(row["class_id"], 0) + row["hours"]
        if subjects[row["subject_id"]]["type"] == "lab" and row["hours"] % 2:
            issues.append(f"{subjects[row['subject_id']]['name']}: lab hours must be even (2-period blocks), got {row['hours']} for one class.")
    for sid, demand in demand_by_subject.items():
        eligible = [t for t in teachers.values() if sid in t["subjects"]]
        if not eligible:
            issues.append(f"{subjects[sid]['name']} needs {demand} periods/week but NO teacher can teach it (H6).")
        else:
            cap = sum(t["weekly_hours"] for t in eligible)
            if demand > cap:
                issues.append(f"{subjects[sid]['name']} needs {demand} periods/week but eligible teachers' combined weekly cap is {cap}.")
    classes = {r["id"]: class_name(r) for r in conn.execute("SELECT * FROM class_section")}
    for cid, total in demand_by_class.items():
        if total > slots_per_week:
            issues.append(f"{classes.get(cid,cid)} needs {total} periods but the week only has {slots_per_week} slots.")
    for t in teachers.values():
        if not t["subjects"]:
            warnings.append(f"Teacher {t['name']} has no subjects assigned.")
    if not cs:
        warnings.append("No class-subject hours defined yet — add them on the Classes page or load demo data.")
    return issues, warnings, {"demand_by_subject": demand_by_subject, "demand_by_class": demand_by_class, "slots_per_week": slots_per_week}
