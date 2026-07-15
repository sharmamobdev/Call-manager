import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { useAuthStore } from "../lib/auth";
import { formatDate, formatCurrency } from "../lib/utils";
import { Plus, Phone, Search, X, MapPin, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

export default function Numbers() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showBuy, setShowBuy] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [searchAreaCode, setSearchAreaCode] = useState<string | undefined>(undefined);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["numbers"],
    queryFn: () => api.get("/customer/numbers").then((r) => r.data),
  });

  const { data: available, isLoading: availableLoading } = useQuery({
    queryKey: ["available-numbers", searchAreaCode],
    queryFn: () =>
      api
        .get("/customer/available-numbers", { params: { area_code: searchAreaCode } })
        .then((r) => r.data),
    enabled: showBuy,
  });

  const buyMutation = useMutation({
    mutationFn: (phoneNumber: string) =>
      api.post("/customer/numbers/buy", { phone_number: phoneNumber }),
    onSuccess: () => {
      toast.success("Number purchased successfully");
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
      setShowBuy(false);
      setSelectedNumber(null);
      setAreaCode("");
      setSearchAreaCode(undefined);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to purchase number");
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/admin/numbers/sync"),
    onSuccess: (res) => {
      const { synced, updated, total } = res.data;
      toast.success(`Synced ${synced} new number${synced !== 1 ? "s" : ""} from SignalWire (${total} total)`);
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to sync numbers");
    },
  });

  const numbers = data?.numbers || [];
  const filtered = search
    ? numbers.filter(
        (n: any) => n.e164.includes(search) || n.friendlyName?.includes(search)
      )
    : numbers;

  const availableNumbers = available?.numbers || [];

  function handleSearch() {
    setSearchAreaCode(areaCode || undefined);
    setSelectedNumber(null);
  }

  function openBuyModal() {
    setShowBuy(true);
    setSelectedNumber(null);
    setSearchAreaCode(undefined);
    setAreaCode("");
  }

  function closeBuyModal() {
    setShowBuy(false);
    setSelectedNumber(null);
    setAreaCode("");
    setSearchAreaCode(undefined);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Numbers</h2>
        <div className="flex items-center gap-2">
          {user?.role === "admin" && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {syncMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {syncMutation.isPending ? "Syncing..." : "Sync Numbers"}
            </button>
          )}
          <button
            onClick={openBuyModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors"
          >
            <Plus className="w-4 h-4" /> Buy Number
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search numbers..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1] outline-none"
        />
      </div>

      {showBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Buy Number</h3>
              <button onClick={closeBuyModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Area Code (optional)
                  </label>
                  <input
                    type="text"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
                    placeholder="e.g. 212"
                    maxLength={3}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSearch}
                    disabled={availableLoading}
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {availableLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Search
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
                {availableLoading ? (
                  <div className="p-8 text-center text-sm text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-300" />
                    Searching available numbers...
                  </div>
                ) : availableNumbers.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {availableNumbers.map((n: any) => (
                      <label
                        key={n.phone_number}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          selectedNumber === n.phone_number
                            ? "bg-[#1985A1]/5 border-l-2 border-l-[#1985A1]"
                            : "hover:bg-gray-50 border-l-2 border-l-transparent"
                        }`}
                      >
                        <input
                          type="radio"
                          name="available-number"
                          value={n.phone_number}
                          checked={selectedNumber === n.phone_number}
                          onChange={() => setSelectedNumber(n.phone_number)}
                          className="w-4 h-4 text-[#1985A1] focus:ring-[#1985A1]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-sm font-medium text-gray-800">
                              {n.phone_number}
                            </span>
                          </div>
                          {(n.locality || n.region) && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-gray-300" />
                              <span className="text-xs text-gray-500">
                                {[n.locality, n.region].filter(Boolean).join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {formatCurrency(n.price || "0")}/mo
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-gray-400">
                    {searchAreaCode
                      ? "No numbers found for this area code. Try a different one."
                      : "Click Search to find available numbers."}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {availableNumbers.length} number{availableNumbers.length !== 1 ? "s" : ""} available
                  {selectedNumber && (
                    <span className="ml-2 text-[#1985A1] font-medium">
                      Selected: {selectedNumber}
                    </span>
                  )}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={closeBuyModal}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => selectedNumber && buyMutation.mutate(selectedNumber)}
                    disabled={!selectedNumber || buyMutation.isPending}
                    className="px-6 py-2 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {buyMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Buying...
                      </>
                    ) : (
                      "Buy Number"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Number
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Friendly Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Campaign
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Rental
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Purchased
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((num: any) => (
              <tr key={num.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-800">{num.e164}</span>
                    {num.isTollFree && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        TF
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{num.friendlyName || "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {num.campaignId ? "Assigned" : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatCurrency(num.monthlyRental)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      num.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {num.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatDate(num.purchasedAt)}
                </td>
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
