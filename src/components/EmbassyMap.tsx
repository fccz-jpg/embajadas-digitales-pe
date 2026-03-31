import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { EMBASSIES } from '../types';
import { useEffect } from 'react';

// Fix for default marker icons in Leaflet with Webpack/Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface EmbassyMapProps {
  selectedLocation: string;
  onLocationSelect: (location: string) => void;
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 4);
  }, [center, map]);
  return null;
}

export default function EmbassyMap({ selectedLocation, onLocationSelect }: EmbassyMapProps) {
  const selectedEmbassy = EMBASSIES.find(e => e.name === selectedLocation) || EMBASSIES[0];

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-stone-200 shadow-sm z-0">
      <MapContainer 
        center={selectedEmbassy.coords} 
        zoom={4} 
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView center={selectedEmbassy.coords} />
        {EMBASSIES.map((embassy) => (
          <Marker 
            key={embassy.id} 
            position={embassy.coords}
            eventHandlers={{
              click: () => onLocationSelect(embassy.name),
            }}
          >
            <Popup>
              <div className="text-center">
                <p className="font-bold text-mre-blue">{embassy.name}</p>
                <p className="text-[10px] uppercase tracking-wider text-stone-500">Sede de Monitoreo</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
