"use client";

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polygon, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Check, Grid, Info, Plus, Minus } from 'lucide-react';
import { useTheme } from '@/lib/theme/theme-context';
import { useTranslation } from '@/lib/i18n';

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

interface FeatureConfig {
  key: LandCoverFeature;
  label: string;
  icon: string;
  lightColor: string;
  darkColor: string;
  description: string;
  indexName: string;
  badge: string;
  formula: string;
}

const FEATURE_CONFIGS: Record<LandCoverFeature, FeatureConfig> = {
  all: {
    key: 'all',
    label: 'All Features',
    icon: '🌐',
    lightColor: '#4C7A3D',
    darkColor: '#14B8A6',
    description: 'Displays all classified land-cover categories across the region.',
    indexName: 'Multi-Band Composite',
    badge: 'Multi-Modal',
    formula: 'Band Math: 26 Spectral Bands',
  },
  vegetation: {
    key: 'vegetation',
    label: 'Vegetation',
    icon: '🌱',
    lightColor: '#8FBC5A',
    darkColor: '#4ade80',
    description: 'Highlights dense forest canopy, crops, and photosynthetic activity.',
    indexName: 'NDVI',
    badge: 'NDVI',
    formula: 'Band Math: (B8 - B4) / (B8 + B4)',
  },
  water: {
    key: 'water',
    label: 'Water Bodies',
    icon: '💧',
    lightColor: '#5B9BD5',
    darkColor: '#38bdf8',
    description: 'Detects lakes, rivers, reservoirs, and surface moisture signatures.',
    indexName: 'MNDWI',
    badge: 'NDWI (Moisture)',
    formula: 'Band Math: (B3 - B8) / (B3 + B8)',
  },
  agriculture: {
    key: 'agriculture',
    label: 'Agriculture',
    icon: '🌾',
    lightColor: '#4C7A3D',
    darkColor: '#eab308',
    description: 'Tracks active cropland, crop health, and seasonal crop cycles.',
    indexName: 'SAVI',
    badge: 'SAVI / EVI',
    formula: 'Band Math: ((B8 - B4) / (B8 + B4 + 0.5)) * 1.5',
  },
  'built-up': {
    key: 'built-up',
    label: 'Built-up / Urban',
    icon: '🏙️',
    lightColor: '#C4823A',
    darkColor: '#f59e0b',
    description: 'Identifies impervious surfaces, buildings, and urban structures.',
    indexName: 'NDBI',
    badge: 'NDBI',
    formula: 'Band Math: (B11 - B8) / (B11 + B8)',
  },
  barren: {
    key: 'barren',
    label: 'Barren Soil',
    icon: '🟫',
    lightColor: '#A9825A',
    darkColor: '#b45309',
    description: 'Exposes bare earth, fallow land, and rocky soil surfaces.',
    indexName: 'BSI',
    badge: 'BSI',
    formula: 'Band Math: ((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))',
  },
};

