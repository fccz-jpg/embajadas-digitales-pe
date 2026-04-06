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

// ── Country name aliases for keyword matching ────────────────────────────────
const LOCATION_COUNTRY_TERMS = {
  "Ciudad de México": ["méxico","mexico","mexicano","mexicana","azteca"],
  "San Marino":       ["san marino","sanmarinese","sammarinese"],
  "Timbu":            ["bhutan","bután","bhutanese","butanés"],
  "Saint John's":     ["antigua","barbuda","antiguan"],
  "Nasáu":            ["bahamas","bahamian","bahameño"],
  "Bridgetown":       ["barbados","barbadian","barbadense"],
  "Belmopán":         ["belize","belice","belizean","beliceño"],
  "Saint George's":   ["grenada","granada","grenadian","granadino"],
  "Puerto Príncipe":  ["haiti","haití","haitian","haitiano"],
  "Basseterre":       ["saint kitts","san cristóbal","nevis","kittitian","nevisian"],
  "Castries":         ["saint lucia","santa lucía","st. lucia","lucian","luciano"],
  "Kingstown":        ["saint vincent","san vicente","granadinas","vincentian"],
  "Paramaribo":       ["suriname","surinam","surinamese","surinamés"],
};

// ── Category keyword filter (for general feeds that cover all topics) ────────
const CATEGORY_KEYWORDS = {
  politico: ["gobierno","política","político","presidente","congreso","parlamento","ministro","elección","partido","constitución","seguridad","ley","decreto","senado","diputado","gobernador","alcalde","primer ministro","prime minister","parliament","election","government","political","minister","security"],
  economico: ["economía","económic","finanza","mercado","inversión","empresa","inflación","pib","crecimiento","comercio","banco","dólar","euro","exportación","importación","deuda","presupuesto","economy","economic","finance","market","investment","inflation","gdp","trade","bank"],
  cultural: ["cultura","arte","festival","exposición","museo","teatro","música","cine","turismo","patrimonio","educación","universidad","literatura","deporte","tradición","culture","art","museum","festival","tourism","heritage","education","sport","music"],
  relaciones_internacionales: ["diplomacia","bilateral","cancillería","embajada","tratado","cooperación","oea","caricom","onu","sica","unión europea","relaciones exteriores","acuerdo","canciller","ministerio de relaciones","diplomacy","treaty","cooperation","united nations","foreign","international relations","embassy","minister of foreign"],
};

// ── Google News locale fallback ──────────────────────────────────────────────
const GNEWS_LOCALE = {
  "Ciudad de México": { gl: "MX", hl: "es-419" },
  "San Marino":       { gl: "IT", hl: "it"      },
  "Timbu":            { gl: "IN", hl: "en"      },
  "Saint John's":     { gl: "AG", hl: "en"      },
  "Nasáu":            { gl: "BS", hl: "en"      },
  "Bridgetown":       { gl: "BB", hl: "en"      },
  "Belmopán":         { gl: "BZ", hl: "es-419"  },
  "Saint George's":   { gl: "GD", hl: "en"      },
  "Puerto Príncipe":  { gl: "HT", hl: "fr"      },
  "Basseterre":       { gl: "KN", hl: "en"      },
  "Castries":         { gl: "LC", hl: "en"      },
  "Kingstown":        { gl: "VC", hl: "en"      },
  "Paramaribo":       { gl: "SR", hl: "nl"      },
};

