"use client";

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Search, MapPin, Layers, Crosshair, Pentagon,
  Trash2, BarChart2, AlertTriangle, Satellite, Info, ChevronDown,
  GitCompare, Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackendAPI } from '@/lib/api-client';
import { areasService } from '@/services/areas-service';

// Dynamic import to avoid SSR issues with Leaflet
const MapComponent = dynamic(
  () => import('@/components/map/MapComponent'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 font-medium animate-pulse">Loading Map...</div>
      </div>
    ),
  }
);

interface PredictionResult {
  prediction: string;
  confidence: number;
  probabilities: Record<string, number>;
  year_status: string;
  validated_accuracy_available: boolean;
  year: number;
  latitude: number;
  longitude: number;
  features?: Record<string, number>;
}

interface PolygonResult {
  samples_analyzed: number;
  year: number;
  distribution: Record<string, { sample_count: number; regional_landcover_percentage: number }>;
  year_status: string;
  validated_accuracy_available: boolean;
}

const AVAILABLE_YEARS = [
  { year: 2018, status: 'validated' },
  { year: 2019, status: 'unseen_inference' },
  { year: 2020, status: 'unseen_inference' },
  { year: 2021, status: 'unseen_inference' },
  { year: 2022, status: 'unseen_inference' },
  { year: 2023, status: 'unseen_inference' },
  { year: 2024, status: 'validated' },
];

const CLASS_COLORS: Record<string, string> = {
  'Water': '#3b82f6',
  'Vegetation': '#22c55e',
  'Agriculture': '#eab308',
  'Built-up': '#ef4444',
  'Barren': '#a1a1aa',
};

