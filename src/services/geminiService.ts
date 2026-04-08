import { MediaSource } from "../types";

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
  "Timbu": [
    { title: "Turismo sostenible de montaña", source: "Kuensel", preview: "Bután y Perú exploran modelos de turismo que respeten el medio ambiente y las comunidades...", date: "2026-03-22T09:00:00Z", url: "https://kuenselonline.com" },
    { title: "Agricultura de altura y seguridad alimentaria", source: "Bhutan Times", preview: "Científicos de ambos países comparten avances en cultivos resistentes al clima...", date: "2026-03-21T10:15:00Z", url: "https://bhutantimes.bt" },
    { title: "Diálogo Andes-Himalaya", source: "BBS", preview: "Foro internacional sobre la conservación de glaciares y ecosistemas de montaña...", date: "2026-03-23T12:00:00Z", url: "https://www.bbs.bt" }
  ],
  "Saint John's": [
    { title: "Antigua y Barbuda refuerza agenda climática en CARICOM", source: "Antigua Observer", preview: "El PM Browne lidera iniciativas de resiliencia climática y transición energética renovable...", date: "2026-03-22T10:00:00Z", url: "https://antiguaobserver.com" },
    { title: "Sector turístico anticipa récord en temporada alta", source: "ABS Television", preview: "La industria hotelera reporta ocupación superior al 90% ante arribo masivo de cruceros...", date: "2026-03-21T14:30:00Z", url: "https://www.absonline.ag" }
  ],
  "Nasáu": [
    { title: "Bahamas intensifica cooperación con EE.UU. en seguridad marítima", source: "Nassau Guardian", preview: "Patrullajes conjuntos buscan frenar el tráfico de narcóticos en aguas del Atlántico norte...", date: "2026-03-22T10:00:00Z", url: "https://thenassauguardian.com" },
    { title: "Sector financiero offshore mantiene estabilidad pese a presiones regulatorias", source: "Tribune242", preview: "La banca privada adapta sus estructuras al nuevo marco OCDE de transparencia fiscal...", date: "2026-03-21T14:30:00Z", url: "https://www.tribune242.com" }
  ],
  "Bridgetown": [
    { title: "PM Mottley presenta agenda climática en Naciones Unidas", source: "Nation News", preview: "Barbados promueve la Iniciativa Bridgetown como marco financiero para países vulnerables...", date: "2026-03-22T10:00:00Z", url: "https://www.nationnews.com" },
    { title: "Renovables superan el 50% de la matriz energética de Barbados", source: "Barbados Today", preview: "La transición hacia solar y eólico avanza aceleradamente en la isla...", date: "2026-03-21T14:30:00Z", url: "https://barbadostoday.bb" }
  ],
  "Belmopán": [
    { title: "CIJ retoma debate sobre disputa territorial con Guatemala", source: "Channel 5 Belize", preview: "La Corte Internacional de Justicia programa audiencias sobre el territorio Beliceño...", date: "2026-03-22T10:00:00Z", url: "https://edition.channel5belize.com" },
    { title: "Belice apuesta por turismo sostenible en arrecife mesoamericano", source: "Amandala", preview: "Nuevas regulaciones protegen el segundo arrecife de barrera más grande del mundo...", date: "2026-03-21T14:30:00Z", url: "https://amandala.com.bz" }
  ],
  "Roseau": [
    { title: "Dominica avanza en plan de geotermia para exportar energía", source: "Dominica News Online", preview: "El proyecto geotérmico podría convertir a Dominica en exportadora de energía limpia...", date: "2026-03-22T10:00:00Z", url: "https://dominicanewsonline.com" },
    { title: "Controversias del programa de Ciudadanía por Inversión generan debate", source: "The Sun Dominica", preview: "Críticas internacionales sobre transparencia del CBI impulsan reforma regulatoria...", date: "2026-03-21T14:30:00Z", url: "https://www.thesundominica.com" }
  ],
  "Saint George's": [
    { title: "Granada celebra 40 años post-intervención con agenda de soberanía", source: "Now Grenada", preview: "El PM Mitchell impulsa independencia energética y diplomacia activa en CARICOM...", date: "2026-03-22T10:00:00Z", url: "https://www.nowgrenada.com" },
    { title: "Exportaciones de nuez moscada recuperan volúmenes históricos", source: "GBN TV Grenada", preview: "La producción especiera retoma crecimiento con acceso a mercados europeos y asiáticos...", date: "2026-03-21T14:30:00Z", url: "https://www.gbn.gd" }
  ],
  "Puerto Príncipe": [
    { title: "MSS Kenya amplía operaciones ante escalada de violencia de pandillas", source: "Alterpresse", preview: "La Misión de Apoyo a la Seguridad enfrenta dificultades operativas en zonas controladas por G9...", date: "2026-03-22T10:00:00Z", url: "https://www.alterpresse.org" },
    { title: "OEA y CARICOM convocan a diálogo de emergencia por crisis humanitaria", source: "Le Nouvelliste", preview: "Se estiman más de 5 millones de haitianos en situación de inseguridad alimentaria crítica...", date: "2026-03-21T14:30:00Z", url: "https://lenouvelliste.com" }
  ],
  "Basseterre": [
    { title: "San Cristóbal y Nieves debate nuevo referéndum de independencia en Nieves", source: "The St. Kitts-Nevis Observer", preview: "Movimientos separatistas en la isla de Nieves impulsan nueva consulta popular...", date: "2026-03-22T10:00:00Z", url: "https://www.thestkittsnevisobserver.com" },
    { title: "CBI atrae inversión récord en turismo de lujo", source: "ZIZ Broadcasting", preview: "El programa de ciudadanía por inversión financia complejos hoteleros de alta gama...", date: "2026-03-21T14:30:00Z", url: "https://zizonline.com" }
  ],
  "Castries": [
    { title: "Santa Lucía lidera agenda de SIDS ante cambio climático", source: "St. Lucia Times", preview: "El gobierno Pierre preside negociaciones de financiamiento climático para pequeñas islas...", date: "2026-03-22T10:00:00Z", url: "https://stluciatimes.com" },
    { title: "Turismo bate récord con 1.2 millones de visitantes", source: "The Voice St. Lucia", preview: "El sector representa el 65% del PIB y el 70% del empleo formal en la isla...", date: "2026-03-21T14:30:00Z", url: "https://www.thevoiceslu.com" }
  ],
  "Kingstown": [
    { title: "PM Gonsalves refuerza lazos con Venezuela y ALBA pese a críticas regionales", source: "iWitness News SVG", preview: "San Vicente mantiene posición independiente en foros hemisféricos ante presión de EE.UU....", date: "2026-03-22T10:00:00Z", url: "https://iwnsvg.com" },
    { title: "Festival Vincy Mas 2026 proyecta récord de visitantes del Caribe", source: "Searchlight", preview: "El carnaval más grande de las Granadinas impulsa economía turística y cultural...", date: "2026-03-21T14:30:00Z", url: "https://searchlight.vc" }
  ],
  "Paramaribo": [
    { title: "TotalEnergies inicia producción offshore de petróleo en bloque surinamés", source: "Times of Suriname", preview: "Las reservas offshore de Surinam posicionan al país como nuevo actor petrolero del Caribe...", date: "2026-03-22T10:00:00Z", url: "https://www.timesofsur.com" },
    { title: "Surinam refuerza nexos con Países Bajos ante crisis fiscal", source: "De Ware Tijd", preview: "La herencia colonial holandesa sigue siendo eje del vínculo bilateral con La Haya...", date: "2026-03-21T14:30:00Z", url: "https://www.dwtonline.com" }
  ],
};

