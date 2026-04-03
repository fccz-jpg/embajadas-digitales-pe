import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import pg from "pg";
import cron from "node-cron";
import Parser from "rss-parser";

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
      category    TEXT,
      content     JSONB        NOT NULL,
      raw_news    TEXT,
      news_items  JSONB,
      created_at  TIMESTAMPTZ  DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_reports_location    ON reports (location);
    CREATE INDEX IF NOT EXISTS idx_reports_loc_cat     ON reports (location, category, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_created_at  ON reports (created_at DESC);
  `);
  // Add category column if table already exists without it
  await pool.query(`
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS category TEXT;
  `).catch(() => {});
  console.log("Base de datos lista.");
}

initDB().catch(err => console.error("Error inicializando BD:", err.message || err));

// ── RSS News ────────────────────────────────────────────────────────────────
const rssParser = new Parser({
  timeout: 10000,
  customFields: { item: [['source', 'source']] },
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MRE-Monitor/1.0)' },
});

// Google News search queries per category and country name
const CATEGORY_QUERIES = {
  politico:                   (loc) => `${loc} política gobierno presidente congreso estabilidad`,
  economico:                  (loc) => `${loc} economía finanzas inversión comercio PIB inflación`,
  cultural:                   (loc) => `${loc} cultura arte turismo festival sociedad educación`,
  relaciones_internacionales: (loc) => `${loc} diplomacia relaciones internacionales cancillería OEA embajada`,
};

// Per-location Google News locale params (gl, hl)
const LOCATION_LOCALE = {
  "Ciudad de México": { gl: "MX", hl: "es-419", lang: "es" },
  "Madrid":           { gl: "ES", hl: "es",      lang: "es" },
  "San Marino":       { gl: "IT", hl: "it",      lang: "it" },
  "Timbu":            { gl: "IN", hl: "en",      lang: "en" },
  "Saint John's":     { gl: "AG", hl: "en",      lang: "en" },
  "Nasáu":            { gl: "BS", hl: "en",      lang: "en" },
  "Bridgetown":       { gl: "BB", hl: "en",      lang: "en" },
  "Belmopán":         { gl: "BZ", hl: "es-419",  lang: "es" },
  "Roseau":           { gl: "DM", hl: "en",      lang: "en" },
  "Saint George's":   { gl: "GD", hl: "en",      lang: "en" },
  "Puerto Príncipe":  { gl: "HT", hl: "fr",      lang: "fr" },
  "Basseterre":       { gl: "KN", hl: "en",      lang: "en" },
  "Castries":         { gl: "LC", hl: "en",      lang: "en" },
  "Kingstown":        { gl: "VC", hl: "en",      lang: "en" },
  "Paramaribo":       { gl: "SR", hl: "nl",      lang: "nl" },
};

function parseGoogleTitle(raw) {
  // Google News titles: "Article Title - Source Name"
  const idx = raw.lastIndexOf(' - ');
  if (idx > 0) return { title: raw.slice(0, idx).trim(), sourceName: raw.slice(idx + 3).trim() };
  return { title: raw.trim(), sourceName: '' };
}

async function fetchCategoryNews(location, category) {
  const queryFn = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.politico;
  const q = queryFn(location);
  const locale = LOCATION_LOCALE[location] || { gl: "US", hl: "es-419", lang: "es" };
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.gl}:${locale.hl}`;

  const feed = await rssParser.parseURL(url);
  return feed.items.slice(0, 20).map(item => {
    const { title, sourceName } = parseGoogleTitle(item.title || '');
    const source = item.source?._ || sourceName || 'Google News';
    return {
      title,
      source,
      url: item.link || '',
      date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      preview: item.contentSnippet || item.content || title,
      category,
    };
  });
}

// GET /api/news?location=Ciudad de México&category=politico
app.get("/api/news", async (req, res) => {
  const { location, category } = req.query;
  if (!location || !category) return res.status(400).json({ error: "location y category requeridos" });
  try {
    const items = await fetchCategoryNews(location, category);
    res.json(items);
  } catch (err) {
    console.error("Error fetching news:", err.message);
    res.status(500).json({ error: "Error al obtener noticias: " + err.message });
  }
});

// ── Gemini ──────────────────────────────────────────────────────────────────
function getAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurado");
  return new GoogleGenAI({ apiKey: key });
}

// ── Category configs ────────────────────────────────────────────────────────
const CATEGORIES = {
  politico: {
    label: "Político",
    focus: "política interna, gobernanza, estabilidad gubernamental, partidos políticos, elecciones y seguridad pública",
    searchTerms: "política gobierno estabilidad",
  },
  economico: {
    label: "Económico",
    focus: "economía, finanzas, mercados, comercio exterior, inversión, inflación, crecimiento del PIB y sectores productivos clave",
    searchTerms: "economía finanzas mercados comercio",
  },
  cultural: {
    label: "Cultural",
    focus: "cultura, arte, turismo, sociedad, educación, medios de comunicación y tendencias sociales",
    searchTerms: "cultura arte turismo sociedad eventos",
  },
  relaciones_internacionales: {
    label: "Relaciones Internacionales",
    focus: "relaciones diplomáticas, acuerdos bilaterales y multilaterales, organismos internacionales (OEA, CARICOM, ONU, SICA, etc.) y agenda exterior",
    searchTerms: "diplomacia relaciones internacionales organismos multilaterales",
  },
};

