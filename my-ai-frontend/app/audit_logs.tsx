"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Clock, User, Shield, Info, Loader2 } from "lucide-react";

export default function AuditLogTable() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const token = localStorage.getItem("token");
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:7860";
        const res = await axios.get("${API_BASE}/admin/audit-logs", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "workspace-id": localStorage.getItem("workspace_id"),
          }
        });
        setLogs(res.data);
      } catch (err) {
        console.error("Failed to fetch audit logs");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-500 animate-pulse">
      <Loader2 className="animate-spin mb-2" size={24} />
      <span className="text-xs font-bold uppercase tracking-widest">Synchronizing Logs...</span>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Scrollable Container for Mobile */}
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left border-collapse min-w-[600px] md:min-w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 md:px-6 py-4 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Timestamp
              </th>
              <th className="px-4 md:px-6 py-4 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Operator
              </th>
              <th className="px-4 md:px-6 py-4 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Action
              </th>
              <th className="px-4 md:px-6 py-4 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log, idx) => (
              <tr key={log.log_id || idx} className="hover:bg-slate-50/50 transition-colors">
                {/* Timestamp - Monospace scaled for readability */}
                <td className="px-4 md:px-6 py-4 text-[10px] md:text-xs text-slate-500 font-mono whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </td>

                {/* Operator - Optimized spacing */}
                <td className="px-4 md:px-6 py-4">
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-slate-400 shrink-0" />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                        <span className="text-[11px] md:text-xs font-bold text-slate-700 whitespace-nowrap">
                            {log.username}
                        </span>
                        <span className={`text-[8px] md:text-[9px] px-1.5 py-0.5 rounded font-black uppercase w-fit ${
                            log.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                            {log.role}
                        </span>
                    </div>
                  </div>
                </td>

                {/* Action - High contrast */}
                <td className="px-4 md:px-6 py-4">
                  <span className="text-[10px] md:text-xs font-black text-indigo-600 uppercase tracking-tight">
                    {log.action}
                  </span>
                </td>

                {/* Details - Responsive truncation */}
                <td className="px-4 md:px-6 py-4 text-[10px] md:text-xs text-slate-600">
                  <div className="max-w-[150px] md:max-w-xs truncate font-medium">
                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile-only hint */}
      <div className="md:hidden p-3 bg-slate-50 border-t border-slate-100 text-center">
         <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter flex items-center justify-center gap-1">
            <Info size={10} /> Swipe horizontally to view full trail
         </p>
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}