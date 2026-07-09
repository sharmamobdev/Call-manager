import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { formatDateTime, formatCurrency, formatDuration } from "../lib/utils";
import { Search, Download, PhoneCall } from "lucide-react";

export default function Cdrs() {
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 50,
    fromNumber: "",
    toNumber: "",
    direction: "",
    sortBy: "callDate",
    sortOrder: "desc" as const,
  });

  const { data } = useQuery({
    queryKey: ["cdrs", filters],
    queryFn: () => api.get("/customer/cdrs", { params: filters }).then((r) => r.data),
  });

  const { data: liveData } = useQuery({
    queryKey: ["live-calls"],
    queryFn: () => api.get("/customer/live-calls").then((r) => r.data),
    refetchInterval: 10000,
  });

  const cdrs = data?.cdrs || [];
  const liveCalls = liveData?.calls || [];

  return (
    <div className="space-y-6">
      {/* Live Calls */}
      {liveCalls.length > 0 && (
        <div className="bg-white rounded-xl border border-yellow-200 overflow-hidden">
          <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-yellow-600" />
            <h3 className="text-sm font-semibold text-yellow-800">Live Calls ({liveCalls.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-yellow-100 bg-yellow-50/50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-yellow-700 uppercase">From</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-yellow-700 uppercase">To</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-yellow-700 uppercase">Direction</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-yellow-700 uppercase">Status</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-yellow-700 uppercase">Since</th>
                </tr>
              </thead>
              <tbody>
                {liveCalls.map((call: any) => (
                  <tr key={call.id} className="border-b border-yellow-100 hover:bg-yellow-50/30">
                    <td className="px-4 py-2 text-sm text-gray-800">{call.fromNumber}</td>
                    <td className="px-4 py-2 text-sm text-gray-800">{call.toNumber}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{call.direction}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 animate-pulse">{call.status}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">{formatDateTime(call.callDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Call Detail Records</h2>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="From number"
              value={filters.fromNumber}
              onChange={(e) => setFilters({ ...filters, fromNumber: e.target.value, page: 1 })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="To number"
              value={filters.toNumber}
              onChange={(e) => setFilters({ ...filters, toNumber: e.target.value, page: 1 })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
            />
          </div>
          <select
            value={filters.direction}
            onChange={(e) => setFilters({ ...filters, direction: e.target.value, page: 1 })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
          >
            <option value="">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <button
            onClick={() => setFilters({ page: 1, pageSize: 50, fromNumber: "", toNumber: "", direction: "", sortBy: "callDate", sortOrder: "desc" })}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Call SID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">From</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">To</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Direction</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cost</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {cdrs.map((cdr: any) => (
                <tr key={cdr.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{cdr.callSid?.slice(0, 20) || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{cdr.fromNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{cdr.toNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cdr.direction === "inbound" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {cdr.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDuration(cdr.duration)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(cdr.cost)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cdr.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {cdr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(cdr.callDate)}</td>
                </tr>
              ))}
              {cdrs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No CDRs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Total: {data.total} records</span>
          <div className="flex gap-2">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={cdrs.length < filters.pageSize}
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
