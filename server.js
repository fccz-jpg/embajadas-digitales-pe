import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import pg from "pg";
import cron from "node-cron";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// ── PostgreSQL ──────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      location    TEXT         NOT NULL,
      content     JSONB        NOT NULL,
      raw_news    TEXT,
      news_items  JSONB,
      created_at  TIMESTAMPTZ  DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_reports_location    ON reports (location);
    CREATE INDEX IF NOT EXISTS idx_reports_created_at  ON reports (created_at DESC);
  `);
  console.log("Base de datos lista.");
}

initDB().catch(err => console.error("Error inicializando BD:", err.message));

// ── Gemini ──────────────────────────────────────────────────────────────────
function getAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurado");
  return new GoogleGenAI({ apiKey: key });
}

async function generateAndSave(location) {
  const prompt = `
    Actúa como un analista de inteligencia estratégica para el Ministerio de Relaciones Exteriores (MRE) de Perú.
    Genera un monitoreo de medios estructurado para la Embajada Digital en ${location}.

    INSTRUCCIONES:
    1. Realiza una búsqueda exhaustiva de noticias recientes (últimas 24-48 horas) relacionadas con la situación actual en ${location}.
    2. Analiza la información encontrada y sepárala en 5 secciones.
    3. Cada sección debe ser una nota distinta y completa.

    SECCIONES:
    - politico: Análisis de política interna, gobernanza y estabilidad.
    - economico: Análisis de la situación económica general, inflación, crecimiento y sectores clave.
    - cultural: Análisis de la vida cultural, eventos sociales y tendencias de la sociedad.
    - relaciones_internacionales: Análisis de relaciones diplomáticas, organismos internacionales y agenda bilateral.
    - panorama_general: Un resumen ejecutivo del panorama general del país en el periodo monitoreado.

    REQUISITOS DE FORMATO:
    - Usa Markdown para el formato.
    - Cada sección debe comenzar con un título descriptivo.
    - Usa negritas para resaltar datos clave, cifras y nombres de medios.
    - El tono debe ser profesional, analítico y de alta dirección.
    - NO realices comparaciones o cruces con Perú. Enfócate exclusivamente en ${location}.
    - Si no hay reportes relevantes indica: "Sin reportes relevantes en los medios monitoreados durante el presente periodo."
  `;

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          politico:                  { type: Type.STRING },
          economico:                 { type: Type.STRING },
          cultural:                  { type: Type.STRING },
          relaciones_internacionales:{ type: Type.STRING },
          panorama_general:          { type: Type.STRING },
          sources: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title:  { type: Type.STRING },
                source: { type: Type.STRING },
                url:    { type: Type.STRING },
                date:   { type: Type.STRING },
              }
            }
          }
        },
        required: ["politico", "economico", "cultural", "relaciones_internacionales", "panorama_general", "sources"],
      },
    },
  });

  const content = JSON.parse(response.text);
  const newsItems = (content.sources ?? []).map(s => ({
    title: s.title, source: s.source, preview: s.title, date: s.date, url: s.url,
  }));

  const { rows } = await pool.query(
    `INSERT INTO reports (location, content, raw_news, news_items)
     VALUES ($1, $2, $3, $4)
     RETURNING id, location, content, raw_news, news_items, created_at`,
    [location, JSON.stringify(content), "Real-time via Google Grounding", JSON.stringify(newsItems)]
  );

  const r = rows[0];
  return { id: r.id, location: r.location, content: r.content, createdAt: r.created_at, rawNews: r.raw_news, newsItems: r.news_items };
}

// ── API routes ──────────────────────────────────────────────────────────────

// Generar reporte para un país
app.post("/api/report", async (req, res) => {
  const { location } = req.body;
  if (!location) return res.status(400).json({ error: "location requerido" });
  try {
    const report = await generateAndSave(location);
    res.json(report);
  } catch (err) {
    console.error("Error generando reporte:", err.message);
    res.status(500).json({ error: "Error al generar el reporte" });
  }
});

// Obtener reportes (último por país, o histórico de un país)
app.get("/api/reports", async (req, res) => {
  const { location } = req.query;
  try {
    let result;
    if (location) {
      result = await pool.query(
        `SELECT id, location, content, raw_news, news_items, created_at
         FROM reports WHERE location = $1 ORDER BY created_at DESC LIMIT 50`,
        [location]
      );
    } else {
      result = await pool.query(
        `SELECT DISTINCT ON (location) id, location, content, raw_news, news_items, created_at
         FROM reports ORDER BY location, created_at DESC`
      );
    }
    res.json(result.rows.map(r => ({
      id: r.id, location: r.location, content: r.content,
      createdAt: r.created_at, rawNews: r.raw_news, newsItems: r.news_items,
    })));
  } catch (err) {
    console.error("Error leyendo reportes:", err.message);
    res.status(500).json({ error: "Error al obtener reportes" });
  }
});

// Actualizar base de medios
app.post("/api/media", async (req, res) => {
  const { location } = req.body;
  if (!location) return res.status(400).json({ error: "location requerido" });

  const prompt = `
    Eres un experto en monitoreo de medios internacionales para el MRE de Perú.
    Genera una lista de los principales medios de comunicación de ${location} relevantes para política, economía, relaciones internacionales y cultura.
    Para cada medio: name (nombre), type ("Diario", "Radio", "TV" o "Digital"), url (URL oficial activa).
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING },
              url:  { type: Type.STRING },
            },
            required: ["name", "type", "url"]
          }
        },
      },
    });

    const validTypes = ["Diario", "Radio", "TV", "Digital"];
    const sources = JSON.parse(response.text).map((s, i) => ({
      id: `gen_${Date.now()}_${i}`,
      name: s.name,
      country: location,
      location,
      type: validTypes.includes(s.type) ? s.type : "Digital",
      url: s.url,
      status: "Activo",
      lastCheck: new Date().toISOString(),
    }));
    res.json(sources);
  } catch (err) {
    console.error("Error generando medios:", err.message);
    res.status(500).json({ error: "Error al generar la base de medios" });
  }
});

// ── Cron diario — 7am Lima (UTC-5 = 12:00 UTC) ─────────────────────────────
const LOCATIONS = [
  "Ciudad de México", "San Marino", "Timbu", "Madrid",
  "Saint John's", "Nasáu", "Bridgetown", "Belmopán",
  "Roseau", "Saint George's", "Puerto Príncipe", "Basseterre",
  "Castries", "Kingstown", "Paramaribo",
];

cron.schedule("0 12 * * *", async () => {
  console.log(`[${new Date().toISOString()}] Iniciando generación diaria...`);
  for (const loc of LOCATIONS) {
    try {
      await generateAndSave(loc);
      console.log(`  ✓ ${loc}`);
      await new Promise(r => setTimeout(r, 4000)); // pausa entre requests
    } catch (err) {
      console.error(`  ✗ ${loc}: ${err.message}`);
    }
  }
  console.log(`[${new Date().toISOString()}] Generación diaria completada.`);
}, { timezone: "UTC" });

// ── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Embajadas Digitales MRE corriendo en puerto ${PORT}`);
});
