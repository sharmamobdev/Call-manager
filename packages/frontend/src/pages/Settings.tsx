import { useAuthStore } from "../lib/auth";
import { User, Shield, Bell } from "lucide-react";

export default function Settings() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-[#1985A1]" />
            <h3 className="text-lg font-semibold text-gray-800">Profile</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Email</label>
              <p className="text-sm text-gray-800">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Display Name</label>
              <p className="text-sm text-gray-800">{user?.displayName || "Not set"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Role</label>
              <p className="text-sm text-gray-800 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-[#1985A1]" />
            <h3 className="text-lg font-semibold text-gray-800">Two-Factor Authentication</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Add an extra layer of security to your account by enabling 2FA.
          </p>
          <button className="px-4 py-2 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81]">
            Set Up 2FA
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-[#1985A1]" />
            <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
          </div>
          <p className="text-sm text-gray-500">
            Notification preferences are coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
