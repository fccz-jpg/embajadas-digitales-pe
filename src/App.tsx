import { useState, useEffect, useCallback } from "react";
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
  Info,
  Users,
  Coins,
  Languages,
  TrendingUp,
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
import { generateEmbassyReport, mockNews, mockMediaSources, mockCountryData } from "./services/geminiService";
import { Report, MediaSource, EMBASSIES } from "./types";
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
  const [activeTab, setActiveTab] = useState<"politico" | "economico" | "cultural" | "mercados_industria" | "panorama_general">("politico");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load reports from local storage
  useEffect(() => {
    const saved = localStorage.getItem("mre_reports");
    if (saved) {
      setReports(JSON.parse(saved));
    }
  }, []);

  const saveReports = (newReports: Report[]) => {
    setReports(newReports);
    localStorage.setItem("mre_reports", JSON.stringify(newReports));
  };

  const handleUpdateMonitoring = useCallback(async () => {
    setIsGenerating(true);
    try {
      const content = await generateEmbassyReport(location, location);
      
      const newReport: Report = {
        id: crypto.randomUUID(),
        location,
        content,
        createdAt: new Date().toISOString(),
        rawNews: "Real-time search via Google Grounding",
        newsItems: content.sources?.map((s: any) => ({
          title: s.title,
          source: s.source,
          preview: s.title,
          date: s.date,
          url: s.url
        })) || []
      };

      const updatedReports = [newReport, ...reports.filter(r => r.id !== newReport.id)];
      saveReports(updatedReports);
      setSelectedReport(newReport);
      setActiveView("dashboard");
    } catch (error) {
      console.error("Failed to update monitoring", error);
    } finally {
      setIsGenerating(false);
    }
  }, [location, reports]);

  // Hourly update logic
  useEffect(() => {
    const checkAndUpdate = () => {
      const lastReport = reports.find(r => r.location === location);
      if (lastReport) {
        const lastUpdate = new Date(lastReport.createdAt);
        const now = new Date();
        const diffInHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
        
        if (diffInHours >= 1) {
          console.log("Real-time update triggered: 1 hour passed since last report.");
          handleUpdateMonitoring();
        }
      } else {
        // If no report exists for this location, generate the first one
        handleUpdateMonitoring();
      }
    };

    // Check every 5 minutes
    const interval = setInterval(checkAndUpdate, 5 * 60 * 1000);
    
    // Initial check
    if (reports.length > 0) {
      checkAndUpdate();
    }

    return () => clearInterval(interval);
  }, [location, reports.length, handleUpdateMonitoring]);

  const filteredMedia = mockMediaSources.filter(source => 
    source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    source.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const latestReportForLocation = reports.find(r => r.location === location);

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
                        {mockMediaSources.filter(s => s.location === location).length}
                      </span>
                      <Radio className="text-mre-blue" size={18} />
                    </div>
                  </div>
                  <div className="bg-white border border-stone-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[9px] font-bold text-stone-400 tracking-widest mb-2">Alertas críticas</p>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold text-stone-900 tracking-tighter">0</span>
                      <AlertTriangle className="text-amber-500" size={18} />
                    </div>
                  </div>
                  <div className="bg-white border border-stone-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[9px] font-bold text-stone-400 tracking-widest mb-2">Nivel de riesgo</p>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold text-green-600 tracking-tighter">Bajo</span>
                      <Activity className="text-green-500" size={18} />
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
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-bold tracking-wider">
                        <span className="text-stone-500">Política</span>
                        <span className="text-green-600">85%</span>
                      </div>
                      <div className="w-full bg-stone-100 h-1 rounded-full overflow-hidden">
                        <div className="bg-green-500 h-full w-[85%]"></div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-bold tracking-wider">
                        <span className="text-stone-500">Economía</span>
                        <span className="text-amber-600">62%</span>
                      </div>
                      <div className="w-full bg-stone-100 h-1 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full w-[62%]"></div>
                      </div>
                    </div>
                  </div>
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
                    {latestReportForLocation ? (
                      <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col">
                        {/* Analysis Tabs as Fields at the top */}
                        <div className="grid grid-cols-4 border-b border-stone-100">
                          {(["politico", "economico", "cultural", "mercados_industria"] as const).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setActiveTab(tab)}
                              className={cn(
                                "py-4 px-2 text-[9px] font-black tracking-widest transition-all border-r border-stone-50 last:border-r-0 flex flex-col items-center gap-1",
                                activeTab === tab 
                                  ? "bg-stone-50 text-mre-blue border-b-2 border-b-mre-blue" 
                                  : "text-stone-400 hover:bg-stone-50/50"
                              )}
                            >
                              {tab === "politico" && <Shield size={14} />}
                              {tab === "economico" && <Coins size={14} />}
                              {tab === "cultural" && <Languages size={14} />}
                              {tab === "mercados_industria" && <TrendingUp size={14} />}
                              {tab === "mercados_industria" ? "Mercados e industria" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                          ))}
                        </div>

                        <div className="p-8 flex-1">
                          <div className="mb-6 pb-6 border-b border-stone-50">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                activeTab === "politico" && "bg-blue-100 text-blue-700",
                                activeTab === "economico" && "bg-amber-100 text-amber-700",
                                activeTab === "cultural" && "bg-purple-100 text-purple-700",
                                activeTab === "mercados_industria" && "bg-green-100 text-green-700"
                              )}>
                                Informe {activeTab === "mercados_industria" ? "de Mercados" : activeTab}
                              </span>
                              <span className="text-[8px] font-bold text-stone-300 tracking-widest uppercase">ID: {latestReportForLocation.id.slice(0, 8)}</span>
                            </div>
                            <h1 className="text-3xl font-black text-stone-900 tracking-tighter mb-1">
                              {activeTab === "politico" && "Análisis Político y Diplomático"}
                              {activeTab === "economico" && "Reporte Económico y Comercial"}
                              {activeTab === "cultural" && "Cooperación Cultural y Técnica"}
                              {activeTab === "mercados_industria" && "Inteligencia de Mercados e Industria"}
                              <span className="text-stone-400 font-light ml-2">| {location}</span>
                            </h1>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-mre-blue tracking-widest">
                              <ExternalLink size={12} />
                              <a 
                                href={latestReportForLocation.newsItems?.[0]?.url || "#"} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                Fuente: {latestReportForLocation.newsItems?.[0]?.source || "Monitoreo Global"}
                              </a>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            <div className="lg:col-span-3">
                              <div className="markdown-body prose prose-stone max-w-none">
                                <ReactMarkdown>
                                  {typeof latestReportForLocation.content === 'string' 
                                    ? latestReportForLocation.content 
                                    : (latestReportForLocation.content as any)[activeTab]}
                                </ReactMarkdown>
                              </div>
                            </div>
                            
                            <div className="space-y-6">
                              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                                <p className="text-[9px] font-black text-blue-900 tracking-widest mb-3 flex items-center gap-2">
                                  <TrendingUp size={12} />
                                  Cifras Clave
                                </p>
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-stone-500 font-bold">Variación</span>
                                    <span className={cn(
                                      "text-xs font-black",
                                      activeTab === "politico" && "text-blue-600",
                                      activeTab === "economico" && "text-green-600",
                                      activeTab === "cultural" && "text-purple-600",
                                      activeTab === "mercados_industria" && "text-emerald-600"
                                    )}>
                                      {activeTab === "politico" && "+1.2%"}
                                      {activeTab === "economico" && "+3.5%"}
                                      {activeTab === "cultural" && "+0.8%"}
                                      {activeTab === "mercados_industria" && "+5.2%"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-stone-500 font-bold">Impacto</span>
                                    <span className="text-xs font-black text-stone-900">
                                      {activeTab === "politico" && "Alto"}
                                      {activeTab === "economico" && "Medio"}
                                      {activeTab === "cultural" && "Bajo"}
                                      {activeTab === "mercados_industria" && "Crítico"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-stone-500 font-bold">Confianza</span>
                                    <span className="text-xs font-black text-blue-600">
                                      {activeTab === "politico" && "95%"}
                                      {activeTab === "economico" && "92%"}
                                      {activeTab === "cultural" && "99%"}
                                      {activeTab === "mercados_industria" && "90%"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                                <p className="text-[9px] font-black text-stone-900 tracking-widest mb-3 flex items-center gap-2">
                                  <Activity size={12} />
                                  Dato Relevante
                                </p>
                                <p className="text-[11px] text-stone-600 font-medium leading-relaxed">
                                  {activeTab === "politico" && "Se observa un incremento en las menciones diplomáticas bilaterales en medios oficiales."}
                                  {activeTab === "economico" && "Nuevas proyecciones sugieren un aumento en el intercambio de productos agroindustriales."}
                                  {activeTab === "cultural" && "La agenda cultural muestra una alta receptividad hacia las expresiones artísticas peruanas."}
                                  {activeTab === "mercados_industria" && "Sectores de logística y puertos presentan las mayores oportunidades de inversión inmediata."}
                                </p>
                              </div>

                              <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                                <p className="text-[9px] font-black text-stone-900 tracking-widest mb-3 flex items-center gap-2">
                                  <Languages size={12} />
                                  Palabras más frecuentes
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {getMostFrequentWords(
                                    typeof latestReportForLocation.content === 'string' 
                                      ? latestReportForLocation.content 
                                      : (latestReportForLocation.content as any)[activeTab]
                                  ).map(({ word, count }, i) => (
                                    <div key={i} className="flex items-center gap-1.5 bg-white border border-stone-200 px-2 py-1 rounded-md shadow-sm">
                                      <span className="text-[10px] font-bold text-stone-700">{word}</span>
                                      <span className="text-[8px] font-black text-mre-blue bg-blue-50 px-1 rounded">{count}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* News Sources used for this report */}
                        <div className="bg-stone-50/80 border-t border-stone-100 p-6">
                          <p className="text-[9px] font-black text-stone-400 tracking-[0.2em] mb-4 flex items-center gap-2">
                            <Radio size={12} />
                            Fuentes Utilizadas en este Análisis (Tiempo Real)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {latestReportForLocation.newsItems?.map((news, idx) => (
                              <a 
                                key={idx}
                                href={news.url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-white border border-stone-200 px-3 py-1.5 rounded-full shadow-sm hover:border-mre-blue/30 transition-all group"
                              >
                                <Globe size={10} className="text-stone-300 group-hover:text-mre-blue" />
                                <span className="text-[10px] font-bold text-stone-600">{news.source}</span>
                                <ExternalLink size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        </div>

                        <div className="px-8 py-4 bg-white border-t border-stone-100 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-stone-400 tracking-widest">
                            Generado el {format(new Date(latestReportForLocation.createdAt), "PPP", { locale: es })}
                          </span>
                          <button 
                            onClick={() => {
                              setSelectedReport(latestReportForLocation);
                              setActiveView("reports");
                            }}
                            className="text-[10px] font-bold text-mre-blue hover:underline tracking-widest"
                          >
                            Ver historial completo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-dashed border-stone-200 rounded-2xl p-12 text-center shadow-inner">
                        <p className="text-stone-400 text-sm italic mb-4">No hay análisis reciente para este país.</p>
                        <button 
                          onClick={handleUpdateMonitoring}
                          className="text-xs font-bold text-mre-blue hover:underline tracking-widest"
                        >
                          Sincronizar ahora
                        </button>
                      </div>
                    )}
                  </section>
                </div>

                <div className="space-y-8">
                  {/* Country Data Card */}
                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold text-stone-400 tracking-[0.2em] flex items-center gap-2">
                      <Info size={14} />
                      Ficha de datos del país
                    </h3>
                    <div className="bg-white border border-stone-100 rounded-2xl p-6 shadow-lg space-y-6">
                      <div className="flex items-center gap-4 pb-4 border-b border-stone-50">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                          <Globe size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-900">{location}</h4>
                          <p className="text-[10px] text-stone-400 font-bold tracking-widest">Información general</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <MapPin size={16} className="text-stone-300 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-stone-400 font-bold tracking-widest">Capital</p>
                            <p className="text-sm font-semibold text-stone-700">{mockCountryData[location]?.capital}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Users size={16} className="text-stone-300 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-stone-400 font-bold tracking-widest">Población</p>
                            <p className="text-sm font-semibold text-stone-700">{mockCountryData[location]?.population}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Coins size={16} className="text-stone-300 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-stone-400 font-bold tracking-widest">Moneda</p>
                            <p className="text-sm font-semibold text-stone-700">{mockCountryData[location]?.currency}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Languages size={16} className="text-stone-300 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-stone-400 font-bold tracking-widest">Idioma</p>
                            <p className="text-sm font-semibold text-stone-700">{mockCountryData[location]?.language}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <TrendingUp size={16} className="text-stone-300 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-stone-400 font-bold tracking-widest">PIB nominal</p>
                            <p className="text-sm font-semibold text-stone-700">{mockCountryData[location]?.gdp}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Markets & Industry Block */}
                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold text-stone-400 tracking-[0.2em] flex items-center gap-2">
                      <TrendingUp size={14} />
                      Mercados e industria
                    </h3>
                    <div className="bg-white border border-stone-100 rounded-2xl p-6 shadow-lg">
                      {latestReportForLocation && typeof latestReportForLocation.content !== 'string' ? (
                        <div className="markdown-body text-xs leading-relaxed">
                          <ReactMarkdown>
                            {latestReportForLocation.content.mercados_industria}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-stone-400 text-xs italic">Sincronice para obtener análisis de mercados.</p>
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

              {/* News of the Day List */}
              <section className="space-y-4">
                <h3 className="text-[11px] font-bold text-stone-400 tracking-[0.2em] flex items-center gap-2">
                  <Radio size={14} />
                  Noticias filtradas por área: {activeTab === "mercados_industria" ? "Mercados" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    const keywords: Record<string, string[]> = {
                      politico: ["política", "gobierno", "diplomacia", "acuerdo", "relaciones", "embajada", "presidente", "ministro", "canciller"],
                      economico: ["economía", "inversión", "comercio", "agropecuario", "infraestructura", "puerto", "mercado", "pib", "crecimiento"],
                      cultural: ["cultura", "arte", "exposición", "museo", "patrimonio", "unesco", "turismo", "evento"],
                      mercados_industria: ["industria", "mercado", "cifras", "comercio", "exportación", "importación", "promperú", "sector"]
                    };
                    const currentKeywords = keywords[activeTab] || [];
                    const filteredNews = (latestReportForLocation?.newsItems || []).filter(news => 
                      currentKeywords.some(k => 
                        news.title.toLowerCase().includes(k) || 
                        (news.preview && news.preview.toLowerCase().includes(k))
                      ) || currentKeywords.length === 0
                    );

                    if (filteredNews.length === 0) {
                      return (
                        <div className="col-span-full py-8 text-center bg-stone-50/50 border border-dashed border-stone-200 rounded-xl">
                          <p className="text-[10px] font-bold text-stone-400 tracking-widest uppercase">No se encontraron noticias específicas para esta área hoy</p>
                        </div>
                      );
                    }

                    return filteredNews.map((news, idx) => (
                      <div key={idx} className="bg-white border border-stone-100 rounded-xl p-5 shadow-md hover:shadow-lg transition-all border-l-4 border-l-mre-blue animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-mre-blue tracking-widest">{news.source}</span>
                          <span className="text-[10px] text-stone-400 font-medium">{news.date || "Hoy"}</span>
                        </div>
                        <h4 className="font-bold text-stone-900 text-sm mb-2 leading-snug">
                          {news.url ? (
                            <a href={news.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-2">
                              {news.title}
                              <ExternalLink size={12} className="opacity-50" />
                            </a>
                          ) : news.title}
                        </h4>
                        <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{news.preview}</p>
                      </div>
                    ));
                  })()}
                </div>
              </section>
            </div>
          </div>
        ) : activeView === "monitoring" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-white/40 backdrop-blur-md">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input 
                  type="text"
                  placeholder="Buscar medio o ciudad..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-mre-blue/20 focus:border-mre-blue transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMedia.map((source) => (
                    <div 
                      key={source.id}
                      className="bg-white border border-stone-200 rounded-xl p-6 hover:shadow-lg hover:border-mre-blue/20 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-stone-50 rounded-lg group-hover:bg-mre-blue/5 transition-colors">
                          <Globe className="text-stone-400 group-hover:text-mre-blue" size={20} />
                        </div>
                        <div className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold tracking-wider",
                          source.status === "Activo" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {source.status}
                        </div>
                      </div>
                      
                      <h3 className="font-bold text-stone-900 mb-1 flex items-center gap-2">
                        {source.name}
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-stone-300 hover:text-mre-blue transition-colors">
                          <ExternalLink size={14} />
                        </a>
                      </h3>
                      <p className="text-xs text-stone-500 mb-4 flex items-center gap-1">
                        <MapPin size={10} />
                        {source.location}
                      </p>

                      <div className="space-y-3 pt-4 border-t border-stone-50">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-stone-400 font-medium tracking-wider">Tipo</span>
                          <span className="text-stone-700 font-semibold">{source.type}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-stone-400 font-medium tracking-wider">Última sincronización</span>
                          <span className="text-stone-700 font-semibold flex items-center gap-1">
                            <Clock size={10} />
                            {format(new Date(source.lastCheck), "HH:mm", { locale: es })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-stone-400 font-medium tracking-wider">Conexión API</span>
                          <span className="text-green-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            Estable
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                      {(["politico", "economico", "cultural", "mercados_industria", "panorama_general"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab as any)}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-all whitespace-nowrap",
                            activeTab === tab 
                              ? "bg-white text-mre-blue shadow-sm" 
                              : "text-stone-400 hover:text-stone-600"
                          )}
                        >
                          {tab === "panorama_general" ? "Panorama General" : tab === "mercados_industria" ? "Mercados e industria" : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                        typeof selectedReport.content === 'string' 
                          ? selectedReport.content 
                          : (selectedReport.content as any)[activeTab]
                      ).map(({ word, count }, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 px-2 py-1 rounded-md">
                          <span className="text-[10px] font-bold text-stone-700">{word}</span>
                          <span className="text-[8px] font-black text-mre-blue bg-blue-50 px-1 rounded">{count}</span>
                        </div>
                      ))}
                    </div>
                    <ReactMarkdown>
                      {typeof selectedReport.content === 'string' 
                        ? selectedReport.content 
                        : (selectedReport.content as any)[activeTab]}
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
                              <a 
                                href={news.url || "#"} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 text-stone-300 hover:text-mre-blue hover:bg-mre-blue/5 rounded-full transition-all"
                              >
                                <ChevronRight size={20} />
                              </a>
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
                            // For now, we analyze the first selected country or a combination
                            const targetLocation = selectedCountries.join(" & ");
                            const allNewsItems = selectedCountries.flatMap(c => mockNews[c as keyof typeof mockNews] || []);
                            const newsString = allNewsItems.map(n => `- ${n.source}: ${n.title}`).join("\n");
                            
                            const content = await generateEmbassyReport(targetLocation, newsString);
                            
                            const newReport: Report = {
                              id: crypto.randomUUID(),
                              location: targetLocation,
                              content,
                              createdAt: new Date().toISOString(),
                              rawNews: newsString,
                              newsItems: allNewsItems
                            };

                            const updatedReports = [newReport, ...reports];
                            saveReports(updatedReports);
                            setSelectedReport(newReport);
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
