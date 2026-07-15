import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./lib/auth";
import Layout from "./components/Layout";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import Numbers from "./pages/Numbers";
import Campaigns from "./pages/Campaigns";
import CallLogs from "./pages/CallLogs";
import LiveCalls from "./pages/LiveCalls";
import Billing from "./pages/Billing";

import Buyers from "./pages/Buyers";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminNumbers from "./pages/admin/Numbers";
import AdminCustomers from "./pages/admin/Customers";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="numbers" element={<Numbers />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="live-calls" element={<LiveCalls />} />
        <Route path="call-logs" element={<CallLogs />} />
        <Route path="billing" element={<Billing />} />

        <Route path="buyers" element={<Buyers />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/numbers" element={<AdminNumbers />} />
        <Route path="admin/customers" element={<AdminCustomers />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
