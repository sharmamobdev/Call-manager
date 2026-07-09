import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { formatDate } from "../lib/utils";
import { Plus, Megaphone, X } from "lucide-react";

export default function Campaigns() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", useCase: "" });

  const { data } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api.get("/customer/campaigns").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/customer/campaigns", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setShowCreate(false);
      setForm({ name: "", description: "", useCase: "" });
    },
  });

  const campaigns = data?.campaigns || [];

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    pending_review: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    active: "bg-blue-100 text-blue-700",
    paused: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Campaigns</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Campaign
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Campaign</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                <input
                  type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
                  placeholder="My Campaign"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
                  rows={3}
                  placeholder="Campaign description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Use Case</label>
                <input
                  type="text" value={form.useCase}
                  onChange={(e) => setForm({ ...form, useCase: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
                  placeholder="e.g. Customer Support"
                />
              </div>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.name}
                className="w-full py-2.5 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((camp: any) => (
          <div key={camp.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#1985A1]/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#1985A1]" />
                <h3 className="font-semibold text-gray-800">{camp.name}</h3>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[camp.status] || "bg-gray-100 text-gray-600"}`}>
                {camp.status.replace("_", " ")}
              </span>
            </div>
            {camp.description && <p className="text-sm text-gray-500 mb-3">{camp.description}</p>}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{camp.useCase || "No use case"}</span>
              <span>{formatDate(camp.createdAt)}</span>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-gray-400">
            No campaigns yet. Create your first campaign to get started.
          </div>
        )}
      </div>
    </div>
  );
}
