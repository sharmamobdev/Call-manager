import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";
import { Receipt, DollarSign, FileText } from "lucide-react";

export default function Billing() {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Invoices</h3>
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
