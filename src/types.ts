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
    mercados_industria: string;
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
  { id: "argentina", name: "Buenos Aires", country: "Argentina", coords: [-34.6037, -58.3816] },
  { id: "spain", name: "Madrid", country: "España", coords: [40.4168, -3.7038] },
  { id: "france", name: "París", country: "Francia", coords: [48.8566, 2.3522] },
  { id: "japan", name: "Tokio", country: "Japón", coords: [35.6762, 139.6503] },
  { id: "brazil", name: "Brasilia", country: "Brasil", coords: [-15.7975, -47.8919] },
  { id: "usa", name: "Washington D.C.", country: "EE.UU.", coords: [38.9072, -77.0369] },
];

export interface MediaSource {
  id: string;
  name: string;
  location: string;
  type: "Diario" | "Radio" | "TV" | "Digital";
  url: string;
  status: "Activo" | "Inactivo";
  lastCheck: string;
}

export const INSTITUTIONAL_COLORS = {
  AZUL_MRE: "#003366",
  GRIS_NEUTRAL: "#575757",
};

export const TIPOGRAFIA_PRINCIPAL = "Raleway";
