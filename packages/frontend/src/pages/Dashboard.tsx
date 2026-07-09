import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { formatCurrency } from "../lib/utils";
import { Phone, DollarSign, Activity, Receipt } from "lucide-react";

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary } = useQuery({
    queryKey: ["billing-summary"],
    queryFn: () => api.get("/customer/billing/summary").then((r) => r.data),
  });

  const { data: cdrs } = useQuery({
    queryKey: ["recent-cdrs"],
    queryFn: () => api.get("/customer/cdrs", { params: { pageSize: 5 } }).then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active DIDs" value={summary?.total_dids || 0} icon={Phone} color="bg-blue-500" />
        <StatCard title="Monthly Rental" value={formatCurrency(summary?.monthly_rental || "0")} icon={DollarSign} color="bg-green-500" />
        <StatCard title="Current Balance" value={formatCurrency(summary?.current_balance || "0")} icon={Activity} color="bg-purple-500" />
        <StatCard title="Pending Amount" value={formatCurrency(summary?.pending_amount || "0")} icon={Receipt} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Calls</h3>
          <div className="space-y-3">
            {(cdrs?.cdrs || []).slice(0, 5).map((cdr: any) => (
              <div key={cdr.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {cdr.fromNumber} → {cdr.toNumber}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(cdr.callDate).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">{cdr.duration}s</p>
                  <p className="text-xs text-gray-400">{formatCurrency(cdr.cost)}</p>
                </div>
              </div>
            ))}
            {(!cdrs?.cdrs || cdrs.cdrs.length === 0) && (
              <p className="text-sm text-gray-400">No recent calls</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Buy Number", href: "/numbers" },
              { label: "Create Campaign", href: "/campaigns" },
              { label: "View CDRs", href: "/cdrs" },
              { label: "View Invoices", href: "/billing" },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="p-3 bg-gray-50 rounded-lg text-sm font-medium text-gray-700 hover:bg-[#1985A1]/5 hover:text-[#1985A1] transition-colors text-center"
              >
                {action.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
