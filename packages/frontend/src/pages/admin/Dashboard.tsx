import { useQuery } from "@tanstack/react-query";
import api from "../../lib/api";
import { Building2, Users, Phone, PhoneCall } from "lucide-react";

export default function AdminDashboard() {
  const { data } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get("/admin/stats").then((r) => r.data),
  });

  const stats = [
    { label: "Organizations", value: data?.organizations ?? 0, icon: Building2, color: "text-blue-600 bg-blue-100" },
    { label: "Users", value: data?.users ?? 0, icon: Users, color: "text-green-600 bg-green-100" },
    { label: "Numbers", value: data?.numbers ?? 0, icon: Phone, color: "text-purple-600 bg-purple-100" },
    { label: "CDRs", value: data?.cdrs ?? 0, icon: PhoneCall, color: "text-orange-600 bg-orange-100" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${s.color}`}>
                <s.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
