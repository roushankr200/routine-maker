import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Teachers from "./pages/Teachers";
import Availability from "./pages/Availability";
import Subjects from "./pages/Subjects";
import Classes from "./pages/Classes";
import Setup from "./pages/Setup";
import DepartmentWizard from "./pages/DepartmentWizard";
import GuidedSetup from "./pages/GuidedSetup";
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
      { path: "setup", element: <Setup /> },
      { path: "setup/wizard", element: <DepartmentWizard /> },
      { path: "setup/guided", element: <GuidedSetup /> },
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
