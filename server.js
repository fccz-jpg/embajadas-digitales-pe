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
  timeout: 12000,
  customFields: { item: [['source', 'source'], ['media:content', 'mediaContent']] },
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MRE-Monitor/1.0; +https://mre.gob.pe)' },
});

// ── Direct RSS feeds per location per category ───────────────────────────────
// Each entry: { url, name } — feeds are fetched in parallel, errors silently skipped
const LOCATION_FEEDS = {
  "Ciudad de México": {
    politico: [
      { url: "https://www.animalpolitico.com/feed", name: "Animal Político" },
      { url: "https://www.proceso.com.mx/rss/", name: "Proceso" },
      { url: "https://www.jornada.com.mx/rss/politica.xml", name: "La Jornada Política" },
      { url: "https://www.eluniversal.com.mx/rss/nacion.xml", name: "El Universal Nación" },
      { url: "https://www.milenio.com/rss", name: "Milenio" },
    ],
    economico: [
      { url: "https://expansion.mx/rss", name: "Expansión" },
      { url: "https://www.elfinanciero.com.mx/rss", name: "El Financiero" },
      { url: "https://www.eleconomista.com.mx/rss/", name: "El Economista" },
      { url: "https://www.milenio.com/rss", name: "Milenio" },
    ],
    cultural: [
      { url: "https://www.eluniversal.com.mx/rss/cultura.xml", name: "El Universal Cultura" },
      { url: "https://www.jornada.com.mx/rss/cultura.xml", name: "La Jornada Cultura" },
      { url: "https://www.milenio.com/rss", name: "Milenio" },
    ],
    relaciones_internacionales: [
      { url: "https://www.jornada.com.mx/rss/mundo.xml", name: "La Jornada Mundo" },
      { url: "https://www.eluniversal.com.mx/rss/mundo.xml", name: "El Universal Mundo" },
      { url: "https://www.proceso.com.mx/rss/", name: "Proceso" },
    ],
  },
  "Madrid": {
    politico: [
      { url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada", name: "El País España" },
      { url: "https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml", name: "El Mundo España" },
      { url: "https://www.lavanguardia.com/rss/politica.xml", name: "La Vanguardia" },
      { url: "https://www.publico.es/rss/", name: "Público" },
    ],
    economico: [
      { url: "https://e00-expansion.uecdn.es/rss/mercados.xml", name: "Expansión Mercados" },
      { url: "https://www.eleconomista.es/rss/rss-seleccion-ee.php", name: "El Economista ES" },
      { url: "https://cincodias.elpais.com/rss/cincodias/ultima_hora.xml", name: "Cinco Días" },
    ],
    cultural: [
      { url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada", name: "El País Cultura" },
      { url: "https://www.elmundo.es/rss/cultura.xml", name: "El Mundo Cultura" },
    ],
    relaciones_internacionales: [
      { url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada", name: "El País Internacional" },
      { url: "https://e00-elmundo.uecdn.es/elmundo/rss/internacional.xml", name: "El Mundo Internacional" },
    ],
  },
  "San Marino": {
    politico: [
      { url: "https://www.sanmarinortv.sm/rss/news.rss", name: "San Marino RTV" },
      { url: "https://www.libertas.sm/feed/", name: "Libertas" },
    ],
    economico: [
      { url: "https://www.sanmarinortv.sm/rss/news.rss", name: "San Marino RTV" },
    ],
    cultural: [
      { url: "https://www.sanmarinortv.sm/rss/news.rss", name: "San Marino RTV" },
    ],
    relaciones_internacionales: [
      { url: "https://www.sanmarinortv.sm/rss/news.rss", name: "San Marino RTV" },
    ],
  },
  "Timbu": {
    politico: [
      { url: "https://kuenselonline.com/feed/", name: "Kuensel Online" },
      { url: "https://www.bhutantimes.bt/feed/", name: "Bhutan Times" },
    ],
    economico: [
      { url: "https://kuenselonline.com/feed/", name: "Kuensel Online" },
      { url: "https://www.bhutantimes.bt/feed/", name: "Bhutan Times" },
    ],
    cultural: [
      { url: "https://kuenselonline.com/feed/", name: "Kuensel Online" },
    ],
    relaciones_internacionales: [
      { url: "https://kuenselonline.com/feed/", name: "Kuensel Online" },
      { url: "https://www.bhutantimes.bt/feed/", name: "Bhutan Times" },
    ],
  },
  "Saint John's": {
    politico: [
      { url: "https://antiguaobserver.com/feed/", name: "Antigua Observer" },
      { url: "https://antiguanewsroom.com/feed/", name: "Antigua Newsroom" },
    ],
    economico: [
      { url: "https://antiguaobserver.com/feed/", name: "Antigua Observer" },
    ],
    cultural: [
      { url: "https://antiguaobserver.com/feed/", name: "Antigua Observer" },
    ],
    relaciones_internacionales: [
      { url: "https://antiguaobserver.com/feed/", name: "Antigua Observer" },
      { url: "https://antiguanewsroom.com/feed/", name: "Antigua Newsroom" },
    ],
  },
  "Nasáu": {
    politico: [
      { url: "https://thenassauguardian.com/feed/", name: "Nassau Guardian" },
      { url: "https://www.tribune242.com/rss/headlines.rss", name: "Tribune242" },
    ],
    economico: [
      { url: "https://thenassauguardian.com/feed/", name: "Nassau Guardian" },
      { url: "https://www.tribune242.com/rss/headlines.rss", name: "Tribune242" },
    ],
    cultural: [
      { url: "https://thenassauguardian.com/feed/", name: "Nassau Guardian" },
    ],
    relaciones_internacionales: [
      { url: "https://thenassauguardian.com/feed/", name: "Nassau Guardian" },
      { url: "https://www.tribune242.com/rss/headlines.rss", name: "Tribune242" },
    ],
  },
  "Bridgetown": {
    politico: [
      { url: "https://www.nationnews.com/feed/", name: "Nation News" },
      { url: "https://barbadostoday.bb/feed/", name: "Barbados Today" },
    ],
    economico: [
      { url: "https://www.nationnews.com/feed/", name: "Nation News" },
      { url: "https://barbadostoday.bb/feed/", name: "Barbados Today" },
    ],
    cultural: [
      { url: "https://www.nationnews.com/feed/", name: "Nation News" },
      { url: "https://barbadostoday.bb/feed/", name: "Barbados Today" },
    ],
    relaciones_internacionales: [
      { url: "https://www.nationnews.com/feed/", name: "Nation News" },
      { url: "https://barbadostoday.bb/feed/", name: "Barbados Today" },
    ],
  },
  "Belmopán": {
    politico: [
      { url: "https://edition.channel5belize.com/feed/", name: "Channel 5 Belize" },
      { url: "https://amandala.com.bz/news/feed/", name: "Amandala" },
      { url: "https://www.breakingbelizenews.com/feed/", name: "Breaking Belize News" },
    ],
    economico: [
      { url: "https://edition.channel5belize.com/feed/", name: "Channel 5 Belize" },
      { url: "https://amandala.com.bz/news/feed/", name: "Amandala" },
    ],
    cultural: [
      { url: "https://edition.channel5belize.com/feed/", name: "Channel 5 Belize" },
    ],
    relaciones_internacionales: [
      { url: "https://edition.channel5belize.com/feed/", name: "Channel 5 Belize" },
      { url: "https://amandala.com.bz/news/feed/", name: "Amandala" },
    ],
  },
  "Roseau": {
    politico: [
      { url: "https://dominicanewsonline.com/news/feed/", name: "Dominica News Online" },
      { url: "https://dominicavibes.dm/feed/", name: "Dominica Vibes" },
    ],
    economico: [
      { url: "https://dominicanewsonline.com/news/feed/", name: "Dominica News Online" },
    ],
    cultural: [
      { url: "https://dominicanewsonline.com/news/feed/", name: "Dominica News Online" },
    ],
    relaciones_internacionales: [
      { url: "https://dominicanewsonline.com/news/feed/", name: "Dominica News Online" },
    ],
  },
  "Saint George's": {
    politico: [
      { url: "https://www.nowgrenada.com/feed/", name: "Now Grenada" },
      { url: "https://grenadabroadcast.com/feed/", name: "Grenada Broadcasting" },
    ],
    economico: [
      { url: "https://www.nowgrenada.com/feed/", name: "Now Grenada" },
    ],
    cultural: [
      { url: "https://www.nowgrenada.com/feed/", name: "Now Grenada" },
    ],
    relaciones_internacionales: [
      { url: "https://www.nowgrenada.com/feed/", name: "Now Grenada" },
    ],
  },
  "Puerto Príncipe": {
    politico: [
      { url: "https://www.alterpresse.org/rss.php", name: "AlterPresse" },
      { url: "https://www.haitilibre.com/rss/haiti-actualite.xml", name: "Haiti Libre" },
    ],
    economico: [
      { url: "https://www.alterpresse.org/rss.php", name: "AlterPresse" },
      { url: "https://www.haitilibre.com/rss/haiti-economie.xml", name: "Haiti Libre Economía" },
    ],
    cultural: [
      { url: "https://www.haitilibre.com/rss/haiti-culture.xml", name: "Haiti Libre Cultura" },
      { url: "https://www.alterpresse.org/rss.php", name: "AlterPresse" },
    ],
    relaciones_internacionales: [
      { url: "https://www.haitilibre.com/rss/haiti-international.xml", name: "Haiti Libre Internacional" },
      { url: "https://www.alterpresse.org/rss.php", name: "AlterPresse" },
    ],
  },
  "Basseterre": {
    politico: [
      { url: "https://www.thestkittsnevisobserver.com/feed/", name: "SKN Observer" },
      { url: "https://sknpulse.com/feed/", name: "SKN Pulse" },
    ],
    economico: [
      { url: "https://www.thestkittsnevisobserver.com/feed/", name: "SKN Observer" },
      { url: "https://sknpulse.com/feed/", name: "SKN Pulse" },
    ],
    cultural: [
      { url: "https://www.thestkittsnevisobserver.com/feed/", name: "SKN Observer" },
    ],
    relaciones_internacionales: [
      { url: "https://www.thestkittsnevisobserver.com/feed/", name: "SKN Observer" },
      { url: "https://sknpulse.com/feed/", name: "SKN Pulse" },
    ],
  },
  "Castries": {
    politico: [
      { url: "https://stluciatimes.com/feed/", name: "St. Lucia Times" },
      { url: "https://www.thevoiceslu.com/feed/", name: "The Voice St. Lucia" },
    ],
    economico: [
      { url: "https://stluciatimes.com/feed/", name: "St. Lucia Times" },
      { url: "https://www.thevoiceslu.com/feed/", name: "The Voice St. Lucia" },
    ],
    cultural: [
      { url: "https://stluciatimes.com/feed/", name: "St. Lucia Times" },
    ],
    relaciones_internacionales: [
      { url: "https://stluciatimes.com/feed/", name: "St. Lucia Times" },
      { url: "https://www.thevoiceslu.com/feed/", name: "The Voice St. Lucia" },
    ],
  },
  "Kingstown": {
    politico: [
      { url: "https://iwnsvg.com/feed/", name: "iWitness News SVG" },
      { url: "https://searchlight.vc/feed/", name: "Searchlight" },
    ],
    economico: [
      { url: "https://iwnsvg.com/feed/", name: "iWitness News SVG" },
      { url: "https://searchlight.vc/feed/", name: "Searchlight" },
    ],
    cultural: [
      { url: "https://iwnsvg.com/feed/", name: "iWitness News SVG" },
      { url: "https://searchlight.vc/feed/", name: "Searchlight" },
    ],
    relaciones_internacionales: [
      { url: "https://iwnsvg.com/feed/", name: "iWitness News SVG" },
      { url: "https://searchlight.vc/feed/", name: "Searchlight" },
    ],
  },
  "Paramaribo": {
    politico: [
      { url: "https://www.waterkant.net/feed/", name: "Waterkant" },
      { url: "https://www.srherald.com/feed/", name: "Suriname Herald" },
    ],
    economico: [
      { url: "https://www.waterkant.net/feed/", name: "Waterkant" },
      { url: "https://www.srherald.com/feed/", name: "Suriname Herald" },
    ],
    cultural: [
      { url: "https://www.waterkant.net/feed/", name: "Waterkant" },
    ],
    relaciones_internacionales: [
      { url: "https://www.waterkant.net/feed/", name: "Waterkant" },
      { url: "https://www.srherald.com/feed/", name: "Suriname Herald" },
    ],
  },
};

// ── Category keyword filter (for general feeds that cover all topics) ────────
const CATEGORY_KEYWORDS = {
  politico: ["gobierno","política","presidente","congreso","parlamento","ministro","elección","partido","constitución","seguridad","ley","decreto","senado","diputado","gobernador","alcalde"],
  economico: ["economía","económic","finanza","mercado","inversión","empresa","inflación","pib","crecimiento","comercio","banco","dólar","peso","exportación","importación","deuda","presupuesto"],
  cultural: ["cultura","arte","festival","exposición","museo","teatro","música","cine","turismo","patrimonio","educación","universidad","literatura","deporte","tradición"],
  relaciones_internacionales: ["diplomacia","bilateral","cancillería","embajada","tratado","cooperación","oea","caricom","onu","sica","unión europea","relaciones exteriores","acuerdo","reunión","canciller","ministerio de relaciones"],
};

// ── Google News locale fallback ──────────────────────────────────────────────
const GNEWS_LOCALE = {
  "Ciudad de México": { gl: "MX", hl: "es-419" },
  "Madrid":           { gl: "ES", hl: "es"      },
  "San Marino":       { gl: "IT", hl: "it"      },
  "Timbu":            { gl: "IN", hl: "en"      },
  "Saint John's":     { gl: "AG", hl: "en"      },
  "Nasáu":            { gl: "BS", hl: "en"      },
  "Bridgetown":       { gl: "BB", hl: "en"      },
  "Belmopán":         { gl: "BZ", hl: "es-419"  },
  "Roseau":           { gl: "DM", hl: "en"      },
  "Saint George's":   { gl: "GD", hl: "en"      },
  "Puerto Príncipe":  { gl: "HT", hl: "fr"      },
  "Basseterre":       { gl: "KN", hl: "en"      },
  "Castries":         { gl: "LC", hl: "en"      },
  "Kingstown":        { gl: "VC", hl: "en"      },
  "Paramaribo":       { gl: "SR", hl: "nl"      },
};

const CATEGORY_QUERY = {
  politico:                   (loc) => `${loc} política gobierno presidente`,
  economico:                  (loc) => `${loc} economía finanzas mercado`,
  cultural:                   (loc) => `${loc} cultura arte turismo`,
  relaciones_internacionales: (loc) => `${loc} diplomacia relaciones internacionales`,
};

// ── Fetch a single RSS feed with timeout ────────────────────────────────────
async function fetchFeed(feedDef, category) {
  try {
    const feed = await rssParser.parseURL(feedDef.url);
    return feed.items.slice(0, 15).map(item => ({
      title:   (item.title || '').trim(),
      source:  feedDef.name,
      url:     item.link || '',
      date:    item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      preview: item.contentSnippet || item.summary || '',
      category,
    })).filter(i => i.title);
  } catch {
    return [];
  }
}

// ── Fetch Google News RSS fallback ───────────────────────────────────────────
async function fetchGoogleNews(location, category) {
  const locale = GNEWS_LOCALE[location] || { gl: "US", hl: "es-419" };
  const q = (CATEGORY_QUERY[category] || CATEGORY_QUERY.politico)(location);
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.gl}:${locale.hl}`;
  try {
    const feed = await rssParser.parseURL(url);
    return feed.items.slice(0, 15).map(item => {
      const raw = item.title || '';
      const idx = raw.lastIndexOf(' - ');
      const title  = idx > 0 ? raw.slice(0, idx).trim() : raw.trim();
      const source = idx > 0 ? raw.slice(idx + 3).trim() : 'Google News';
      return { title, source, url: item.link || '', date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(), preview: item.contentSnippet || '', category };
    }).filter(i => i.title);
  } catch {
    return [];
  }
}

// ── Main news fetch: direct feeds first, Google News fallback ────────────────
async function fetchCategoryNews(location, category) {
  const locationFeeds = LOCATION_FEEDS[location];
  const feeds = locationFeeds?.[category] ?? [];

  let items = [];

  if (feeds.length > 0) {
    // Fetch all feeds for this category in parallel
    const results = await Promise.all(feeds.map(f => fetchFeed(f, category)));
    const allItems = results.flat();

    // For locations with only general feeds (same feeds across categories), filter by keywords
    const keywords = CATEGORY_KEYWORDS[category] || [];
    const hasSpecificFeed = feeds.some(f => f.url.includes(category) || f.url.includes(
      { politico: 'politi', economico: 'econom', cultural: 'cultur', relaciones_internacionales: 'mundo' }[category] || ''
    ));

    if (!hasSpecificFeed && allItems.length > 0) {
      // Filter by category keywords
      const filtered = allItems.filter(item => {
        const text = `${item.title} ${item.preview}`.toLowerCase();
        return keywords.some(k => text.includes(k));
      });
      items = filtered.length >= 3 ? filtered : allItems; // fallback to all if too few matches
    } else {
      items = allItems;
    }
  }

  // Deduplicate by title
  const seen = new Set();
  items = items.filter(item => {
    const key = item.title.slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // If we got fewer than 5 articles, supplement with Google News
  if (items.length < 5) {
    const gnews = await fetchGoogleNews(location, category);
    const combined = [...items, ...gnews];
    const seen2 = new Set();
    items = combined.filter(item => {
      const key = item.title.slice(0, 60);
      if (seen2.has(key)) return false;
      seen2.add(key);
      return true;
    });
  }

  return items.slice(0, 25);
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
