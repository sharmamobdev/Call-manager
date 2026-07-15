import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";
import { Receipt, DollarSign, FileText, Plus, Download } from "lucide-react";

export default function Billing() {
  const queryClient = useQueryClient();
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [autoTopup, setAutoTopup] = useState({ enabled: false, threshold: 5, amount: 20 });
  const [showAutoTopup, setShowAutoTopup] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["billing-summary"],
    queryFn: () => api.get("/customer/billing/summary").then((r) => r.data),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get("/customer/invoices").then((r) => r.data),
  });

  const { data: ledgerData } = useQuery({
    queryKey: ["ledger"],
    queryFn: () => api.get("/customer/billing/ledger").then((r) => r.data),
  });

  const { data: rentals } = useQuery({
    queryKey: ["did-rentals"],
    queryFn: () => api.get("/customer/billing/did-rentals").then((r) => r.data),
  });

  const { data: autoTopupData } = useQuery({
    queryKey: ["auto-topup"],
    queryFn: () => api.get("/customer/wallet/auto-topup").then((r) => r.data),
  });

  useEffect(() => {
    if (autoTopupData) {
      setAutoTopup({ enabled: autoTopupData.enabled, threshold: autoTopupData.threshold, amount: autoTopupData.amount });
    }
  }, [autoTopupData]);

  const depositMutation = useMutation({
    mutationFn: () => api.post("/customer/wallet/deposit", { amount: depositAmount, description: "Web deposit" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ledger"] }); queryClient.invalidateQueries({ queryKey: ["billing-summary"] }); setShowDeposit(false); setDepositAmount(""); },
  });

  const autoTopupMutation = useMutation({
    mutationFn: () => api.post("/customer/wallet/auto-topup", autoTopup),
    onSuccess: () => { setShowAutoTopup(false); queryClient.invalidateQueries({ queryKey: ["auto-topup"] }); },
  });

  const invoices = invoicesData?.invoices || [];
  const ledger = ledgerData?.entries || [];
  const charges = rentals?.charges || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Billing</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-gray-500">Current Balance</span>
          </div>
          <div className="text-2xl font-bold text-gray-800">{formatCurrency(summary?.current_balance || "0")}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-medium text-gray-500">Pending</span>
          </div>
          <div className="text-2xl font-bold text-gray-800">{formatCurrency(summary?.pending_amount || "0")}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-500">Active DIDs</span>
          </div>
          <div className="text-2xl font-bold text-gray-800">{summary?.total_dids || 0}</div>
        </div>
      </div>

      {/* Deposit + Auto-topup */}
      <div className="flex items-center gap-3">
        <button onClick={() => setShowDeposit(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Funds
        </button>
        <button onClick={() => { setAutoTopup({ enabled: autoTopupData?.enabled || false, threshold: autoTopupData?.threshold || 5, amount: autoTopupData?.amount || 20 }); setShowAutoTopup(true); }}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Auto-Topup {autoTopupData?.enabled ? "(On)" : "(Off)"}
        </button>
      </div>

      {/* Deposit Modal */}
      {showDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeposit(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Add Funds to Wallet</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                <input type="number" min="1" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" placeholder="0.00" />
              </div>
              <button onClick={() => depositMutation.mutate()} disabled={depositMutation.isPending || !depositAmount || parseFloat(depositAmount) <= 0}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
                {depositMutation.isPending ? "Processing..." : `Deposit $${parseFloat(depositAmount || "0").toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-topup Modal */}
      {showAutoTopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAutoTopup(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Auto-Topup Settings</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoTopup.enabled} onChange={(e) => setAutoTopup({ ...autoTopup, enabled: e.target.checked })} />
                <span className="text-sm text-gray-700">Enable auto-topup</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Threshold ($)</label>
                <input type="number" min="1" step="1" value={autoTopup.threshold} onChange={(e) => setAutoTopup({ ...autoTopup, threshold: parseFloat(e.target.value) || 5 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topup Amount ($)</label>
                <input type="number" min="1" step="1" value={autoTopup.amount} onChange={(e) => setAutoTopup({ ...autoTopup, amount: parseFloat(e.target.value) || 20 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" />
              </div>
              <button onClick={() => autoTopupMutation.mutate()} disabled={autoTopupMutation.isPending}
                className="w-full py-2.5 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors disabled:opacity-50">
                {autoTopupMutation.isPending ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Invoices
            <span className="text-xs text-gray-400 font-normal ml-2">(PDF download at bottom of invoice list coming)</span>
          </h3>
          <div className="space-y-3">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-400">{formatDate(inv.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">{formatCurrency(inv.totalAmount)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    inv.status === "paid" ? "bg-green-100 text-green-700" :
                    inv.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                  }`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
            {invoices.length === 0 && <p className="text-sm text-gray-400">No invoices</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">DID Rentals</h3>
          <div className="space-y-3">
            {charges.map((ch: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{ch.number}</p>
                  <p className="text-xs text-gray-400">{formatDate(ch.from)}</p>
                </div>
                <div className="text-sm font-medium text-gray-700">{formatCurrency(ch.rental)}</div>
              </div>
            ))}
            {charges.length === 0 && <p className="text-sm text-gray-400">No DID rentals</p>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Billing Ledger</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Balance</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry: any) => (
                <tr key={entry.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">{entry.type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{entry.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(entry.amount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(entry.balance)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(entry.createdAt)}</td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No ledger entries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
