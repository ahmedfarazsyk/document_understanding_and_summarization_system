"use client";

import { useState } from "react";
import axios from "axios";
import { Shield, User, Building, Key, Lock, ArrowRight, Loader2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:7860";

export default function AuthPage({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<"admin" | "researcher">("researcher");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    workspace_name: "",
    workspace_id: "",
    google_api_key: "",
  });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let endpoint = `${API_BASE}/auth/login`;
      if (!isLogin) {
        endpoint = role === "admin" ? `${API_BASE}/auth/signup/admin` : `${API_BASE}/auth/signup/researcher`;
      }
      const res = await axios.post(endpoint, formData);
      if (isLogin) {
        localStorage.setItem("token", res.data.access_token);
        localStorage.setItem("workspace_id", res.data.workspace_id);
        localStorage.setItem("username", res.data.username);
        localStorage.setItem("role", res.data.role);
        onLoginSuccess();
      } else {
        alert("Account created! Please login.");
        setIsLogin(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 sm:p-6 font-sans">
      {/* Responsive Container: Full width on mobile, max-width on desktop */}
      <div className="w-full max-w-[400px] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Top Header Section - Optimized padding for mobile */}
        <div className="bg-slate-900 p-6 sm:p-8 text-center">
          <div className="inline-flex p-2.5 sm:p-3 bg-indigo-600 rounded-xl sm:rounded-2xl mb-3 sm:mb-4 shadow-lg shadow-indigo-500/30">
            <Shield className="text-white" size={28} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            AlphaDoc <span className="text-indigo-400">Enterprise</span>
          </h1>
          <p className="text-slate-400 text-[9px] sm:text-[10px] mt-2 font-bold uppercase tracking-[0.2em]">
            Secure Knowledge Gateway
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {/* Mode Switcher - Full width buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6 sm:mb-8 border border-slate-200">
            <button 
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black rounded-lg transition-all ${isLogin ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
            >LOGIN</button>
            <button 
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black rounded-lg transition-all ${!isLogin ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
            >SIGN UP</button>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            {isLogin ? "Member Authentication" : `Register as ${role === 'admin' ? 'Administrator' : 'Researcher'}`}
          </h2>

          {/* Role Selection - Stacked on very small screens, side-by-side on mobile+ */}
          {!isLogin && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button 
                type="button"
                onClick={() => setRole("researcher")}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${role === "researcher" ? "border-indigo-600 bg-indigo-50/50 shadow-inner" : "border-slate-100 hover:border-slate-200 bg-slate-50"}`}
              >
                <User size={18} className={role === "researcher" ? "text-indigo-600" : "text-slate-400"} />
                <span className="text-[9px] font-black uppercase tracking-tighter text-slate-600">Researcher</span>
              </button>
              <button 
                type="button"
                onClick={() => setRole("admin")}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${role === "admin" ? "border-indigo-600 bg-indigo-50/50 shadow-inner" : "border-slate-100 hover:border-slate-200 bg-slate-50"}`}
              >
                <Building size={18} className={role === "admin" ? "text-indigo-600" : "text-slate-400"} />
                <span className="text-[9px] font-black uppercase tracking-tighter text-slate-600">Admin</span>
              </button>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4 sm:space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Account Identity</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  required
                  type="text" 
                  placeholder="Enter username" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all shadow-sm"
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Credential</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  required
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all shadow-sm"
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            {/* Admin Fields */}
            {!isLogin && role === "admin" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Workspace Alias</label>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. DeepMind Lab" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all shadow-sm"
                    onChange={(e) => setFormData({...formData, workspace_name: e.target.value})}
                  />
                </div>
              </div>
            )}

            {/* Researcher Fields */}
            {!isLogin && role === "researcher" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Workspace Authorization</label>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    required
                    type="text" 
                    placeholder="Enter Workspace ID" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all shadow-sm"
                    onChange={(e) => setFormData({...formData, workspace_id: e.target.value})}
                  />
                </div>
              </div>
            )}

            <button 
              disabled={loading}
              type="submit" 
              className="w-full bg-slate-900 text-white py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-3 group mt-4 disabled:bg-slate-400"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (
                <>
                  {isLogin ? "Secure Login" : "Initialize Workspace"}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}