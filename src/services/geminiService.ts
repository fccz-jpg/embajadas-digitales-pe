import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const AZUL_MRE_HEX = "#003366";
const GRIS_NEUTRAL_HEX = "#575757";
const TIPOGRAFIA_PRINCIPAL = "Raleway";

export const mockNews: Record<string, { title: string, source: string, preview: string, date: string, url: string }[]> = {
  "Ciudad de México": [
    { title: "México y Perú buscan fortalecer lazos comerciales en el sector agropecuario", source: "El Universal", preview: "Ambas naciones buscan potenciar el intercambio en el sector agropecuario y tecnológico...", date: "2026-03-22T10:00:00Z", url: "https://www.eluniversal.com.mx" },
    { title: "Analizan nuevas medidas de ciberseguridad en foros regionales", source: "Reforma", preview: "Expertos analizan los retos de la seguridad digital en foros de cooperación económica...", date: "2026-03-21T14:30:00Z", url: "https://www.reforma.com" },
    { title: "Exposición de arte peruano llega al Museo de Antropología", source: "Excélsior", preview: "Una muestra sin precedentes de la cultura Chavín llega a la capital mexicana...", date: "2026-03-23T09:15:00Z", url: "https://www.excelsior.com.mx" },
    { title: "Empresarios mexicanos interesados en invertir en infraestructura portuaria peruana", source: "La Jornada", preview: "Empresarios del sector logística anuncian planes de expansión en la costa del Pacífico...", date: "2026-03-20T16:45:00Z", url: "https://www.jornada.com.mx" }
  ],
  "San Marino": [
    { title: "Fortalecimiento diplomático San Marino-Perú", source: "San Marino RTV", preview: "Se firman acuerdos de entendimiento para la promoción del turismo y la cultura...", date: "2026-03-22T11:20:00Z", url: "https://www.sanmarinortv.sm" },
    { title: "Cooperación cultural UNESCO", source: "Libertas", preview: "Ambos países coordinan esfuerzos para la protección del patrimonio mundial...", date: "2026-03-21T08:00:00Z", url: "http://www.libertas.sm" },
    { title: "Gestión de patrimonio histórico", source: "L'Informazione", preview: "Intercambio de mejores prácticas en la conservación de centros históricos...", date: "2026-03-23T15:30:00Z", url: "https://www.linformazione.sm" }
  ],
  "Bután": [
    { title: "Turismo sostenible de montaña", source: "Kuensel", preview: "Bután y Perú exploran modelos de turismo que respeten el medio ambiente y las comunidades...", date: "2026-03-22T09:00:00Z", url: "https://kuenselonline.com" },
    { title: "Agricultura de altura y seguridad alimentaria", source: "Bhutan Times", preview: "Científicos de ambos países comparten avances en cultivos resistentes al clima...", date: "2026-03-21T10:15:00Z", url: "https://bhutantimes.bt" },
    { title: "Diálogo Andes-Himalaya", source: "BBS", preview: "Foro internacional sobre la conservación de glaciares y ecosistemas de montaña...", date: "2026-03-23T12:00:00Z", url: "https://www.bbs.bt" }
  ]
};

export const mockMediaSources = [
  { id: "1", name: "El Universal", location: "Ciudad de México", type: "Diario", url: "https://www.eluniversal.com.mx", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "2", name: "Reforma", location: "Ciudad de México", type: "Diario", url: "https://www.reforma.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "3", name: "Excélsior", location: "Ciudad de México", type: "Diario", url: "https://www.excelsior.com.mx", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "4", name: "La Jornada", location: "Ciudad de México", type: "Diario", url: "https://www.jornada.com.mx", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "5", name: "San Marino RTV", location: "San Marino", type: "TV", url: "https://www.sanmarinortv.sm", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "6", name: "Kuensel", location: "Bután", type: "Diario", url: "https://kuenselonline.com", status: "Activo", lastCheck: new Date().toISOString() },
];

export const mockCountryData: Record<string, { capital: string, population: string, currency: string, language: string, gdp: string }> = {
  "Ciudad de México": {
    capital: "Ciudad de México",
    population: "128.9 millones",
    currency: "Peso Mexicano (MXN)",
    language: "Español",
    gdp: "1.29 billones USD"
  },
  "San Marino": {
    capital: "Ciudad de San Marino",
    population: "33,660",
    currency: "Euro (EUR)",
    language: "Italiano",
    gdp: "1.7 billones USD"
  },
  "Bután": {
    capital: "Timbu",
    population: "777,486",
    currency: "Ngultrum (BTN)",
    language: "Dzongkha",
    gdp: "2.5 billones USD"
  }
};

export async function generateEmbassyReport(location: string, searchQuery: string) {
  const prompt = `
    Actúa como un analista de inteligencia estratégica para el Ministerio de Relaciones Exteriores (MRE) de Perú.
    Genera un monitoreo de medios estructurado para la Embajada Digital en ${location}.
    
    INSTRUCCIONES:
    1. Realiza una búsqueda exhaustiva de noticias recientes (últimas 24-48 horas) relacionadas con la situación actual en ${location} (política, economía y cultura).
    2. Analiza la información encontrada y sepárala en 5 secciones.
    3. Cada sección debe ser una nota distinta y completa.
    
    SECCIONES:
    - politico: Análisis de política interna, gobernanza y estabilidad.
    - economico: Análisis de la situación económica general, inflación, crecimiento y sectores clave.
    - cultural: Análisis de la vida cultural, eventos sociales y tendencias de la sociedad.
    - mercados_industria: Análisis de la industria local, mercados financieros y clima de negocios.
    - panorama_general: Un resumen ejecutivo del panorama general del país en el periodo monitoreado.
    
    REQUISITOS DE FORMATO:
    - Usa Markdown para el formato.
    - Cada sección debe comenzar con un título descriptivo (ej: "Política Interna").
    - Usa negritas para resaltar datos clave, cifras y nombres de medios.
    - El tono debe ser profesional, analítico y de alta dirección.
    - NO realices comparaciones o cruces con Perú en este reporte. Enfócate exclusivamente en la situación de ${location}.
    - Si no hay reportes relevantes para una sección, indica: "Sin reportes relevantes en los medios monitoreados durante el presente periodo."
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            politico: { type: Type.STRING, description: "Nota política en formato markdown" },
            economico: { type: Type.STRING, description: "Nota económica en formato markdown" },
            cultural: { type: Type.STRING, description: "Nota cultural en formato markdown" },
            mercados_industria: { type: Type.STRING, description: "Nota de mercados e industria en formato markdown" },
            panorama_general: { type: Type.STRING, description: "Panorama general del país en formato markdown" },
            sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  source: { type: Type.STRING },
                  url: { type: Type.STRING },
                  date: { type: Type.STRING }
                }
              }
            }
          },
          required: ["politico", "economico", "cultural", "mercados_industria", "panorama_general", "sources"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating report:", error);
    throw error;
  }
}
