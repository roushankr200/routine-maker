"""Solver tests — run: python -m pytest tests/ -q  (or unittest)."""
import os, sys, unittest
from collections import Counter, defaultdict
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__) + "/..")
from solver import solve
import sqlite3, tempfile
import db as dbmod
from seed import load_demo


def demo_data_via_db():
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False); tmp.close()
    dbmod.DB_PATH = tmp.name
    dbmod.init_db()
    conn = dbmod.get_conn(); load_demo(conn)
    data = dbmod.load_solver_data(conn); conn.close()
    return data


class TestDemoSolvesClean(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.teachers, cls.subjects, cls.cs, cls.cfg = demo_data_via_db()
        cls.result = solve(cls.teachers, cls.subjects, cls.cs, cls.cfg, time_limit=10)
        cls.entries = cls.result.entries()

    def test_full_placement(self):
        self.assertTrue(self.result.success, f"unplaced: {self.result.unplaced}")
        total = sum(c["hours"] for c in self.cs)
        self.assertEqual(len(self.entries), total)

    def test_no_h1_teacher_clash(self):
        seen = Counter((e["teacher_id"], e["day"], e["period"]) for e in self.entries)
        self.assertTrue(all(v == 1 for v in seen.values()))

    def test_no_h2_class_clash(self):
        seen = Counter((e["class_id"], e["day"], e["period"]) for e in self.entries)
        self.assertTrue(all(v == 1 for v in seen.values()))

    def test_h3_daily_and_h4_weekly_limits(self):
        day = Counter((e["teacher_id"], e["day"]) for e in self.entries)
        week = Counter(e["teacher_id"] for e in self.entries)
        for tid, t in self.teachers.items():
            self.assertLessEqual(week.get(tid, 0), t["weekly_hours"])
            for d in self.cfg["days"]:
                self.assertLessEqual(day.get((tid, d), 0), t["max_per_day"])

    def test_h5_exact_hours_per_class_subject(self):
        got = Counter((e["class_id"], e["subject_id"]) for e in self.entries)
        for c in self.cs:
            self.assertEqual(got[(c["class_id"], c["subject_id"])], c["hours"])

    def test_h6_eligibility_and_h7_unavailable(self):
        for e in self.entries:
            t = self.teachers[e["teacher_id"]]
            self.assertIn(e["subject_id"], t["subjects"])
            self.assertNotIn((e["day"], e["period"]), t["unavailable"])
            self.assertNotIn((e["day"], None), t["unavailable"])

    def test_h8_lab_continuity_no_lunch_span(self):
        labs = [sid for sid, s in self.subjects.items() if s["type"] == "lab"]
        by = defaultdict(list)
        for e in self.entries:
            if e["subject_id"] in labs:
                by[(e["class_id"], e["subject_id"], e["day"])].append(e)
        # Every lab day-group must partition into consecutive pairs with same teacher,
        # and no pair may span lunch (periods lunch_after & lunch_after+1 together).
        lunch = self.cfg["lunch_after"]
        for key, es in by.items():
            self.assertEqual(len(es) % 2, 0, f"odd lab periods {key}")
            periods = sorted(e["period"] for e in es)
            # check pairs formed by solver blocks: group by teacher+consecutiveness greedily
            used = set()
            for e in sorted(es, key=lambda x: x["period"]):
                if e["period"] in used: continue
                nxt = [x for x in es if x["period"] == e["period"] + 1 and x["teacher_id"] == e["teacher_id"]]
                self.assertTrue(nxt, f"lab period {e} has no consecutive partner")
                self.assertFalse(lunch is not None and e["period"] == lunch, "lab spans lunch")
                used.add(e["period"]); used.add(e["period"] + 1)


class TestImpossibleReportsUnplaced(unittest.TestCase):
    def test_overloaded_subject(self):
        teachers = {1: {"id": 1, "name": "Solo", "max_per_day": 1, "weekly_hours": 2, "subjects": {1}, "unavailable": set()}}
        subjects = {1: {"id": 1, "name": "X", "code": "X1", "type": "theory"}}
        cs = [{"class_id": 1, "subject_id": 1, "hours": 10}]
        cfg = {"days": ["Monday", "Tuesday"], "periods_per_day": 3, "lunch_after": None}
        r = solve(teachers, subjects, cs, cfg, time_limit=5)
        self.assertFalse(r.success); self.assertTrue(r.unplaced)


if __name__ == "__main__":
    unittest.main()
