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
    <tr className="border-b border-yellow-100 hover:bg-yellow-50/30">
      <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDateTime(call.callDate)}</td>
      <td className="px-3 py-3 text-sm font-medium text-gray-800">{call.fromNumber}</td>
      <td className="px-3 py-3 text-sm text-gray-700">{call.toNumber}</td>
      <td className="px-3 py-3 text-sm text-gray-700">{call.buyerName || "-"}</td>
      <td className="px-3 py-3 text-sm text-gray-700">{call.buyerNumber || "-"}</td>
      <td className="px-3 py-3 text-sm text-gray-700">{call.campaignName || "-"}</td>
      <td className="px-3 py-3 text-sm text-gray-600">{tta != null ? formatDuration(tta) : "-"}</td>
      <td className="px-3 py-3 text-sm font-mono text-gray-700">{formatDuration(elapsed)}</td>
      <td className="px-3 py-3 text-sm text-gray-600">{tta != null ? formatDuration(tta) : "-"}</td>
      <td className="px-3 py-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 animate-pulse">{call.status}</span>
      </td>
      <td className="px-3 py-3 text-sm text-gray-600">{call.reason || "-"}</td>
      <td className="px-3 py-3 text-sm text-gray-600 text-center">{call.routingAttempt || "-"}</td>
      <td className="px-3 py-3">
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
            <span className="text-sm font-medium text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
              {liveCalls.length} active
            </span>
          )}
        </div>
      </div>

      {liveCalls.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Radio className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-1">No active calls</h3>
          <p className="text-sm text-gray-400">Calls will appear here in real-time when they come in.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-yellow-200 overflow-hidden">
          <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-yellow-600" />
            <h3 className="text-sm font-semibold text-yellow-800">Active Calls ({liveCalls.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-yellow-100 bg-yellow-50/50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">Call Start</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">Caller ID</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">DID</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">Buyer Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">Buyer Number</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">Campaign</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">TTA</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">Duration</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">Ring Time</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">Reason</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">Routing Attempt</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-yellow-700 uppercase whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {liveCalls.map((call) => (
                  <LiveCallRow key={call.id} call={call} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {liveCalls.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">Active Calls</div>
            <div className="text-2xl font-bold text-gray-800">{liveCalls.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">Inbound</div>
            <div className="text-2xl font-bold text-blue-600">{liveCalls.filter(c => c.direction === "inbound").length}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">Outbound</div>
            <div className="text-2xl font-bold text-purple-600">{liveCalls.filter(c => c.direction === "outbound").length}</div>
          </div>
        </div>
      )}
    </div>
  );
}