// ── Generate one category report ────────────────────────────────────────────
async function generateCategoryReport(location, category) {
  const { label, focus } = CATEGORIES[category];

  const prompt = `Actúa como analista de inteligencia estratégica del Ministerio de Relaciones Exteriores (MRE) de Perú.

Genera un informe ${label} completo y detallado sobre ${location}.

ENFOQUE EXCLUSIVO: ${focus}

INSTRUCCIONES:
1. Busca y analiza las noticias más recientes (últimas 24-48 horas) sobre este tema en ${location}.
2. Redacta un análisis estructurado que incluya:
   - Contexto y situación actual
   - Hechos y eventos relevantes del período monitoreado
   - Actores clave y sus posiciones
   - Tendencias identificadas
   - Perspectivas a corto plazo
3. Extensión mínima: 400 palabras de análisis.

FORMATO:
- Usa Markdown. Comienza con un título ## descriptivo.
- Usa **negritas** para resaltar datos clave, cifras, fechas y nombres de medios.
- Usa listas con viñetas para enumerar hechos concretos.
- Tono profesional, analítico y de alta dirección.
- NO compares con Perú ni hagas referencias a relaciones bilaterales con Perú. Enfócate exclusivamente en ${location}.
- Si no hay noticias relevantes en el período: indica "Sin reportes relevantes en los medios monitoreados durante el presente período."

Para cada fuente utilizada: proporciona el título exacto del artículo, nombre del medio, URL activa, fecha de publicación y una descripción breve de 1-2 oraciones del contenido.`;

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
          text: { type: Type.STRING },
          sources: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title:   { type: Type.STRING },
                source:  { type: Type.STRING },
                url:     { type: Type.STRING },
                date:    { type: Type.STRING },
                preview: { type: Type.STRING },
              },
            },
          },
        },
        required: ["text", "sources"],
      },
    },
  });

  const content = JSON.parse(response.text);
  const newsItems = (content.sources ?? []).map(s => ({
    title:    s.title,
    source:   s.source,
    preview:  s.preview || s.title,
    date:     s.date,
    url:      s.url,
    category,
  }));

  const { rows } = await pool.query(
    `INSERT INTO reports (location, category, content, raw_news, news_items)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, location, category, content, news_items, created_at`,
    [location, category, JSON.stringify({ text: content.text, sources: content.sources }), "Real-time via Google Grounding", JSON.stringify(newsItems)]
  );

  const r = rows[0];
  return {
    id:        r.id,
    location:  r.location,
    category:  r.category,
    content:   r.content,
    createdAt: r.created_at,
    newsItems: r.news_items,
  };
}

// ── API routes ──────────────────────────────────────────────────────────────

// Generar los 4 reportes de categoría para un país
app.post("/api/report", async (req, res) => {
  const { location, category } = req.body;
  if (!location) return res.status(400).json({ error: "location requerido" });

  const cats = category
    ? [category]
    : ["politico", "economico", "cultural", "relaciones_internacionales"];

  try {
    const results = [];
    for (const cat of cats) {
      try {
        const report = await generateCategoryReport(location, cat);
        results.push(report);
        if (cats.length > 1) await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`Error generando ${cat} para ${location}:`, err.message);
      }
    }
    if (results.length === 0) return res.status(500).json({ error: "No se pudo generar ningún reporte" });
    res.json(results);
  } catch (err) {
    console.error("Error generando reporte:", err.message);
    res.status(500).json({ error: "Error al generar el reporte" });
  }
});

// Obtener reportes (último por país+categoría, o histórico)
app.get("/api/reports", async (req, res) => {
  const { location, category } = req.query;
  try {
    let result;
    if (location && category) {
      result = await pool.query(
        `SELECT id, location, category, content, raw_news, news_items, created_at
         FROM reports WHERE location = $1 AND category = $2 ORDER BY created_at DESC LIMIT 50`,
        [location, category]
      );
    } else if (location) {
      result = await pool.query(
        `SELECT DISTINCT ON (COALESCE(category, 'legacy')) id, location, category, content, raw_news, news_items, created_at
         FROM reports WHERE location = $1
         ORDER BY COALESCE(category, 'legacy'), created_at DESC`,
        [location]
      );
    } else {
      result = await pool.query(
        `SELECT DISTINCT ON (location, COALESCE(category, 'legacy')) id, location, category, content, raw_news, news_items, created_at
         FROM reports ORDER BY location, COALESCE(category, 'legacy'), created_at DESC`
      );
    }
    res.json(result.rows.map(r => ({
      id:        r.id,
      location:  r.location,
      category:  r.category,
      content:   r.content,
      createdAt: r.created_at,
      rawNews:   r.raw_news,
      newsItems: r.news_items,
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
            required: ["name", "type", "url"],
          },
        },
      },
    });

    const validTypes = ["Diario", "Radio", "TV", "Digital"];
    const sources = JSON.parse(response.text).map((s, i) => ({
      id:        `gen_${Date.now()}_${i}`,
      name:      s.name,
      country:   location,
      location,
      type:      validTypes.includes(s.type) ? s.type : "Digital",
      url:       s.url,
      status:    "Activo",
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
    for (const cat of ["politico", "economico", "cultural", "relaciones_internacionales"]) {
      try {
        await generateCategoryReport(loc, cat);
        console.log(`  ✓ ${loc} / ${cat}`);
        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        console.error(`  ✗ ${loc}/${cat}: ${err.message}`);
      }
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
