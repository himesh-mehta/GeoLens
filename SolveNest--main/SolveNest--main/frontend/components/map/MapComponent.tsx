"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polygon, Circle, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export type LandCoverFeature = 'all' | 'vegetation' | 'water' | 'agriculture' | 'built-up' | 'barren';
export type BaseLayerType = 'satellite' | 'map' | 'dark' | 'topo';

export interface MapProps {
  center?: [number, number];
  zoom?: number;
  onPointSelected?: (lat: number, lon: number) => void;
  onPolygonSelected?: (coords: [number, number][]) => void;
  selectedPoint?: [number, number] | null;
  selectedPolygon?: [number, number][] | null;
  drawMode?: 'point' | 'polygon' | 'none';
  layerMode?: 'map' | 'satellite';
  initialFeature?: LandCoverFeature;
  showFeatureControls?: boolean;
}

const FEATURE_CONFIGS: Record<LandCoverFeature, {
  label: string;
  icon: string;
  color: string;
  fillColor: string;
  indexName: string;
  formula: string;
  description: string;
}> = {
  all: {
    label: 'All Features',
    icon: '🌐',
    color: '#10b981',
    fillColor: 'rgba(16, 185, 129, 0.15)',
    indexName: 'Multi-Modal',
    formula: '26 Spectral Bands',
    description: 'Displays all classified land-cover categories across the region.'
  },
  vegetation: {
    label: 'Vegetation',
    icon: '🌿',
    color: '#16a34a',
    fillColor: 'rgba(22, 163, 74, 0.35)',
    indexName: 'NDVI (Canopy)',
    formula: '(B8 - B4) / (B8 + B4)',
    description: 'Highlights dense forest, green canopy, and natural vegetation vigor.'
  },
  water: {
    label: 'Water Bodies',
    icon: '💧',
    color: '#0284c7',
    fillColor: 'rgba(2, 132, 199, 0.35)',
    indexName: 'NDWI (Moisture)',
    formula: '(B3 - B8) / (B3 + B8)',
    description: 'Detects lakes, rivers, reservoirs, and surface moisture signatures.'
  },
  agriculture: {
    label: 'Agriculture',
    icon: '🌾',
    color: '#eab308',
    fillColor: 'rgba(234, 179, 8, 0.35)',
    indexName: 'SAVI / GRVI',
    formula: '((B8 - B4) / (B8 + B4 + 0.5)) * 1.5',
    description: 'Isolates agricultural cropland, active cultivation, and fertile soil zones.'
  },
  'built-up': {
    label: 'Built-up / Urban',
    icon: '🏙️',
    color: '#ef4444',
    fillColor: 'rgba(239, 68, 68, 0.35)',
    indexName: 'NDBI (Impervious)',
    formula: '(B11 - B8) / (B11 + B8)',
    description: 'Highlights residential buildings, concrete infrastructure, and urban density.'
  },
  barren: {
    label: 'Barren Soil',
    icon: '🏜️',
    color: '#f97316',
    fillColor: 'rgba(249, 115, 22, 0.35)',
    indexName: 'BSI (Bare Soil)',
    formula: '((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))',
    description: 'Isolates exposed bedrock, dry barren dirt, and uncultivated terrain.'
  }
};

function MapEvents({ onMapClick }: { onMapClick: (e: any) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e);
    },
  });
  return null;
}

