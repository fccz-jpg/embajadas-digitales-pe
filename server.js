import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import pg from "pg";
import cron from "node-cron";
import Parser from "rss-parser";
import {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, BorderStyle, PageNumber,
  ExternalHyperlink, LevelFormat, UnderlineType,
} from "docx";

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
      { url: "https://www.excelsior.com.mx/rss.xml", name: "Excélsior" },
      { url: "https://politica.expansion.mx/rss", name: "Expansión Política" },
      { url: "https://www.elheraldo.mx/rss.xml", name: "El Heraldo" },
      { url: "https://www.24-horas.mx/feed/", name: "24 Horas" },
      { url: "https://www.reporteindigo.com/feed/", name: "Reporte Índigo" },
      { url: "https://aristeguinoticias.com/feed/", name: "Aristegui Noticias" },
      { url: "https://www.sdpnoticias.com/feed/", name: "SDP Noticias" },
    ],
    economico: [
      { url: "https://expansion.mx/rss", name: "Expansión" },
      { url: "https://www.elfinanciero.com.mx/rss", name: "El Financiero" },
      { url: "https://www.eleconomista.com.mx/rss/", name: "El Economista" },
      { url: "https://www.eluniversal.com.mx/rss/cartera.xml", name: "El Universal Cartera" },
      { url: "https://www.jornada.com.mx/rss/economia.xml", name: "La Jornada Economía" },
      { url: "https://www.forbes.com.mx/feed/", name: "Forbes México" },
      { url: "https://www.excelsior.com.mx/rss.xml", name: "Excélsior" },
      { url: "https://www.reporteindigo.com/feed/", name: "Reporte Índigo" },
      { url: "https://www.elheraldo.mx/rss.xml", name: "El Heraldo" },
    ],
    cultural: [
      { url: "https://www.eluniversal.com.mx/rss/cultura.xml", name: "El Universal Cultura" },
      { url: "https://www.jornada.com.mx/rss/cultura.xml", name: "La Jornada Cultura" },
      { url: "https://www.excelsior.com.mx/rss.xml", name: "Excélsior" },
      { url: "https://www.proceso.com.mx/rss/", name: "Proceso" },
      { url: "https://www.animalpolitico.com/feed", name: "Animal Político" },
      { url: "https://www.elheraldo.mx/rss.xml", name: "El Heraldo" },
      { url: "https://aristeguinoticias.com/feed/", name: "Aristegui Noticias" },
    ],
    relaciones_internacionales: [
      { url: "https://www.jornada.com.mx/rss/mundo.xml", name: "La Jornada Mundo" },
      { url: "https://www.eluniversal.com.mx/rss/mundo.xml", name: "El Universal Mundo" },
      { url: "https://www.proceso.com.mx/rss/", name: "Proceso" },
      { url: "https://www.excelsior.com.mx/rss.xml", name: "Excélsior" },
      { url: "https://expansion.mx/rss", name: "Expansión" },
      { url: "https://www.reporteindigo.com/feed/", name: "Reporte Índigo" },
      { url: "https://aristeguinoticias.com/feed/", name: "Aristegui Noticias" },
    ],
  },
  "San Marino": {
    politico: [
      { url: "https://www.sanmarinortv.sm/rss/news.rss", name: "San Marino RTV" },
      { url: "https://www.libertas.sm/feed/", name: "Libertas" },
      { url: "https://www.sanmarinoserenissima.sm/feed/", name: "San Marino Serenissima" },
      { url: "https://sanmarinonews.net/feed/", name: "San Marino News" },
      { url: "https://www.ansa.it/sito/ansait_rss.xml", name: "ANSA" },
      { url: "https://xml2.corrieredellasera.it/rss/homepage.xml", name: "Corriere della Sera" },
    ],
    economico: [
      { url: "https://www.sanmarinortv.sm/rss/news.rss", name: "San Marino RTV" },
      { url: "https://www.libertas.sm/feed/", name: "Libertas" },
      { url: "https://www.ilsole24ore.com/rss/italia.xml", name: "Il Sole 24 Ore" },
      { url: "https://www.ansa.it/sito/ansait_rss.xml", name: "ANSA" },
      { url: "https://sanmarinonews.net/feed/", name: "San Marino News" },
    ],
    cultural: [
      { url: "https://www.sanmarinortv.sm/rss/news.rss", name: "San Marino RTV" },
      { url: "https://www.sanmarinoserenissima.sm/feed/", name: "San Marino Serenissima" },
      { url: "https://sanmarinonews.net/feed/", name: "San Marino News" },
      { url: "https://www.repubblica.it/rss/homepage/rss2.0.xml", name: "La Repubblica" },
      { url: "https://xml2.corrieredellasera.it/rss/homepage.xml", name: "Corriere della Sera" },
    ],
    relaciones_internacionales: [
      { url: "https://www.sanmarinortv.sm/rss/news.rss", name: "San Marino RTV" },
      { url: "https://www.libertas.sm/feed/", name: "Libertas" },
      { url: "https://www.ansa.it/sito/ansait_rss.xml", name: "ANSA" },
      { url: "https://www.repubblica.it/rss/homepage/rss2.0.xml", name: "La Repubblica" },
      { url: "https://xml2.corrieredellasera.it/rss/homepage.xml", name: "Corriere della Sera" },
      { url: "https://www.ilsole24ore.com/rss/italia.xml", name: "Il Sole 24 Ore" },
    ],
  },
  "Timbu": {
    politico: [
      { url: "https://kuenselonline.com/feed/", name: "Kuensel Online" },
      { url: "https://www.bhutantimes.bt/feed/", name: "Bhutan Times" },
      { url: "https://thebhutanese.bt/feed/", name: "The Bhutanese" },
      { url: "https://www.bhutanobserver.bt/feed/", name: "Bhutan Observer" },
      { url: "https://www.thehindu.com/feeder/default.rss", name: "The Hindu" },
      { url: "https://southasianmonitor.com/feed/", name: "South Asian Monitor" },
    ],
    economico: [
      { url: "https://kuenselonline.com/feed/", name: "Kuensel Online" },
      { url: "https://www.bhutantimes.bt/feed/", name: "Bhutan Times" },
      { url: "https://businessbhutan.bt/feed/", name: "Business Bhutan" },
      { url: "https://timesofindia.indiatimes.com/rssfeeds/1221656.cms", name: "Times of India" },
      { url: "https://southasianmonitor.com/feed/", name: "South Asian Monitor" },
    ],
    cultural: [
      { url: "https://kuenselonline.com/feed/", name: "Kuensel Online" },
      { url: "https://thebhutanese.bt/feed/", name: "The Bhutanese" },
      { url: "https://drukjournal.bt/feed/", name: "Druk Journal" },
      { url: "https://www.bhutanobserver.bt/feed/", name: "Bhutan Observer" },
      { url: "https://www.thehindu.com/feeder/default.rss", name: "The Hindu" },
    ],
    relaciones_internacionales: [
      { url: "https://kuenselonline.com/feed/", name: "Kuensel Online" },
      { url: "https://www.bhutantimes.bt/feed/", name: "Bhutan Times" },
      { url: "https://thebhutanese.bt/feed/", name: "The Bhutanese" },
      { url: "https://southasianmonitor.com/feed/", name: "South Asian Monitor" },
      { url: "https://www.thehindu.com/feeder/default.rss", name: "The Hindu" },
      { url: "https://timesofindia.indiatimes.com/rssfeeds/1221656.cms", name: "Times of India" },
    ],
  },
  "Saint John's": {
    politico: [
      { url: "https://antiguaobserver.com/feed/", name: "Antigua Observer" },
      { url: "https://antiguanewsroom.com/feed/", name: "Antigua Newsroom" },
      { url: "https://268today.com/feed/", name: "268Today" },
      { url: "https://caribarena.com/antigua/feed/", name: "Caribarena Antigua" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    economico: [
      { url: "https://antiguaobserver.com/feed/", name: "Antigua Observer" },
      { url: "https://268today.com/feed/", name: "268Today" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://caribbeanmediagroup.com/feed/", name: "CMC Caribbean" },
      { url: "https://antiguanewsroom.com/feed/", name: "Antigua Newsroom" },
    ],
    cultural: [
      { url: "https://antiguaobserver.com/feed/", name: "Antigua Observer" },
      { url: "https://268today.com/feed/", name: "268Today" },
      { url: "https://caribarena.com/antigua/feed/", name: "Caribarena Antigua" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    relaciones_internacionales: [
      { url: "https://antiguaobserver.com/feed/", name: "Antigua Observer" },
      { url: "https://antiguanewsroom.com/feed/", name: "Antigua Newsroom" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://caribbeanmediagroup.com/feed/", name: "CMC Caribbean" },
      { url: "https://loop.antiguaobserver.com/feed/", name: "Loop Antigua" },
    ],
  },
  "Nasáu": {
    politico: [
      { url: "https://thenassauguardian.com/feed/", name: "Nassau Guardian" },
      { url: "https://www.tribune242.com/rss/headlines.rss", name: "Tribune242" },
      { url: "https://ewnews.com/feed/", name: "Eyewitness News Bahamas" },
      { url: "https://bahamaspress.com/feed/", name: "Bahamas Press" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    economico: [
      { url: "https://thenassauguardian.com/feed/", name: "Nassau Guardian" },
      { url: "https://www.tribune242.com/rss/headlines.rss", name: "Tribune242" },
      { url: "https://ewnews.com/feed/", name: "Eyewitness News Bahamas" },
      { url: "https://loopnewsbahamas.com/feed/", name: "Loop Bahamas" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    cultural: [
      { url: "https://thenassauguardian.com/feed/", name: "Nassau Guardian" },
      { url: "https://www.tribune242.com/rss/headlines.rss", name: "Tribune242" },
      { url: "https://loopnewsbahamas.com/feed/", name: "Loop Bahamas" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    relaciones_internacionales: [
      { url: "https://thenassauguardian.com/feed/", name: "Nassau Guardian" },
      { url: "https://www.tribune242.com/rss/headlines.rss", name: "Tribune242" },
      { url: "https://bahamaspress.com/feed/", name: "Bahamas Press" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://ewnews.com/feed/", name: "Eyewitness News Bahamas" },
    ],
  },
  "Bridgetown": {
    politico: [
      { url: "https://www.nationnews.com/feed/", name: "Nation News" },
      { url: "https://barbadostoday.bb/feed/", name: "Barbados Today" },
      { url: "https://www.barbadosadvocate.com/feed/", name: "Barbados Advocate" },
      { url: "https://www.loopnewsbarbados.com/feed/", name: "Loop Barbados" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    economico: [
      { url: "https://www.nationnews.com/feed/", name: "Nation News" },
      { url: "https://barbadostoday.bb/feed/", name: "Barbados Today" },
      { url: "https://www.barbadosadvocate.com/feed/", name: "Barbados Advocate" },
      { url: "https://www.barbadosbusinessauthority.com/feed/", name: "Barbados Business Authority" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    cultural: [
      { url: "https://www.nationnews.com/feed/", name: "Nation News" },
      { url: "https://barbadostoday.bb/feed/", name: "Barbados Today" },
      { url: "https://www.loopnewsbarbados.com/feed/", name: "Loop Barbados" },
      { url: "https://www.barbadosadvocate.com/feed/", name: "Barbados Advocate" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    relaciones_internacionales: [
      { url: "https://www.nationnews.com/feed/", name: "Nation News" },
      { url: "https://barbadostoday.bb/feed/", name: "Barbados Today" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://www.barbadosadvocate.com/feed/", name: "Barbados Advocate" },
      { url: "https://www.starcomnetwork.com/feed/", name: "Starcom Barbados" },
    ],
  },
  "Belmopán": {
    politico: [
      { url: "https://edition.channel5belize.com/feed/", name: "Channel 5 Belize" },
      { url: "https://amandala.com.bz/news/feed/", name: "Amandala" },
      { url: "https://www.breakingbelizenews.com/feed/", name: "Breaking Belize News" },
      { url: "https://www.7newsbelize.com/feed/", name: "7News Belize" },
      { url: "https://www.reporter.bz/feed/", name: "Reporter Belize" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    economico: [
      { url: "https://edition.channel5belize.com/feed/", name: "Channel 5 Belize" },
      { url: "https://amandala.com.bz/news/feed/", name: "Amandala" },
      { url: "https://www.7newsbelize.com/feed/", name: "7News Belize" },
      { url: "https://www.belizetimes.bz/feed/", name: "Belize Times" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    cultural: [
      { url: "https://edition.channel5belize.com/feed/", name: "Channel 5 Belize" },
      { url: "https://amandala.com.bz/news/feed/", name: "Amandala" },
      { url: "https://lovefm.com/feed/", name: "Love FM Belize" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    relaciones_internacionales: [
      { url: "https://edition.channel5belize.com/feed/", name: "Channel 5 Belize" },
      { url: "https://amandala.com.bz/news/feed/", name: "Amandala" },
      { url: "https://www.reporter.bz/feed/", name: "Reporter Belize" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://www.7newsbelize.com/feed/", name: "7News Belize" },
    ],
  },
  "Saint George's": {
    politico: [
      { url: "https://www.nowgrenada.com/feed/", name: "Now Grenada" },
      { url: "https://grenadabroadcast.com/feed/", name: "Grenada Broadcasting" },
      { url: "https://www.loopnewsgrenada.com/feed/", name: "Loop Grenada" },
      { url: "https://www.thegrenadainformer.com/feed/", name: "Grenada Informer" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    economico: [
      { url: "https://www.nowgrenada.com/feed/", name: "Now Grenada" },
      { url: "https://www.loopnewsgrenada.com/feed/", name: "Loop Grenada" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://www.gov.gd/feed/", name: "GIS Grenada" },
      { url: "https://www.thegrenadainformer.com/feed/", name: "Grenada Informer" },
    ],
    cultural: [
      { url: "https://www.nowgrenada.com/feed/", name: "Now Grenada" },
      { url: "https://www.loopnewsgrenada.com/feed/", name: "Loop Grenada" },
      { url: "https://www.thegrenadainformer.com/feed/", name: "Grenada Informer" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    relaciones_internacionales: [
      { url: "https://www.nowgrenada.com/feed/", name: "Now Grenada" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://www.loopnewsgrenada.com/feed/", name: "Loop Grenada" },
      { url: "https://www.gov.gd/feed/", name: "GIS Grenada" },
    ],
  },
  "Puerto Príncipe": {
    politico: [
      { url: "https://www.alterpresse.org/rss.php", name: "AlterPresse" },
      { url: "https://www.haitilibre.com/rss/haiti-actualite.xml", name: "Haiti Libre" },
      { url: "https://lenouvelliste.com/feed/", name: "Le Nouvelliste" },
      { url: "https://www.metropolehaiti.com/feed/", name: "Radio Métropole Haiti" },
      { url: "https://haiti24.net/feed/", name: "Haiti 24" },
      { url: "https://gazettehaiti.com/feed/", name: "Gazette Haiti" },
    ],
    economico: [
      { url: "https://www.alterpresse.org/rss.php", name: "AlterPresse" },
      { url: "https://www.haitilibre.com/rss/haiti-economie.xml", name: "Haiti Libre Economía" },
      { url: "https://lenouvelliste.com/feed/", name: "Le Nouvelliste" },
      { url: "https://haiti24.net/feed/", name: "Haiti 24" },
      { url: "https://gazettehaiti.com/feed/", name: "Gazette Haiti" },
    ],
    cultural: [
      { url: "https://www.haitilibre.com/rss/haiti-culture.xml", name: "Haiti Libre Cultura" },
      { url: "https://www.alterpresse.org/rss.php", name: "AlterPresse" },
      { url: "https://lenouvelliste.com/feed/", name: "Le Nouvelliste" },
      { url: "https://www.metropolehaiti.com/feed/", name: "Radio Métropole Haiti" },
      { url: "https://haitiinformationproject.com/feed/", name: "Haiti Information Project" },
    ],
    relaciones_internacionales: [
      { url: "https://www.haitilibre.com/rss/haiti-international.xml", name: "Haiti Libre Internacional" },
      { url: "https://www.alterpresse.org/rss.php", name: "AlterPresse" },
      { url: "https://lenouvelliste.com/feed/", name: "Le Nouvelliste" },
      { url: "https://haitiinformationproject.com/feed/", name: "Haiti Information Project" },
      { url: "https://haiti24.net/feed/", name: "Haiti 24" },
    ],
  },
  "Basseterre": {
    politico: [
      { url: "https://www.thestkittsnevisobserver.com/feed/", name: "SKN Observer" },
      { url: "https://sknpulse.com/feed/", name: "SKN Pulse" },
      { url: "https://sknvibes.com/feed/", name: "SKN Vibes" },
      { url: "https://zizonline.com/feed/", name: "ZIZ St Kitts" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    economico: [
      { url: "https://www.thestkittsnevisobserver.com/feed/", name: "SKN Observer" },
      { url: "https://sknpulse.com/feed/", name: "SKN Pulse" },
      { url: "https://www.loopnewsskn.com/feed/", name: "Loop SKN" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://sknvibes.com/feed/", name: "SKN Vibes" },
    ],
    cultural: [
      { url: "https://www.thestkittsnevisobserver.com/feed/", name: "SKN Observer" },
      { url: "https://sknvibes.com/feed/", name: "SKN Vibes" },
      { url: "https://www.loopnewsskn.com/feed/", name: "Loop SKN" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    relaciones_internacionales: [
      { url: "https://www.thestkittsnevisobserver.com/feed/", name: "SKN Observer" },
      { url: "https://sknpulse.com/feed/", name: "SKN Pulse" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://zizonline.com/feed/", name: "ZIZ St Kitts" },
      { url: "https://www.loopnewsskn.com/feed/", name: "Loop SKN" },
    ],
  },
  "Castries": {
    politico: [
      { url: "https://stluciatimes.com/feed/", name: "St. Lucia Times" },
      { url: "https://www.thevoiceslu.com/feed/", name: "The Voice St. Lucia" },
      { url: "https://www.loopnewsstlucia.com/feed/", name: "Loop St. Lucia" },
      { url: "https://thelusianstar.com/feed/", name: "Lucian Star" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    economico: [
      { url: "https://stluciatimes.com/feed/", name: "St. Lucia Times" },
      { url: "https://www.thevoiceslu.com/feed/", name: "The Voice St. Lucia" },
      { url: "https://www.loopnewsstlucia.com/feed/", name: "Loop St. Lucia" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://thelusianstar.com/feed/", name: "Lucian Star" },
    ],
    cultural: [
      { url: "https://stluciatimes.com/feed/", name: "St. Lucia Times" },
      { url: "https://www.loopnewsstlucia.com/feed/", name: "Loop St. Lucia" },
      { url: "https://thelusianstar.com/feed/", name: "Lucian Star" },
      { url: "https://rci.fm/feed/", name: "RCI Radio Caribbean" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    relaciones_internacionales: [
      { url: "https://stluciatimes.com/feed/", name: "St. Lucia Times" },
      { url: "https://www.thevoiceslu.com/feed/", name: "The Voice St. Lucia" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://rci.fm/feed/", name: "RCI Radio Caribbean" },
      { url: "https://www.loopnewsstlucia.com/feed/", name: "Loop St. Lucia" },
    ],
  },
  "Kingstown": {
    politico: [
      { url: "https://iwnsvg.com/feed/", name: "iWitness News SVG" },
      { url: "https://searchlight.vc/feed/", name: "Searchlight" },
      { url: "https://thevincentian.com/feed/", name: "Vincentian" },
      { url: "https://nbcsvg.com/feed/", name: "NBC SVG" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    economico: [
      { url: "https://iwnsvg.com/feed/", name: "iWitness News SVG" },
      { url: "https://searchlight.vc/feed/", name: "Searchlight" },
      { url: "https://thevincentian.com/feed/", name: "Vincentian" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://www.loopnewssvg.com/feed/", name: "Loop SVG" },
    ],
    cultural: [
      { url: "https://iwnsvg.com/feed/", name: "iWitness News SVG" },
      { url: "https://searchlight.vc/feed/", name: "Searchlight" },
      { url: "https://thevincentian.com/feed/", name: "Vincentian" },
      { url: "https://www.loopnewssvg.com/feed/", name: "Loop SVG" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    relaciones_internacionales: [
      { url: "https://iwnsvg.com/feed/", name: "iWitness News SVG" },
      { url: "https://searchlight.vc/feed/", name: "Searchlight" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
      { url: "https://nbcsvg.com/feed/", name: "NBC SVG" },
      { url: "https://thevincentian.com/feed/", name: "Vincentian" },
    ],
  },
  "Paramaribo": {
    politico: [
      { url: "https://www.waterkant.net/feed/", name: "Waterkant" },
      { url: "https://www.srherald.com/feed/", name: "Suriname Herald" },
      { url: "https://www.dwt-online.com/feed/", name: "De Ware Tijd" },
      { url: "https://www.dbsuriname.com/feed/", name: "Dagblad Suriname" },
      { url: "https://surinametimes.net/feed/", name: "Suriname Times" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    economico: [
      { url: "https://www.waterkant.net/feed/", name: "Waterkant" },
      { url: "https://www.srherald.com/feed/", name: "Suriname Herald" },
      { url: "https://www.dwt-online.com/feed/", name: "De Ware Tijd" },
      { url: "https://surinametimes.net/feed/", name: "Suriname Times" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    cultural: [
      { url: "https://www.waterkant.net/feed/", name: "Waterkant" },
      { url: "https://www.dbsuriname.com/feed/", name: "Dagblad Suriname" },
      { url: "https://surinametimes.net/feed/", name: "Suriname Times" },
      { url: "https://www.starnieuws.com/rss/starnieuws.rss", name: "Starnieuws" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
    relaciones_internacionales: [
      { url: "https://www.waterkant.net/feed/", name: "Waterkant" },
      { url: "https://www.srherald.com/feed/", name: "Suriname Herald" },
      { url: "https://www.dwt-online.com/feed/", name: "De Ware Tijd" },
      { url: "https://www.starnieuws.com/rss/starnieuws.rss", name: "Starnieuws" },
      { url: "https://www.caribbean360.com/feed", name: "Caribbean360" },
    ],
  },
};

// ── Country name aliases for keyword matching ────────────────────────────────
const LOCATION_COUNTRY_TERMS = {
  "Ciudad de México": ["méxico","mexico","mexicano","mexicana","cdmx","ciudad de méxico","gobierno federal","sheinbaum","morena","banxico","pemex","cfe","nafta","tmec","senado mexicano","congreso mexicano","banco de méxico"],
  "San Marino":       ["san marino","sanmarinese","sammarinese","serenissima","titano"],
  "Timbu":            ["bhutan","bután","bhutanese","butanés","thimphu","timbu","wangchuck","druk"],
  "Saint John's":     ["antigua","barbuda","antiguan","saint john","wadadli"],
  "Nasáu":            ["bahamas","bahamian","bahameño","nassau","nasáu","new providence"],
  "Bridgetown":       ["barbados","barbadian","barbadense","bridgetown","bajan"],
  "Belmopán":         ["belize","belice","belizean","beliceño","belmopan","belmopán","belizean"],
  "Saint George's":   ["grenada","granada","grenadian","granadino","spice isle"],
  "Puerto Príncipe":  ["haiti","haití","haitian","haitiano","port-au-prince","puerto príncipe","ayiti"],
  "Basseterre":       ["saint kitts","san cristóbal","nevis","kittitian","nevisian","basseterre","st. kitts"],
  "Castries":         ["saint lucia","santa lucía","st. lucia","lucian","luciano","castries"],
  "Kingstown":        ["saint vincent","san vicente","granadinas","vincentian","kingstown","svg"],
  "Paramaribo":       ["suriname","surinam","surinamese","surinamés","paramaribo","surinaams"],
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

    // ALWAYS filter by country terms — never return unrelated foreign news.
    // If country filter yields < 3, keep those few and supplement with Google News below.
    if (countryTerms.length > 0) {
      items = allItems.filter(item => {
        const text = `${item.title} ${item.preview}`.toLowerCase();
        return countryTerms.some(k => text.includes(k));
      });
    } else {
      // No country terms defined → filter at least by category keywords
      items = allItems.filter(item => {
        const text = `${item.title} ${item.preview}`.toLowerCase();
        return categoryKeywords.length === 0 || categoryKeywords.some(k => text.includes(k));
      });
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

// ── Claude (Anthropic) ───────────────────────────────────────────────────────
function getAI() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY no configurado");
  return new Anthropic({ apiKey: key });
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

// ── Generate one category report using Claude + real RSS news ────────────────
async function generateCategoryReport(location, category) {
  const { label, focus } = CATEGORIES[category];

  // 1. Fetch real RSS news to ground the analysis
  const cats = category === 'panorama_general'
    ? ['politico', 'economico', 'cultural', 'relaciones_internacionales']
    : [category];
  const allNewsRaw = (await Promise.all(cats.map(c => fetchCategoryNews(location, c)))).flat();

  // Filter to only TODAY's news
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayNews = allNewsRaw.filter(n => {
    if (!n.date) return true; // keep if no date info
    const d = new Date(n.date);
    return !isNaN(d) && d >= todayStart;
  });
  // Fall back to most recent 8 articles if today has fewer than 3
  const allNews = todayNews.length >= 3 ? todayNews : allNewsRaw.slice(0, 8);

  const newsContext = allNews.length > 0
    ? allNews.map(n =>
        `• [${n.source}] ${n.title}${n.preview && n.preview !== n.title ? ': ' + n.preview.slice(0, 150) : ''}`
      ).join('\n')
    : 'No se encontraron noticias del día en los RSS monitoreados.';

  const today = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();

  const yr = new Date().getFullYear();
  const systemPrompt = `Eres un analista de inteligencia estratégica del MRE del Perú. Redactas análisis periodísticos basados EXCLUSIVAMENTE en las noticias proporcionadas. No inventas hechos ni fuentes. REGLA ESTRICTA DE CITACIÓN: cada oración que mencione un hecho concreto DEBE terminar con la cita APA en texto así: (Nombre del Medio, ${yr}). Nunca omitas la cita al final de la oración.`;

  const sections = category === 'panorama_general'
    ? ['SITUACIÓN DEL DÍA', 'ACTORES CLAVE', 'CONTEXTO', 'POSICIÓN DEL PERÚ']
    : ['SITUACIÓN DEL DÍA', 'ACTORES CLAVE', 'CONTEXTO'];

  const userPrompt = `Analiza las siguientes noticias de HOY sobre ${focus} en ${location} y redacta un informe estructurado.

NOTICIAS DEL DÍA:
${newsContext}

ESTRUCTURA OBLIGATORIA — cada subtítulo en mayúsculas seguido de dos puntos y el texto en la misma línea:

SITUACIÓN DEL DÍA: 3 a 4 oraciones desarrollando los hechos más relevantes del día con sus implicaciones. Cada oración termina con (Fuente, ${yr}).

ACTORES CLAVE: 2 a 3 oraciones, una por actor principal. Describe qué hizo o declaró y por qué importa. Cada oración termina con (Fuente, ${yr}).

CONTEXTO: 2 a 3 oraciones explicando los antecedentes necesarios para entender los eventos del día y su tendencia. Solo citar si el dato viene de las noticias.
${category === 'panorama_general' ? `\nPOSICIÓN DEL PERÚ: 1 a 2 oraciones sobre la postura oficial del gobierno peruano o la Cancillería respecto a ${location}. Si no hay información: "Sin declaración oficial del Perú registrada en el período."` : ''}

REGLAS: prosa fluida, sin viñetas, sin asteriscos, sin numeración. Máximo 250 palabras en total. La cita (Fuente, ${yr}) va pegada al punto final de cada oración que exponga un hecho.`;

  // 2. Call Claude
  const ai = getAI();
  const stream = ai.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const response = await stream.finalMessage();
  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  // 3. Use the fetched RSS news as sources
  const sources = allNews.map(n => ({
    title:   n.title,
    source:  n.source,
    url:     n.url,
    date:    n.date,
    preview: n.preview,
  }));

  const newsItems = allNews.map(n => ({ ...n, category }));

  const { rows } = await pool.query(
    `INSERT INTO reports (location, category, content, raw_news, news_items)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, location, category, content, news_items, created_at`,
    [location, category, JSON.stringify({ text, sources }), `RSS + Claude claude-haiku-4-5`, JSON.stringify(newsItems)]
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

// Limpiar reportes viejos de una location (para forzar regeneración)
app.delete("/api/reports", async (req, res) => {
  const { location } = req.query;
  if (!location) return res.status(400).json({ error: "location requerido" });
  try {
    await pool.query("DELETE FROM reports WHERE location = $1", [location]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

  try {
    const ai = getAI();
    const stream = ai.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system:
        "Eres un experto en monitoreo de medios internacionales para el MRE de Perú. " +
        "Responde ÚNICAMENTE con un array JSON válido, sin texto adicional, sin markdown, sin bloques de código.",
      messages: [
        {
          role: "user",
          content:
            `Genera una lista de los 10 principales medios de comunicación de ${location} ` +
            `relevantes para política, economía, relaciones internacionales y cultura. ` +
            `Para cada medio incluye: name (nombre del medio), type (uno de: "Diario", "Radio", "TV", "Digital"), ` +
            `url (URL oficial activa). ` +
            `Responde SOLO con el array JSON, ejemplo: [{"name":"El Comercio","type":"Diario","url":"https://elcomercio.pe"}]`,
        },
      ],
    });
    const response = await stream.finalMessage();

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No text block in Claude response");

    // Extract JSON array from the response text (strip any accidental markdown)
    const raw = textBlock.text.replace(/```(?:json)?/gi, "").trim();
    const parsed = JSON.parse(raw);

    const validTypes = ["Diario", "Radio", "TV", "Digital"];
    const sources = parsed.map((s, i) => ({
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

// ── Exportar Informe Diario como Word (.docx) ───────────────────────────────
app.post("/api/export-word", async (req, res) => {
  const { location } = req.body;
  if (!location) return res.status(400).json({ error: "location requerido" });

  try {
    // Fetch latest report per category for this location (4 categories only)
    const cats = ["politico", "economico", "cultural", "relaciones_internacionales"];
    const catLabels = {
      politico: "I. Situación Política",
      economico: "II. Situación Económica",
      cultural: "III. Situación Cultural",
      relaciones_internacionales: "IV. Relaciones Internacionales",
    };

    const reportRows = await Promise.all(cats.map(async (cat) => {
      const { rows } = await pool.query(
        `SELECT content, news_items, created_at FROM reports
         WHERE location = $1 AND category = $2
         ORDER BY created_at DESC LIMIT 1`,
        [location, cat]
      );
      return { cat, row: rows[0] || null };
    }));

    // Collect all news items across categories for references
    const allNewsMap = new Map(); // url → news item (deduplicated)
    reportRows.forEach(({ row }) => {
      if (!row) return;
      const items = Array.isArray(row.news_items) ? row.news_items : JSON.parse(row.news_items || "[]");
      items.forEach(n => { if (n.url) allNewsMap.set(n.url, n); });
    });
    const allNews = [...allNewsMap.values()];

    // Format date
    const today = new Date();
    const dateStr = today.toLocaleDateString("es-PE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const fileDate = today.toISOString().split("T")[0];

    // ── APA 7th edition citation builder ────────────────────────────────────
    // APA 7 para artículo de medio de comunicación sin autor individual:
    // Nombre del medio. (Año, mes día). Título del artículo. https://...
    function apaCitation(news, index) {
      const pub = (news.source || "Fuente desconocida").trim();
      let year = new Date().getFullYear().toString();
      let dateApa = "s.f.";
      if (news.date) {
        const d = new Date(news.date);
        if (!isNaN(d)) {
          year = d.getFullYear().toString();
          const mes = d.toLocaleDateString("es-PE", { month: "long" });
          const dia = d.getDate();
          dateApa = `${year}, ${mes} ${dia}`;
        }
      }
      const title = (news.title || "Sin título").trim();
      const url = news.url || "";
      return { index: index + 1, pub, dateApa, title, url };
    }

    const refs = allNews.map((n, i) => apaCitation(n, i));

    // ── Helper: split report text into titled sections ───────────────────────
    function parseSections(text) {
      if (!text) return [];
      const blocks = text.split(/\n(?=\d+\.\s[A-ZÁÉÍÓÚÑ]|REPORTE DIARIO)/);
      return blocks.map(b => b.trim()).filter(Boolean);
    }

    // ── Build docx children ──────────────────────────────────────────────────
    const children = [];

    // Cover / Title
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 120 },
        children: [new TextRun({ text: "MINISTERIO DE RELACIONES EXTERIORES DEL PERÚ", bold: true, size: 22, font: "Arial", color: "1B3A6B" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: "Embajadas Digitales — Monitor Geopolítico", size: 20, font: "Arial", color: "555555" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C0392B", space: 1 } },
        spacing: { before: 0, after: 400 },
        children: [new TextRun({ text: "" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: `INFORME DIARIO CONSOLIDADO`, bold: true, size: 36, font: "Arial", color: "1B3A6B" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: location.toUpperCase(), bold: true, size: 28, font: "Arial", color: "C0392B" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 480 },
        children: [new TextRun({ text: dateStr.toUpperCase(), size: 20, font: "Arial", color: "888888" })],
      }),
    );

    // One section per category — paragraph + source links
    for (const { cat, row } of reportRows) {
      if (!row) continue;
      const label = catLabels[cat];
      const contentObj = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
      const text = (contentObj.text || "").trim();
      const catSources = Array.isArray(contentObj.sources) ? contentObj.sources : [];
      if (!text) continue;

      // Section heading
      children.push(
        new Paragraph({
          pageBreakBefore: children.length > 6,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 28, font: "Arial", color: "1B3A6B" })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "1B3A6B", space: 4 } },
          spacing: { after: 200 },
        }),
      );

      // Parse subtitle blocks: "SUBTÍTULO: texto"
      const subtitleRe = /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{2,}[A-ZÁÉÍÓÚÑ]):\s*(.+)/;
      const blocks = text.split('\n').filter(l => l.trim()).reduce((acc, line) => {
        const m = line.trim().match(subtitleRe);
        if (m) acc.push({ title: m[1], body: m[2] });
        else if (acc.length > 0) acc[acc.length - 1].body += ' ' + line.trim();
        else acc.push({ title: null, body: line.trim() });
        return acc;
      }, []);

      for (const block of blocks) {
        if (block.title) {
          children.push(
            new Paragraph({
              spacing: { before: 160, after: 60 },
              children: [new TextRun({ text: block.title, bold: true, size: 19, font: "Arial", color: "C0392B" })],
            }),
          );
        }
        children.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 120 },
            children: [new TextRun({ text: block.body.trim(), size: 20, font: "Arial" })],
          }),
        );
      }

      // Source links for this category
      if (catSources.length > 0) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: "Fuentes:", bold: true, size: 18, font: "Arial", color: "555555" })],
          }),
        );
        for (const s of catSources) {
          if (!s.url) continue;
          const linkParts = [
            new TextRun({ text: `${s.source || "Fuente"}: `, bold: true, size: 17, font: "Arial", color: "555555" }),
          ];
          linkParts.push(
            new ExternalHyperlink({
              link: s.url,
              children: [new TextRun({ text: s.url, style: "Hyperlink", size: 17, font: "Arial",
                underline: { type: UnderlineType.SINGLE }, color: "1B3A6B" })],
            }),
          );
          children.push(
            new Paragraph({
              spacing: { after: 60 },
              indent: { left: 360 },
              children: linkParts,
            }),
          );
        }
      }
    }

    // ── Referencias APA 7ma edición ──────────────────────────────────────────
    if (refs.length > 0) {
      children.push(
        new Paragraph({
          pageBreakBefore: true,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "REFERENCIAS", bold: true, size: 28, font: "Arial", color: "1B3A6B" })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "1B3A6B", space: 4 } },
          spacing: { after: 240 },
        }),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: "Fuentes de información utilizadas para la elaboración del presente informe (APA 7.ª edición):", size: 18, font: "Arial", color: "555555", italics: true })],
        }),
      );

      // Sort refs alphabetically by source name
      const sortedRefs = [...refs].sort((a, b) => a.pub.localeCompare(b.pub, "es"));

      for (const ref of sortedRefs) {
        // Format: Nombre del medio. (Año, mes día). Título. https://...
        const refChildren = [
          new TextRun({ text: `${ref.pub}. `, bold: true, size: 18, font: "Arial" }),
          new TextRun({ text: `(${ref.dateApa}). `, size: 18, font: "Arial" }),
          new TextRun({ text: `${ref.title}. `, size: 18, font: "Arial", italics: true }),
        ];
        if (ref.url) {
          refChildren.push(
            new ExternalHyperlink({
              link: ref.url,
              children: [new TextRun({ text: ref.url, style: "Hyperlink", size: 18, font: "Arial",
                underline: { type: UnderlineType.SINGLE }, color: "1B3A6B" })],
            }),
          );
        }
        children.push(
          new Paragraph({
            spacing: { after: 120 },
            indent: { left: 720, hanging: 720 }, // hanging indent APA style
            children: refChildren,
          }),
        );
      }
    }

    // ── Nota metodológica ────────────────────────────────────────────────────
    children.push(
      new Paragraph({
        spacing: { before: 480, after: 80 },
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 4 } },
        children: [new TextRun({ text: "NOTA METODOLÓGICA", bold: true, size: 17, font: "Arial", color: "888888" })],
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: `Este informe ha sido elaborado por el sistema de monitoreo geopolítico de la Dirección de Políticas y Estrategias del Ministerio de Relaciones Exteriores del Perú, con base en información pública disponible recopilada de fuentes abiertas y procesada con apoyo de inteligencia artificial (Claude, Anthropic). Los análisis son referenciales y no constituyen posición oficial del MRE.`, size: 17, font: "Arial", color: "888888", italics: true })],
      }),
      new Paragraph({
        spacing: { after: 0 },
        children: [new TextRun({ text: `Documento generado automáticamente el ${dateStr}.`, size: 17, font: "Arial", color: "AAAAAA" })],
      }),
    );

    // ── Build document ───────────────────────────────────────────────────────
    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: "Arial", size: 20 } },
        },
        paragraphStyles: [
          { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 28, bold: true, font: "Arial", color: "1B3A6B" },
            paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
          { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 22, bold: true, font: "Arial", color: "C0392B" },
            paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
        ],
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC", space: 1 } },
                children: [
                  new TextRun({ text: `MRE PERÚ — Monitor Geopolítico — ${location}`, size: 16, font: "Arial", color: "888888" }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC", space: 1 } },
                children: [
                  new TextRun({ text: "Página ", size: 16, font: "Arial", color: "888888" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: "888888" }),
                  new TextRun({ text: " de ", size: 16, font: "Arial", color: "888888" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: "Arial", color: "888888" }),
                  new TextRun({ text: `   •   Documento generado automáticamente — ${dateStr}`, size: 16, font: "Arial", color: "AAAAAA" }),
                ],
              }),
            ],
          }),
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="Informe_MRE_${location.replace(/\s+/g, "_")}_${fileDate}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error("Error generando Word:", err.message);
    res.status(500).json({ error: "Error al generar el documento Word: " + err.message });
  }
});

// ── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Embajadas Digitales MRE corriendo en puerto ${PORT}`);
});
