"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const REMEMBER_KEY = "ks_rm";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const parsed = JSON.parse(atob(saved));
        if (parsed.e && parsed.p) {
          setEmail(parsed.e);
          setPassword(parsed.p);
          setRememberMe(true);
        }
      }
    } catch {
      localStorage.removeItem(REMEMBER_KEY);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, btoa(JSON.stringify({ e: email, p: password })));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Login failed");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <style>{`
        @keyframes ks-grid-drift {
          from { transform: translateY(0); }
          to   { transform: translateY(60px); }
        }
        @keyframes ks-scan {
          0%   { transform: translateY(-8px); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes ks-glow-breathe {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 0.6;  transform: scale(1.08); }
        }
        @keyframes ks-shimmer {
          from { transform: translateX(-200%); }
          to   { transform: translateX(200%); }
        }
        @keyframes ks-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        .ks-grid-bg {
          background-image:
            linear-gradient(rgba(232,127,36,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232,127,36,0.045) 1px, transparent 1px);
          background-size: 44px 44px;
          animation: ks-grid-drift 10s linear infinite;
        }
        .ks-scan-line {
          animation: ks-scan 6s linear infinite;
        }
        .ks-glow-orb {
          animation: ks-glow-breathe 4s ease-in-out infinite;
        }
        .ks-card-shadow {
          box-shadow:
            0 0 0 1px rgba(232,127,36,0.12),
            0 0 80px rgba(232,127,36,0.06),
            0 40px 80px rgba(0,0,0,0.7);
        }
        .ks-input-focus:focus {
          box-shadow: 0 0 0 1px #e87f24, 0 0 18px rgba(232,127,36,0.18);
          border-color: #e87f24 !important;
          outline: none;
        }
        .ks-btn-glow:not(:disabled):hover {
          box-shadow: 0 0 36px rgba(232,127,36,0.45), 0 4px 16px rgba(0,0,0,0.4);
        }
        .ks-btn-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%);
          transform: translateX(-200%);
          transition: none;
        }
        .ks-btn-shimmer:not(:disabled):hover::after {
          animation: ks-shimmer 0.6s ease forwards;
        }
        .ks-logo-glow {
          filter: drop-shadow(0 0 18px rgba(232,127,36,0.55)) drop-shadow(0 0 40px rgba(232,127,36,0.25));
        }
        .ks-status-blink {
          animation: ks-blink 2.4s ease-in-out infinite;
        }
        .ks-divider {
          background: linear-gradient(90deg, transparent, rgba(232,127,36,0.3), transparent);
        }
      `}</style>

      <div className="min-h-screen bg-[#06080a] flex items-center justify-center px-4 relative overflow-hidden select-none">

        {/* Animated grid */}
        <div className="absolute inset-0 ks-grid-bg" />

        {/* Vignette overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#06080a_100%)]" />

        {/* Glowing scan line */}
        <div className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#e87f24]/40 to-transparent ks-scan-line pointer-events-none" />

        {/* Ambient glow orb */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[700px] h-[700px] rounded-full bg-[#e87f24]/[0.04] blur-[130px] ks-glow-orb" />
        </div>

        {/* HUD corners */}
        <div className="absolute top-6 left-6 font-mono text-[10px] text-[#e87f24]/25 tracking-[0.25em] uppercase">
          KS-ADMIN&nbsp;/&nbsp;v2.1.0
        </div>
        <div className="absolute top-6 right-6 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] ks-status-blink" />
          <span className="font-mono text-[10px] text-[#10b981]/55 tracking-[0.25em] uppercase">Secure&nbsp;TLS</span>
        </div>
        <div className="absolute bottom-6 left-6 font-mono text-[10px] text-white/10 tracking-[0.2em] uppercase">
          Kootenay Signal Communications
        </div>
        <div className="absolute bottom-6 right-6 font-mono text-[10px] text-white/10 tracking-[0.2em] uppercase">
          Authorized&nbsp;Access&nbsp;Only
        </div>

        {/* Card */}
        <div className="w-full max-w-[420px] relative z-10">

          {/* Logo block */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#e87f24]/12 blur-3xl scale-[2]" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://res.cloudinary.com/doajstql7/image/upload/v1777003162/f3d21215-ada9-4ea3-b86d-510a6885c8f5-removebg-preview_uat1ay.png"
                alt="Kootenay Signal"
                width={160}
                height={160}
                className="relative w-40 h-40 object-contain ks-logo-glow"
              />
            </div>
            <div className="flex items-center justify-center gap-3 mt-5">
              <div className="h-px w-16 ks-divider" />
              <p className="font-mono text-[9px] tracking-[0.4em] text-white/30 uppercase">Admin&nbsp;Portal</p>
              <div className="h-px w-16 ks-divider" />
            </div>
          </div>

          {/* Login card */}
          <div className="bg-[#0c0e12]/85 backdrop-blur-2xl border border-[#1a1e25] rounded-2xl p-8 ks-card-shadow">

            {/* Card top bar */}
            <div className="flex items-center justify-between mb-7">
              <div>
                <p className="text-[11px] font-semibold text-white/70 tracking-[0.18em] uppercase">Sign In</p>
                <p className="text-[10px] text-white/25 mt-0.5 tracking-wide">Authorized personnel only</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#e87f24]/25" />
                <div className="w-2 h-2 rounded-full bg-[#e87f24]/55" />
                <div className="w-2 h-2 rounded-full bg-[#e87f24]" />
              </div>
            </div>

            {/* Thin divider */}
            <div className="h-px w-full ks-divider mb-7" />

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="block font-mono text-[10px] tracking-[0.3em] uppercase text-white/40">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#e87f24]/45 pointer-events-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-[#06080a]/70 border border-[#1a1e25] rounded-lg text-white/85 text-sm placeholder:text-white/20 transition-all duration-200 ks-input-focus"
                    placeholder="admin@kootenavsignal.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="password" className="block font-mono text-[10px] tracking-[0.3em] uppercase text-white/40">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#e87f24]/45 pointer-events-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="3" y="11" width="18" height="11" rx="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-11 py-3 bg-[#06080a]/70 border border-[#1a1e25] rounded-lg text-white/85 text-sm placeholder:text-white/20 transition-all duration-200 ks-input-focus"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-[#e87f24] transition-colors duration-150"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-3 pt-0.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={rememberMe}
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`relative w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all duration-200 ${
                    rememberMe
                      ? "bg-[#e87f24] border-[#e87f24] shadow-[0_0_10px_rgba(232,127,36,0.4)]"
                      : "bg-[#06080a]/70 border-[#1a1e25] hover:border-[#e87f24]/40"
                  }`}
                >
                  {rememberMe && (
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,6 5,9 10,3"/>
                    </svg>
                  )}
                </button>
                <span
                  className="text-[11px] text-white/35 cursor-pointer hover:text-white/55 transition-colors duration-150 tracking-wide"
                  onClick={() => setRememberMe(!rememberMe)}
                >
                  Remember me on this device
                </span>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 text-[#ef4444] text-xs bg-[#ef4444]/8 border border-[#ef4444]/20 rounded-lg px-4 py-3">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full py-3 bg-[#e87f24] hover:bg-[#f59542] text-white text-[11px] font-bold tracking-[0.3em] uppercase rounded-lg transition-all duration-200 disabled:opacity-50 cursor-pointer overflow-hidden ks-btn-glow ks-btn-shimmer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      Authenticating…
                    </span>
                  ) : (
                    "Access Dashboard"
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* Footer tag */}
          <p className="mt-6 text-center font-mono text-[9px] tracking-[0.35em] text-white/15 uppercase">
            Classified&nbsp;·&nbsp;Internal Use Only&nbsp;·&nbsp;All Access Logged
          </p>
        </div>
      </div>
    </>
  );
}
