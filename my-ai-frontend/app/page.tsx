"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import AuthPage from "./auth_page";
import ReactMarkdown from "react-markdown";
import { 
  Upload, Database, Search, FileText, CheckCircle, Download,
  AlertTriangle, Lightbulb, Loader2, BookOpen, 
  ShieldAlert, Cpu, BarChart3, ChevronRight, ListChecks, Layers, Clock, X, Menu,
  Target, Tag, Users, Network, LogOut, CopyPlus, RefreshCcw, Trash2, Settings, ArrowRight, Code
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:7860" ;

export default function DocumentIntelligence() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState("lab");
  const [file, setFile] = useState<File | null>(null);
  
  // Processing States
  const [loading, setLoading] = useState(false);
  const [storing, setStoring] = useState(false);
  const [searching, setSearching] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [updatingMongo, setUpdatingMongo] = useState(false);

  const [analysis, setAnalysis] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [dashboard, setDashboard] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Configuration States
  const [configKey, setConfigKey] = useState("");
  const [configErrorModal, setConfigErrorModal] = useState<{show: boolean, type: 'missing' | 'invalid' | 'storage'} | null>(null);
  const [collisionData, setCollisionData] = useState<{show: boolean, filename: string} | null>(null);

  const [mongoUri, setMongoUri] = useState("");
  const [vectorIndexName, setVectorIndexName] = useState("vector_index");

  const getWsId = () => typeof window !== 'undefined' ? localStorage.getItem("workspace_id") || "" : "";
  const getUsername = () => typeof window !== 'undefined' ? localStorage.getItem("username") || "" : "";
  const getRole = () => typeof window !== 'undefined' ? (localStorage.getItem("role") || "").toLowerCase() : "";

  // JWT Update: Now includes Authorization Bearer token
  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem("token") || "" : "";
    return {
      "Authorization": `Bearer ${token}`,
      "workspace-id": getWsId(),
      "username": getUsername(),
      "role": getRole()
    };
  };

  const handleDownloadJSON = () => {
    if (!analysis) return;
    const exportData = {
      metadata: {
        filename: analysis.filename,
        exported_at: new Date().toISOString(),
        workspace: getWsId(),
        intent: analysis.document_intent
      },
      major_themes: analysis.major_themes,
      summaries: {
        executive: analysis.summaries.executive_summary,
        technical: analysis.summaries.technical_summary,
        sectional: analysis.summaries.section_summaries
      },
      insights: analysis.insights.insights || analysis.insights,
      entities: analysis.entities,
      obligations_logic: analysis.relationships
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Intelligence_Report_${analysis.filename.split('.')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/history`, {
        headers: getHeaders()
      });
      setHistoryList(res.data);
    } catch (err: any) { 
        if (err.response?.status === 401) {
            localStorage.clear();
            setIsLoggedIn(false);
        }
        if (err.response?.status === 428) console.warn("MongoDB connection required for history.");
        else console.error("History fetch failed"); 
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/audit-logs`, {
        headers: getHeaders()
      });
      setAuditLogs(res.data);
      setActiveTab("audit");
    } catch (err) { 
      alert("Unauthorized: Admin access required."); 
    } finally { setLoading(false); }
  };

  const handleUpdateConfig = async () => {
    if (!configKey) return;
    setUpdatingConfig(true);
    try {
      await axios.post(`${API_BASE}/admin/config/gemini-key`, 
        { api_key: configKey }, 
        { headers: getHeaders() }
      );
      alert("✅ AI Engine Environment Variable Updated.");
      setConfigKey("");
      setConfigErrorModal(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Configuration failed.");
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleUpdateMongo = async () => {
    if (!mongoUri) return;
    setUpdatingMongo(true);
    try {
      await axios.post(`${API_BASE}/admin/config/mongodb-uri`, 
        { mongodb_uri: mongoUri, vector_index: vectorIndexName }, 
        { headers: getHeaders() }
      );
      alert("✅ Storage Engine Configured.");
      setMongoUri("");
      setConfigErrorModal(null);
      fetchHistory(); 
    } catch (err: any) {
      alert(err.response?.data?.detail || "Database link failed.");
    } finally {
      setUpdatingMongo(false);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      setIsLoggedIn(true);
      fetchHistory(); 
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    fetchHistory(); 
  };

  if (!isLoggedIn) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  const loadHistoryDoc = async (docId: string) => {
    setLoading(true); setDrawerOpen(false);
    try {
      const res = await axios.get(`${API_BASE}/history/${docId}`, {
        headers: getHeaders()
      });
      setAnalysis({
        id: docId,
        filename: res.data.filename,
        document_intent: res.data.document_intent,
        major_themes: res.data.major_themes,
        entities: res.data.entities,
        relationships: res.data.relationships,
        summaries: {
          executive_summary: res.data.executive_summary,
          technical_summary: res.data.technical_summary,
          section_summaries: res.data.section_summaries
        },
        insights: { insights: res.data.actionable_insights },
        _isHistory: true
      });
      setActiveTab("lab");
    } catch (err: any) { 
        if (err.response?.status === 428) setConfigErrorModal({ show: true, type: 'storage' });
        else alert("Failed to load document"); 
    } finally { setLoading(false); }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true); setAnalysis(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API_BASE}/analyze`, formData, {
         headers: {"Authorization": getHeaders()['Authorization']},
      });
      const data = res.data;
      setAnalysis({
        filename: data.filename,
        document_intent: data.intelligence.document_intent,
        major_themes: data.intelligence.major_themes || data.intelligence.topics,
        entities: data.intelligence.entities,
        relationships: data.intelligence.relationships,
        summaries: data.summaries, 
        insights: data.insights,   
        raw_chunks: data.raw_chunks,
        embeddings: data.embeddings,
        intelligence: data.intelligence
      });
    } catch (err: any) { 
        if (err.response?.status === 428) {
            setConfigErrorModal({ show: true, type: 'missing' });
        } else if (err.response?.status === 401) {
            setConfigErrorModal({ show: true, type: 'invalid' });
        } else {
            alert("Analysis failed."); 
        }
    } finally { setLoading(false); }
  };

  const handleStore = async (confirmUpdate = false, forceNew = false) => {
    setStoring(true);
    try {
      await axios.post(`${API_BASE}/store`, {
        summaries: analysis.summaries,
        insights: analysis.insights,
        intelligence: analysis.intelligence || { 
          document_intent: analysis.document_intent, 
          topics: analysis.major_themes, 
          entities: analysis.entities, 
          relationships: analysis.relationships 
        },
        raw_chunks: analysis.raw_chunks,
        embeddings: analysis.embeddings,
        filename: analysis.filename,
        confirm_update: confirmUpdate,
        force_new: forceNew
      },{
        headers: getHeaders()
      });
      alert(confirmUpdate ? "🔄 Version updated successfully." : "✅ Document permanently indexed.");
      setAnalysis(null); setFile(null); setCollisionData(null); fetchHistory();
    } catch (err: any) { 
      if (err.response?.status === 409) {
        setCollisionData({ show: true, filename: analysis.filename });
      } else if (err.response?.status === 428) {
        setConfigErrorModal({ show: true, type: 'storage' });
      } else {
        alert(err.response?.data?.detail || "Storage failed."); 
      }
    } finally { setStoring(false); }
  };

  const handleDeleteVersion = async (docId: string) => {
    if (!window.confirm("Are you sure you want to deactivate this version?")) return;
    setDeactivatingId(docId);
    try {
      await axios.delete(`${API_BASE}/documents/version/${docId}`, {
        headers: getHeaders()
      });
      alert("Document deactivated successfully.");
      if (analysis?.id === docId) setAnalysis(null);
      fetchHistory();
    } catch (err: any) {
        if (err.response?.status === 428) setConfigErrorModal({ show: true, type: 'storage' });
        else alert(err.response?.data?.detail || "Deactivation failed.");
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const res = await axios.post(`${API_BASE}/search`, null, { 
        params: { user_query: searchQuery }, 
        headers: getHeaders()
      });
      setSearchResult(res.data.answer);
    } catch (err: any) {
        if (err.response?.status === 428) {
            setConfigErrorModal({ show: true, type: 'storage' });
        } else if (err.response?.status === 401) {
            setConfigErrorModal({ show: true, type: 'invalid' });
        }
    } finally { setSearching(false); }
  };

  const fetchDashboard = async () => {
    setSearching(true);
    try {
      const res = await axios.get(`${API_BASE}/dashboard/latest`, {
        headers: getHeaders()
      });
      setDashboard(res.data.dashboard_summary);
    } catch (err: any) {
        if (err.response?.status === 428) {
            setConfigErrorModal({ show: true, type: 'storage' });
        } else if (err.response?.status === 401) {
            setConfigErrorModal({ show: true, type: 'invalid' });
        }
    } finally { setSearching(false); }
  };

  const MarkdownProcessor = ({ content }: { content: string }) => {
    return (
      <ReactMarkdown
        components={{
          p: ({ children }) => {
            if (typeof children === 'string') {
              const parts = children.split(/(\[.*?,.*?\])/g);
              return (
                <p className="mb-4">
                  {parts.map((part, i) => 
                    part.startsWith('[') && part.endsWith(']') ? (
                      <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded border border-slate-200 mx-1 uppercase tracking-tighter shadow-sm">
                        <Database size={10} /> {part.replace(/[\[\]]/g, '')}
                      </span>
                    ) : part
                  )}
                </p>
              );
            }
            return <p className="mb-4">{children}</p>;
          },
          li: ({ children }) => {
            const processText = (text: any) => {
                if (typeof text === 'string') {
                    const parts = text.split(/(\[.*?,.*?\])/g);
                    return parts.map((part, j) => 
                        part.startsWith('[') && part.endsWith(']') ? (
                          <span key={j} className="inline-flex items-center gap-1 bg-slate-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded border border-slate-200 mx-1 uppercase tracking-tighter">
                            <Database size={10} /> {part.replace(/[\[\]]/g, '')}
                          </span>
                        ) : part
                    );
                }
                return text;
            };
            return <li className="mb-2">{Array.isArray(children) ? children.map(processText) : processText(children)}</li>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800 overflow-hidden relative">
      
      {/* DYNAMIC ERROR MODAL */}
      {configErrorModal?.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto">
              {configErrorModal.type === 'storage' ? <Database className="text-indigo-600" size={32}/> : <Cpu className="text-indigo-600" size={32} />}
            </div>
            <h3 className="text-xl font-bold text-center">
                {configErrorModal.type === 'storage' ? "Storage Engine Required" : "AI Engine Deactivated"}
            </h3>
            <p className="text-sm text-slate-500 mt-3 text-center leading-relaxed">
              {configErrorModal.type === 'storage' 
                ? "To commit documents, use the dashboard, or perform searches, you must first link your workspace to a private MongoDB cluster in configuration."
                : "Your workspace is not yet linked to an AI Engine. Please provide a Google Gemini API Key to enable analysis."}
            </p>
            
            <div className="mt-8 space-y-3">
              <button 
                onClick={() => { setActiveTab("config"); setConfigErrorModal(null); }}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                Configure Infrastructure <ArrowRight size={14} />
              </button>
              <button onClick={() => setConfigErrorModal(null)} className="w-full text-slate-400 py-2 text-[10px] font-bold uppercase tracking-widest">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {collisionData?.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="bg-amber-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="text-amber-500" size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Commit Conflict</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              A document named <span className="font-bold text-slate-800">"{collisionData.filename}"</span> already exists.
            </p>
            <div className="mt-6 space-y-3">
              {getRole() === "admin" ? (
                <button 
                  disabled={storing}
                  onClick={() => handleStore(true, false)} 
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  {storing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14}/>} Replace Existing Version
                </button>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <ShieldAlert size={14} className="text-amber-500 mt-0.5" />
                  <p className="text-[10px] leading-tight text-slate-500 font-bold uppercase tracking-tight">Version updates are restricted to Administrators</p>
                </div>
              )}
              <button 
                disabled={storing}
                onClick={() => handleStore(false, true)} 
                className="w-full bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                {storing ? <Loader2 className="animate-spin" size={14} /> : <CopyPlus size={14}/>} Save as New Document
              </button>
              <button onClick={() => setCollisionData(null)} className="w-full text-slate-400 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-slate-600 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Drawer */}
      <div className={`fixed inset-y-0 left-0 w-72 md:w-80 bg-white shadow-2xl z-[100] transform transition-transform duration-300 ease-in-out border-r border-slate-200 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest text-[10px]">Library Archive</h2>
            <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-400"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
            {historyList.map((doc) => (
              <div key={doc.id} className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all">
                <div onClick={() => loadHistoryDoc(doc.id)} className="flex-1 cursor-pointer truncate mr-2">
                  <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-indigo-600">{doc.filename}</p>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 uppercase tracking-tighter font-bold opacity-60"><Clock size={12}/> {new Date(doc.upload_date).toLocaleDateString()}</p>
                </div>
                {getRole() === "admin" && (
                  <button 
                    disabled={deactivatingId === doc.id}
                    onClick={(e) => { e.stopPropagation(); handleDeleteVersion(doc.id); }} 
                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                  >
                    {deactivatingId === doc.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {drawerOpen && <div onClick={() => setDrawerOpen(false)} className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[90]" />}

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 shadow-sm gap-4 md:gap-0">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)} className="p-2 hover:bg-slate-100 rounded-md text-slate-600 border border-slate-200 shadow-sm transition-all"><Menu size={20} /></button>
            <div className="flex items-center gap-2">
              <div className="bg-slate-900 p-1.5 rounded text-white shadow-md"><Cpu size={18} /></div>
              <h1 className="text-base md:text-lg font-bold tracking-tight text-slate-900">AlphaDoc <span className="hidden sm:inline text-indigo-600">Enterprise</span></h1>
            </div>
          </div>
          <div className="md:hidden">
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="p-2 text-rose-500 hover:bg-rose-50 border border-rose-100 rounded-md transition-all">
                <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto no-scrollbar w-full md:w-auto">
                <button onClick={() => setActiveTab("lab")} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-6 py-2 rounded-md text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${activeTab === "lab" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
                    <FileText size={14} /> Lab
                </button>
                <button onClick={() => setActiveTab("repo")} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-6 py-2 rounded-md text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${activeTab === "repo" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
                    <BookOpen size={14} /> Repository
                </button>
                {getRole() === "admin" && (
                  <>
                    <button onClick={fetchAuditLogs} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-6 py-2 rounded-md text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${activeTab === "audit" ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
                        <ShieldAlert size={14} /> Audit
                    </button>
                    <button onClick={() => setActiveTab("config")} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-6 py-2 rounded-md text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${activeTab === "config" ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
                        <Settings size={14} /> Config
                    </button>
                  </>
                )}
            </div>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="hidden md:block p-2 text-rose-500 hover:bg-rose-50 border border-rose-100 rounded-md transition-all">
                <LogOut size={16} />
            </button>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden relative">
        <div className="h-full overflow-y-auto p-4 md:p-8 scrollbar-thin">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* ANALYSIS LAB TAB */}
            {activeTab === "lab" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 pb-12 animate-in fade-in duration-500">
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">Input Engine</h3>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 md:p-8 text-center bg-slate-50/50 hover:bg-white transition-all cursor-pointer relative group">
                      <input type="file" name="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                      <Upload className="mx-auto mb-2 text-slate-400 group-hover:text-indigo-500 transition-colors" size={24} />
                      <p className="text-xs md:text-sm font-medium text-slate-600 truncate">{file ? file.name : "Select Document"}</p>
                    </div>
                    <button disabled={!file || loading} onClick={handleAnalyze} className="w-full mt-4 bg-slate-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-slate-800 disabled:bg-slate-300 transition-all flex items-center justify-center gap-2 shadow-sm">
                      {loading ? <><Loader2 className="animate-spin" size={16} /> Analyzing Structure...</> : "Initialize Extraction"}
                    </button>
                  </div>
                  {analysis && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                       <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2"><Tag size={12}/> Major Themes</h3>
                       <div className="flex flex-wrap gap-2">
                         {analysis.major_themes?.map((theme: string, i: number) => (
                           <span key={i} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tighter border border-indigo-100">{theme}</span>
                         ))}
                       </div>
                    </div>
                  )}
                  {analysis && (
                    <div className="space-y-3">
                      {!analysis._isHistory && (
                        <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 shadow-sm animate-in zoom-in-95">
                          <h3 className="text-sm font-bold text-indigo-900 mb-2 text-center md:text-left">Extraction Complete</h3>
                          <button onClick={() => handleStore()} disabled={storing} className="w-full bg-indigo-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-sm">
                            {storing ? <><Loader2 className="animate-spin" size={16} /> Comitting to Vault...</> : <><Database size={16} /> Commit to Repository</>}
                          </button>
                        </div>
                      )}
                      <button onClick={handleDownloadJSON} className="w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                        <Download size={16} /> Download Intelligence Report
                      </button>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-8 space-y-8">
                  {analysis ? (
                    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2">
                      <div className="bg-slate-900 text-white rounded-xl p-5 md:p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10 hidden md:block"><Target size={120}/></div>
                        <h4 className="text-[9px] md:text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em] mb-2">Semantic Intent Mapping</h4>
                        <p className="text-base md:text-lg font-medium leading-snug relative z-10 italic">"{analysis.document_intent}"</p>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-5 md:px-6 py-4 bg-slate-50 border-b border-slate-200 font-bold text-xs md:text-sm text-slate-700 flex items-center gap-2"><BarChart3 size={16} className="text-indigo-600"/> Summaries</div>
                        <div className="p-5 md:p-8 max-h-[450px] overflow-y-auto scrollbar-thin space-y-6 md:space-y-8">
                          <div>
                            <h4 className="text-[10px] md:text-[11px] font-bold text-indigo-600 uppercase mb-4 tracking-widest border-l-2 border-indigo-600 pl-3">Executive Overview</h4>
                            <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-600 markdown-content"><MarkdownProcessor content={analysis.summaries.executive_summary} /></div>
                          </div>
                          <div className="h-px bg-slate-100" />
                          <div>
                            <h4 className="text-[10px] md:text-[11px] font-bold text-indigo-600 uppercase mb-4 tracking-widest border-l-2 border-indigo-600 pl-3">Technical Decomposition</h4>
                            <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-600 markdown-content"><MarkdownProcessor content={analysis.summaries.technical_summary} /></div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                           <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs flex items-center gap-2"><Users size={14} className="text-indigo-600"/> Stakeholders & Entities</div>
                           <div className="p-4 max-h-[250px] overflow-y-auto scrollbar-thin space-y-2">
                                {analysis.entities?.map((ent: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                                    <span className="text-[10px] md:text-xs font-bold text-slate-700">{ent.name}</span>
                                    <span className="text-[8px] md:text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-black uppercase whitespace-nowrap ml-2">{ent.type}</span>
                                  </div>
                                ))}
                           </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                           <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs flex items-center gap-2"><Network size={14} className="text-indigo-600"/> Obligations & Logic</div>
                           <div className="p-4 max-h-[250px] overflow-y-auto scrollbar-thin space-y-3">
                                {analysis.relationships?.map((rel: any, i: number) => (
                                  <div key={i} className="text-[10px] md:text-[11px] border-l-2 border-indigo-200 pl-3 py-1">
                                    <span className="font-bold text-indigo-600">{rel.subject}</span><span className="mx-1 text-slate-400 italic">{rel.relation}</span><span className="font-bold text-slate-700">{rel.object}</span>
                                  </div>
                                ))}
                           </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Action Items</h3>
                        <div className="max-h-[500px] overflow-y-auto scrollbar-thin pr-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                            {analysis.insights.insights?.filter((ins: any) => ins.description && ins.description !== "N/A").map((ins: any, idx: number) => {
                                const typeColors: any = { Risk: "border-l-rose-500", Decision: "border-l-blue-500", Recommendation: "border-l-emerald-500", Deadline: "border-l-amber-500" };
                                return (
                                <div key={idx} className={`p-4 md:p-5 bg-white rounded-lg border border-slate-200 border-l-4 ${typeColors[ins.type] || "border-l-slate-400"} shadow-sm`}>
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{ins.type}</span>
                                      <span className="text-[9px] font-mono text-slate-300 uppercase">CHUNK_{ins.chunk_index}</span>
                                    </div>
                                    <h4 className="text-[13px] font-bold mb-2 text-slate-800 leading-tight">{ins.header}</h4>
                                    <p className="text-[12px] leading-relaxed text-slate-600">{ins.description}</p>
                                </div>
                                );
                            })}
                            </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-5 md:px-6 py-4 bg-slate-50 border-b border-slate-200 font-bold text-xs md:text-sm text-slate-700 flex items-center gap-2"><Layers size={16} className="text-indigo-600"/> Granular Breakdown</div>
                        <div className="max-h-[350px] overflow-y-auto scrollbar-thin divide-y divide-slate-100">
                          {analysis.summaries.section_summaries?.map((sec: any, idx: number) => (
                            <div key={idx} className="p-5 md:p-6 hover:bg-slate-50/50 transition-all">
                              <h4 className="text-[10px] md:text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide">{sec.section_header}</h4>
                              <p className="text-[12px] md:text-[13px] text-slate-600 leading-relaxed">{sec.summary_text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 md:h-72 flex flex-col items-center justify-center text-slate-400 bg-white border-2 border-dashed border-slate-200 rounded-xl shadow-sm px-4 text-center">
                      <div className="bg-slate-50 p-4 rounded-full mb-4"><Lightbulb size={32} className="opacity-40 text-indigo-500" /></div>
                      <p className="text-xs md:text-sm font-semibold text-slate-500 uppercase tracking-widest">Extraction Engine Idling</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "repo" && (
              <div className="space-y-6 animate-in slide-in-from-right-10 duration-500 pb-12">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-200 pb-6 gap-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Intelligence Repository</h2>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold italic">Cross-Document Knowledge Store</p>
                  </div>
                  <button 
                    onClick={fetchDashboard} 
                    disabled={searching} 
                    className="w-full md:w-auto bg-slate-900 text-white px-6 py-2.5 rounded-lg text-[10px] md:text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    {searching ? <><Loader2 className="animate-spin" size={14}/> Synchronizing...</> : <><BarChart3 size={14}/> Refresh Aggregate Insights</>}
                  </button>
                </div>

                {/* Two-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  
                  {/* COLUMN 1: SYNTHESIS OUTPUT */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Intelligence</span>
                      {dashboard && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase">Live View</span>}
                    </div>
                    <div className="p-6 md:p-8 overflow-y-auto scrollbar-thin flex-1 bg-white">
                      {dashboard ? (
                        <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700 markdown-content">
                          <MarkdownProcessor content={dashboard} />
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center space-y-4">
                          <div className="bg-slate-50 p-6 rounded-full">
                            <BarChart3 size={40} className="opacity-20 text-indigo-600" />
                          </div>
                          <p className="text-[10px] md:text-xs font-medium italic uppercase tracking-widest max-w-[200px]">
                            Execute refresh to synthesize patterns across your repository
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COLUMN 2: SEARCH ENGINE */}
                  <div className="space-y-6 flex flex-col h-[600px]">
                    {/* Search Input Card */}
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Search size={80} />
                      </div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2">
                        <Network size={14} className="text-indigo-600" /> Neural RAG Query
                      </h3>
                      <div className="relative flex flex-col gap-2">
                        <input 
                          type="text" 
                          placeholder="Ask anything about your documents..." 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner" 
                          value={searchQuery} 
                          onChange={(e) => setSearchQuery(e.target.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button 
                          onClick={handleSearch} 
                          disabled={searching || !searchQuery} 
                          className="bg-indigo-600 text-white py-3 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:bg-slate-300"
                        >
                          {searching ? <Loader2 className="animate-spin" size={16}/> : <Search size={16}/>} 
                          Execute Semantic Search
                        </button>
                      </div>
                    </div>

                    {/* Results Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Search Results
                      </div>
                      <div className="p-6 overflow-y-auto scrollbar-thin flex-1">
                        {searchResult ? (
                          <div className="animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-indigo-50">
                              <ShieldAlert size={14} className="text-indigo-600"/>
                              <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Verified Grounded Intelligence</h4>
                            </div>
                            <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-600 markdown-content">
                              <MarkdownProcessor content={searchResult} />
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                            <div className="bg-slate-50 p-4 rounded-full mb-3">
                              <Lightbulb size={24} className="opacity-20" />
                            </div>
                            <p className="text-[10px] uppercase font-bold tracking-tighter">Awaiting Input</p>
                            <p className="text-[9px] italic mt-1">Queries are grounded in your private repository data</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* AUDIT TRAIL */}
            {activeTab === "audit" && (
              <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-500 pb-12">
                <div className="border-b border-slate-200 pb-6 text-center md:text-left">
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Audit Trail</h2>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 italic">Monitoring: {getWsId()}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {auditLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-[10px] font-mono text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="px-6 py-4"><div className="flex flex-col"><span className="text-[11px] font-bold text-slate-700">{log.username}</span><span className="text-[8px] font-black uppercase text-indigo-500 tracking-tighter">{log.role}</span></div></td>
                          <td className="px-6 py-4 text-xs"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-md uppercase text-[9px]">{log.action}</span></td>
                          <td className="px-6 py-4 text-[11px] text-slate-600 max-w-[200px] truncate">{log.action === "RAG_QUERY" ? log.details.query : (log.details.filename || JSON.stringify(log.details))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CONFIGURATION */}
            {activeTab === "config" && (
              <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-10 pb-20">
                <div className="border-b border-slate-200 pb-6">
                  <h2 className="text-xl font-bold text-slate-900">Infrastructure Settings</h2>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Configure workspace engines</p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><Cpu size={20} /></div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Intelligence Engine</h3>
                      <p className="text-[11px] text-slate-500">Powering document decomposition and intent mapping.</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="password" placeholder="Enter Gemini API Key..." className="flex-1 bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={configKey} onChange={(e) => setConfigKey(e.target.value)} />
                    <button onClick={handleUpdateConfig} disabled={updatingConfig} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap min-w-[120px] flex justify-center shadow-lg">
                      {updatingConfig ? <Loader2 className="animate-spin" size={16}/> : "Set Key"}
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><Database size={20} /></div>
                    <h3 className="text-sm font-bold text-slate-800">Private Repository Engine</h3>
                  </div>

                  

                  <div className="space-y-4 mb-6 rounded-lg">
                    <input type="text" placeholder="MongoDB Connection URI..." className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={mongoUri} onChange={(e) => setMongoUri(e.target.value)} />
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input type="text" placeholder="Index Name..." className="flex-1 bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={vectorIndexName} onChange={(e) => setVectorIndexName(e.target.value)} />
                      <button onClick={handleUpdateMongo} disabled={updatingMongo} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap min-w-[120px] flex justify-center shadow-lg">
                        {updatingMongo ? <Loader2 className="animate-spin" size={16}/> : "Link Cluster"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6 p-4 md:p-6 bg-slate-950 rounded-lg border-l-4 border-indigo-500 shadow-lg">
                    <div className="flex items-center gap-2 mb-2 text-indigo-400 font-bold uppercase tracking-widest text-[10px]">
                      <Code size={16} /> Configuration Protocol
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-4">
                      Initialize Extraction atleast once then Navigate to your <strong>Atlas Search</strong> tab, search for database <span className="text-indigo-400 font-mono">workspace_{getWsId()}</span> and select collection <span className="text-indigo-400 font-mono italic underline">chunks</span>, then paste this into the JSON editor:
                    </p>
                    <pre className="bg-slate-900 text-indigo-300 p-3 rounded text-[10px] font-mono border border-slate-800 shadow-inner overflow-x-auto leading-relaxed">
{`{
  "fields": [
    { "numDimensions": 768, "path": "embedding", "similarity": "cosine", "type": "vector" },
    { "path": "section_header", "type": "filter" },
    { "path": "insight_types", "type": "filter" },
    { "path": "parent_doc_id", "type": "filter" },
    { "path": "entities.name", "type": "filter" },
    { "path": "entities.type", "type": "filter" },
    { "path": "relationships.relation", "type": "filter" },
    { "path": "is_current", "type": "filter" }
  ]
}`}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <style jsx global>{`
        .markdown-content h1, .markdown-content h2, .markdown-content h3 { font-weight: 700; color: #1e293b; margin-top: 1.5rem; margin-bottom: 0.75rem; }
        .markdown-content p { margin-bottom: 1.25rem; line-height: 1.7; }
        .markdown-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.5rem; }
        .scrollbar-thin::-webkit-scrollbar { width: 5px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}