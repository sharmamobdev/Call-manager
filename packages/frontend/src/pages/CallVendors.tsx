import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { Building2, CheckCircle, XCircle } from "lucide-react";

export default function CallVendors() {
  const { data } = useQuery({
    queryKey: ["call-vendors"],
    queryFn: () => api.get("/customer/call-vendors").then((r) => r.data),
  });

  const vendors = data?.call_vendors || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Call Vendors</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map((v: any) => (
          <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1985A1]" />
                <h3 className="font-semibold text-gray-800">{v.name}</h3>
              </div>
              {v.isActive
                ? <CheckCircle className="w-5 h-5 text-green-500" />
                : <XCircle className="w-5 h-5 text-red-400" />
              }
            </div>
            {v.description && <p className="text-sm text-gray-500">{v.description}</p>}
          </div>
        ))}
        {vendors.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-gray-400">
            No call vendors configured
          </div>
        )}
      </div>
    </div>
  );
}
