import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { formatDate, formatCurrency, formatDuration, formatDateTime } from "../lib/utils";
import { Phone, PhoneCall, TrendingUp, DollarSign, Receipt, Users, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useLiveCalls, LiveCall } from "../hooks/useLiveCalls";

function LiveCallRow({ call }: { call: LiveCall }) {
  const elapsed = useElapsed(call.callDate);
  return (
    <div className="flex items-center justify-between py-2 border-b border-yellow-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-700">{call.fromNumber} → {call.toNumber}</p>
        <p className="text-xs text-gray-400">{formatDateTime(call.callDate)} · {formatDuration(elapsed)}</p>
      </div>
      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 animate-pulse">{call.status}</span>
    </div>
  );
}

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

function useElapsed(start: number | undefined): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!start) return;
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [start]);
  return elapsed;
}

export default function Dashboard() {
  const { data: summary } = useQuery({
    queryKey: ["billing-summary"],
    queryFn: () => api.get("/customer/billing/summary").then((r) => r.data),
  });

  const { data: callData } = useQuery({
    queryKey: ["recent-calls"],
    queryFn: () => api.get("/customer/signalwire-calls", { params: { pageSize: 5 } }).then((r) => r.data),
  });

  const liveCalls = useLiveCalls();

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
            {(callData?.calls || []).slice(0, 5).map((call: any) => (
              <div key={call.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {call.fromNumber} → {call.toNumber}
                  </p>
                  <p className="text-xs text-gray-400">{formatDateTime(call.startTime)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">{call.duration}s</p>
                  <p className="text-xs text-gray-400">{call.cost != null ? formatCurrency(String(call.cost)) : "-"}</p>
                </div>
              </div>
            ))}
            {(!callData?.calls || callData.calls.length === 0) && (
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
              { label: "Call Logs", href: "/call-logs" },
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

      {liveCalls.length > 0 && (
        <div className="bg-white rounded-xl border border-yellow-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <PhoneCall className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-800">Live Calls ({liveCalls.length})</h3>
          </div>
          <div className="space-y-3">
            {liveCalls.slice(0, 5).map((call) => (
              <LiveCallRow key={call.id} call={call} />
            ))}
          </div>
        </div>
      )}

      {/* Concurrency Chart */}
      {liveCalls.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Active Call Concurrency</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={Array.from({ length: 10 }, (_, i) => ({ time: `${-10 + i * 1}s`, count: liveCalls.length }))}>
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#1985A1" fill="#1985A1" fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
