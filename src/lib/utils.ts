import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getMostFrequentWords(text: string, limit: number = 5): { word: string; count: number }[] {
  if (!text) return [];
  
  const stopWords = new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "pero", "si", "porque", "como", "de", "del", "a", "al", "en", "con", "por", "para", "sobre", "entre", "hasta", "desde", "durante", "mediante", "hacia", "contra", "sin", "tras", "ante", "bajo", "cabe", "con", "de", "desde", "en", "entre", "hacia", "hasta", "para", "por", "segun", "sin", "so", "sobre", "tras", "durante", "mediante", "vía", "que", "qué", "quien", "quién", "cual", "cuál", "cuanto", "cuánto", "donde", "dónde", "cuando", "cuándo", "como", "cómo", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "aquel", "aquella", "aquellos", "aquellas", "mi", "tu", "su", "nuestro", "vuestro", "sus", "mío", "tuyo", "suyo", "nuestro", "vuestro", "me", "te", "se", "nos", "os", "lo", "le", "la", "los", "les", "nosotros", "vosotros", "ellos", "ellas", "usted", "ustedes", "yo", "tú", "él", "ella", "nosotras", "vosotras", "ellos", "ellas", "es", "son", "era", "eran", "fue", "fueron", "será", "serán", "ha", "han", "había", "habían", "he", "hemos", "está", "están", "estaba", "estaban", "estuvo", "estuvieron", "estará", "estarán", "tiene", "tienen", "tenía", "tenían", "tuvo", "tuvieron", "tendrá", "tendrán", "hace", "hacen", "hacía", "hacían", "hizo", "hicieron", "hará", "harán", "puede", "pueden", "podía", "podían", "pudo", "pudieron", "podrá", "podrán", "dice", "dicen", "decía", "decían", "dijo", "dijeron", "dirá", "dirán", "perú", "peruano", "peruana", "país", "gobierno", "presidente", "ministro", "relaciones", "exteriores", "embajada", "digital", "internacional", "geopolítico", "análisis", "estratégico", "situación", "informe", "noticias", "medios", "comunicación", "prensa", "diario", "radio", "tv", "digital", "fuente", "fuentes", "utilizadas", "análisis", "generado", "elaborado", "dirección", "estudios", "estrategias", "dee", "mre", "monitoreo", "global", "última", "semana", "hoy", "ayer", "mañana", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ]);

  const words = text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  const wordCounts: Record<string, number> = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });

  return Object.entries(wordCounts)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
