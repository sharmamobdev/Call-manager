import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { Users, Plus, X, Edit2, Trash2, Phone, Mail, ChevronRight, Save, Link, Unlink, FolderPlus, UserPlus, UserMinus } from "lucide-react";

export default function Buyers() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editBuyer, setEditBuyer] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", description: "" });
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", description: "" });

  // Groups state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupDetail, setGroupDetail] = useState<any>(null);
  const [groupForm, setGroupForm] = useState({ name: "" });

  const { data } = useQuery({
    queryKey: ["buyers"],
    queryFn: () => api.get("/customer/buyers").then((r) => r.data),
  });

  const { data: groupsData } = useQuery({
    queryKey: ["buyer-groups"],
    queryFn: () => api.get("/customer/buyer-groups").then((r) => r.data),
  });

  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api.get("/customer/campaigns").then((r) => r.data),
  });

  const { data: buyerDetail, refetch: refetchBuyer } = useQuery({
    queryKey: ["buyer", editBuyer?.id],
    queryFn: () => api.get(`/customer/buyers/${editBuyer.id}`).then((r) => r.data),
    enabled: !!editBuyer?.id,
  });

  const { data: groupDetailData, refetch: refetchGroup } = useQuery({
    queryKey: ["buyer-group", groupDetail?.id],
    queryFn: () => api.get(`/customer/buyer-groups/${groupDetail.id}`).then((r) => r.data),
    enabled: !!groupDetail?.id,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/customer/buyers", form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["buyers"] }); setShowCreate(false); setForm({ name: "", email: "", phone: "", description: "" }); },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/customer/buyers/${editBuyer.id}`, editForm),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["buyers"] }); queryClient.invalidateQueries({ queryKey: ["buyer", editBuyer.id] }); setEditBuyer(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/customer/buyers/${deleteConfirm}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["buyers"] }); setDeleteConfirm(null); setEditBuyer(null); },
  });

  const linkCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => api.post("/customer/campaign-buyers", { campaign_id: campaignId, buyer_id: editBuyer.id }),
    onSuccess: () => { refetchBuyer(); queryClient.invalidateQueries({ queryKey: ["campaign-buyers"] }); },
  });

  const unlinkCampaignMutation = useMutation({
    mutationFn: (linkId: string) => api.delete(`/customer/campaign-buyers/${linkId}`),
    onSuccess: () => { refetchBuyer(); queryClient.invalidateQueries({ queryKey: ["campaign-buyers"] }); },
  });

  const createGroupMutation = useMutation({
    mutationFn: () => api.post("/customer/buyer-groups", groupForm),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["buyer-groups"] }); setGroupForm({ name: "" }); setShowGroupModal(false); },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customer/buyer-groups/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["buyer-groups"] }); setGroupDetail(null); },
  });

  const addMemberMutation = useMutation({
    mutationFn: (buyerId: string) => api.post(`/customer/buyer-groups/${groupDetail.id}/members`, { buyer_id: buyerId }),
    onSuccess: () => { refetchGroup(); queryClient.invalidateQueries({ queryKey: ["buyer-groups"] }); },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (membershipId: string) => api.delete(`/customer/buyer-groups/${groupDetail.id}/members/${membershipId}`),
    onSuccess: () => { refetchGroup(); queryClient.invalidateQueries({ queryKey: ["buyer-groups"] }); },
  });

  const buyers = data?.buyers || [];
  const groups = groupsData?.buyer_groups || [];
  const campaigns = campaignsData?.campaigns || [];
  const groupedCampaigns = buyerDetail?.campaigns || [];
  const groupedGroups = buyerDetail?.groups || [];
  const groupMembers = groupDetailData?.members || [];
  const linkedCampaignIds = groupedCampaigns.map((c: any) => c.campaign_id);

  function openEdit(buyer: any) {
    setEditBuyer(buyer);
    setEditForm({ name: buyer.name || "", email: buyer.email || "", phone: buyer.phone || "", description: buyer.description || "" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Buyers</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors">
          <Plus className="w-4 h-4" /> Add Buyer
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Buyer</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" placeholder="Buyer name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" placeholder="buyer@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" placeholder="+15551234567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" rows={2} placeholder="Optional" />
              </div>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name}
                className="w-full py-2.5 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors disabled:opacity-50">
                {createMutation.isPending ? "Saving..." : "Add Buyer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Detail Modal */}
      {editBuyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8" onClick={() => setEditBuyer(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Buyer</h3>
              <button onClick={() => setEditBuyer(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" placeholder="+15551234567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" rows={2} />
              </div>
              <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !editForm.name}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>

              <hr className="border-gray-200" />

              {/* Linked Campaigns */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Link className="w-4 h-4" /> Linked Campaigns</h4>
                {groupedCampaigns.length === 0 ? (
                  <p className="text-xs text-gray-400 mb-2">Not linked to any campaigns</p>
                ) : (
                  <div className="space-y-1.5 mb-3">
                    {groupedCampaigns.map((c: any) => (
                      <div key={c.link_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-700">{c.campaign_name}</span>
                        <button onClick={() => unlinkCampaignMutation.mutate(c.link_id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {campaigns.filter((c: any) => !linkedCampaignIds.includes(c.id)).length > 0 && (
                  <div className="flex gap-2">
                    <select id="link-campaign"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]">
                      <option value="">-- Select campaign --</option>
                      {campaigns.filter((c: any) => !linkedCampaignIds.includes(c.id)).map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button onClick={() => { const sel = (document.getElementById("link-campaign") as HTMLSelectElement)?.value; if (sel) linkCampaignMutation.mutate(sel); }}
                      disabled={linkCampaignMutation.isPending}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">
                      Link
                    </button>
                  </div>
                )}
              </div>

              <hr className="border-gray-200" />

              {/* Groups */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Groups</h4>
                {groupedGroups.length === 0 ? (
                  <p className="text-xs text-gray-400">Not in any groups</p>
                ) : (
                  <div className="space-y-1.5">
                    {groupedGroups.map((g: any) => (
                      <div key={g.membership_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-700">{g.group_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <hr className="border-gray-200" />

              <button onClick={() => setDeleteConfirm(editBuyer.id)}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                <Trash2 className="w-4 h-4" /> Delete Buyer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Delete Buyer?</h3>
            <p className="text-sm text-gray-500 mb-4">This will also remove them from all campaigns and groups.</p>
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

      {/* Buyer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buyers.map((buyer: any) => (
          <div key={buyer.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#1985A1]/30 transition-colors cursor-pointer group"
            onClick={() => openEdit(buyer)}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1985A1]" />
                <h3 className="font-semibold text-gray-800">{buyer.name}</h3>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={(e) => { e.stopPropagation(); openEdit(buyer); }} className="p-1.5 text-gray-400 hover:text-[#1985A1] hover:bg-gray-100 rounded-lg">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(buyer.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1 ml-1">
              {buyer.email && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Mail className="w-3 h-3" /> {buyer.email}</p>}
              {buyer.phone && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Phone className="w-3 h-3" /> {buyer.phone}</p>}
            </div>
            {buyer.description && <p className="text-xs text-gray-400 mt-2">{buyer.description}</p>}
          </div>
        ))}
        {buyers.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-gray-400">No buyers yet</div>
        )}
      </div>

      {/* Buyer Groups Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Buyer Groups</h3>
          <button onClick={() => setShowGroupModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors">
            <FolderPlus className="w-4 h-4" /> New Group
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g: any) => (
            <div key={g.id} className="border border-gray-200 rounded-lg p-4 hover:border-[#1985A1]/30 transition-colors cursor-pointer"
              onClick={() => setGroupDetail(g)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1985A1]" />
                  <span className="text-sm font-medium text-gray-800">{g.name}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="text-sm text-gray-400 col-span-full">No groups configured</p>}
        </div>
      </div>

      {/* Create Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowGroupModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Buyer Group</h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                <input type="text" value={groupForm.name} onChange={(e) => setGroupForm({ name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]" placeholder="e.g. VIP Buyers" />
              </div>
              <button onClick={() => createGroupMutation.mutate()} disabled={createGroupMutation.isPending || !groupForm.name}
                className="w-full py-2.5 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81] transition-colors disabled:opacity-50">
                {createGroupMutation.isPending ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Detail Modal */}
      {groupDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8" onClick={() => setGroupDetail(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Group: {groupDetail.name}</h3>
              <button onClick={() => setGroupDetail(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              {/* Members */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Members ({groupMembers.length})</h4>
                <div className="space-y-1.5 mb-3">
                  {groupMembers.map((m: any) => (
                    <div key={m.membership_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-gray-700">{m.buyer_name}</span>
                        <div className="text-xs text-gray-400">
                          {m.email && <span className="mr-3">{m.email}</span>}
                          {m.phone && <span>{m.phone}</span>}
                        </div>
                      </div>
                      <button onClick={() => removeMemberMutation.mutate(m.membership_id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded">
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {groupMembers.length === 0 && <p className="text-xs text-gray-400">No members in this group</p>}
                </div>

                {buyers.filter((b: any) => !groupMembers.find((m: any) => m.buyer_id === b.id)).length > 0 && (
                  <div className="flex gap-2">
                    <select id="add-member"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1]">
                      <option value="">-- Add a buyer --</option>
                      {buyers.filter((b: any) => !groupMembers.find((m: any) => m.buyer_id === b.id)).map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}{b.phone ? ` (${b.phone})` : ""}</option>
                      ))}
                    </select>
                    <button onClick={() => { const sel = (document.getElementById("add-member") as HTMLSelectElement)?.value; if (sel) addMemberMutation.mutate(sel); }}
                      disabled={addMemberMutation.isPending}
                      className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">
                      <UserPlus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                )}
              </div>

              <hr className="border-gray-200" />

              <button onClick={() => { setDeleteConfirm(null); deleteGroupMutation.mutate(groupDetail.id); }}
                disabled={deleteGroupMutation.isPending}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> {deleteGroupMutation.isPending ? "Deleting..." : "Delete Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
