import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";
import { BarChart3, Download } from "lucide-react";

export default function Reports() {
  const { data: campaignSummary } = useQuery({
    queryKey: ["campaign-summary"],
    queryFn: () => api.get("/customer/reports/campaign-summary").then((r) => r.data),
  });

  const { data: consolidatedData } = useQuery({
    queryKey: ["consolidated-campaigns"],
    queryFn: () => api.get("/customer/reports/consolidated-campaigns").then((r) => r.data),
  });

  const { data: reportSettings } = useQuery({
    queryKey: ["report-settings"],
    queryFn: () => api.get("/customer/daily-reports/settings").then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Reports</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-500">Campaign Summary</span>
            <BarChart3 className="w-5 h-5 text-[#1985A1]" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Calls</span>
              <span className="font-medium">{campaignSummary?.totalCalls || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Answered</span>
              <span className="font-medium">{campaignSummary?.answeredCalls || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Cost</span>
              <span className="font-medium">{formatCurrency(campaignSummary?.totalCost || "0")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Consolidated Campaign Report</h3>
          <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Campaign</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total Calls</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {(consolidatedData?.campaigns || []).map((c: any) => (
                <tr key={c.campaignId} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-sm text-gray-800">{c.campaignName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.totalCalls}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(c.totalCost)}</td>
                </tr>
              ))}
              {(!consolidatedData?.campaigns || consolidatedData.campaigns.length === 0) && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No campaign data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Report Settings</h3>
        <div className="space-y-3">
          {(reportSettings?.settings || []).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {s.scheduleType} report {s.campaignId ? `(Campaign: ${s.campaignId})` : ""}
                </p>
                <p className="text-xs text-gray-400">
                  Recipients: {(s.recipients || []).join(", ") || "None configured"}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {s.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
          {(!reportSettings?.settings || reportSettings.settings.length === 0) && (
            <p className="text-sm text-gray-400">No report schedules configured</p>
          )}
        </div>
      </div>
    </div>
  );
}