// Custom Leaflet Zoom Control positioned below floating toolbar (top: 60px)
function CustomZoomControl() {
  const map = useMapEvents({});
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className="absolute top-[60px] left-4 z-[400] flex flex-col rounded-lg border shadow-md overflow-hidden transition-colors pointer-events-auto">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        title="Zoom In"
        className={`w-7 h-7 flex items-center justify-center text-xs font-bold border-b transition-colors cursor-pointer ${
          isLight
            ? 'bg-white hover:bg-[#F0F2EB] text-[#2D3B27] border-[#E5E7DE]'
            : 'bg-[#131B2E] hover:bg-[#1E293B] text-[#F1F5F9] border-[#1E293B]'
        }`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        title="Zoom Out"
        className={`w-7 h-7 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer ${
          isLight
            ? 'bg-white hover:bg-[#F0F2EB] text-[#2D3B27]'
            : 'bg-[#131B2E] hover:bg-[#1E293B] text-[#F1F5F9]'
        }`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Map camera controller to handle smooth zoom & flyTo panning on location changes
function MapCameraController({ center }: { center?: [number, number] | null }) {
  const map = useMapEvents({});

  useEffect(() => {
    if (center && typeof center[0] === 'number' && typeof center[1] === 'number' && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, 13, { duration: 1.2 });
    }
  }, [center, map]);

  return null;
}

// Component to handle map clicks
function MapClickHandler({
  drawMode,
  onPointClick,
  onPolygonAddPoint,
}: {
  drawMode: 'point' | 'polygon' | 'none';
  onPointClick: (lat: number, lon: number) => void;
  onPolygonAddPoint: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (drawMode === 'point') {
        onPointClick(e.latlng.lat, e.latlng.lng);
      } else if (drawMode === 'polygon') {
        onPolygonAddPoint(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Component to auto-invalidate Leaflet map size on element resize or sidebar toggles
function MapAutoResizer() {
  const map = useMapEvents({});

  useEffect(() => {
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 300);

    const container = map.getContainer();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (resizeObserver && container) resizeObserver.unobserve(container);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  return null;
}

// Dynamic Lat/Lon Graticule Layer Overlay
function GraticuleLayer({ show, isSatellite }: { show: boolean; isSatellite: boolean }) {
  const map = useMapEvents({});
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleMove = () => setTick(t => t + 1);
    map.on('moveend zoomend', handleMove);
    return () => {
      map.off('moveend zoomend', handleMove);
    };
  }, [map]);

  if (!show) return null;

  const bounds = map.getBounds();
  const zoom = map.getZoom();

  let step = 5;
  if (zoom >= 14) step = 0.01;
  else if (zoom >= 11) step = 0.05;
  else if (zoom >= 8) step = 0.2;
  else if (zoom >= 6) step = 1;
  else if (zoom >= 4) step = 5;
  else step = 10;

  const south = Math.floor(bounds.getSouth() / step) * step;
  const north = Math.ceil(bounds.getNorth() / step) * step;
  const west = Math.floor(bounds.getWest() / step) * step;
  const east = Math.ceil(bounds.getEast() / step) * step;

  const polylines: [number, number][][] = [];

  // Latitudes
  for (let lat = south; lat <= north; lat += step) {
    if (lat >= -90 && lat <= 90) {
      polylines.push([[lat, -180], [lat, 180]]);
    }
  }

  // Longitudes
  for (let lon = west; lon <= east; lon += step) {
    if (lon >= -180 && lon <= 180) {
      polylines.push([[-90, lon], [90, lon]]);
    }
  }

  const lineProps = {
    color: isSatellite ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.12)',
    weight: 1,
    opacity: 0.85,
    dashArray: '4, 4',
  };

  return (
    <>
      {polylines.map((line, idx) => (
        <Polyline key={idx} positions={line} pathOptions={lineProps} />
      ))}
    </>
  );
}

export default function MapComponent({
  center = [20.5937, 78.9629],
  zoom = 5,
  onPointSelected,
  onPolygonSelected,
  selectedPoint,
  selectedPolygon,
  drawMode = 'point',
  layerMode = 'map',
  initialFeature = 'all',
  showFeatureControls = true,
}: MapProps) {
  const { theme } = useTheme();
  const { t, lang } = useTranslation();
  const isLight = theme === 'light';

  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerType>(layerMode);
  const [activeFeature, setActiveFeature] = useState<LandCoverFeature>(initialFeature);
  const [polygonCoords, setPolygonCoords] = useState<[number, number][]>(selectedPolygon || []);
  const [showInfo, setShowInfo] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setShowInfo(false);
      }
    };
    if (showInfo) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInfo]);

  const handlePointClick = (lat: number, lon: number) => {
    if (onPointSelected) {
      onPointSelected(lat, lon);
    }
  };

  const handlePolygonAddPoint = (lat: number, lon: number) => {
    const nextCoords: [number, number][] = [...polygonCoords, [lat, lon]];
    setPolygonCoords(nextCoords);
    if (onPolygonSelected && nextCoords.length >= 3) {
      onPolygonSelected(nextCoords);
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
  const color = isLight ? featureCfg.lightColor : featureCfg.darkColor;

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* ── MAP CONTROLS FLOATING BAR (Compact Fit-Content Sizing & App Theme Colors) ── */}
      {showFeatureControls && (
        <div className="absolute top-3 left-3 right-3 z-[450] pointer-events-auto flex justify-center max-w-full px-2">
          <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-md max-w-full overflow-hidden transition-colors ${
            isLight
              ? 'bg-[#FFFFFF]/95 border-[#E5E7DE] text-[#2D3B27]'
              : 'bg-[#0F172A]/95 border-slate-700 text-[#F1F5F9]'
          }`}>
            
            {/* Inline Feature Pill Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1 pr-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
              <span className={`text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap pl-1 pr-0.5 ${
                isLight ? 'text-[#6B7568]' : 'text-slate-400'
              }`}>
                FEATURE:
              </span>
              <div className="flex items-center gap-1.5 flex-nowrap">
                {(Object.keys(FEATURE_CONFIGS) as LandCoverFeature[]).map((fKey) => {
                  const cfg = FEATURE_CONFIGS[fKey];
                  const isActive = activeFeature === fKey;
                  return (
                    <button
                      key={fKey}
                      type="button"
                      onClick={() => setActiveFeature(fKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        isActive
                          ? isLight
                            ? 'bg-[#4C7A3D] text-white shadow-xs font-bold'
                            : 'bg-[#14B8A6] text-white shadow-xs font-bold'
                          : isLight
                            ? 'bg-[#F0F2EB] hover:bg-[#E5E7DE] text-[#2D3B27] border border-[#D8DCCF]/60'
                            : 'bg-[#1E293B] hover:bg-[#334155] text-slate-200 border border-slate-700/60'
                      }`}
                    >
                      <span className="text-xs">{cfg.icon}</span>
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1px Vertical Divider */}
            <div
              className={`w-px h-5 self-center flex-shrink-0 mx-2.5 ${isLight ? 'bg-black/15' : 'bg-white/25'}`}
              style={{ width: '1px', height: '20px' }}
            />

            {/* Right Buttons: Sat, Map, Grid Toggle, Info */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setActiveBaseLayer('satellite')}
                title="Satellite View"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  activeBaseLayer === 'satellite'
                    ? isLight ? 'bg-[#4C7A3D] text-white shadow-xs' : 'bg-[#14B8A6] text-white shadow-xs'
                    : isLight ? 'text-[#6B7568] hover:bg-[#F0F2EB]' : 'text-slate-300 hover:bg-[#1E293B]'
                }`}
              >
                🛰️ Sat
              </button>
              <button
                type="button"
                onClick={() => setActiveBaseLayer('map')}
                title="Street Map View"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  activeBaseLayer === 'map'
                    ? isLight ? 'bg-[#4C7A3D] text-white shadow-xs' : 'bg-[#14B8A6] text-white shadow-xs'
                    : isLight ? 'text-[#6B7568] hover:bg-[#F0F2EB]' : 'text-slate-300 hover:bg-[#1E293B]'
                }`}
              >
                🗺️ Map
              </button>

              {/* Grid Lines Toggle */}
              <button
                type="button"
                onClick={() => setShowGrid(g => !g)}
                title="Toggle Lat/Lon Grid Lines"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap ${
                  showGrid
                    ? isLight ? 'bg-[#4C7A3D] text-white shadow-xs' : 'bg-[#14B8A6] text-white shadow-xs'
                    : isLight ? 'text-[#6B7568] hover:bg-[#F0F2EB]' : 'text-slate-300 hover:bg-[#1E293B]'
                }`}
              >
                <Grid className="h-3.5 w-3.5" />
                <span>Grid</span>
              </button>

              {/* Info Button with Absolute Floating Popover Overlay */}
              <div className="relative" ref={infoRef}>
                <button
                  type="button"
                  onClick={() => setShowInfo(!showInfo)}
                  title="Spectral Info"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    showInfo
                      ? isLight ? 'bg-[#4C7A3D] text-white shadow-xs' : 'bg-[#14B8A6] text-white shadow-xs'
                      : isLight ? 'text-[#6B7568] hover:bg-[#F0F2EB]' : 'text-slate-300 hover:bg-[#1E293B]'
                  }`}
                >
                  ℹ️ Info
                </button>

                {/* Floating Overlay Popover - Dynamic per activeFeature */}
                {showInfo && (
                  <div className={`absolute top-full right-0 mt-2 w-80 p-3.5 rounded-xl border text-xs space-y-2 backdrop-blur-md shadow-2xl z-[550] animate-in fade-in duration-200 ${
                    isLight ? 'bg-white/95 border-[#E5E7DE] text-[#2D3B27]' : 'bg-[#0F172A]/95 border-slate-700 text-[#F1F5F9]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold flex items-center gap-1.5 text-xs ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`}>
                        {featureCfg.icon} {featureCfg.label} Feature Layer
                      </span>
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        isLight ? 'bg-[#F0F2EB] text-[#2D3B27] border-[#D8DCCF]' : 'bg-[#1E293B] text-slate-200 border-slate-700'
                      }`}>
                        {featureCfg.badge}
                      </span>
                    </div>
                    <p className={isLight ? 'text-[#6B7568] text-xs leading-relaxed' : 'text-slate-300 text-xs leading-relaxed'}>
                      {featureCfg.description}
                    </p>
                    <div className={`pt-2 border-t font-mono text-[11px] font-medium flex items-center justify-between ${
                      isLight ? 'border-[#E5E7DE] text-[#4C7A3D]' : 'border-slate-800 text-[#14B8A6]'
                    }`}>
                      <span>{featureCfg.formula}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LEAFLET MAP CONTAINER ── */}
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={3}
        maxZoom={18}
        zoomControl={false}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%', zIndex: 10 }}
      >
        <MapAutoResizer />
        <MapCameraController center={selectedPoint || center} />
        <CustomZoomControl />

        {activeBaseLayer === 'map' && (
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            noWrap={true}
            bounds={[[-90, -180], [90, 180]]}
          />
        )}
        {activeBaseLayer === 'satellite' && (
          <TileLayer
            attribution='Tiles &copy; Esri World Imagery'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            noWrap={true}
            bounds={[[-90, -180], [90, 180]]}
          />
        )}

        {/* Dynamic Coordinate Graticule Grid Layer */}
        <GraticuleLayer show={showGrid} isSatellite={activeBaseLayer === 'satellite'} />

        <MapClickHandler
          drawMode={drawMode}
          onPointClick={handlePointClick}
          onPolygonAddPoint={handlePolygonAddPoint}
        />

        {/* Selected Point Marker + Analysis Area Dashed Circle Overlay */}
        {selectedPoint && (
          <>
            <Marker position={selectedPoint}>
              <Popup>
                <div className="text-xs space-y-1">
                  <p className="font-bold">Selected Location</p>
                  <p>Lat: {selectedPoint[0].toFixed(4)}°</p>
                  <p>Lon: {selectedPoint[1].toFixed(4)}°</p>
                </div>
              </Popup>
            </Marker>

            {/* Analysis Area Dashed Circle Overlay (500m radius, color-coded to active feature) */}
            <Circle
              center={selectedPoint}
              radius={500}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.18,
                weight: 2,
                dashArray: '6, 6',
              }}
            />
          </>
        )}

        {/* Selected Polygon */}
        {polygonCoords.length > 0 && (
          <>
            <Polygon
              positions={polygonCoords}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.18,
                weight: 2,
                dashArray: '6, 6',
              }}
            />
            {polygonCoords.map((coord, idx) => (
              <Circle
                key={idx}
                center={coord}
                radius={30}
                pathOptions={{ color: color, fillColor: color, fillOpacity: 0.8 }}
              />
            ))}
          </>
        )}
      </MapContainer>
    </div>
  );
}
