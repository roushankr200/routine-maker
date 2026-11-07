"""One-click MCA demo data — designed to be solvable (verified by tests).

Load split: each subject has exactly 2 eligible teachers; total demand
86 periods vs 148 combined weekly capacity, classes fill 28-30 of 42
weekly slots, so the solver has real constraints but real slack.
"""
from db import get_config, rebuild_time_slots
import json

SUBJECTS = [
    ("Database Management Systems", "CA501", "theory"),
    ("Operating Systems", "CA502", "theory"),
    ("Java Programming", "CA503", "theory"),
    ("Data Structures & Algorithms", "CA504", "theory"),
    ("Computer Networks", "CA505", "theory"),
    ("Machine Learning", "CA506", "theory"),
    ("Web Technologies", "CA507", "theory"),
    ("DBMS Lab", "CA591", "lab"),
    ("Java Lab", "CA592", "lab"),
]
# name, designation, max/day, weekly, [subject codes]
TEACHERS = [
    ("Dr. Anil Sharma", "Professor", 4, 18, ["CA501", "CA591"]),
    ("Dr. Priya Singh", "Associate Professor", 4, 18, ["CA502", "CA504"]),
    ("Prof. Rahul Verma", "Assistant Professor", 4, 18, ["CA503", "CA592"]),
    ("Dr. Sneha Patel", "Assistant Professor", 4, 16, ["CA505", "CA502"]),
    ("Prof. Vikram Das", "Assistant Professor", 4, 16, ["CA504", "CA506"]),
    ("Dr. Kavita Rao", "Associate Professor", 4, 16, ["CA506", "CA501"]),
    ("Prof. Arjun Mehta", "Assistant Professor", 4, 16, ["CA507", "CA503"]),
    ("Dr. Neha Gupta", "Assistant Professor", 4, 16, ["CA507", "CA505"]),
    ("Prof. Rohit Kumar", "Assistant Professor", 4, 14, ["CA592", "CA591"]),
]
CLASSES = [
    ("MCA", "Sem 1", ""), ("MCA", "Sem 3", ""), ("MCA", "Sem 5", ""),
]
# class index -> {code: hours}
CLASS_SUBJECTS = [
    {"CA504": 4, "CA503": 4, "CA502": 4, "CA501": 4, "CA505": 3, "CA507": 3, "CA592": 4, "CA591": 2},  # 28
    {"CA504": 3, "CA503": 3, "CA502": 3, "CA501": 4, "CA506": 4, "CA505": 4, "CA507": 3, "CA592": 2, "CA591": 4},  # 30
    {"CA506": 5, "CA505": 3, "CA502": 3, "CA501": 3, "CA507": 4, "CA503": 3, "CA504": 3, "CA592": 2, "CA591": 2},  # 28
]
# teacher name -> [(day, period or None)]
UNAVAILABLE = {
    "Prof. Rohit Kumar": [("Saturday", None)],
    "Dr. Priya Singh": [("Monday", 1)],
    "Dr. Anil Sharma": [("Wednesday", 7)],
}

def load_demo(conn):
    for tbl in ["routine_entry", "teacher_unavailable", "teacher_subject", "class_subject", "teacher", "subject", "class_section"]:
        conn.execute(f"DELETE FROM {tbl}")
    cfg_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    conn.execute("UPDATE config SET days=?, periods_per_day=7, lunch_after=4, period_duration=50 WHERE id=1", (json.dumps(cfg_days),))
    rebuild_time_slots(conn, {"days": cfg_days, "periods_per_day": 7})
    code_to_id = {}
    for name, code, typ in SUBJECTS:
        cur = conn.execute("INSERT INTO subject(name,code,type) VALUES(?,?,?)", (name, code, typ))
        code_to_id[code] = cur.lastrowid
    name_to_id = {}
    for name, desig, mx, wk, codes in TEACHERS:
        cur = conn.execute("INSERT INTO teacher(name,designation,max_per_day,weekly_hours) VALUES(?,?,?,?)", (name, desig, mx, wk))
        tid = cur.lastrowid; name_to_id[name] = tid
        for c in codes:
            conn.execute("INSERT INTO teacher_subject VALUES(?,?)", (tid, code_to_id[c]))
    class_ids = []
    for prog, yr, sec in CLASSES:
        cur = conn.execute("INSERT INTO class_section(program,year,section) VALUES(?,?,?)", (prog, yr, sec))
        class_ids.append(cur.lastrowid)
    for idx, mapping in enumerate(CLASS_SUBJECTS):
        for code, hrs in mapping.items():
            conn.execute("INSERT INTO class_subject VALUES(?,?,?)", (class_ids[idx], code_to_id[code], hrs))
    for tname, slots in UNAVAILABLE.items():
        for day, period in slots:
            if period is None:
                for p in range(1, 8):
                    conn.execute("INSERT OR IGNORE INTO teacher_unavailable VALUES(?,?,?)", (name_to_id[tname], day, p))
            else:
                conn.execute("INSERT OR IGNORE INTO teacher_unavailable VALUES(?,?,?)", (name_to_id[tname], day, period))
    conn.commit()
