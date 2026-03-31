import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { EMBASSIES } from '../types';
import { mockCountryData } from '../services/geminiService';
import { cn } from '../lib/utils';

interface WorldMapViewProps {
  onLocationSelect: (location: string) => void;
}

export default function WorldMapView({ onLocationSelect }: WorldMapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number, y: number, content: string, visible: boolean }>({
    x: 0,
    y: 0,
    content: '',
    visible: false
  });

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 1000;
    const height = 600;

    svg.selectAll("*").remove();

    const projection = d3.geoNaturalEarth1()
      .scale(180)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    const g = svg.append("g");

    // Map topojson names to our location names and country display names
    const countryMap: Record<string, { country: string, locationName: string }> = {
      "Mexico": { country: "México", locationName: "Ciudad de México" },
      "San Marino": { country: "San Marino", locationName: "San Marino" },
      "Bhutan": { country: "Bután", locationName: "Bután" }
    };

    // Load world data
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then((data: any) => {
      const countries = topojson.feature(data, data.objects.countries) as any;
      const monitoredCountries = Object.keys(countryMap);

      g.selectAll("path")
        .data(countries.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", (d: any) => monitoredCountries.includes(d.properties.name) ? "#003366" : "#f5f5f4")
        .attr("stroke", (d: any) => monitoredCountries.includes(d.properties.name) ? "#ffffff" : "#d6d3d1")
        .attr("stroke-width", (d: any) => monitoredCountries.includes(d.properties.name) ? 1 : 0.5)
        .attr("class", "country")
        .style("transition", "all 0.3s ease")
        .on("mouseover", function(event, d: any) {
          const isMonitored = monitoredCountries.includes(d.properties.name);
          if (isMonitored) {
            d3.select(this).attr("fill", "#002244");
            const info = countryMap[d.properties.name];
            const capital = mockCountryData[info.locationName]?.capital || "N/A";
            
            setTooltip({
              x: event.pageX,
              y: event.pageY,
              content: `${info.country}\nCapital: ${capital}`,
              visible: true
            });
          } else {
            d3.select(this).attr("fill", "#e7e5e4");
          }
        })
        .on("mousemove", function(event) {
          setTooltip(prev => ({ ...prev, x: event.pageX, y: event.pageY }));
        })
        .on("mouseout", function(event, d: any) {
          d3.select(this).attr("fill", monitoredCountries.includes(d.properties.name) ? "#003366" : "#f5f5f4");
          setTooltip(prev => ({ ...prev, visible: false }));
        })
        .on("click", (event, d: any) => {
          const info = countryMap[d.properties.name];
          if (info) {
            onLocationSelect(info.locationName);
          }
        });
    });

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

  }, [onLocationSelect]);

  return (
    <div className="w-full h-full bg-stone-50 rounded-2xl border border-stone-200 overflow-hidden relative shadow-inner">
      <div className="absolute top-6 left-6 z-10">
        <h2 className="text-xl font-bold text-stone-900">Mapa - Paises en seguimiento activo</h2>
        <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">Monitor Geopolítico</p>
      </div>
      <div className="absolute bottom-6 left-6 z-10 bg-white/80 backdrop-blur-md p-3 rounded-lg border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-mre-blue"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600">Países Disponibles</span>
        </div>
        <p className="text-[9px] text-stone-400 leading-tight max-w-[180px]">
          Haga clic en una sede para acceder al panel de control y análisis estratégico local.
        </p>
      </div>

      {tooltip.visible && (
        <div 
          className="fixed z-[100] pointer-events-none bg-stone-900 text-white p-2 rounded shadow-xl text-[10px] font-bold uppercase tracking-wider whitespace-pre-line border border-white/20"
          style={{ left: tooltip.x + 15, top: tooltip.y - 15 }}
        >
          {tooltip.content}
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox="0 0 1000 600"
        className="w-full h-full"
      />
    </div>
  );
}
