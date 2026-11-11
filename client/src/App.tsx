import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Teachers from "./pages/Teachers";
import Availability from "./pages/Availability";
import Subjects from "./pages/Subjects";
import Classes from "./pages/Classes";
import UnifiedSetup from "./pages/UnifiedSetup";
import MasterRoutine from "./pages/MasterRoutine";
import ByClass from "./pages/ByClass";
import ByTeacher from "./pages/ByTeacher";
import Validation from "./pages/Validation";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "teachers", element: <Teachers /> },
      { path: "teachers/:id/availability", element: <Availability /> },
      { path: "subjects", element: <Subjects /> },
      { path: "classes", element: <Classes /> },
      { path: "setup", element: <UnifiedSetup /> },
      // v2.4: ONE setup — the old guided/wizard URLs land on it.
      { path: "setup/wizard", element: <Navigate to="/setup" replace /> },
      { path: "setup/guided", element: <Navigate to="/setup" replace /> },
      { path: "routine", element: <MasterRoutine /> },
      { path: "routine/by-class", element: <ByClass /> },
      { path: "routine/by-teacher", element: <ByTeacher /> },
      { path: "validation", element: <Validation /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
