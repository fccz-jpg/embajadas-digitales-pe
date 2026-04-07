import { useState, useEffect, useCallback, useRef } from "react";
import { 
  FileText, 
  Plus, 
  History, 
  Globe, 
  ChevronRight, 
  ChevronLeft,
  Loader2, 
  Download,
  MapPin,
  LayoutDashboard,
  Radio,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  Activity,
  AlertTriangle,
  Zap,
  Coins,
  Languages,
  Eye,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Shield
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn, getMostFrequentWords } from "./lib/utils";
import { generateEmbassyReport, generateMediaDatabase } from "./services/geminiService";
import { Report, MediaSource, NewsItem, EMBASSIES } from "./types";

function getFavicon(url?: string): string | null {
  if (!url) return null;
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

const TAB_KEYWORDS: Record<string, string[]> = {
  politico: ["política", "gobierno", "gobernanza", "estabilidad", "presidente", "ministro", "parlamento", "elección", "partido", "constitución"],
  economico: ["economía", "económic", "inversión", "comercio", "inflación", "pib", "crecimiento", "mercado", "empresa", "industria", "finanza"],
  cultural: ["cultura", "cultural", "arte", "artíst", "exposición", "museo", "patrimonio", "unesco", "turismo", "evento", "festival", "educación"],
  relaciones_internacionales: ["diplomaci", "bilateral", "caricom", "oea", "sica", "onu", "cooperación", "tratado", "cancillería", "embajada", "internacional"],
};

function inferCategory(item: { title: string; preview?: string; category?: string | null }): string | null {
  if (item.category) return item.category;
  const text = `${item.title} ${item.preview ?? ""}`.toLowerCase();
  for (const [cat, kws] of Object.entries(TAB_KEYWORDS)) {
    if (kws.some(k => text.includes(k))) return cat;
  }
  return null;
}

// Get the display text for a report (handles new per-category format + legacy multi-section format)
function getReportText(report: Report | undefined, tab: string): string {
  if (!report) return "";
  const c = report.content;
  if (typeof c === "string") return c;
  if (c.text) return c.text;
  return (c as Record<string, string>)[tab] ?? "";
}

// Type-safe accessor for report content sections (legacy)
function getReportContent(
  content: Report["content"],
  tab: "politico" | "economico" | "cultural" | "relaciones_internacionales" | "panorama_general"
): string {
  if (typeof content === "string") return content;
  if ((content as {text?: string}).text) return (content as {text: string}).text;
  return (content as Record<string, string>)[tab] ?? "";
}

// Real-time status check via no-cors fetch (checks if server responds)
async function checkUrlReachable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    await fetch(url, { method: "HEAD", mode: "no-cors", signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);
    return true;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}
import EmbassyMap from "./components/EmbassyMap";
import WorldMapView from "./components/WorldMapView";

type View = "home" | "dashboard" | "monitoring" | "reports";

export default function App() {
  const [activeView, setActiveView] = useState<View>("home");
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [location, setLocation] = useState("Ciudad de México");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"politico" | "economico" | "cultural" | "relaciones_internacionales" | "panorama_general">("politico");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaSources, setMediaSources] = useState<MediaSource[]>([]);
  const [allCategoryNews, setAllCategoryNews] = useState<NewsItem[]>([]);
  const [mediaCountryFilter, setMediaCountryFilter] = useState<string>("all");
  const [isCheckingMedia, setIsCheckingMedia] = useState(false);
  const [isUpdatingMedia, setIsUpdatingMedia] = useState(false);
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);

  // Fetch live RSS news whenever location or active tab changes
  useEffect(() => {
    if (activeView !== "dashboard") return;
    if (activeTab === "panorama_general") return;
    setIsLoadingNews(true);
    setLiveNews([]);
    fetch(`/api/news?location=${encodeURIComponent(location)}&category=${encodeURIComponent(activeTab)}`)
      .then(r => r.json())
      .then(data => setLiveNews(Array.isArray(data) ? data : []))
      .catch(() => setLiveNews([]))
      .finally(() => setIsLoadingNews(false));
  }, [location, activeTab, activeView]);

  // Fetch all 4 categories in parallel for dashboard metrics
  useEffect(() => {
    if (activeView !== "dashboard") return;
    setAllCategoryNews([]);
    const cats = ["politico", "economico", "cultural", "relaciones_internacionales"];
    Promise.all(cats.map(cat =>
      fetch(`/api/news?location=${encodeURIComponent(location)}&category=${encodeURIComponent(cat)}`)
        .then(r => r.json())
        .then(data => Array.isArray(data) ? data.map((item: NewsItem) => ({ ...item, category: cat as NewsItem["category"] })) : [])
        .catch(() => [])
    )).then(results => setAllCategoryNews((results as NewsItem[][]).flat()));
  }, [location, activeView]);

  // Load reports from API (fallback to localStorage when offline)
  useEffect(() => {
    fetch("/api/reports")
      .then(r => r.json())
      .then((apiReports: Report[]) => {
        if (apiReports.length > 0) {
          setReports(apiReports);
          localStorage.setItem("mre_reports", JSON.stringify(apiReports));
        } else {
          const saved = localStorage.getItem("mre_reports");
          if (saved) setReports(JSON.parse(saved));
        }
      })
      .catch(() => {
        try {
          const saved = localStorage.getItem("mre_reports");
          if (saved) setReports(JSON.parse(saved));
        } catch {
          localStorage.removeItem("mre_reports");
        }
      });
  }, []);

  const saveReports = (newReports: Report[]) => {
    setReports(newReports);
    localStorage.setItem("mre_reports", JSON.stringify(newReports));
  };

  const handleUpdateMonitoring = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const newReports: Report[] = await generateEmbassyReport(location, location);
      const updatedCategories = new Set(newReports.map(r => r.category).filter(Boolean));
      setReports(prev => {
        const filtered = prev.filter(r =>
          !(r.location === location && r.category && updatedCategories.has(r.category))
        );
        const result = [...newReports, ...filtered];
        localStorage.setItem("mre_reports", JSON.stringify(result));
        return result;
      });
      setActiveView("dashboard");
    } catch (err) {
      setError("Error al actualizar el monitoreo. Verifique su conexión e intente de nuevo.");
      console.error("Failed to update monitoring", err);
    } finally {
      setIsGenerating(false);
    }
  }, [location]);

  // Keep a ref to the latest handleUpdateMonitoring to avoid stale closure in interval
  const handleUpdateMonitoringRef = useRef(handleUpdateMonitoring);
  handleUpdateMonitoringRef.current = handleUpdateMonitoring;

  // Hourly update logic — only triggers if last report is > 1 hour old
  useEffect(() => {
    const checkAndUpdate = () => {
      const lastReport = reports.find(r => r.location === location);
      if (!lastReport) return;
      const diffInHours = (Date.now() - new Date(lastReport.createdAt).getTime()) / (1000 * 60 * 60);
      if (diffInHours >= 1) {
        handleUpdateMonitoringRef.current();
      }
    };

    const interval = setInterval(checkAndUpdate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [location, reports]);

  // Real-time media status check using no-cors HEAD requests
  const handleCheckMediaStatus = useCallback(async () => {
    setIsCheckingMedia(true);
    setMediaSources(prev => prev.map(s => ({ ...s, status: "Verificando" as const })));
    const updated = await Promise.all(
      mediaSources.map(async (source) => {
        const alive = await checkUrlReachable(source.url);
        return { ...source, status: (alive ? "Activo" : "Inactivo") as MediaSource["status"], lastCheck: new Date().toISOString() };
      })
    );
    setMediaSources(updated);
    setIsCheckingMedia(false);
  }, [mediaSources]);

  // Refresh media database for current location using Gemini AI
  const handleUpdateMediaDatabase = useCallback(async () => {
    setIsUpdatingMedia(true);
    setError(null);
    try {
      const newSources = await generateMediaDatabase(location);
      setMediaSources(prev => [
        ...prev.filter(s => s.location !== location),
        ...newSources,
      ]);
    } catch (err) {
      setError("No se pudo actualizar la base de medios. Intente de nuevo.");
      console.error("Failed to update media database", err);
    } finally {
      setIsUpdatingMedia(false);
    }
  }, [location]);

  const filteredMedia = mediaSources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCountry = mediaCountryFilter === "all" || source.country === mediaCountryFilter;
    return matchesSearch && matchesCountry;
  });

  const uniqueMediaCountries = [...new Set(mediaSources.map(s => s.country))].sort();

  const latestReportForLocation = reports.find(r => r.location === location);
  // Per-category report (new format) — falls back to combined report (legacy format)
  const activeTabReport =
    reports.find(r => r.location === location && r.category === activeTab)
    ?? reports.find(r => r.location === location && !r.category);

  // ── Dashboard metrics derived from real RSS news ─────────────────────────
  const CRISIS_KW = ["crisis","conflicto","violencia","protesta","huelga","emergencia","ataque","colapso","caos","desastre","disturbio","golpe"];
  const NEG_ECON_KW = ["recesión","desempleo","quiebra","déficit","contracción","caída","pérdida","escasez","devaluación","embargo"];
  const uniqueSources = new Set(allCategoryNews.map(n => n.source)).size;
  const criticalAlerts = allCategoryNews.filter(n => {
    const text = `${n.title} ${n.preview ?? ""}`.toLowerCase();
    return CRISIS_KW.some(k => text.includes(k));
  }).length;
  const riskLevel = criticalAlerts === 0 ? "Bajo" : criticalAlerts <= 3 ? "Medio" : "Alto";
  const riskColor = criticalAlerts === 0 ? "text-green-600" : criticalAlerts <= 3 ? "text-amber-500" : "text-red-600";
  const riskIconColor = criticalAlerts === 0 ? "text-green-500" : criticalAlerts <= 3 ? "text-amber-400" : "text-red-500";
  const politicalNews = allCategoryNews.filter(n => n.category === "politico");
  const economicNews = allCategoryNews.filter(n => n.category === "economico");
  const polCrisis = politicalNews.filter(n => CRISIS_KW.some(k => `${n.title} ${n.preview ?? ""}`.toLowerCase().includes(k))).length;
  const econNeg = economicNews.filter(n => [...CRISIS_KW, ...NEG_ECON_KW].some(k => `${n.title} ${n.preview ?? ""}`.toLowerCase().includes(k))).length;
  const polStability = politicalNews.length > 0 ? Math.round((1 - polCrisis / politicalNews.length) * 100) : null;
  const econStability = economicNews.length > 0 ? Math.round((1 - econNeg / economicNews.length) * 100) : null;
  const polColor = polStability !== null && polStability >= 70 ? "text-green-600" : polStability !== null && polStability >= 40 ? "text-amber-600" : "text-red-600";
  const polBarColor = polStability !== null && polStability >= 70 ? "bg-green-500" : polStability !== null && polStability >= 40 ? "bg-amber-500" : "bg-red-500";
  const econColor = econStability !== null && econStability >= 70 ? "text-green-600" : econStability !== null && econStability >= 40 ? "text-amber-600" : "text-red-600";
  const econBarColor = econStability !== null && econStability >= 70 ? "bg-green-500" : econStability !== null && econStability >= 40 ? "bg-amber-500" : "bg-red-500";

  const viewNames: Record<View, string> = {
    home: "Inicio",
    dashboard: "Situación país",
    monitoring: "Fuentes",
    reports: "Análisis cruzado"
  };

  return (
    <div className="flex h-screen bg-stone-50 overflow-hidden">
      {/* Sidebar */}
      <div className="relative flex h-full">
        <aside className={cn(
          "w-80 border-r border-stone-200 bg-white flex flex-col transition-all duration-300 ease-in-out relative z-30",
          !isSidebarOpen && "w-0 border-r-0"
        )}>
          <div className={cn(
            "flex flex-col h-full w-80 transition-opacity duration-200",
            !isSidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100"
          )}>
            <div className="p-6 border-b border-stone-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-mre-blue flex items-center justify-center rounded-lg shadow-lg shadow-mre-blue/20">
                  <Eye className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="font-bold text-stone-900 leading-tight tracking-tight">Embajadas digitales - PE</h1>
                  <p className="text-[10px] tracking-widest text-stone-400 font-bold">Monitor geopolítico</p>
                </div>
              </div>

              <nav className="space-y-1">
                <button
                  onClick={() => setActiveView("home")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all",
                    activeView === "home" ? "bg-stone-100 text-mre-blue" : "text-stone-500 hover:bg-stone-50"
                  )}
                >
                  <Globe size={18} />
                  Inicio
                </button>
                <button
                  onClick={() => setActiveView("dashboard")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all",
                    activeView === "dashboard" ? "bg-stone-100 text-mre-blue" : "text-stone-500 hover:bg-stone-50"
                  )}
                >
                  <LayoutDashboard size={18} />
                  Situación país
                </button>
                <button
                  onClick={() => setActiveView("monitoring")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all",
                    activeView === "monitoring" ? "bg-stone-100 text-mre-blue" : "text-stone-500 hover:bg-stone-50"
                  )}
                >
                  <Radio size={18} />
                  Fuentes
                </button>
                <button
                  onClick={() => setActiveView("reports")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all",
                    activeView === "reports" ? "bg-stone-100 text-mre-blue" : "text-stone-500 hover:bg-stone-50"
                  )}
                >
                  <History size={18} />
                  Análisis cruzado
                </button>
              </nav>
            </div>

            <div className="p-4 space-y-4">
              <button
                onClick={handleUpdateMonitoring}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 bg-mre-blue hover:bg-blue-800 text-white py-3 px-4 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                Actualizar monitor
              </button>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 tracking-widest flex items-center gap-2">
                  <Globe size={12} />
                  País en seguimiento
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-md px-3 py-2 text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-mre-blue/20 focus:border-mre-blue transition-all"
                >
                  {EMBASSIES.map((emb) => (
                    <option key={emb.id} value={emb.name}>
                      {emb.name}, {emb.country}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2">
              {activeView === "reports" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-bold text-stone-400 tracking-widest">Historial</h3>
                    <button 
                      onClick={() => setSelectedReport(null)}
                      className="text-[10px] font-bold text-mre-blue tracking-widest hover:underline"
                    >
                      Nuevo
                    </button>
                  </div>
                  <div className="space-y-1">
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-xs transition-all",
                          selectedReport?.id === report.id ? "bg-stone-100 text-mre-blue font-bold" : "text-stone-500 hover:bg-stone-50"
                        )}
                      >
                        <div className="truncate">{report.location}</div>
                        <div className="text-[9px] opacity-60">{format(new Date(report.createdAt), "dd/MM/yyyy HH:mm")}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-stone-100 bg-stone-50">
              <div className="flex items-center gap-3 text-stone-400 text-[10px] font-bold tracking-widest">
                <Activity size={12} />
                Estado del sistema: <span className="text-green-600">En línea</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Sidebar Toggle Button - Centered on edge */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-40 w-6 h-12 bg-white border border-stone-200 rounded-r-lg flex items-center justify-center shadow-md hover:bg-stone-50 transition-all duration-300 group",
            isSidebarOpen ? "left-80" : "left-0"
          )}
          title={isSidebarOpen ? "Ocultar lateral" : "Mostrar lateral"}
        >
          {isSidebarOpen ? (
            <ChevronLeft size={14} className="text-stone-400 group-hover:text-mre-blue" />
          ) : (
            <ChevronRight size={14} className="text-stone-400 group-hover:text-mre-blue" />
          )}
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-blue-50/30 overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-gradient-to-r from-mre-blue to-blue-900 text-white px-8 py-4 flex items-center justify-between shadow-lg z-20">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-md flex items-center justify-center rounded-md">
              {activeView === "home" && <Globe size={18} />}
              {activeView === "dashboard" && <LayoutDashboard size={18} />}
              {activeView === "monitoring" && <Radio size={18} />}
              {activeView === "reports" && <History size={18} />}
            </div>
            <h2 className="text-lg font-black tracking-tighter">{viewNames[activeView]}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-bold tracking-widest opacity-70">País:</div>
            <div className="relative">
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-white/10 pl-3 pr-8 py-1 rounded-full text-xs font-bold border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 cursor-pointer appearance-none transition-all hover:bg-white/20"
              >
                {EMBASSIES.map((emb) => (
                  <option key={emb.id} value={emb.name} className="text-stone-900">
                    {emb.name}, {emb.country}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60">
                <ChevronRight size={12} className="rotate-90" />
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 border-b border-red-200 px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
              <AlertTriangle size={16} />
              {error}
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
          </div>
        )}

        {activeView === "home" ? (
          <div className="p-8 h-full flex flex-col">
            <div className="flex-1">
              <WorldMapView 
                onLocationSelect={(loc) => {
                  setLocation(loc);
                  setActiveView("dashboard");
                }} 
              />
            </div>
          </div>
        ) : activeView === "dashboard" ? (
          <div className="flex-1 overflow-y-auto">
            <div className="p-8 max-w-6xl mx-auto space-y-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-bold text-stone-400 tracking-[0.2em] flex items-center gap-2">
                  <Activity size={14} className="text-mre-blue" />
                  Estado de monitoreo: {location}
                </h3>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-100 shadow-sm rounded-full text-[10px] font-bold text-stone-500 tracking-wider">
                  <Clock size={12} className="text-mre-blue" />
                  Sincronizado: {format(new Date(), "HH:mm:ss")}
                </div>
              </div>

              {/* Top Dashboard Row: Stats & Stability */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-stone-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[9px] font-bold text-stone-400 tracking-widest mb-2">Fuentes activas</p>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold text-stone-900 tracking-tighter">
                        {uniqueSources > 0 ? uniqueSources : "—"}
                      </span>
                      <Radio className="text-mre-blue" size={18} />
                    </div>
                  </div>
                  <div className="bg-white border border-stone-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[9px] font-bold text-stone-400 tracking-widest mb-2">Alertas críticas</p>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold text-stone-900 tracking-tighter">
                        {allCategoryNews.length > 0 ? criticalAlerts : "—"}
                      </span>
                      <AlertTriangle className="text-amber-500" size={18} />
                    </div>
                  </div>
                  <div className="bg-white border border-stone-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[9px] font-bold text-stone-400 tracking-widest mb-2">Nivel de riesgo</p>
                    <div className="flex items-end justify-between">
                      <span className={`text-2xl font-bold tracking-tighter ${allCategoryNews.length > 0 ? riskColor : "text-stone-400"}`}>
                        {allCategoryNews.length > 0 ? riskLevel : "—"}
                      </span>
                      <Activity className={allCategoryNews.length > 0 ? riskIconColor : "text-stone-300"} size={18} />
                    </div>
                  </div>
                  <div className="bg-white border border-stone-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[9px] font-bold text-stone-400 tracking-widest mb-2">Análisis IA</p>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold text-stone-900 tracking-tighter">
                        {reports.filter(r => r.location === location).length}
                      </span>
                      <Zap className="text-mre-blue" size={18} />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-stone-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[9px] font-bold text-stone-400 tracking-widest">Indicadores de estabilidad</p>
                    <Activity size={14} className="text-stone-300" />
                  </div>
                  {polStability === null && econStability === null ? (
                    <p className="text-[10px] text-stone-400 italic text-center py-4">Cargando datos...</p>
                  ) : (
                  <div className="space-y-3">
                    {polStability !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-bold tracking-wider">
                        <span className="text-stone-500">Política</span>
                        <span className={polColor}>{polStability}%</span>
                      </div>
                      <div className="w-full bg-stone-100 h-1 rounded-full overflow-hidden">
                        <div className={`${polBarColor} h-full transition-all`} style={{ width: `${polStability}%` }}></div>
                      </div>
                    </div>
                    )}
                    {econStability !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-bold tracking-wider">
                        <span className="text-stone-500">Economía</span>
                        <span className={econColor}>{econStability}%</span>
                      </div>
                      <div className="w-full bg-stone-100 h-1 rounded-full overflow-hidden">
                        <div className={`${econBarColor} h-full transition-all`} style={{ width: `${econStability}%` }}></div>
                      </div>
                    </div>
                    )}
                  </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  {/* Latest Analysis */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-bold text-stone-400 tracking-[0.2em] flex items-center gap-2">
                        <FileText size={14} />
                        Análisis estratégico
                      </h3>
                    </div>
                    <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden shadow-lg flex flex-col">
                        {/* Analysis Tabs */}
                        <div className="flex border-b border-stone-100 overflow-hidden">
                          {/* Político — Navy blue */}
                          <button
                            onClick={() => setActiveTab("politico")}
                            className={cn(
                              "flex-1 py-4 px-2 text-[9px] font-black tracking-widest transition-all flex flex-col items-center gap-1.5 border-r border-stone-100",
                              activeTab === "politico"
                                ? "bg-blue-950 text-white"
                                : "text-stone-400 hover:bg-blue-950/5 hover:text-blue-900"
                            )}
                          >
                            <Shield size={15} className={activeTab === "politico" ? "text-blue-300" : ""} />
                            <span>Político</span>
                            {activeTab === "politico" && <span className="w-4 h-0.5 bg-blue-400 rounded-full" />}
                          </button>

                          {/* Económico — Amber */}
                          <button
                            onClick={() => setActiveTab("economico")}
                            className={cn(
                              "flex-1 py-4 px-2 text-[9px] font-black tracking-widest transition-all flex flex-col items-center gap-1.5 border-r border-stone-100",
                              activeTab === "economico"
                                ? "bg-amber-500 text-white"
                                : "text-stone-400 hover:bg-amber-50 hover:text-amber-700"
                            )}
                          >
                            <Coins size={15} className={activeTab === "economico" ? "text-amber-100" : ""} />
                            <span>Económico</span>
                            {activeTab === "economico" && <span className="w-4 h-0.5 bg-amber-200 rounded-full" />}
                          </button>

                          {/* Cultural — Violet */}
                          <button
                            onClick={() => setActiveTab("cultural")}
                            className={cn(
                              "flex-1 py-4 px-2 text-[9px] font-black tracking-widest transition-all flex flex-col items-center gap-1.5 border-r border-stone-100",
                              activeTab === "cultural"
                                ? "bg-violet-600 text-white"
                                : "text-stone-400 hover:bg-violet-50 hover:text-violet-700"
                            )}
                          >
                            <Languages size={15} className={activeTab === "cultural" ? "text-violet-200" : ""} />
                            <span>Cultural</span>
                            {activeTab === "cultural" && <span className="w-4 h-0.5 bg-violet-300 rounded-full" />}
                          </button>

                          {/* Relaciones Internacionales — Teal */}
                          <button
                            onClick={() => setActiveTab("relaciones_internacionales")}
                            className={cn(
                              "flex-1 py-4 px-2 text-[9px] font-black tracking-widest transition-all flex flex-col items-center gap-1.5 border-r border-stone-100",
                              activeTab === "relaciones_internacionales"
                                ? "bg-teal-600 text-white"
                                : "text-stone-400 hover:bg-teal-50 hover:text-teal-700"
                            )}
                          >
                            <Globe size={15} className={activeTab === "relaciones_internacionales" ? "text-teal-200" : ""} />
                            <span className="text-center leading-tight">RR. Int.</span>
                            {activeTab === "relaciones_internacionales" && <span className="w-4 h-0.5 bg-teal-300 rounded-full" />}
                          </button>

                          {/* Panorama General — Dark red */}
                          <button
                            onClick={() => setActiveTab("panorama_general")}
                            className={cn(
                              "flex-1 py-4 px-2 text-[9px] font-black tracking-widest transition-all flex flex-col items-center gap-1.5",
                              activeTab === "panorama_general"
                                ? "bg-red-800 text-white"
                                : "text-stone-400 hover:bg-red-50 hover:text-red-800"
                            )}
                          >
                            <FileText size={15} className={activeTab === "panorama_general" ? "text-red-200" : ""} />
                            <span className="text-center leading-tight">Informe</span>
                            {activeTab === "panorama_general" && <span className="w-4 h-0.5 bg-red-300 rounded-full" />}
                          </button>
                        </div>

                        {/* Content area */}
                        <div className={cn(
                          "flex-1 border-l-4",
                          activeTab === "politico" && "border-blue-950",
                          activeTab === "economico" && "border-amber-500",
                          activeTab === "cultural" && "border-violet-600",
                          activeTab === "relaciones_internacionales" && "border-teal-600",
                          activeTab === "panorama_general" && "border-red-800"
                        )}>
                          {/* Header */}
                          <div className={cn(
                            "px-6 py-4 border-b flex items-center justify-between",
                            activeTab === "politico" && "bg-blue-950 border-blue-900",
                            activeTab === "economico" && "bg-amber-50 border-amber-100",
                            activeTab === "cultural" && "bg-violet-50 border-violet-100",
                            activeTab === "relaciones_internacionales" && "bg-teal-50 border-teal-100",
                            activeTab === "panorama_general" && "bg-red-900 border-red-800"
                          )}>
                            <div>
                              <h2 className={cn(
                                "text-lg font-black tracking-tight",
                                activeTab === "politico" || activeTab === "panorama_general" ? "text-white" : "text-stone-900"
                              )}>
                                {activeTab === "politico" && "Monitor Político"}
                                {activeTab === "economico" && "Monitor Económico"}
                                {activeTab === "cultural" && "Monitor Cultural"}
                                {activeTab === "relaciones_internacionales" && "Monitor Diplomático"}
                                {activeTab === "panorama_general" && "Informe Diario"}
                                <span className={cn("font-light ml-2 text-sm", activeTab === "politico" ? "text-blue-300" : activeTab === "panorama_general" ? "text-red-200" : "text-stone-400")}>
                                  — {location}
                                </span>
                              </h2>
                              <p className={cn("text-[10px] font-bold tracking-widest mt-0.5",
                                activeTab === "politico" ? "text-blue-400" :
                                activeTab === "panorama_general" ? "text-red-300" : "text-stone-400"
                              )}>
                                {activeTab === "panorama_general" ? "SÍNTESIS ESTRATÉGICA DIARIA · IA" : "NOTICIAS EN TIEMPO REAL · ÚLTIMAS 24H"}
                              </p>
                            </div>
                            <div className={cn(
                              "flex items-center gap-1.5 text-[9px] font-black tracking-widest",
                              activeTab === "politico" ? "text-blue-300" : activeTab === "panorama_general" ? "text-red-300" : "text-stone-400"
                            )}>
                              {activeTab === "panorama_general" ? (
                                <><Zap size={12} /><span>ANÁLISIS IA</span></>
                              ) : (
                                <><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /><span>EN VIVO</span></>
                              )}
                            </div>
                          </div>

                          {/* Daily briefing — shown BEFORE news if a report exists */}
                          {activeTabReport && getReportText(activeTabReport, activeTab) && (
                            <div className="border-b border-stone-200">
                              <div className="px-6 pt-5 pb-2 flex items-center justify-between">
                                <span className="text-[9px] font-black tracking-[0.2em] text-stone-400 flex items-center gap-1.5">
                                  <Zap size={11} className="text-mre-blue" />
                                  REPORTE DIARIO IA — {format(new Date(activeTabReport.createdAt), "dd MMM yyyy", { locale: es }).toUpperCase()}
                                </span>
                                <span className="text-[8px] text-stone-300 font-bold tracking-widest">GENERADO POR CLAUDE</span>
                              </div>
                              <div className="px-6 pb-6">
                                <div className="bg-stone-50 border border-stone-100 rounded-xl p-6 text-[13px] leading-relaxed text-stone-800 space-y-5
                                  [&_p]:mb-0
                                  ">
                                  {getReportText(activeTabReport, activeTab)
                                    .split(/\n(?=\d+\.\s[A-ZÁÉÍÓÚÑ]|REPORTE DIARIO)/)
                                    .filter(s => s.trim())
                                    .map((section, i) => {
                                      const lines = section.trim().split('\n');
                                      const firstLine = lines[0].trim();
                                      const isMainTitle = firstLine.startsWith('REPORTE DIARIO');
                                      const isSectionTitle = /^\d+\.\s[A-ZÁÉÍÓÚÑ]/.test(firstLine);
                                      const isSubsection = /^\d+\.\d+\./.test(firstLine);
                                      const body = lines.slice(1).join('\n').trim();
                                      if (isMainTitle) return (
                                        <div key={i} className="pb-3 border-b-2 border-stone-800 mb-2">
                                          <p className="text-[11px] font-black tracking-[0.15em] text-stone-800">{firstLine}</p>
                                        </div>
                                      );
                                      if (isSectionTitle) return (
                                        <div key={i} className="space-y-2 pt-2 border-t border-stone-200 first:border-t-0 first:pt-0">
                                          <p className="text-[10px] font-black tracking-[0.12em] text-red-700">{firstLine}</p>
                                          {body.split(/\n(?=\d+\.\d+\.)/).map((sub, j) => {
                                            const subLines = sub.trim().split('\n');
                                            const subFirst = subLines[0].trim();
                                            const isSubTitle = /^\d+\.\d+\./.test(subFirst);
                                            const subBody = subLines.slice(isSubTitle ? 1 : 0).join(' ').trim();
                                            return isSubTitle ? (
                                              <div key={j} className="space-y-1">
                                                <p className="text-[10px] font-bold text-stone-600">{subFirst}</p>
                                                <p className="text-stone-700">{subBody}</p>
                                              </div>
                                            ) : (
                                              <p key={j} className="text-stone-700">{subFirst}{subBody ? ' ' + subBody : ''}</p>
                                            );
                                          })}
                                        </div>
                                      );
                                      return <p key={i} className="text-stone-700">{section.trim()}</p>;
                                    })
                                  }
                                </div>
                              </div>
                            </div>
                          )}

                          {/* News cards — only for the 4 category tabs, not for panorama */}
                          {activeTab === "panorama_general" && !activeTabReport && (
                            <div className="p-12 text-center text-stone-400 space-y-3">
                              <FileText size={28} className="mx-auto opacity-20" />
                              <p className="text-sm font-medium">El informe diario se genera automáticamente cada mañana.</p>
                              <p className="text-[11px]">Presiona "Actualizar monitor" para generar ahora.</p>
                            </div>
                          )}
                          <div className={cn("p-6", activeTab === "panorama_general" && "hidden")}>
                            {isLoadingNews ? (
                              <div className="flex items-center justify-center py-16 gap-3 text-stone-400">
                                <Loader2 size={18} className="animate-spin" />
                                <span className="text-sm font-medium">Conectando con medios de comunicación...</span>
                              </div>
                            ) : liveNews.length === 0 ? (
                              <div className="py-12 text-center text-stone-400">
                                <Radio size={24} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No se encontraron noticias en este momento.</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {liveNews.map((news, idx) => {
                                  const favicon = getFavicon(news.url);
                                  const borderColor = {
                                    politico: "border-l-blue-950",
                                    economico: "border-l-amber-400",
                                    cultural: "border-l-violet-500",
                                    relaciones_internacionales: "border-l-teal-500",
                                  }[activeTab] ?? "border-l-mre-blue";
                                  return (
                                    <div key={idx} className={`bg-stone-50 border border-stone-100 rounded-xl p-4 hover:bg-white hover:shadow-md transition-all border-l-4 ${borderColor}`}>
                                      <div className="flex items-start justify-between gap-3 mb-1.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {favicon && (
                                            <img src={favicon} alt="" className="w-4 h-4 rounded-sm shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                          )}
                                          <span className="text-[9px] font-black text-stone-500 tracking-widest truncate">{news.source}</span>
                                        </div>
                                        <span className="text-[9px] text-stone-400 shrink-0">
                                          {news.date ? format(new Date(news.date), "dd MMM · HH:mm", { locale: es }) : ""}
                                        </span>
                                      </div>
                                      <h4 className="text-sm font-bold text-stone-900 leading-snug mb-1.5">
                                        {news.url ? (
                                          <a href={news.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-mre-blue transition-colors flex items-start gap-1">
                                            {news.title}
                                            <ExternalLink size={11} className="shrink-0 mt-0.5 opacity-30" />
                                          </a>
                                        ) : news.title}
                                      </h4>
                                      {news.preview && news.preview !== news.title && (
                                        <p className="text-[11px] text-stone-500 leading-relaxed line-clamp-2">{news.preview}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>


                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-8">
                  {/* Country Data Card */}
                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold text-stone-400 tracking-[0.2em] flex items-center gap-2">
                      <Activity size={14} />
                      Cobertura por categoría
                    </h3>
                    <div className="bg-white border border-stone-100 rounded-2xl p-5 shadow-lg space-y-3">
                      {(["politico","economico","cultural","relaciones_internacionales"] as const).map(cat => {
                        const count = allCategoryNews.filter(n => n.category === cat).length;
                        const label = { politico: "Política", economico: "Economía", cultural: "Cultura", relaciones_internacionales: "RR. Int." }[cat];
                        const max = 25;
                        const pct = Math.round((count / max) * 100);
                        const barColor = { politico: "bg-blue-900", economico: "bg-amber-500", cultural: "bg-violet-600", relaciones_internacionales: "bg-teal-600" }[cat];
                        const textColor = { politico: "text-blue-900", economico: "text-amber-600", cultural: "text-violet-600", relaciones_internacionales: "text-teal-600" }[cat];
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex justify-between text-[8px] font-bold tracking-wider">
                              <span className="text-stone-500">{label}</span>
                              <span className={textColor}>{count} noticias</span>
                            </div>
                            <div className="w-full bg-stone-100 h-1 rounded-full overflow-hidden">
                              <div className={`${barColor} h-full transition-all`} style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Relaciones Internacionales Block */}
                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold text-stone-400 tracking-[0.2em] flex items-center gap-2">
                      <Globe size={14} />
                      RR. Internacionales
                    </h3>
                    <div className="bg-white border border-stone-100 rounded-2xl p-6 shadow-lg">
                      {latestReportForLocation && typeof latestReportForLocation.content !== 'string' ? (
                        <div className="markdown-body text-xs leading-relaxed">
                          <ReactMarkdown>
                            {latestReportForLocation.content.relaciones_internacionales}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-stone-400 text-xs italic">Sincronice para obtener análisis diplomático.</p>
                      )}
                    </div>
                  </section>

                  {/* Local Map */}
                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold text-stone-400 tracking-[0.2em] flex items-center gap-2">
                      <MapPin size={14} />
                      Ubicación de la sede
                    </h3>
                    <div className="h-[250px]">
                      <EmbassyMap 
                        selectedLocation={location} 
                        onLocationSelect={(loc) => setLocation(loc)} 
                      />
                    </div>
                  </section>
                </div>
              </div>

            </div>
          </div>
        ) : activeView === "monitoring" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header controls */}
            <div className="p-6 border-b border-stone-100 bg-white/40 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar medio, país o ciudad..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-mre-blue/20 focus:border-mre-blue transition-all shadow-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCheckMediaStatus}
                    disabled={isCheckingMedia}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-full text-xs font-bold text-stone-600 hover:border-mre-blue/40 hover:text-mre-blue transition-all disabled:opacity-50 shadow-sm"
                  >
                    {isCheckingMedia ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                    Verificar en tiempo real
                  </button>
                  <button
                    onClick={handleUpdateMediaDatabase}
                    disabled={isUpdatingMedia}
                    className="flex items-center gap-2 px-4 py-2 bg-mre-blue text-white rounded-full text-xs font-bold hover:bg-blue-800 transition-all disabled:opacity-50 shadow-sm"
                  >
                    {isUpdatingMedia ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    Actualizar con IA — {location}
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-6 text-[11px] font-bold text-stone-500">
                <span className="flex items-center gap-1.5">
                  <Globe size={12} className="text-mre-blue" />
                  <span className="text-stone-900">{mediaSources.length}</span> fuentes totales
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-stone-900">{mediaSources.filter(s => s.status === "Activo").length}</span> activas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span className="text-stone-900">{mediaSources.filter(s => s.status === "Inactivo").length}</span> inactivas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-stone-900">{mediaSources.filter(s => s.status === "Verificando").length}</span> verificando
                </span>
                <span className="ml-auto flex items-center gap-1 text-stone-400">
                  <Clock size={10} />
                  Actualizado: {format(new Date(), "HH:mm:ss")}
                </span>
              </div>

              {/* Country filter tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setMediaCountryFilter("all")}
                  className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all",
                    mediaCountryFilter === "all" ? "bg-mre-blue text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                  )}
                >
                  Todos ({mediaSources.length})
                </button>
                {uniqueMediaCountries.map(country => (
                  <button
                    key={country}
                    onClick={() => setMediaCountryFilter(country)}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all",
                      mediaCountryFilter === country ? "bg-mre-blue text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                    )}
                  >
                    {country} ({mediaSources.filter(s => s.country === country).length})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-6xl mx-auto">
                {filteredMedia.length === 0 ? (
                  <div className="py-16 text-center text-stone-400">
                    <Globe size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No se encontraron fuentes con ese criterio.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredMedia.map((source) => {
                      const citedInReport = latestReportForLocation?.newsItems?.some(
                        n => n.source.toLowerCase().includes(source.name.toLowerCase()) ||
                             source.name.toLowerCase().includes(n.source.toLowerCase())
                      );
                      return (
                        <div
                          key={source.id}
                          className="bg-white border border-stone-200 rounded-xl p-5 hover:shadow-lg hover:border-mre-blue/20 transition-all group"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-stone-50 rounded-lg group-hover:bg-mre-blue/5 transition-colors">
                                <Globe className="text-stone-400 group-hover:text-mre-blue" size={18} />
                              </div>
                              <span className={cn(
                                "text-[9px] font-bold tracking-widest px-2 py-0.5 rounded uppercase",
                                source.type === "Diario" && "bg-blue-50 text-blue-600",
                                source.type === "TV" && "bg-purple-50 text-purple-600",
                                source.type === "Radio" && "bg-amber-50 text-amber-600",
                                source.type === "Digital" && "bg-emerald-50 text-emerald-600",
                              )}>
                                {source.type}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {source.status === "Verificando" && (
                                <Loader2 size={10} className="animate-spin text-amber-500" />
                              )}
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                source.status === "Activo" && "bg-green-500 animate-pulse",
                                source.status === "Inactivo" && "bg-red-400",
                                source.status === "Verificando" && "bg-amber-400"
                              )} />
                              <span className={cn(
                                "text-[9px] font-bold tracking-wider",
                                source.status === "Activo" && "text-green-600",
                                source.status === "Inactivo" && "text-red-500",
                                source.status === "Verificando" && "text-amber-500"
                              )}>
                                {source.status}
                              </span>
                            </div>
                          </div>

                          <h3 className="font-bold text-stone-900 mb-0.5 flex items-center gap-2 text-sm">
                            {source.name}
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-stone-300 hover:text-mre-blue transition-colors">
                              <ExternalLink size={12} />
                            </a>
                          </h3>
                          <p className="text-[10px] text-stone-400 mb-3 flex items-center gap-1">
                            <MapPin size={9} />
                            {source.country} — {source.location}
                          </p>

                          <div className="space-y-2 pt-3 border-t border-stone-50">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-stone-400 tracking-wider">Última verificación</span>
                              <span className="text-stone-600 font-semibold flex items-center gap-1">
                                <Clock size={9} />
                                {format(new Date(source.lastCheck), "dd/MM HH:mm", { locale: es })}
                              </span>
                            </div>
                            {citedInReport && (
                              <div className="flex items-center gap-1.5 text-[9px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md">
                                <CheckCircle2 size={10} />
                                Citado en último reporte
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedReport ? (
              <>
                <div className="px-8 py-4 border-b border-stone-100 flex items-center justify-between bg-white/40 backdrop-blur-md">
                  <div className="flex items-center gap-4">
                    <div className="flex bg-stone-100 p-1 rounded-xl overflow-x-auto max-w-2xl">
                      {(["politico", "economico", "cultural", "relaciones_internacionales", "panorama_general"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-all whitespace-nowrap",
                            activeTab === tab
                              ? "bg-white text-mre-blue shadow-sm"
                              : "text-stone-400 hover:text-stone-600"
                          )}
                        >
                          {tab === "panorama_general" ? "Panorama General" : tab === "relaciones_internacionales" ? "RR. Internacionales" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => window.print()}
                      className="p-2 text-stone-400 hover:text-mre-blue hover:bg-stone-50 rounded-full transition-all"
                    >
                      <Download size={20} />
                    </button>
                  </div>
                  <div className="text-[10px] font-bold text-stone-400 tracking-widest">
                    Archivo: {selectedReport.location}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-12 max-w-4xl mx-auto w-full">
                  <div className="markdown-body min-h-[500px] animate-in fade-in duration-300">
                    <div className="mb-8 p-6 bg-stone-50 border-l-4 border-mre-blue rounded-r-xl">
                      <p className="text-xs font-bold text-stone-600 mb-1">Fuente: Monitoreo Global</p>
                      <p className="text-sm text-stone-800 leading-relaxed">
                        Informe de monitoreo de medios para la Embajada Digital - {selectedReport.location} <br/>
                        <span className="text-stone-500 text-xs">Elaborado por: Dirección de Estudios y Estrategias (DEE), MRE</span>
                      </p>
                    </div>

                    <div className="mb-8 flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] font-black text-stone-400 tracking-widest uppercase mr-2">Palabras clave:</span>
                      {getMostFrequentWords(
                        getReportContent(selectedReport.content, activeTab)
                      ).map(({ word, count }, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 px-2 py-1 rounded-md">
                          <span className="text-[10px] font-bold text-stone-700">{word}</span>
                          <span className="text-[8px] font-black text-mre-blue bg-blue-50 px-1 rounded">{count}</span>
                        </div>
                      ))}
                    </div>
                    <ReactMarkdown>
                      {getReportContent(selectedReport.content, activeTab)}
                    </ReactMarkdown>
                  </div>

                  {/* News Sources Section */}
                  {selectedReport.newsItems && selectedReport.newsItems.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-stone-200">
                      <h3 className="text-xs font-bold text-stone-400 tracking-[0.2em] mb-6 flex items-center gap-2">
                        <Radio size={14} className="text-mre-blue" />
                        Fuentes de información (última semana)
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {selectedReport.newsItems.map((news, idx) => (
                          <div key={idx} className="bg-white border border-stone-100 rounded-xl p-5 hover:border-mre-blue/30 hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex gap-4">
                                <div className="w-10 h-10 bg-stone-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-mre-blue/5 transition-colors">
                                  <Globe size={18} className="text-stone-400 group-hover:text-mre-blue" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-mre-blue tracking-wider">{news.source}</span>
                                    <span className="text-[10px] text-stone-400">•</span>
                                    <span className="text-[10px] text-stone-400">{format(new Date(news.date), "dd MMM, yyyy", { locale: es })}</span>
                                  </div>
                                  <h4 className="text-sm font-bold text-stone-900 mb-1 leading-tight">{news.title}</h4>
                                  <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{news.preview}</p>
                                </div>
                              </div>
                              {news.url && (
                                <a
                                  href={news.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-stone-300 hover:text-mre-blue hover:bg-mre-blue/5 rounded-full transition-all"
                                >
                                  <ChevronRight size={20} />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 overflow-y-auto">
                <div className="max-w-2xl w-full bg-white border border-stone-200 rounded-3xl p-10 shadow-xl shadow-stone-200/50">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-mre-blue/10 flex items-center justify-center rounded-2xl">
                      <History className="text-mre-blue" size={28} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-stone-900 tracking-tight">Nuevo análisis cruzado</h2>
                      <p className="text-stone-500 text-sm">Seleccione los países para analizar su relación estratégica con Perú.</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {EMBASSIES.map((emb) => (
                        <button
                          key={emb.id}
                          onClick={() => {
                            if (selectedCountries.includes(emb.name)) {
                              setSelectedCountries(selectedCountries.filter(c => c !== emb.name));
                            } else {
                              setSelectedCountries([...selectedCountries, emb.name]);
                            }
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2",
                            selectedCountries.includes(emb.name)
                              ? "border-mre-blue bg-mre-blue/5 text-mre-blue"
                              : "border-stone-100 bg-stone-50 text-stone-400 hover:border-stone-200"
                          )}
                        >
                          <Globe size={24} />
                          <span className="text-[10px] font-bold tracking-widest text-center leading-tight">
                            {emb.name}<br/>{emb.country}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="pt-6 border-t border-stone-100">
                      <button
                        onClick={async () => {
                          if (selectedCountries.length === 0) return;
                          setIsAnalyzing(true);
                          try {
                            const targetLocation = selectedCountries.join(" & ");
                            const fetched = await Promise.all(
                              selectedCountries.map(c =>
                                fetch(`/api/news?location=${encodeURIComponent(c)}&category=politico`)
                                  .then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => [])
                              )
                            );
                            const allNewsItems = fetched.flat();
                            const newsString = allNewsItems.map((n: NewsItem) => `- ${n.source}: ${n.title}`).join("\n");
                            
                            const newReports = await generateEmbassyReport(targetLocation, newsString);
                            const updatedReports = [...newReports, ...reports];
                            saveReports(updatedReports);
                            setSelectedReport(newReports[0] ?? null);
                            setSelectedCountries([]);
                          } catch (error) {
                            console.error("Analysis failed", error);
                          } finally {
                            setIsAnalyzing(false);
                          }
                        }}
                        disabled={selectedCountries.length === 0 || isAnalyzing}
                        className="w-full bg-mre-blue hover:bg-blue-800 text-white py-4 rounded-xl font-bold tracking-widest shadow-lg shadow-mre-blue/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="animate-spin" size={20} />
                        ) : (
                          <Zap size={20} />
                        )}
                        Generar análisis estratégico
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
