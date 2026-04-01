export interface NewsItem {
  title: string;
  source: string;
  preview: string;
  date: string;
  url?: string;
}

export interface Report {
  id: string;
  location: string;
  content: {
    politico: string;
    economico: string;
    cultural: string;
    relaciones_internacionales: string;
    panorama_general: string;
    sources?: {
      title: string;
      source: string;
      url: string;
      date: string;
    }[];
  } | string;
  createdAt: string;
  rawNews: string;
  newsItems?: NewsItem[];
}

export interface EmbassyLocation {
  id: string;
  name: string;
  country: string;
  coords: [number, number];
}

export const EMBASSIES: EmbassyLocation[] = [
  { id: "mexico", name: "Ciudad de México", country: "México", coords: [19.4326, -99.1332] },
  { id: "sanmarino", name: "San Marino", country: "San Marino", coords: [43.9424, 12.4578] },
  { id: "bhutan", name: "Timbu", country: "Bután", coords: [27.4728, 89.6339] },
  { id: "spain", name: "Madrid", country: "España", coords: [40.4168, -3.7038] },
  { id: "antigua", name: "Saint John's", country: "Antigua y Barbuda", coords: [17.1175, -61.8456] },
  { id: "bahamas", name: "Nasáu", country: "Bahamas", coords: [25.0480, -77.3554] },
  { id: "barbados", name: "Bridgetown", country: "Barbados", coords: [13.0969, -59.6145] },
  { id: "belize", name: "Belmopán", country: "Belice", coords: [17.2510, -88.7590] },
  { id: "dominica", name: "Roseau", country: "Dominica", coords: [15.3009, -61.3882] },
  { id: "grenada", name: "Saint George's", country: "Granada", coords: [12.0561, -61.7488] },
  { id: "haiti", name: "Puerto Príncipe", country: "Haití", coords: [18.5944, -72.3074] },
  { id: "stkitts", name: "Basseterre", country: "San Cristóbal y Nieves", coords: [17.3026, -62.7177] },
  { id: "stlucia", name: "Castries", country: "Santa Lucía", coords: [14.0101, -60.9875] },
  { id: "stvincent", name: "Kingstown", country: "San Vicente y las Granadinas", coords: [13.1600, -61.2248] },
  { id: "suriname", name: "Paramaribo", country: "Surinam", coords: [5.8520, -55.2038] },
];

export interface MediaSource {
  id: string;
  name: string;
  country: string;
  location: string;
  type: "Diario" | "Radio" | "TV" | "Digital";
  url: string;
  status: "Activo" | "Inactivo" | "Verificando";
  lastCheck: string;
}

export const INSTITUTIONAL_COLORS = {
  AZUL_MRE: "#003366",
  GRIS_NEUTRAL: "#575757",
};

export const TIPOGRAFIA_PRINCIPAL = "Raleway";