export const mockCountryData: Record<string, { capital: string, population: string, currency: string, language: string, gdp: string }> = {
  "Ciudad de México": {
    capital: "Ciudad de México",
    population: "128.9 millones",
    currency: "Peso Mexicano (MXN)",
    language: "Español",
    gdp: "1.32 billones USD"
  },
  "San Marino": {
    capital: "Ciudad de San Marino",
    population: "33,660",
    currency: "Euro (EUR)",
    language: "Italiano",
    gdp: "2.07 mil millones USD"
  },
  "Timbu": {
    capital: "Timbu",
    population: "777,486",
    currency: "Ngultrum (BTN)",
    language: "Dzongkha",
    gdp: "2.53 mil millones USD"
  },
"Saint John's": { capital: "Saint John's", population: "97,928", currency: "Dólar del Caribe Oriental (XCD)", language: "Inglés", gdp: "1.73 mil millones USD" },
  "Nasáu": { capital: "Nasáu", population: "393,244", currency: "Dólar bahameño (BSD)", language: "Inglés", gdp: "13.6 mil millones USD" },
  "Bridgetown": { capital: "Bridgetown", population: "287,025", currency: "Dólar de Barbados (BBD)", language: "Inglés", gdp: "5.64 mil millones USD" },
  "Belmopán": { capital: "Belmopán", population: "441,471", currency: "Dólar de Belice (BZD)", language: "Inglés / Español", gdp: "2.79 mil millones USD" },
  "Roseau": { capital: "Roseau", population: "72,412", currency: "Dólar del Caribe Oriental (XCD)", language: "Inglés / Créole", gdp: "612 millones USD" },
  "Saint George's": { capital: "Saint George's", population: "124,610", currency: "Dólar del Caribe Oriental (XCD)", language: "Inglés", gdp: "1.31 mil millones USD" },
  "Puerto Príncipe": { capital: "Puerto Príncipe", population: "11.7 millones", currency: "Gourde haitiano (HTG)", language: "Créole / Francés", gdp: "19.9 mil millones USD" },
  "Basseterre": { capital: "Basseterre", population: "47,755", currency: "Dólar del Caribe Oriental (XCD)", language: "Inglés", gdp: "1.07 mil millones USD" },
  "Castries": { capital: "Castries", population: "183,629", currency: "Dólar del Caribe Oriental (XCD)", language: "Inglés / Créole", gdp: "2.11 mil millones USD" },
  "Kingstown": { capital: "Kingstown", population: "110,589", currency: "Dólar del Caribe Oriental (XCD)", language: "Inglés", gdp: "897 millones USD" },
  "Paramaribo": { capital: "Paramaribo", population: "618,040", currency: "Dólar surinamés (SRD)", language: "Holandés", gdp: "3.62 mil millones USD" },
};

