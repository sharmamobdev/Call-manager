import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import { formatDate, formatCurrency } from "../../lib/utils";
import { Phone, RefreshCw, Search } from "lucide-react";

export default function AdminNumbers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "numbers"],
    queryFn: () => api.get("/admin/numbers").then((r) => r.data),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/admin/numbers/sync"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "numbers"] }),
  });

  const numbers = data?.numbers || [];
  const filtered = search
    ? numbers.filter((n: any) => n.e164?.includes(search) || n.friendlyName?.includes(search) || n.organizationName?.includes(search))
    : numbers;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">All Numbers</h2>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing..." : "Sync from SignalWire"}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search numbers by number, name, or org..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1] outline-none"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Number</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Friendly Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Organization</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rental</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Purchased</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((num: any) => (
                <tr key={num.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-800">{num.e164}</span>
                      {num.isTollFree && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">TF</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{num.friendlyName || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{num.organizationName || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(num.monthlyRental)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${num.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {num.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(num.purchasedAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    No numbers found. Click "Sync from SignalWire" to import purchased numbers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
