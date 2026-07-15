import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { formatDate, formatCurrency } from "../lib/utils";
import { Plus, Megaphone, X, Edit2, Trash2, Save, Phone, Users, BarChart3, Search } from "lucide-react";
import toast from "react-hot-toast";

const STATUS_OPTIONS = ["draft", "pending_review", "approved", "rejected", "active", "paused"];
const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  active: "bg-blue-100 text-blue-700",
  paused: "bg-orange-100 text-orange-700",
};

export default function Campaigns() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editCampaign, setEditCampaign] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", useCase: "" });
  const [editForm, setEditForm] = useState({ name: "", description: "", useCase: "", status: "draft" });
  const [selectedNumberId, setSelectedNumberId] = useState("");
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [search, setSearch] = useState("");

  const editCampaignRef = useRef(editCampaign);
  useEffect(() => { editCampaignRef.current = editCampaign; }, [editCampaign]);

  const { data } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api.get("/customer/campaigns").then((r) => r.data),
  });

  const { data: numbersData } = useQuery({
    queryKey: ["numbers"],
    queryFn: () => api.get("/customer/numbers").then((r) => r.data),
    enabled: !!editCampaign,
  });

  const { data: analytics } = useQuery({
    queryKey: ["campaign-analytics", editCampaign?.id],
    queryFn: () => api.get(`/customer/campaigns/${editCampaign.id}/analytics`).then((r) => r.data),
    enabled: !!editCampaign,
  });

  const { data: campaignBuyers } = useQuery({
    queryKey: ["campaign-buyers", editCampaign?.id],
    queryFn: () => api.get("/customer/campaign-buyers").then((r) => r.data),
    enabled: !!editCampaign,
  });

  const { data: buyersData } = useQuery({
    queryKey: ["buyers"],
    queryFn: () => api.get("/customer/buyers").then((r) => r.data),
    enabled: !!editCampaign,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/customer/campaigns", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setShowCreate(false);
      setForm({ name: "", description: "", useCase: "" });
      toast.success("Campaign created");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to create campaign"),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/customer/campaigns/${editCampaignRef.current?.id}`, editForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-analytics"] });
      setEditCampaign(null);
      toast.success("Campaign saved");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to save campaign"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/customer/campaigns/${deleteConfirm}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setDeleteConfirm(null);
      toast.success("Campaign deleted");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to delete campaign"),
  });

  const assignNumberMutation = useMutation({
    mutationFn: (numberId: string) => {
      const cid = editCampaignRef.current?.id;
      if (!cid) throw new Error("No campaign selected");
      return api.post(`/customer/numbers/${numberId}/assign-campaign`, { campaign_id: cid });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["numbers"] });
      setSelectedNumberId("");
      toast.success("Number assigned");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to assign number"),
  });

  const linkBuyerMutation = useMutation({
    mutationFn: (buyerId: string) => {
      const cid = editCampaignRef.current?.id;
      if (!cid) throw new Error("No campaign selected");
      return api.post("/customer/campaign-buyers", { campaign_id: cid, buyer_id: buyerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-buyers", editCampaignRef.current?.id] });
      setSelectedBuyerId("");
      toast.success("Buyer linked");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to link buyer"),
  });

  const unlinkBuyerMutation = useMutation({
    mutationFn: (linkId: string) => api.delete(`/customer/campaign-buyers/${linkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-buyers", editCampaignRef.current?.id] });
      toast.success("Buyer unlinked");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to unlink buyer"),
  });

  const campaigns = data?.campaigns || [];
  const numbers = numbersData?.numbers || [];
  const unassignedNumbers = numbers.filter((n: any) => !n.campaignId);
  const linkedBuyers = (campaignBuyers?.campaign_buyers || []).filter((cb: any) => cb.campaign_id === editCampaign?.id);
  const buyers = buyersData?.buyers || [];
  const linkedBuyerIds = linkedBuyers.map((cb: any) => cb.buyer_id);

  const filtered = search
    ? campaigns.filter((c: any) =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase()) ||
        c.useCase?.toLowerCase().includes(search.toLowerCase())
      )
    : campaigns;

  function openEdit(camp: any) {
    setEditCampaign(camp);
    setEditForm({ name: camp.name || "", description: camp.description || "", useCase: camp.useCase || "", status: camp.status || "draft" });
    setSelectedNumberId("");
    setSelectedBuyerId("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Campaigns</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors">
          <Plus className="w-4 h-4" /> Create Campaign
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campaigns..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1] outline-none"
        />
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Campaign</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" placeholder="My Campaign" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" rows={3} placeholder="Campaign description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Use Case</label>
                <input type="text" value={form.useCase} onChange={(e) => setForm({ ...form, useCase: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" placeholder="e.g. Customer Support" />
              </div>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name}
                className="w-full py-2.5 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors disabled:opacity-50">
                {createMutation.isPending ? "Creating..." : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Detail Modal */}
      {editCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8" onClick={() => setEditCampaign(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Campaign</h3>
              <button onClick={() => setEditCampaign(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" rows={3} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Use Case</label>
                <input type="text" value={editForm.useCase} onChange={(e) => setEditForm({ ...editForm, useCase: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" />
              </div>

              <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !editForm.name}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Analytics</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Total Calls</p>
                    <p className="text-lg font-bold text-gray-800">{analytics?.totalCalls ?? 0}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Answered</p>
                    <p className="text-lg font-bold text-gray-800">{analytics?.answeredCalls ?? 0}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Avg Duration</p>
                    <p className="text-lg font-bold text-gray-800">{analytics?.avgDuration ?? 0}s</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Total Cost</p>
                    <p className="text-lg font-bold text-gray-800">{formatCurrency(analytics?.totalCost ?? 0)}</p>
                  </div>
                </div>
              </div>

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Phone className="w-4 h-4" /> Assigned Numbers</h4>
                <div className="space-y-2 mb-3">
                  {numbers.filter((n: any) => n.campaignId === editCampaign.id).map((n: any) => (
                    <div key={n.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-700">{n.e164} {n.friendlyName ? `(${n.friendlyName})` : ""}</span>
                    </div>
                  ))}
                  {numbers.filter((n: any) => n.campaignId === editCampaign.id).length === 0 && (
                    <p className="text-xs text-gray-400">No numbers assigned</p>
                  )}
                </div>
                {unassignedNumbers.length > 0 && (
                  <div className="flex gap-2">
                    <select value={selectedNumberId} onChange={(e) => setSelectedNumberId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]">
                      <option value="">-- Select a number --</option>
                      {unassignedNumbers.map((n: any) => (
                        <option key={n.id} value={n.id}>{n.e164} {n.friendlyName ? `(${n.friendlyName})` : ""}</option>
                      ))}
                    </select>
                    <button onClick={() => { if (selectedNumberId) assignNumberMutation.mutate(selectedNumberId); }}
                      disabled={assignNumberMutation.isPending || !selectedNumberId}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">
                      {assignNumberMutation.isPending ? "..." : "Assign"}
                    </button>
                  </div>
                )}
              </div>

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Linked Buyers</h4>
                {linkedBuyers.length === 0 ? (
                  <p className="text-xs text-gray-400 mb-2">No buyers linked to this campaign</p>
                ) : (
                  <div className="space-y-1.5 mb-3">
                    {linkedBuyers.map((cb: any) => (
                      <div key={cb.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-700">{cb.buyer_name || cb.buyer_id}</span>
                        <button onClick={() => unlinkBuyerMutation.mutate(cb.id)} disabled={unlinkBuyerMutation.isPending}
                          className="p-1 text-gray-400 hover:text-red-500 rounded disabled:opacity-50">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {buyers.filter((b: any) => !linkedBuyerIds.includes(b.id)).length > 0 && (
                  <div className="flex gap-2">
                    <select value={selectedBuyerId} onChange={(e) => setSelectedBuyerId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]">
                      <option value="">-- Link a buyer --</option>
                      {buyers.filter((b: any) => !linkedBuyerIds.includes(b.id)).map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}{b.phone ? ` (${b.phone})` : ""}</option>
                      ))}
                    </select>
                    <button onClick={() => { if (selectedBuyerId) linkBuyerMutation.mutate(selectedBuyerId); }}
                      disabled={linkBuyerMutation.isPending || !selectedBuyerId}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">
                      {linkBuyerMutation.isPending ? "..." : "Link"}
                    </button>
                  </div>
                )}
              </div>

              <hr className="border-gray-200" />

              <button onClick={() => setDeleteConfirm(editCampaign.id)}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                <Trash2 className="w-4 h-4" /> Delete Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Delete Campaign?</h3>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone. All associated data will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Campaign</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Buyer</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">DID Numbers</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((camp: any) => (
              <tr key={camp.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(camp)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-[#1985A1]" />
                    <span className="text-sm font-medium text-gray-800">{camp.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[camp.status] || "bg-gray-100 text-gray-600"}`}>
                    {camp.status?.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{camp.description || "-"}</td>
                <td className="px-4 py-3">
                  {camp.buyerNames ? (
                    <div className="text-sm text-gray-800">
                      <div>{camp.buyerNames}</div>
                      {camp.buyerPhones && <div className="text-xs text-gray-500">{camp.buyerPhones}</div>}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{camp.didNumbers || "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatDate(camp.createdAt)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(camp)}
                      className="p-1.5 text-gray-400 hover:text-[#1985A1] hover:bg-gray-100 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(camp.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No campaigns found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
