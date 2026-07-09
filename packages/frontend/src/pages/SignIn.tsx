import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/auth";
import api from "../lib/api";
import { Satellite } from "lucide-react";

export default function SignIn() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: any = { email, password };
      if (twoFactor) payload.twoFactorCode = twoFactorCode;

      const res = await api.post("/auth/login", payload);

      if (res.data?.error === "totp_required") {
        setTwoFactor(true);
        setLoading(false);
        return;
      }

      setAuth(res.data.token, res.data.me);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-[#1985A1] rounded-xl flex items-center justify-center">
              <Satellite className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-800">DialClear</span>
          </div>

          <h2 className="text-xl font-semibold text-gray-800 mb-1">
            {twoFactor ? "Two-Factor Authentication" : "Sign in"}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {twoFactor
              ? "Enter the code from your authenticator app"
              : "Enter your email and password to log into your account"}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!twoFactor ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1] outline-none"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1] outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Authentication Code</label>
                <input
                  type="text" required value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1985A1]/20 focus:border-[#1985A1] outline-none text-center tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 bg-[#1985A1] text-white rounded-lg font-medium text-sm hover:bg-[#146a81] transition-colors disabled:opacity-50"
            >
              {loading ? "Loading..." : twoFactor ? "Verify" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
