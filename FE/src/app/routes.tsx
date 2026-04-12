import React from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { PatientDetails } from "./pages/PatientDetails";
import { Patients } from "./pages/Patients";
import { Reports } from "./pages/Reports";

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // TODO: Replace with real auth check
  const isLoggedIn = sessionStorage.getItem("isLoggedIn") === "true";

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  // Public routes
  {
    path: "/login",
    element: <Login />,
  },

  // Protected routes (with Layout)
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: Dashboard },
      { path: "history", Component: History },
      { path: "patients", Component: Patients },
      { path: "reports", Component: Reports },
      { path: "patient/:id", Component: PatientDetails },
      {
        path: "settings",
        Component: () => (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-20 text-gray-500">
            <h2 className="text-xl font-medium">Cài đặt hệ thống</h2>
            <p>Tính năng đang được phát triển</p>
          </div>
        ),
      },
    ],
  },
]);
