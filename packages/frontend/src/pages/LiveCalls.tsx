import { useState, useEffect } from "react";
import { useLiveCalls, LiveCall } from "../hooks/useLiveCalls";
import { formatDateTime, formatDuration } from "../lib/utils";
import api from "../lib/api";
import { Radio, PhoneCall, PhoneOff } from "lucide-react";

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

function LiveCallRow({ call }: { call: LiveCall }) {
  const elapsed = useElapsed(call.callDate);
  const [disconnecting, setDisconnecting] = useState(false);

  const tta = call.answeredAt && call.callDate
    ? Math.floor((call.answeredAt - call.callDate) / 1000)
    : null;

  const handleDisconnect = async () => {
    if (!call.callSid || disconnecting) return;
    setDisconnecting(true);
    try {
      await api.post(`/customer/calls/${call.callSid}/hangup`);
    } catch {
      setDisconnecting(false);
    }
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="px-3 py-2 text-sm text-slate-500 whitespace-nowrap">{formatDateTime(call.callDate)}</td>
      <td className="px-3 py-2 text-sm font-medium text-slate-800">{call.fromNumber}</td>
      <td className="px-3 py-2 text-sm text-slate-700">{call.toNumber}</td>
      <td className="px-3 py-2 text-sm text-slate-700">{call.buyerName || "-"}</td>
      <td className="px-3 py-2 text-sm text-slate-700">{call.buyerNumber || "-"}</td>
      <td className="px-3 py-2 text-sm text-slate-700">{call.campaignName || "-"}</td>
      <td className="px-3 py-2 text-sm text-slate-600">{tta != null ? formatDuration(tta) : "-"}</td>
      <td className="px-3 py-2 text-sm font-mono text-slate-700">{formatDuration(elapsed)}</td>
      <td className="px-3 py-2 text-sm text-slate-600">{tta != null ? formatDuration(tta) : "-"}</td>
      <td className="px-3 py-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 animate-pulse">{call.status}</span>
      </td>
      <td className="px-3 py-2 text-sm text-slate-600">{call.reason || "-"}</td>
      <td className="px-3 py-2 text-sm text-slate-600 text-center">{call.routingAttempt || "-"}</td>
      <td className="px-3 py-2">
        {call.callSid && (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            <PhoneOff className="w-3 h-3" /> {disconnecting ? "Hanging up..." : "Disconnect"}
          </button>
        )}
      </td>
    </tr>
  );
}

export default function LiveCalls() {
  const liveCalls = useLiveCalls();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-800">Live Calls</h2>
          {liveCalls.length > 0 && (
            <span className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              {liveCalls.length} active
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">
            {liveCalls.length > 0 ? `Active Calls (${liveCalls.length})` : "No Active Calls"}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="sticky top-0 border-b border-slate-200 bg-slate-50">
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Call Start</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Caller ID</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">DID</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Buyer Name</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Buyer Number</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Campaign</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">TTA</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Duration</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Ring Time</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Reason</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Routing Attempt</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {liveCalls.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center">
                    <Radio className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Calls will appear here in real-time when they come in.</p>
                  </td>
                </tr>
              ) : (
                liveCalls.map((call) => (
                  <LiveCallRow key={call.id} call={call} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {liveCalls.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-sm font-medium text-slate-500 mb-1">Active Calls</div>
            <div className="text-2xl font-bold text-slate-800">{liveCalls.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-sm font-medium text-slate-500 mb-1">Inbound</div>
            <div className="text-2xl font-bold text-blue-600">{liveCalls.filter(c => c.direction === "inbound").length}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-sm font-medium text-slate-500 mb-1">Outbound</div>
            <div className="text-2xl font-bold text-purple-600">{liveCalls.filter(c => c.direction === "outbound").length}</div>
          </div>
        </div>
      )}
    </div>
  );
}
