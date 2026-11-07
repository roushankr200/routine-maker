import { NavLink, Outlet } from "react-router-dom";
import {
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Settings2,
  UserRound,
  Users,
} from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/teachers", label: "Teachers", icon: Users },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/classes", label: "Classes", icon: GraduationCap },
  { to: "/setup", label: "Setup", icon: Settings2 },
  { to: "/routine", label: "Master Routine", icon: CalendarRange },
  { to: "/routine/by-class", label: "By Class", icon: GraduationCap },
  { to: "/routine/by-teacher", label: "By Teacher", icon: UserRound },
  { to: "/validation", label: "Validation", icon: ClipboardCheck },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar — Swiss/minimal: white, strong grid lines, teal active state */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="border-b border-line px-5 py-4">
          <div className="font-mono text-lg font-semibold tracking-tight text-primary-dark">
            Routine Maker
          </div>
          <p className="text-xs text-muted">Automatic timetable generator</p>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1 p-3">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[40px] cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-200 ${
                  isActive
                    ? "bg-teal-50 font-semibold text-primary-dark"
                    : "text-ink hover:bg-teal-50/60"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-line px-5 py-3 text-xs text-muted">
          Constraint solver: hardest-first + backtracking · H1–H8 enforced
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top nav */}
        <div className="no-print border-b border-line bg-white px-4 py-3 md:hidden">
          <div className="font-mono font-semibold text-primary-dark">Routine Maker</div>
          <nav aria-label="Main" className="mt-2 flex flex-wrap gap-1">
            {links.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `cursor-pointer rounded-md px-2 py-1 text-xs ${isActive ? "bg-teal-50 font-semibold text-primary-dark" : "text-ink"}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
