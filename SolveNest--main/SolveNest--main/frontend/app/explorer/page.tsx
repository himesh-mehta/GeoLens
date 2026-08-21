"use client";

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Search, MapPin, Layers, Crosshair, Pentagon,
  Trash2, BarChart2, AlertTriangle, Satellite, Info, ChevronDown,
  GitCompare, Image as ImageIcon, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackendAPI } from '@/lib/api-client';
import { areasService } from '@/services/areas-service';
import { AIAnalysisModal } from '@/components/analysis/ai-analysis-modal';

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
  date_range: string;
  latitude: number;
  longitude: number;
  features?: Record<string, number>;
}

interface PolygonResult {
  samples_analyzed: number;
  date_range: string;
  distribution: Record<string, { sample_count: number; regional_landcover_percentage: number }>;
  year_status: string;
  validated_accuracy_available: boolean;
}



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
    const [startDate, setStartDate] = useState('01/01/2024');
  const [endDate, setEndDate] = useState('31/12/2024');
  const [cloudThreshold, setCloudThreshold] = useState(20);
    const [locationName, setLocationName] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const lat = params.get('lat');
      const lon = params.get('lon');
      const name = params.get('name');
      const autoAnalyze = params.get('auto_analyze');

      if (lat && lon) {
        const latF = parseFloat(lat);
        const lonF = parseFloat(lon);
        if (!isNaN(latF) && !isNaN(lonF)) {
          setSelectedPoint([latF, lonF]);
          setLatInput(lat);
          setLonInput(lon);
          if (name) setLocationName(name);
          
          if (autoAnalyze === 'true') {
             setTimeout(() => {
               document.getElementById('analyze-btn')?.click();
             }, 1000);
          }
        }
      }
    }
  }, []);

  const handleSaveArea = () => {
    if (!selectedPoint || !pointResult) return;
    
    // Safely extract spectral indices directly from the backend's `features` dictionary if available
    // Do not generate or fabricate these values
    let ndvi: string | number = "Not available — required spectral bands unavailable.";
    let ndwi: string | number = "Not available — required spectral bands unavailable.";
    let ndbi: string | number = "Not available — required spectral bands unavailable.";
    
    if (pointResult.features) {
      if (typeof pointResult.features.NDVI === 'number') ndvi = pointResult.features.NDVI;
      if (typeof pointResult.features.NDWI === 'number') ndwi = pointResult.features.NDWI;
      if (typeof pointResult.features.NDBI === 'number') ndbi = pointResult.features.NDBI;
    }

    const savedArea = {
      id: `area-${Date.now()}`,
      name: locationName || `Area (${selectedPoint[0].toFixed(4)}, ${selectedPoint[1].toFixed(4)})`,
      latitude: selectedPoint[0],
      longitude: selectedPoint[1],
      createdAt: new Date().toISOString(),
      lastAnalyzedDate: new Date().toISOString(),
      latestAnalysis: {
        verification: pointResult.year_status === 'validated_year' ? 'Verified Satellite Data' : 'Visual Analysis / Fallback',
        predClass: pointResult.prediction,
        confidence: pointResult.confidence,
        ndvi,
        ndwi,
        ndbi
      }
    };
    
    areasService.saveArea(savedArea as any);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };
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
  const [showAI, setShowAI] = useState(false);

  React.useEffect(() => {
    BackendAPI.getHealthGee().then((res: any) => {
      if (res && res.authenticated) {
        setGeeStatus('connected');
      } else {
        setGeeStatus('unavailable');
      }
    }).catch(() => setGeeStatus('unavailable'));
  }, []);

  
  const handlePointSelected = useCallback((lat: number, lon: number) => {
    setSelectedPoint([lat, lon]);
    setSelectedPolygon(null);
    setLatInput(lat.toFixed(6));
    setLonInput(lon.toFixed(6));
    setPointResult(null);
    setPolygonResult(null);
    setErrorMessage(null);
    setShowAI(false);
  }, []);

  const handlePolygonSelected = useCallback((coords: [number, number][]) => {
    setSelectedPolygon(coords);
    setSelectedPoint(null);
    setPointResult(null);
    setPolygonResult(null);
    setErrorMessage(null);
    setShowAI(false);
  }, []);

  const handleClearSelection = () => {
    setSelectedPoint(null);
    setSelectedPolygon(null);
    setLatInput('');
    setLonInput('');
    setPointResult(null);
    setPolygonResult(null);
    setErrorMessage(null);
    setShowAI(false);
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

  const parseDate = (d: string) => {
    const parts = d.split('/');
    if(parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return d;
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setLoadingStep(1); // 1: Fetching Sentinel-2 imagery...
    setErrorMessage(null);
    setPointResult(null);
    setPolygonResult(null);
    setShowAI(false);

    // Simulate step 2 and 3 for UI feedback (since backend call is blocking)
    const step2Timer = setTimeout(() => setLoadingStep(2), 1500); // Computing spectral features
    const step3Timer = setTimeout(() => setLoadingStep(3), 3000); // Running land-cover model

    try {
      if (selectedPoint) {
        const res = await BackendAPI.predictLocation(selectedPoint[0], selectedPoint[1], undefined as any, parseDate(startDate), parseDate(endDate), cloudThreshold) as any;
        if (!res || res.status === 'error') {
          setErrorMessage(res?.message || 'Prediction failed. The backend may be unavailable.');
        } else {
          // Map the nested backend response to the flat PredictionResult interface
          const mappedRes: PredictionResult = {
            prediction: res.point.prediction,
            confidence: res.point.confidence,
            probabilities: res.point.probabilities,
            features: res.point.features,
            latitude: res.location.latitude,
            longitude: res.location.longitude,
            date_range: `${startDate} - ${endDate}`,
            year_status: res.is_fallback ? 'inference_only' : 'validated_year',
            validated_accuracy_available: !res.is_fallback
          };
          setPointResult(mappedRes);
          areasService.addHistoryItem({
            areaId: `custom-${selectedPoint[0].toFixed(4)}-${selectedPoint[1].toFixed(4)}`,
            areaName: `Point: ${selectedPoint[0].toFixed(4)}, ${selectedPoint[1].toFixed(4)}`,
            type: 'analysis',
            date: `${startDate}-${endDate}`,
            status: 'completed',
          });
        }
      } else if (selectedPolygon && selectedPolygon.length >= 3) {
        // Convert [lat,lon] to [lon,lat] for GeoJSON
        const geoCoords = selectedPolygon.map(c => [c[1], c[0]]);
        geoCoords.push(geoCoords[0]); // close polygon
        const res = await BackendAPI.predictPolygon(geoCoords, undefined as any, parseDate(startDate), parseDate(endDate), cloudThreshold) as any;
        if (!res || res.status === 'error') {
          setErrorMessage(res?.message || 'Polygon analysis failed. The backend may be unavailable.');
        } else {
          // Map the nested backend response to the flat PolygonResult interface
          const mappedPolyRes: PolygonResult = {
            samples_analyzed: res.samples_analyzed,
            distribution: res.aoi_statistics?.distribution || {},
            date_range: `${startDate} - ${endDate}`,
            year_status: res.is_fallback ? 'inference_only' : 'validated_year',
            validated_accuracy_available: !res.is_fallback
          };
          setPolygonResult(mappedPolyRes);
          areasService.addHistoryItem({
            areaId: `polygon-${Date.now()}`,
            areaName: `Polygon Area Analysis`,
            type: 'analysis',
            date: `${startDate} - ${endDate}`,
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

          {/* Date Range Selector */}
          <div className="p-4 space-y-3 border-b border-[#e2e8f0]">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Analysis Period</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">Start Date (DD/MM/YYYY)</label>
                  <input
                    type="text"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    placeholder="01/01/2024"
                    className="w-full px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-md focus:ring-2 focus:ring-[#10b981] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] mb-1 block">End Date (DD/MM/YYYY)</label>
                  <input
                    type="text"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    placeholder="31/12/2024"
                    className="w-full px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-md focus:ring-2 focus:ring-[#10b981] outline-none"
                  />
                </div>
            </div>
            
            <div>
               <label className="text-xs text-[#64748b] mb-1 block">Presets</label>
               <div className="flex flex-wrap gap-1">
                   <button onClick={() => { setStartDate('01/01/2024'); setEndDate('31/12/2024'); }} className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded">2024</button>
                   <button onClick={() => { setStartDate('01/01/2020'); setEndDate('31/12/2020'); }} className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded">2020</button>
                   <button onClick={() => { setStartDate('01/01/2018'); setEndDate('31/12/2018'); }} className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded">2018</button>
                   <button onClick={() => { 
                       const today = new Date();
                       const past = new Date(); past.setDate(today.getDate() - 30);
                       const d = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                       setStartDate(d(past)); setEndDate(d(today));
                   }} className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded">Last 30 Days</button>
               </div>
            </div>

            <div className="mt-2">
                <label className="text-xs text-[#64748b] mb-1 flex items-center justify-between">
                    <span>Cloud Threshold (Max %): {cloudThreshold}%</span>
                </label>
                <input 
                    type="range" 
                    min="0" max="100" 
                    value={cloudThreshold} 
                    onChange={e => setCloudThreshold(parseInt(e.target.value))}
                    className="w-full"
                />
            </div>

            
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
                  {pointResult.year_status === 'inference_only' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#fffbeb] border border-[#fde68a] rounded text-xs text-[#92400e]">
                      <AlertTriangle className="h-3 w-3" />
                      Inference-only period — no validated accuracy
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
                  <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Analysis Period</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-[#0f172a]">{pointResult.date_range}</span>
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
                  <Button className="w-full text-sm bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowAI(true)}>
                    <Sparkles className="h-4 w-4 mr-2" /> Analyze Result with AI
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleSaveArea}
                    disabled={saveSuccess}
                  >
                    {saveSuccess ? '✓ Saved to My Areas' : 'Save to My Areas'}
                  </Button>

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
                  {polygonResult.year_status === 'inference_only' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#fffbeb] border border-[#fde68a] rounded text-xs text-[#92400e]">
                      <AlertTriangle className="h-3 w-3" />
                      Inference-only period — no validated accuracy
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Analysis Info</h4>
                  <p className="text-sm text-[#334155]">
                    Period: <span className="font-bold">{polygonResult.date_range}</span> · 
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
                  <Button className="w-full text-sm bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowAI(true)}>
                    <Sparkles className="h-4 w-4 mr-2" /> Analyze Result with AI
                  </Button>
                  <Button variant="outline" className="w-full text-sm" onClick={() => router.push(`/compare?polygon=${encodeURIComponent(JSON.stringify(selectedPolygon))}`)}>
                    <GitCompare className="h-4 w-4 mr-2" /> Compare Years
                  </Button>
                  <Button variant="outline" className="w-full text-sm" onClick={() => setLayerMode('satellite')}>
                    <ImageIcon className="h-4 w-4 mr-2" /> View Satellite Imagery
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AIAnalysisModal 
        isOpen={showAI} 
        onClose={() => setShowAI(false)} 
        analysisResult={pointResult || polygonResult} 
      />

    </div>
  );
}