export default function MapComponent({
  center = [20.5937, 78.9629],
  zoom = 5,
  onPointSelected,
  onPolygonSelected,
  selectedPoint,
  selectedPolygon,
  drawMode = 'none',
  layerMode = 'satellite',
  initialFeature = 'all',
  showFeatureControls = true
}: MapProps) {
  const [polygonCoords, setPolygonCoords] = useState<[number, number][]>([]);
  const [activeFeature, setActiveFeature] = useState<LandCoverFeature>(initialFeature);
  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerType>(layerMode === 'map' ? 'map' : 'satellite');
  const [showInfo, setShowInfo] = useState(false);

  const handleMapClick = (e: any) => {
    if (drawMode === 'point') {
      if (onPointSelected) onPointSelected(e.latlng.lat, e.latlng.lng);
    } else if (drawMode === 'polygon') {
      const newCoords = [...polygonCoords, [e.latlng.lat, e.latlng.lng] as [number, number]];
      setPolygonCoords(newCoords);
      if (newCoords.length >= 3 && onPolygonSelected) {
        onPolygonSelected(newCoords);
      }
    }
  };

  useEffect(() => {
    if (!selectedPolygon) {
      setPolygonCoords([]);
    }
  }, [selectedPolygon]);

  useEffect(() => {
    if (layerMode === 'map' || layerMode === 'satellite') {
      setActiveBaseLayer(layerMode);
    }
  }, [layerMode]);

  const featureCfg = FEATURE_CONFIGS[activeFeature];

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* ── MAP CONTROLS FLOATING BAR ── */}
      {showFeatureControls && (
        <div className="absolute top-3 left-3 right-3 z-[450] pointer-events-auto flex flex-col gap-2">
          {/* Feature selection pills */}
          <div className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/80 shadow-lg overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-300 px-2 uppercase tracking-wider hidden sm:inline">
              Feature:
            </span>
            {(Object.keys(FEATURE_CONFIGS) as LandCoverFeature[]).map((f) => {
              const cfg = FEATURE_CONFIGS[f];
              const isSelected = activeFeature === f;
              return (
                <button
                  key={f}
                  onClick={() => setActiveFeature(f)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </button>
              );
            })}

            {/* Base Layer Switcher */}
            <div className="ml-auto flex items-center gap-1 border-l border-slate-700 pl-2">
              <button
                onClick={() => setActiveBaseLayer('satellite')}
                title="Satellite View"
                className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
                  activeBaseLayer === 'satellite' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                🛰️ Sat
              </button>
              <button
                onClick={() => setActiveBaseLayer('map')}
                title="Street Map View"
                className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
                  activeBaseLayer === 'map' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                🗺️ Map
              </button>
              <button
                onClick={() => setShowInfo(!showInfo)}
                title="Spectral Info"
                className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
                  showInfo ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                ℹ️
              </button>
            </div>
          </div>

          {/* Feature Spectral Info Box (Collapsible) */}
          {showInfo && (
            <div className="bg-slate-950/90 backdrop-blur-md p-3 rounded-lg border border-slate-700 text-white text-xs space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  {featureCfg.icon} {featureCfg.label} Feature Layer
                </span>
                <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                  {featureCfg.indexName}
                </span>
              </div>
              <p className="text-slate-300 text-[11px]">{featureCfg.description}</p>
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                Band Math: <span className="font-mono text-emerald-300">{featureCfg.formula}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LEAFLET MAP CONTAINER ── */}
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', zIndex: 10 }}>
        {activeBaseLayer === 'map' && (
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {activeBaseLayer === 'satellite' && (
          <TileLayer
            attribution='Tiles &copy; Esri World Imagery'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        <MapEvents onMapClick={handleMapClick} />

        {/* Selected Point Marker and Dynamic Feature Halo */}
        {selectedPoint && (
          <>
            <Marker position={selectedPoint}>
              <Popup>
                <div className="p-1 space-y-1 text-xs">
                  <div className="font-bold text-slate-900">Target Coordinate</div>
                  <div>Lat: {selectedPoint[0].toFixed(4)}, Lon: {selectedPoint[1].toFixed(4)}</div>
                  <div className="text-emerald-600 font-semibold">{featureCfg.label} ({featureCfg.indexName})</div>
                </div>
              </Popup>
            </Marker>

            {/* Feature Highlight Halo */}
            {activeFeature !== 'all' && (
              <Circle
                center={selectedPoint}
                radius={800}
                pathOptions={{
                  color: featureCfg.color,
                  fillColor: featureCfg.fillColor,
                  fillOpacity: 0.4,
                  weight: 2,
                  dashArray: '4, 4'
                }}
              />
            )}
          </>
        )}

        {/* Selected Polygon */}
        {(selectedPolygon || polygonCoords.length > 0) && (
          <Polygon
            positions={selectedPolygon || polygonCoords}
            pathOptions={{
              color: featureCfg.color,
              fillColor: activeFeature === 'all' ? '#10b981' : featureCfg.color,
              fillOpacity: 0.3,
              weight: 2.5
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}

