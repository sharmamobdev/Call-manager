import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { formatDateTime, formatCurrency, formatDuration } from "../lib/utils";
import { Search, Download, Play, X } from "lucide-react";

export default function CallLogs() {
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 50,
    fromNumber: "",
    toNumber: "",
  });
  const [playingRecording, setPlayingRecording] = useState<{ cdrId: string; label: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cdrs", filters],
    queryFn: () => api.get("/customer/cdrs", { params: filters }).then((r) => r.data),
  });

  const cdrs = data?.cdrs || [];

  const token = localStorage.getItem("auth_token") || "";
  const recordingUrl = (cdrId: string) => `/v1/recordings/${cdrId}?token=${encodeURIComponent(token)}`;

  function computeTTA(cdr: any): number | null {
    if (cdr.answeredAt && cdr.callDate) {
      return Math.floor((cdr.answeredAt - cdr.callDate) / 1000);
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Call Logs</h2>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" placeholder="Caller number"
              value={filters.fromNumber}
              onChange={(e) => setFilters({ ...filters, fromNumber: e.target.value, page: 1 })}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" placeholder="DID / Buyer number"
              value={filters.toNumber}
              onChange={(e) => setFilters({ ...filters, toNumber: e.target.value, page: 1 })}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
            />
          </div>
          <button
            onClick={() => setFilters({ page: 1, pageSize: 50, fromNumber: "", toNumber: "" })}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="sticky top-0 border-b border-slate-200 bg-slate-50">
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[110px]">Call Start</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[110px]">Call End</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[100px]">Caller ID</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[100px]">DID</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[90px]">Buyer Name</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[100px]">Buyer Number</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[90px]">Campaign</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[55px]">TTA</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[60px]">Duration</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[65px]">Ring Time</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[80px]">Status</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[80px]">Reason</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[75px]">Attempt</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap w-[70px]">Recording</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-sm text-slate-400">Loading call logs...</td>
                </tr>
              )}
              {cdrs.map((cdr: any) => {
                const tta = computeTTA(cdr);
                return (
                  <tr key={cdr.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-2 py-2 text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{formatDateTime(cdr.callDate)}</td>
                    <td className="px-2 py-2 text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{cdr.endedAt ? formatDateTime(cdr.endedAt) : "-"}</td>
                    <td className="px-2 py-2 text-xs font-medium text-slate-800 overflow-hidden text-ellipsis">{cdr.fromNumber || "-"}</td>
                    <td className="px-2 py-2 text-xs text-slate-700 overflow-hidden text-ellipsis">{cdr.toNumber}</td>
                    <td className="px-2 py-2 text-xs text-slate-700 overflow-hidden text-ellipsis">{cdr.buyerName || "-"}</td>
                    <td className="px-2 py-2 text-xs text-slate-700 overflow-hidden text-ellipsis">{cdr.buyerNumber || "-"}</td>
                    <td className="px-2 py-2 text-xs text-slate-700 overflow-hidden text-ellipsis">{cdr.campaignName || "-"}</td>
                    <td className="px-2 py-2 text-xs text-slate-600">{tta != null ? formatDuration(tta) : "-"}</td>
                    <td className="px-2 py-2 text-xs text-slate-600">{formatDuration(cdr.duration)}</td>
                    <td className="px-2 py-2 text-xs text-slate-600">{tta != null ? formatDuration(tta) : "-"}</td>
                    <td className="px-2 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        cdr.status === "completed" ? "bg-green-100 text-green-700" :
                        cdr.status === "busy" ? "bg-orange-100 text-orange-700" :
                        cdr.status === "no-answer" || cdr.status === "ringing" ? "bg-yellow-100 text-yellow-700" :
                        cdr.status === "failed" || cdr.status === "canceled" ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {cdr.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-600 overflow-hidden text-ellipsis">{cdr.reason || "-"}</td>
                    <td className="px-2 py-2 text-xs text-slate-600 text-center">{cdr.routingAttempt || "-"}</td>
                    <td className="px-2 py-2">
                      {cdr.recordingUrl ? (
                        <button
                          onClick={() => setPlayingRecording({ cdrId: cdr.id, label: `${cdr.fromNumber} → ${cdr.toNumber} (${formatDateTime(cdr.callDate)})` })}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#1985A1]/10 text-[#1985A1] hover:bg-[#1985A1]/20 transition-colors"
                        >
                          <Play className="w-3 h-3" /> Play
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && cdrs.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-sm text-slate-400">No call logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Total: {data.total} records</span>
          <div className="flex gap-2">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={cdrs.length < filters.pageSize}
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Recording Player Modal */}
      {playingRecording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPlayingRecording(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Call Recording</h3>
              <button onClick={() => setPlayingRecording(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">{playingRecording.label}</p>
            <audio
              controls
              autoPlay
              src={recordingUrl(playingRecording.cdrId)}
              className="w-full"
            >
              Your browser does not support the audio element.
            </audio>
            <div className="mt-4 flex justify-end">
              <a
                href={recordingUrl(playingRecording.cdrId)}
                download
                className="flex items-center gap-2 px-4 py-2 text-sm text-[#1985A1] hover:bg-[#1985A1]/10 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" /> Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
