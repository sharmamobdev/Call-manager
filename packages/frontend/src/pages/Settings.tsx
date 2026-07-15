import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { useAuthStore } from "../lib/auth";
import { User, Shield, Bell, Mail, Ban, AlertTriangle, Plus, X, Trash2 } from "lucide-react";

function SMTPSettings() {
  const queryClient = useQueryClient();
  const [smtp, setSmtp] = useState({ host: "", port: 587, user: "", pass: "", fromEmail: "" });
  const [editing, setEditing] = useState(false);

  const { data: smtpData } = useQuery({
    queryKey: ["smtp-settings"],
    queryFn: () => api.get("/customer/organization/smtp").then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post("/customer/organization/smtp", smtp),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["smtp-settings"] }); setEditing(false); },
  });

  if (!editing && smtpData?.host) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-600">SMTP: {smtpData.host}:{smtpData.port} · From: {smtpData.fromEmail}</p>
        <button onClick={() => { setSmtp({ host: smtpData.host, port: smtpData.port, user: smtpData.user, pass: "", fromEmail: smtpData.fromEmail }); setEditing(true); }}
          className="text-xs text-[#1985A1] hover:underline">Edit SMTP</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs text-gray-500 mb-0.5">Host</label><input type="text" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="smtp.example.com" /></div>
        <div><label className="block text-xs text-gray-500 mb-0.5">Port</label><input type="number" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value) || 587 })}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
      </div>
      <div><label className="block text-xs text-gray-500 mb-0.5">Username</label><input type="text" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
      <div><label className="block text-xs text-gray-500 mb-0.5">Password</label><input type="password" value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder={smtpData?.host ? "(leave blank to keep current)" : ""} /></div>
      <div><label className="block text-xs text-gray-500 mb-0.5">From Email</label><input type="email" value={smtp.fromEmail} onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
      <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !smtp.host || !smtp.fromEmail}
        className="px-3 py-1.5 bg-[#1985A1] text-white rounded text-sm font-medium hover:bg-[#146a81] disabled:opacity-50">
        {saveMutation.isPending ? "Saving..." : "Save SMTP"}
      </button>
    </div>
  );
}

function BlocklistManager() {
  const queryClient = useQueryClient();
  const [newBlock, setNewBlock] = useState({ type: "number", value: "" });

  const { data } = useQuery({
    queryKey: ["blocklist"],
    queryFn: () => api.get("/customer/blocklist").then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () => api.post("/customer/blocklist", newBlock),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["blocklist"] }); setNewBlock({ type: "number", value: "" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customer/blocklist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blocklist"] }),
  });

  const entries = data?.blocklist || [];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select value={newBlock.type} onChange={(e) => setNewBlock({ ...newBlock, type: e.target.value })}
          className="px-2 py-1.5 border border-gray-300 rounded text-sm">
          <option value="number">Phone Number</option>
          <option value="prefix">Prefix</option>
          <option value="country">Country Code</option>
        </select>
        <input type="text" value={newBlock.value} onChange={(e) => setNewBlock({ ...newBlock, value: e.target.value })}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder={newBlock.type === "number" ? "+15551234567" : newBlock.type === "prefix" ? "+1555" : "US"} />
        <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newBlock.value}
          className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {entries.map((e: any) => (
          <div key={e.id} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded">
            <span className="text-sm text-gray-700"><span className="text-xs text-gray-400 uppercase mr-1">{e.type}</span> {e.value}</span>
            <button onClick={() => deleteMutation.mutate(e.id)} className="p-0.5 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        {entries.length === 0 && <p className="text-xs text-gray-400">No blocked entries</p>}
      </div>
    </div>
  );
}

function FraudSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({ rateLimitPerMin: 10, geoBlock: "", businessHoursOnly: false, businessHoursStart: "09:00", businessHoursEnd: "17:00" });

  const { data } = useQuery({
    queryKey: ["fraud-settings"],
    queryFn: () => api.get("/customer/settings/fraud").then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.patch("/customer/settings/fraud", settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fraud-settings"] }),
  });

  useEffect(() => {
    if (data) {
      setSettings({
        rateLimitPerMin: data.maxCallsPerMinute || data.rateLimitPerMin || 10,
        geoBlock: data.geoBlock || "",
        businessHoursOnly: !!data.businessHoursOnly,
        businessHoursStart: data.businessHoursStart || "09:00",
        businessHoursEnd: data.businessHoursEnd || "17:00",
      });
    }
  }, [data]);

  return (
    <div className="space-y-3">
      <div><label className="block text-xs text-gray-500 mb-0.5">Rate Limit (calls/min)</label>
        <input type="number" min="1" value={settings.rateLimitPerMin} onChange={(e) => setSettings({ ...settings, rateLimitPerMin: parseInt(e.target.value) || 10 })}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
      <div><label className="block text-xs text-gray-500 mb-0.5">Geo Block (comma-separated country codes to block)</label>
        <input type="text" value={settings.geoBlock} onChange={(e) => setSettings({ ...settings, geoBlock: e.target.value })}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="e.g. CU,IR,KP,SY" /></div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="biz-hours" checked={settings.businessHoursOnly} onChange={(e) => setSettings({ ...settings, businessHoursOnly: e.target.checked })} />
        <label htmlFor="biz-hours" className="text-sm text-gray-700">Business hours only</label>
      </div>
      {settings.businessHoursOnly && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-gray-500 mb-0.5">Start</label><input type="time" value={settings.businessHoursStart} onChange={(e) => setSettings({ ...settings, businessHoursStart: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-0.5">End</label><input type="time" value={settings.businessHoursEnd} onChange={(e) => setSettings({ ...settings, businessHoursEnd: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
        </div>
      )}
      <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
        className="px-3 py-1.5 bg-[#1985A1] text-white rounded text-sm font-medium hover:bg-[#146a81] disabled:opacity-50">
        {saveMutation.isPending ? "Saving..." : "Save Fraud Settings"}
      </button>
    </div>
  );
}

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState("profile");

  const tabs = [
    { key: "profile", label: "Profile", icon: User },
    { key: "smtp", label: "SMTP", icon: Mail },
    { key: "blocklist", label: "Blocklist", icon: Ban },
    { key: "fraud", label: "Fraud", icon: AlertTriangle },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "security", label: "Security", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Settings</h2>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? "border-[#1985A1] text-[#1985A1]" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Email</label>
              <p className="text-sm text-gray-800">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Display Name</label>
              <p className="text-sm text-gray-800">{user?.displayName || "Not set"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Role</label>
              <p className="text-sm text-gray-800 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      )}

      {tab === "smtp" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><Mail className="w-5 h-5" /> SMTP Configuration</h3>
          <SMTPSettings />
        </div>
      )}

      {tab === "blocklist" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><Ban className="w-5 h-5" /> Blocklist Management</h3>
          <BlocklistManager />
        </div>
      )}

      {tab === "fraud" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Fraud Protection</h3>
          <FraudSettings />
        </div>
      )}

      {tab === "security" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-[#1985A1]" />
            <h3 className="text-lg font-semibold text-gray-800">Two-Factor Authentication</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Add an extra layer of security to your account by enabling 2FA.
          </p>
          <button className="px-4 py-2 bg-[#1985A1] text-white rounded-lg text-sm font-medium hover:bg-[#146a81]">
            Set Up 2FA
          </button>
        </div>
      )}

      {tab === "notifications" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-[#1985A1]" />
            <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
          </div>
          <p className="text-sm text-gray-500">
            Notification preferences are coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
