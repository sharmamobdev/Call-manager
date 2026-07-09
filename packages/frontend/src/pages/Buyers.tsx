import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { Users, Plus, X } from "lucide-react";

export default function Buyers() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", description: "" });

  const { data } = useQuery({
    queryKey: ["buyers"],
    queryFn: () => api.get("/customer/buyers").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/customer/buyers", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      setShowCreate(false);
      setForm({ name: "", email: "", description: "" });
    },
  });

  const { data: groupsData } = useQuery({
    queryKey: ["buyer-groups"],
    queryFn: () => api.get("/customer/buyer-groups").then((r) => r.data),
  });

  const buyers = data?.buyers || [];
  const groups = groupsData?.buyer_groups || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Buyers</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81]"
        >
          <Plus className="w-4 h-4" /> Add Buyer
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Buyer</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
                  placeholder="Buyer name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
                  placeholder="buyer@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]"
                  rows={2} placeholder="Optional description" />
              </div>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.name}
                className="w-full py-2.5 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] disabled:opacity-50"
              >
                {createMutation.isPending ? "Saving..." : "Add Buyer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buyers.map((buyer: any) => (
          <div key={buyer.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#1985A1]/30 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[#1985A1]" />
              <h3 className="font-semibold text-gray-800">{buyer.name}</h3>
            </div>
            {buyer.email && <p className="text-sm text-gray-500 mb-1">{buyer.email}</p>}
            {buyer.description && <p className="text-sm text-gray-400">{buyer.description}</p>}
          </div>
        ))}
        {buyers.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-gray-400">No buyers yet</div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Buyer Groups</h3>
        <div className="space-y-3">
          {groups.map((g: any) => (
            <div key={g.id} className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">{g.name}</span>
            </div>
          ))}
          {groups.length === 0 && <p className="text-sm text-gray-400">No groups configured</p>}
        </div>
      </div>
    </div>
  );
}
