import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { formatDate, formatCurrency } from "../lib/utils";
import { Plus, Phone, Search, X } from "lucide-react";

export default function Numbers() {
  const queryClient = useQueryClient();
  const [showBuy, setShowBuy] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["numbers"],
    queryFn: () => api.get("/customer/numbers").then((r) => r.data),
  });

  const { data: available } = useQuery({
    queryKey: ["available-numbers"],
    queryFn: () => api.get("/customer/available-numbers").then((r) => r.data),
    enabled: showBuy,
  });

  const buyMutation = useMutation({
    mutationFn: () => api.post("/customer/numbers/buy", { area_code: areaCode || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
      setShowBuy(false);
      setAreaCode("");
    },
  });

  const numbers = data?.numbers || [];
  const filtered = search
    ? numbers.filter((n: any) => n.e164.includes(search) || n.friendlyName?.includes(search))
    : numbers;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Numbers</h2>
        <button
          onClick={() => setShowBuy(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors"
        >
          <Plus className="w-4 h-4" /> Buy Number
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search numbers..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1] outline-none"
        />
      </div>

      {showBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Buy Number</h3>
              <button onClick={() => setShowBuy(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area Code (optional)</label>
                <input
                  type="text" value={areaCode} onChange={(e) => setAreaCode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
                  placeholder="e.g. 212"
                  maxLength={3}
                />
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-2">Available Numbers:</p>
                {available?.numbers?.slice(0, 5).map((n: any) => (
                  <div key={n.phone_number} className="text-sm text-gray-700 py-1">
                    {n.phone_number} - {formatCurrency(n.price || "0")}
                  </div>
                )) || <p className="text-sm text-gray-400">Enter area code to search</p>}
              </div>
              <button
                onClick={() => buyMutation.mutate()}
                disabled={buyMutation.isPending}
                className="w-full py-2.5 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors disabled:opacity-50"
              >
                {buyMutation.isPending ? "Buying..." : "Buy Number"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Number</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Friendly Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Campaign</th>
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
                <td className="px-4 py-3 text-sm text-gray-600">{num.campaignId ? "Assigned" : "-"}</td>
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
                  No numbers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
