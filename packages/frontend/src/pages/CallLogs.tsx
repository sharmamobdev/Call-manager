import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { formatDateTime, formatCurrency, formatDuration } from "../lib/utils";
import { Search, Download, Play, X, Loader2 } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Call Logs</h2>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="Caller number"
              value={filters.fromNumber}
              onChange={(e) => setFilters({ ...filters, fromNumber: e.target.value, page: 1 })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="DID / Buyer number"
              value={filters.toNumber}
              onChange={(e) => setFilters({ ...filters, toNumber: e.target.value, page: 1 })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
            />
          </div>
          <button
            onClick={() => setFilters({ page: 1, pageSize: 50, fromNumber: "", toNumber: "" })}
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Caller</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">DID Called</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Buyer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cost</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Recording</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Loading call logs...</td>
                </tr>
              )}
              {cdrs.map((cdr: any) => (
                <tr key={cdr.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(cdr.callDate)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{cdr.fromNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{cdr.toNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{cdr.buyerNumber || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDuration(cdr.duration)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      cdr.status === "completed" ? "bg-green-100 text-green-700" :
                      cdr.status === "busy" ? "bg-orange-100 text-orange-700" :
                      cdr.status === "no-answer" || cdr.status === "ringing" ? "bg-yellow-100 text-yellow-700" :
                      cdr.status === "failed" || cdr.status === "canceled" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {cdr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{cdr.cost != null ? formatCurrency(String(cdr.cost)) : "-"}</td>
                  <td className="px-4 py-3">
                    {cdr.recordingUrl ? (
                      <button
                        onClick={() => setPlayingRecording({ cdrId: cdr.id, label: `${cdr.fromNumber} → ${cdr.toNumber} (${formatDateTime(cdr.callDate)})` })}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-[#1985A1]/10 text-[#1985A1] hover:bg-[#1985A1]/20 transition-colors"
                      >
                        <Play className="w-3 h-3" /> Play
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && cdrs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No call logs found</td>
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

      {/* Recording Player Modal */}
      {playingRecording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPlayingRecording(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Call Recording</h3>
              <button onClick={() => setPlayingRecording(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{playingRecording.label}</p>
            <audio
              controls
              autoPlay
              src={`/v1/customer/recordings/${playingRecording.cdrId}`}
              className="w-full"
            >
              Your browser does not support the audio element.
            </audio>
            <div className="mt-4 flex justify-end">
              <a
                href={`/v1/customer/recordings/${playingRecording.cdrId}`}
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