const CATEGORY_QUERY = {
  politico:                   (loc) => `${loc} política interna gobierno presidente`,
  economico:                  (loc) => `${loc} economía finanzas mercado comercio`,
  cultural:                   (loc) => `${loc} cultura arte turismo sociedad`,
  relaciones_internacionales: (loc) => `${loc} diplomacia relaciones exteriores cancillería`,
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
  const categoryKeywords = CATEGORY_KEYWORDS[category] || [];
  const countryTerms = LOCATION_COUNTRY_TERMS[location] || [];

  // Combined filter: article must match category AND country terms
  function matchesFilter(item) {
    const text = `${item.title} ${item.preview}`.toLowerCase();
    const matchesCategory = categoryKeywords.length === 0 || categoryKeywords.some(k => text.includes(k));
    const matchesCountry = countryTerms.length === 0 || countryTerms.some(k => text.includes(k));
    return matchesCategory && matchesCountry;
  }

  let items = [];

  if (feeds.length > 0) {
    // Fetch all feeds for this category in parallel
    const results = await Promise.all(feeds.map(f => fetchFeed(f, category)));
    const allItems = results.flat();

    // For category-specific feeds (e.g. jornada.com.mx/rss/politica.xml), only filter by country
    // For general feeds, filter by both category + country
    const hasSpecificFeed = feeds.some(f => f.url.includes(
      { politico: 'politi', economico: 'econom', cultural: 'cultur', relaciones_internacionales: 'mundo' }[category] || '___'
    ));

    if (hasSpecificFeed) {
      // Specific feed: trust the category, only ensure country relevance
      const filtered = allItems.filter(item => {
        const text = `${item.title} ${item.preview}`.toLowerCase();
        return countryTerms.length === 0 || countryTerms.some(k => text.includes(k));
      });
      items = filtered.length >= 3 ? filtered : allItems;
    } else {
      // General feed: filter by both
      const filtered = allItems.filter(matchesFilter);
      items = filtered.length >= 3 ? filtered : allItems;
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
  panorama_general: {
    label: "Panorama General",
    focus: "síntesis integral de la situación política, económica, cultural y diplomática del país, más la posición oficial de Perú respecto a los eventos del período",
    searchTerms: "situación actual política economía diplomacia",
  },
};

// ── Generate one category report ────────────────────────────────────────────
async function generateCategoryReport(location, category) {
  const { label, focus } = CATEGORIES[category];

  const today = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();

  const prompt = `Actúa como analista de inteligencia estratégica del Ministerio de Relaciones Exteriores (MRE) de Perú.

Genera el REPORTE DIARIO ${label.toUpperCase()} sobre ${location} correspondiente al ${today}.

ENFOQUE EXCLUSIVO: ${focus}

ESTRUCTURA OBLIGATORIA — usa exactamente estos títulos numerados en mayúsculas, en texto plano (sin Markdown especial):

REPORTE DIARIO: ${label.toUpperCase()} — ${today}

1. SITUACIÓN DEL DÍA
Resumen ejecutivo de los hechos más relevantes de las últimas 24-48 horas. Mínimo 150 palabras. Incluye cifras, declaraciones textuales y nombres de fuentes entre paréntesis.

2. DESARROLLO DÍA A DÍA
Cronología de eventos del período, organizados por fecha (del más antiguo al más reciente). Para cada día: subtítulo con la fecha exacta (ej. "2.1. Jueves, 03 de abril de 2026") seguido de párrafo narrativo detallado. Cita fuentes al final de cada párrafo: (Fuentes: Medio A, Medio B, año).

3. ACTORES Y ACCIONES RECIENTES
Subsecciones por actor principal (gobierno, oposición, organismos internacionales, etc.). Para cada uno: subtítulo con nombre del actor (ej. "3.1. Nombre del actor") seguido de descripción en prosa de sus acciones, declaraciones y posiciones en el período.

4. CONTEXTO NECESARIO
Antecedentes estructurales necesarios para interpretar los eventos del día. Incluye datos históricos, marcos institucionales y tendencias de largo plazo relevantes. Texto continuo en prosa.
${category === 'panorama_general' ? `
5. POSICIÓN OFICIAL DEL PERÚ
Busca y cita declaraciones oficiales, comunicados de prensa, notas diplomáticas o posiciones públicas del gobierno del Perú, la Cancillería peruana o el Ministerio de Relaciones Exteriores del Perú respecto a ${location} o a los eventos del período monitoreado. Cita fuentes entre paréntesis. Si no hay registro: "Sin declaración oficial del Perú registrada en el período monitoreado."` : ''}

REGLAS ESTRICTAS:
- Texto continuo en prosa, NO listas con viñetas ni asteriscos.
- Cita fuentes entre paréntesis dentro del texto.
- Mínimo 600 palabras en total.
- Tono profesional, analítico, de inteligencia estratégica.
${category === 'panorama_general' ? `- INCLUYE la sección 5 sobre Perú. Busca declaraciones, comunicados o posiciones oficiales del gobierno peruano, Cancillería o MRE respecto a ${location} o los eventos del período. Si no hay declaración oficial registrada, escribe: "Sin declaración oficial del Perú registrada en el período monitoreado."` : `- NO menciones a Perú ni relaciones bilaterales con Perú.`}
- Si no hay eventos relevantes en el período: escribe "Sin reportes relevantes en los medios monitoreados durante el presente período."

Para el campo sources: lista cada artículo consultado con título exacto, nombre del medio, URL activa y fecha.`;

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
  "Ciudad de México", "San Marino", "Timbu",
  "Saint John's", "Nasáu", "Bridgetown", "Belmopán",
  "Saint George's", "Puerto Príncipe", "Basseterre",
  "Castries", "Kingstown", "Paramaribo",
];

cron.schedule("0 12 * * *", async () => {
  console.log(`[${new Date().toISOString()}] Iniciando generación diaria...`);
  for (const loc of LOCATIONS) {
    for (const cat of ["politico", "economico", "cultural", "relaciones_internacionales", "panorama_general"]) {
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