export default function ExplorerPage() {
  const router = useRouter();

  // Map state
  const [drawMode, setDrawMode] = useState<'point' | 'polygon' | 'none'>('point');
  const [layerMode, setLayerMode] = useState<'map' | 'satellite'>('map');
  const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(null);
  const [selectedPolygon, setSelectedPolygon] = useState<[number, number][] | null>(null);

  // Input state
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [selectedYear, setSelectedYear] = useState(2024);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{lat: string, lon: string, display_name: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Results state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [pointResult, setPointResult] = useState<PredictionResult | null>(null);
  const [polygonResult, setPolygonResult] = useState<PolygonResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [geeStatus, setGeeStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking');

  React.useEffect(() => {
    BackendAPI.getHealthGee().then((res: any) => {
      if (res && res.authenticated) {
        setGeeStatus('connected');
      } else {
        setGeeStatus('unavailable');
      }
    }).catch(() => setGeeStatus('unavailable'));
  }, []);

  // Year info
  const yearInfo = AVAILABLE_YEARS.find(y => y.year === selectedYear);
  const isInferenceYear = yearInfo?.status === 'unseen_inference';

  const handlePointSelected = useCallback((lat: number, lon: number) => {
    setSelectedPoint([lat, lon]);
    setSelectedPolygon(null);
    setLatInput(lat.toFixed(6));
    setLonInput(lon.toFixed(6));
    setPointResult(null);
    setPolygonResult(null);
    setErrorMessage(null);
  }, []);

  const handlePolygonSelected = useCallback((coords: [number, number][]) => {
    setSelectedPolygon(coords);
    setSelectedPoint(null);
    setPointResult(null);
    setPolygonResult(null);
    setErrorMessage(null);
  }, []);

  const handleClearSelection = () => {
    setSelectedPoint(null);
    setSelectedPolygon(null);
    setLatInput('');
    setLonInput('');
    setPointResult(null);
    setPolygonResult(null);
    setErrorMessage(null);
  };

  const handleManualCoords = () => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      setSelectedPoint([lat, lon]);
      setSelectedPolygon(null);
      setDrawMode('point');
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setLoadingStep(1); // 1: Fetching Sentinel-2 imagery...
    setErrorMessage(null);
    setPointResult(null);
    setPolygonResult(null);

    // Simulate step 2 and 3 for UI feedback (since backend call is blocking)
    const step2Timer = setTimeout(() => setLoadingStep(2), 1500); // Computing spectral features
    const step3Timer = setTimeout(() => setLoadingStep(3), 3000); // Running land-cover model

    try {
      if (selectedPoint) {
        const res = await BackendAPI.predictLocation(selectedPoint[0], selectedPoint[1], selectedYear) as any;
        if (!res || res.status === 'error') {
          setErrorMessage(res?.message || 'Prediction failed. The backend may be unavailable.');
        } else {
          setPointResult(res as PredictionResult);
          areasService.addHistoryItem({
            areaId: `custom-${selectedPoint[0].toFixed(4)}-${selectedPoint[1].toFixed(4)}`,
            areaName: `Point: ${selectedPoint[0].toFixed(4)}, ${selectedPoint[1].toFixed(4)}`,
            type: 'analysis',
            date: String(selectedYear),
            status: 'completed',
          });
        }
      } else if (selectedPolygon && selectedPolygon.length >= 3) {
        // Convert [lat,lon] to [lon,lat] for GeoJSON
        const geoCoords = selectedPolygon.map(c => [c[1], c[0]]);
        geoCoords.push(geoCoords[0]); // close polygon
        const res = await BackendAPI.predictPolygon(geoCoords, selectedYear) as any;
        if (!res || res.status === 'error') {
          setErrorMessage(res?.message || 'Polygon analysis failed. The backend may be unavailable.');
        } else {
          setPolygonResult(res as PolygonResult);
          areasService.addHistoryItem({
            areaId: `polygon-${Date.now()}`,
            areaName: `Polygon Area Analysis`,
            type: 'analysis',
            date: String(selectedYear),
            status: 'completed',
          });
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Analysis request failed.');
    } finally {
      clearTimeout(step2Timer);
      clearTimeout(step3Timer);
      setIsAnalyzing(false);
      setLoadingStep(0);
    }
  };

  const getLoadingMessage = () => {
    switch (loadingStep) {
      case 1: return "Fetching Sentinel-2 imagery...";
      case 2: return "Computing spectral features...";
      case 3: return "Running land-cover model...";
      default: return "Analyzing...";
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-[#e2e8f0] px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <span className="text-lg font-bold text-[#0f172a]">Map Explorer</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Layer toggle */}
          <Button
            variant={layerMode === 'map' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setLayerMode('map')}
          >
            Map
          </Button>
          <Button
            variant={layerMode === 'satellite' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setLayerMode('satellite')}
          >
            Satellite
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 bg-white border-r border-[#e2e8f0] flex flex-col overflow-y-auto flex-shrink-0">
          {/* Search */}
          <div className="p-4 border-b border-[#e2e8f0]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Search location (press Enter)..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value) setSearchResults([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery) {
                    setIsSearching(true);
                    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`)
                      .then(res => res.json())
                      .then(data => {
                        if (data && data.length > 0) {
                          setSearchResults(data.slice(0, 5));
                        } else {
                          setSearchResults([]);
                          alert("Location not found.");
                        }
                      })
                      .catch(err => {
                        setSearchResults([]);
                        alert("Search failed.");
                      })
                      .finally(() => setIsSearching(false));
                  }
                }}
                className="w-full pl-10 pr-4 py-2 text-sm border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981] outline-none"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-3 h-3 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-[#e2e8f0] rounded-lg shadow-lg overflow-hidden">
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      title={res.display_name}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-[#f8fafc] border-b border-[#e2e8f0] last:border-0 truncate"
                      onClick={() => {
                        const lat = parseFloat(res.lat);
                        const lon = parseFloat(res.lon);
                        setSelectedPoint([lat, lon]);
                        setLatInput(lat.toFixed(6));
                        setLonInput(lon.toFixed(6));
                        setDrawMode('point');
                        setSelectedPolygon(null);
                        setSearchResults([]);
                        setSearchQuery(res.display_name.split(',')[0]);
                      }}
                    >
                      {res.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coordinates */}
          <div className="p-4 space-y-3 border-b border-[#e2e8f0]">
            <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Coordinates</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">Latitude</label>
                <input
                  type="number"
                  step="any"
                  placeholder="20.5937"
                  value={latInput}
                  onChange={e => setLatInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-md focus:ring-2 focus:ring-[#10b981] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">Longitude</label>
                <input
                  type="number"
                  step="any"
                  placeholder="78.9629"
                  value={lonInput}
                  onChange={e => setLonInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-md focus:ring-2 focus:ring-[#10b981] outline-none"
                />
              </div>
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={handleManualCoords}>
              <Crosshair className="h-3.5 w-3.5 mr-1.5" /> Go to Coordinates
            </Button>
          </div>

          {/* Year Selector */}
          <div className="p-4 space-y-3 border-b border-[#e2e8f0]">
            <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Year</h4>
            <div className="grid grid-cols-4 gap-1.5">
              {AVAILABLE_YEARS.map(y => (
                <button
                  key={y.year}
                  onClick={() => setSelectedYear(y.year)}
                  className={`relative px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                    selectedYear === y.year
                      ? 'bg-[#10b981] text-white shadow-sm'
                      : 'bg-[#f1f5f9] text-[#334155] hover:bg-[#e2e8f0]'
                  }`}
                >
                  {y.year}
                  {y.status === 'validated' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full border border-white" />
                  )}
                </button>
              ))}
            </div>
            {isInferenceYear && (
              <div className="flex items-start gap-2 p-2 bg-[#fffbeb] border border-[#fde68a] rounded-md">
                <AlertTriangle className="h-3.5 w-3.5 text-[#d97706] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#92400e]">
                  <strong>Inference-only year.</strong> Model trained/validated on 2018 and 2024. No independent validation for {selectedYear}.
                </p>
              </div>
            )}
          </div>

          {/* Draw Tools */}
          <div className="p-4 space-y-3 border-b border-[#e2e8f0]">
            <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Tools</h4>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={drawMode === 'point' ? 'primary' : 'outline'}
                className="flex-1"
                onClick={() => setDrawMode('point')}
              >
                <MapPin className="h-3.5 w-3.5 mr-1" /> Point
              </Button>
              <Button
                size="sm"
                variant={drawMode === 'polygon' ? 'primary' : 'outline'}
                className="flex-1"
                onClick={() => setDrawMode('polygon')}
              >
                <Pentagon className="h-3.5 w-3.5 mr-1" /> Polygon
              </Button>
            </div>
            <Button size="sm" variant="outline" className="w-full text-[#ef4444]" onClick={handleClearSelection}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear Selection
            </Button>
          </div>

          {/* Analyze Button */}
          <div className="p-4">
            <Button
              size="lg"
              variant="primary"
              className="w-full bg-[#10b981] hover:bg-[#059669] text-white"
              onClick={handleAnalyze}
              disabled={isAnalyzing || (!selectedPoint && (!selectedPolygon || selectedPolygon.length < 3))}
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-2 text-sm"><span className="animate-spin">⟳</span> {getLoadingMessage()}</span>
              ) : (
                <span className="flex items-center gap-2"><BarChart2 className="h-4 w-4" /> Analyze Area</span>
              )}
            </Button>
          </div>

          {/* Data Source Status */}
          <div className="mt-auto p-4 border-t border-[#e2e8f0] bg-[#f8fafc]">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Satellite className="h-3.5 w-3.5 text-[#64748b]" />
                <span className="text-xs text-[#64748b]">Data Source</span>
              </div>
              <p className="text-xs font-medium text-[#334155]">Google Earth Engine / Sentinel-2</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                <span className="text-xs text-[#64748b]">Feature-Derived / Demo Mode</span>
              </div>
              <p className="text-[10px] text-[#94a3b8]">Model: ExtraTrees · Training: 2018 + 2024</p>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748b]">Satellite Data:</span>
              <div className="flex items-center gap-1.5">
                {geeStatus === 'checking' && <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></span>}
                {geeStatus === 'connected' && <span className="h-2 w-2 rounded-full bg-green-500"></span>}
                {geeStatus === 'unavailable' && <span className="h-2 w-2 rounded-full bg-red-500"></span>}
                <span className={`text-xs font-bold ${geeStatus === 'connected' ? 'text-green-700' : geeStatus === 'unavailable' ? 'text-red-600' : 'text-yellow-600'}`}>
                  {geeStatus === 'checking' ? 'Checking...' : geeStatus === 'connected' ? 'Connected' : 'Unavailable'}
                </span>
              </div>
            </div>
            {pointResult || polygonResult ? (
              <div className="mt-2 text-[10px] text-[#10b981] flex items-center justify-center bg-[#dcfce7] py-1 rounded">
                <Satellite className="h-3 w-3 mr-1" /> Analysis complete — Sentinel-2 imagery processed successfully.
              </div>
            ) : null}
          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative">
          <MapComponent
            center={[20.5937, 78.9629]}
            zoom={5}
            drawMode={drawMode}
            layerMode={layerMode}
            selectedPoint={selectedPoint}
            selectedPolygon={selectedPolygon}
            onPointSelected={handlePointSelected}
            onPolygonSelected={handlePolygonSelected}
          />
        </div>

        {/* Right Results Panel */}
        {(pointResult || polygonResult || errorMessage) && (
          <div className="w-96 bg-white border-l border-[#e2e8f0] flex flex-col overflow-y-auto flex-shrink-0">
            {/* Error State */}
            {errorMessage && (
              <div className="p-4">
                <div className="p-4 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-[#ef4444] flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-[#991b1b]">Analysis Unavailable</h4>
                      <p className="text-sm text-[#b91c1c] mt-1">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Point Result */}
            {pointResult && (
              <div className="divide-y divide-[#e2e8f0]">
                {/* Header */}
                <div className="p-4 bg-[#f8fafc]">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-[#10b981]" />
                    <h3 className="text-sm font-bold text-[#0f172a]">Location Result</h3>
                  </div>
                  {isInferenceYear && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#fffbeb] border border-[#fde68a] rounded text-xs text-[#92400e]">
                      <AlertTriangle className="h-3 w-3" />
                      Inference-only year — no validated accuracy
                    </div>
                  )}
                </div>

                {/* Coordinates */}
                <div className="p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Location</h4>
                  <p className="text-sm text-[#334155]">
                    {pointResult.latitude.toFixed(4)}° N, {pointResult.longitude.toFixed(4)}° E
                  </p>
                </div>

                {/* Year */}
                <div className="p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Selected Year</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-[#0f172a]">{pointResult.year}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      pointResult.year_status === 'validated_year'
                        ? 'bg-[#dcfce7] text-[#166534]'
                        : 'bg-[#fef9c3] text-[#854d0e]'
                    }`}>
                      {pointResult.year_status === 'validated_year' ? 'Validated' : 'Inference Only'}
                    </span>
                  </div>
                </div>

                {/* Predicted Class */}
                <div className="p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Predicted Land Cover</h4>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: CLASS_COLORS[pointResult.prediction] || '#94a3b8' }}
                    />
                    <span className="text-xl font-bold text-[#0f172a]">{pointResult.prediction}</span>
                  </div>
                </div>

                {/* Confidence */}
                <div className="p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Class Probability (Not Overall Accuracy)</h4>
                  {pointResult.confidence > 0 ? (
                    <>
                      <p className="text-xl font-bold text-[#0f172a]">{(pointResult.confidence * 100).toFixed(1)}%</p>
                      <div className="w-full bg-[#e2e8f0] rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${pointResult.confidence * 100}%`,
                            backgroundColor: pointResult.confidence > 0.7 ? '#10b981' : pointResult.confidence > 0.4 ? '#f59e0b' : '#ef4444'
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[#94a3b8] italic">Confidence unavailable</p>
                  )}
                </div>

                {/* Class Probabilities */}
                {pointResult.probabilities && (
                  <div className="p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Class Probabilities</h4>
                    {Object.entries(pointResult.probabilities).map(([cls, prob]) => (
                      <div key={cls} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CLASS_COLORS[cls] || '#94a3b8' }} />
                        <span className="text-xs text-[#334155] flex-1">{cls}</span>
                        <span className="text-xs font-mono text-[#0f172a]">{((prob as number) * 100).toFixed(1)}%</span>
                        <div className="w-20 bg-[#f1f5f9] rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${(prob as number) * 100}%`, backgroundColor: CLASS_COLORS[cls] || '#94a3b8' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Feature Summary */}
                {pointResult.features && (
                  <div className="p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Feature Summary (Top Indices)</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {['NDVI', 'MNDWI', 'NDBI', 'BSI', 'SAVI', 'EVI'].map(feat => (
                        pointResult.features![feat] !== undefined && (
                          <div key={feat} className="flex justify-between items-center bg-[#f8fafc] p-2 rounded border border-[#e2e8f0]">
                            <span className="text-xs font-semibold text-[#334155]">{feat}</span>
                            <span className="text-xs font-mono text-[#0f172a]">{pointResult.features![feat].toFixed(4)}</span>
                          </div>
                        )
                      ))}
                    </div>
                    <details className="text-xs text-[#64748b]">
                      <summary className="cursor-pointer hover:text-[#3b82f6]">View all 26 features</summary>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 bg-[#f8fafc] p-2 rounded border border-[#e2e8f0] max-h-40 overflow-y-auto">
                        {Object.entries(pointResult.features).map(([key, val]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-[10px] text-[#475569] truncate" title={key}>{key}</span>
                            <span className="text-[10px] font-mono">{val.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}

                {/* Actions */}
                <div className="p-4 flex flex-col gap-2">
                  <Button variant="outline" className="w-full text-sm" onClick={() => router.push(`/compare?lat=${pointResult.latitude}&lon=${pointResult.longitude}`)}>
                    <GitCompare className="h-4 w-4 mr-2" /> Compare Years
                  </Button>
                  <Button variant="outline" className="w-full text-sm" onClick={() => setLayerMode('satellite')}>
                    <ImageIcon className="h-4 w-4 mr-2" /> View Satellite Imagery
                  </Button>
                </div>
              </div>
            )}

            {/* Polygon Result */}
            {polygonResult && (
              <div className="divide-y divide-[#e2e8f0]">
                <div className="p-4 bg-[#f8fafc]">
                  <div className="flex items-center gap-2 mb-2">
                    <Pentagon className="h-4 w-4 text-[#10b981]" />
                    <h3 className="text-sm font-bold text-[#0f172a]">Polygon Analysis</h3>
                  </div>
                  {isInferenceYear && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#fffbeb] border border-[#fde68a] rounded text-xs text-[#92400e]">
                      <AlertTriangle className="h-3 w-3" />
                      Inference-only year — no validated accuracy
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Analysis Info</h4>
                  <p className="text-sm text-[#334155]">
                    Year: <span className="font-bold">{polygonResult.year}</span> · 
                    Samples: <span className="font-bold">{polygonResult.samples_analyzed}</span>
                  </p>
                </div>

                <div className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Land Cover Distribution</h4>
                  {Object.entries(polygonResult.distribution).map(([cls, data]) => (
                    <div key={cls} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLASS_COLORS[cls] || '#94a3b8' }} />
                          <span className="text-sm text-[#334155]">{cls}</span>
                        </div>
                        <span className="text-sm font-bold text-[#0f172a]">
                          {data.regional_landcover_percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-[#f1f5f9] rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${data.regional_landcover_percentage}%`, backgroundColor: CLASS_COLORS[cls] || '#94a3b8' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dominant Class */}
                <div className="p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Dominant Class</h4>
                  {(() => {
                    const sorted = Object.entries(polygonResult.distribution).sort(
                      (a, b) => b[1].regional_landcover_percentage - a[1].regional_landcover_percentage
                    );
                    const top = sorted[0];
                    return top ? (
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: CLASS_COLORS[top[0]] || '#94a3b8' }} />
                        <span className="text-lg font-bold text-[#0f172a]">{top[0]}</span>
                        <span className="text-sm text-[#64748b]">({top[1].regional_landcover_percentage}%)</span>
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Actions */}
                <div className="p-4 flex flex-col gap-2">
                  <Button variant="outline" className="w-full text-sm" onClick={() => router.push(`/compare?polygon=${encodeURIComponent(JSON.stringify(selectedPolygon))}`)}>
                    <GitCompare className="h-4 w-4 mr-2" /> Compare Years
                  </Button>
                  <Button variant="outline" className="w-full text-sm">
                    <ImageIcon className="h-4 w-4 mr-2" /> View Satellite Imagery
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