export const mockMediaSources: MediaSource[] = [
  // México
  { id: "mx1", name: "El Universal", country: "México", location: "Ciudad de México", type: "Diario", url: "https://www.eluniversal.com.mx", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "mx2", name: "Reforma", country: "México", location: "Ciudad de México", type: "Diario", url: "https://www.reforma.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "mx3", name: "Excélsior", country: "México", location: "Ciudad de México", type: "Diario", url: "https://www.excelsior.com.mx", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "mx4", name: "La Jornada", country: "México", location: "Ciudad de México", type: "Diario", url: "https://www.jornada.com.mx", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "mx5", name: "Milenio", country: "México", location: "Ciudad de México", type: "Diario", url: "https://www.milenio.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "mx6", name: "El Financiero", country: "México", location: "Ciudad de México", type: "Diario", url: "https://www.elfinanciero.com.mx", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "mx7", name: "Televisa Noticias", country: "México", location: "Ciudad de México", type: "TV", url: "https://noticieros.televisa.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "mx8", name: "Animal Político", country: "México", location: "Ciudad de México", type: "Digital", url: "https://www.animalpolitico.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "mx9", name: "Proceso", country: "México", location: "Ciudad de México", type: "Digital", url: "https://www.proceso.com.mx", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "mx10", name: "Expansión", country: "México", location: "Ciudad de México", type: "Digital", url: "https://expansion.mx", status: "Activo", lastCheck: new Date().toISOString() },

  // San Marino
  { id: "sm1", name: "San Marino RTV", country: "San Marino", location: "San Marino", type: "TV", url: "https://www.sanmarinortv.sm", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "sm2", name: "Libertas", country: "San Marino", location: "San Marino", type: "Diario", url: "http://www.libertas.sm", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "sm3", name: "L'Informazione di San Marino", country: "San Marino", location: "San Marino", type: "Diario", url: "https://www.linformazione.sm", status: "Activo", lastCheck: new Date().toISOString() },

  // Bután
  { id: "bt1", name: "Kuensel", country: "Bután", location: "Timbu", type: "Diario", url: "https://kuenselonline.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "bt2", name: "Bhutan Times", country: "Bután", location: "Timbu", type: "Diario", url: "https://bhutantimes.bt", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "bt3", name: "BBS (Bhutan Broadcasting)", country: "Bután", location: "Timbu", type: "TV", url: "https://www.bbs.bt", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "bt4", name: "The Bhutanese", country: "Bután", location: "Timbu", type: "Diario", url: "https://thebhutanese.bt", status: "Activo", lastCheck: new Date().toISOString() },

  // Antigua y Barbuda
  { id: "ag1", name: "Antigua Observer", country: "Antigua y Barbuda", location: "Saint John's", type: "Digital", url: "https://antiguaobserver.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "ag2", name: "ABS Television", country: "Antigua y Barbuda", location: "Saint John's", type: "TV", url: "https://www.absonline.ag", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "ag3", name: "Antigua News Room", country: "Antigua y Barbuda", location: "Saint John's", type: "Digital", url: "https://antiguanewsroom.com", status: "Activo", lastCheck: new Date().toISOString() },

  // Bahamas
  { id: "bs1", name: "Nassau Guardian", country: "Bahamas", location: "Nasáu", type: "Diario", url: "https://thenassauguardian.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "bs2", name: "Tribune242", country: "Bahamas", location: "Nasáu", type: "Diario", url: "https://www.tribune242.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "bs3", name: "Bahamas Press", country: "Bahamas", location: "Nasáu", type: "Digital", url: "https://bahamaspress.com", status: "Activo", lastCheck: new Date().toISOString() },

  // Barbados
  { id: "bb1", name: "Nation News", country: "Barbados", location: "Bridgetown", type: "Diario", url: "https://www.nationnews.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "bb2", name: "Barbados Today", country: "Barbados", location: "Bridgetown", type: "Digital", url: "https://barbadostoday.bb", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "bb3", name: "Barbados Advocate", country: "Barbados", location: "Bridgetown", type: "Diario", url: "https://www.barbadosadvocate.com", status: "Activo", lastCheck: new Date().toISOString() },

  // Belice
  { id: "bz1", name: "Channel 5 Belize", country: "Belice", location: "Belmopán", type: "TV", url: "https://edition.channel5belize.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "bz2", name: "Amandala", country: "Belice", location: "Belmopán", type: "Diario", url: "https://amandala.com.bz", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "bz3", name: "San Pedro Sun", country: "Belice", location: "Belmopán", type: "Digital", url: "https://www.sanpedrosun.com", status: "Activo", lastCheck: new Date().toISOString() },

  // Dominica
  { id: "dm1", name: "Dominica News Online", country: "Dominica", location: "Roseau", type: "Digital", url: "https://dominicanewsonline.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "dm2", name: "The Sun Dominica", country: "Dominica", location: "Roseau", type: "Digital", url: "https://www.thesundominica.com", status: "Activo", lastCheck: new Date().toISOString() },

  // Granada
  { id: "gd1", name: "Now Grenada", country: "Granada", location: "Saint George's", type: "Digital", url: "https://www.nowgrenada.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "gd2", name: "GBN TV Grenada", country: "Granada", location: "Saint George's", type: "TV", url: "https://www.gbn.gd", status: "Activo", lastCheck: new Date().toISOString() },

  // Haití
  { id: "ht1", name: "Le Nouvelliste", country: "Haití", location: "Puerto Príncipe", type: "Diario", url: "https://lenouvelliste.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "ht2", name: "Alterpresse", country: "Haití", location: "Puerto Príncipe", type: "Digital", url: "https://www.alterpresse.org", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "ht3", name: "Haiti Liberté", country: "Haití", location: "Puerto Príncipe", type: "Digital", url: "https://www.haiti-liberte.com", status: "Activo", lastCheck: new Date().toISOString() },

  // San Cristóbal y Nieves
  { id: "kn1", name: "The St. Kitts-Nevis Observer", country: "San Cristóbal y Nieves", location: "Basseterre", type: "Digital", url: "https://www.thestkittsnevisobserver.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "kn2", name: "ZIZ Broadcasting", country: "San Cristóbal y Nieves", location: "Basseterre", type: "TV", url: "https://zizonline.com", status: "Activo", lastCheck: new Date().toISOString() },

  // Santa Lucía
  { id: "lc1", name: "St. Lucia Times", country: "Santa Lucía", location: "Castries", type: "Digital", url: "https://stluciatimes.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "lc2", name: "The Voice St. Lucia", country: "Santa Lucía", location: "Castries", type: "Diario", url: "https://www.thevoiceslu.com", status: "Activo", lastCheck: new Date().toISOString() },

  // San Vicente y las Granadinas
  { id: "vc1", name: "iWitness News SVG", country: "San Vicente y las Granadinas", location: "Kingstown", type: "Digital", url: "https://iwnsvg.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "vc2", name: "Searchlight", country: "San Vicente y las Granadinas", location: "Kingstown", type: "Diario", url: "https://searchlight.vc", status: "Activo", lastCheck: new Date().toISOString() },

  // Surinam
  { id: "sr1", name: "Times of Suriname", country: "Surinam", location: "Paramaribo", type: "Digital", url: "https://www.timesofsur.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "sr2", name: "Starnieuws", country: "Surinam", location: "Paramaribo", type: "Digital", url: "https://www.starnieuws.com", status: "Activo", lastCheck: new Date().toISOString() },
  { id: "sr3", name: "De Ware Tijd", country: "Surinam", location: "Paramaribo", type: "Diario", url: "https://www.dwtonline.com", status: "Activo", lastCheck: new Date().toISOString() },

];

import type { Report } from "../types";

export async function generateEmbassyReport(location: string, _searchQuery: string): Promise<Report[]> {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location }),
  });
  if (!res.ok) throw new Error("Error al generar el reporte");
  return res.json();
}

export async function generateMediaDatabase(location: string): Promise<MediaSource[]> {
  const res = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location }),
  });
  if (!res.ok) throw new Error("Error al actualizar la base de medios");
  return res.json();
}
