import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/auth";
import { cn } from "../lib/utils";
import {
  LayoutDashboard, Phone, Megaphone, PhoneCall, Receipt, Radio,
  BarChart3, Users, Settings, LogOut, Menu, X, Satellite,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/numbers", label: "Numbers", icon: Phone },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/buyers", label: "Buyers", icon: Users },
  { href: "/live-calls", label: "Live Calls", icon: Radio },
  { href: "/call-logs", label: "Call Logs", icon: PhoneCall },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNavItems = [
  { href: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
  { href: "/admin/numbers", label: "All Numbers", icon: Phone },
  { href: "/admin/customers", label: "Customers", icon: Users },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/sign-in");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-2 h-16 px-6 border-b border-gray-200">
          <Satellite className="w-6 h-6 text-[#1985A1]" />
          <span className="text-lg font-bold text-gray-800">DialClear</span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#1985A1]/10 text-[#1985A1]"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
          {user?.role === "admin" && (
            <>
              <div className="pt-3 pb-1">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase">Admin</p>
              </div>
              {adminNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[#1985A1]/10 text-[#1985A1]"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 truncate">{user?.displayName || user?.email}</div>
            <button onClick={handleLogout} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-8 gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="text-lg font-semibold text-gray-800">
            {navItems.find((i) => i.href === location.pathname)?.label ||
             adminNavItems.find((i) => i.href === location.pathname)?.label || "Portal"}
          </h1>
        </header>
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
