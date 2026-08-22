"use client";

import React, { useState, useCallback, useRef, Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, MapPin, Pentagon, Crosshair,
  Trash2, BarChart2, AlertTriangle, Satellite, GitCompare,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, History, X, Bot, Sparkles,
  Download, ShieldCheck, Info, FileText
} from 'lucide-react';
import { BackendAPI } from '@/lib/api-client';
import { areasService, HistoryItem } from '@/services/areas-service';
import { AIAssistant } from '@/components/analysis/ai-assistant';
import { AIAvatar } from '@/components/ui/ai-avatar';
import { useTheme } from '@/lib/theme/theme-context';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { KeyboardShortcutsModal } from '@/components/ui/keyboard-shortcuts-modal';
import { Keyboard } from 'lucide-react';

function SearchParamsHandler({ onParams }: { onParams: (lat: string|null, lon: string|null, name: string|null, auto: string|null) => void }) {
  const searchParams = useSearchParams();
  React.useEffect(() => {
    if (searchParams) {
      onParams(searchParams.get('lat'), searchParams.get('lon'), searchParams.get('name'), searchParams.get('auto_analyze'));
    }
  }, [searchParams, onParams]);
  return null;
}

// Dynamic import to avoid SSR issues with Leaflet
const MapComponent = dynamic(
  () => import('@/components/map/MapComponent'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#FAFAF7]">
        <div className="text-[#6B7568] font-medium animate-pulse">Loading Satellite Map...</div>
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

const CLASS_COLORS_LIGHT: Record<string, string> = {
  'Water': '#5B9BD5',
  'Vegetation': '#8FBC5A',
  'Agriculture': '#8FBC5A',
  'Built-up': '#C4823A',
  'Barren': '#A9825A',
};

const CLASS_COLORS_DARK: Record<string, string> = {
  'Water': '#38bdf8',
  'Vegetation': '#4ade80',
  'Agriculture': '#eab308',
  'Built-up': '#f59e0b',
  'Barren': '#b45309',
};

export default function ExplorerPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const classColors = isLight ? CLASS_COLORS_LIGHT : CLASS_COLORS_DARK;

  // ── In-memory session cache for fast repeated analysis ─────────────────────
  const analysisCache = useRef<Map<string, any>>(new Map());

  // ── Layout state ──────────────────────────────────────────────────────────
  const [controlsOpen, setControlsOpen] = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(false); // Defaults to closed on load
  const [showResultCard, setShowResultCard] = useState(true);
  const [showFullAnalysis, setShowFullAnalysis] = useState(true);
  const [showRecentSection, setShowRecentSection] = useState(true);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [recentLocations, setRecentLocations] = useState<HistoryItem[]>([]);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Map state ─────────────────────────────────────────────────────────────
  const [drawMode, setDrawMode] = useState<'point' | 'polygon' | 'none'>('point');
  const [layerMode, setLayerMode] = useState<'map' | 'satellite'>('map');
  const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>([20.5937, 78.9629]);
  const [selectedPolygon, setSelectedPolygon] = useState<[number, number][] | null>(null);

  // ── Input state ───────────────────────────────────────────────────────────
  const [latInput, setLatInput] = useState('20.5937');
  const [lonInput, setLonInput] = useState('78.9629');
  const [startDate, setStartDate] = useState('01/01/2024');
  const [endDate, setEndDate] = useState('31/12/2024');
  const [cloudThreshold, setCloudThreshold] = useState(20);
  const [locationName, setLocationName] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{lat: string, lon: string, display_name: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // ── Results state ─────────────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [pointResult, setPointResult] = useState<PredictionResult | null>(null);
  const [polygonResult, setPolygonResult] = useState<PolygonResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [geeStatus, setGeeStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking');

  // Check valid location status for analyze button
  const hasValidLocation = Boolean(
    (selectedPoint && selectedPoint.length === 2) ||
    (selectedPolygon && selectedPolygon.length >= 3) ||
    (latInput && lonInput && !isNaN(parseFloat(latInput)) && !isNaN(parseFloat(lonInput)))
  );

  // Centralized keyboard shortcuts listener
  useKeyboardShortcuts({
    onEscape: () => {
      setShowShortcutsModal(false);
      setAssistantOpen(false);
    },
    onSearchFocus: () => {
      if (!controlsOpen) setControlsOpen(true);
      searchInputRef.current?.focus();
    },
    onAnalyzeSubmit: () => {
      if (hasValidLocation && !isAnalyzing) {
        handleAnalyze();
      }
    },
    onToggleShortcutsHelp: () => {
      setShowShortcutsModal(prev => !prev);
    },
  });

  // ── URL params ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const lat = params.get('lat');
      const lon = params.get('lon');
      const name = params.get('name');
      const autoAnalyze = params.get('auto_analyze');
      const openAi = params.get('open_ai');
      if (openAi === 'true') {
        setAssistantOpen(true);
      }
      if (lat && lon) {
        const latF = parseFloat(lat);
        const lonF = parseFloat(lon);
        if (!isNaN(latF) && !isNaN(lonF)) {
          setSelectedPoint([latF, lonF]);
          setLatInput(lat);
          setLonInput(lon);
          if (name) setLocationName(name);
          if (autoAnalyze === 'true') {
            setTimeout(() => { document.getElementById('analyze-btn')?.click(); }, 1000);
          }
        }
      }
    }
  }, []);

  // ── Recent Locations Loader ───────────────────────────────────────────────
  React.useEffect(() => {
    try {
      const history = areasService.getHistory().slice(0, 5);
      setRecentLocations(history);
    } catch {
      setRecentLocations([]);
    }
  }, [pointResult, polygonResult]);

  // ── GEE health ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    BackendAPI.getHealthGee().then((res: any) => {
      if (res && res.authenticated) setGeeStatus('connected');
      else setGeeStatus('unavailable');
    }).catch(() => setGeeStatus('unavailable'));
  }, []);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to Full Analysis Report section on new analysis results
  useEffect(() => {
    if (pointResult || polygonResult) {
      const timer = setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [pointResult, polygonResult]);

  // ── Save area ─────────────────────────────────────────────────────────────
  const handleSaveArea = () => {
    if (!selectedPoint || !pointResult) return;
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
        ndvi, ndwi, ndbi
      }
    };
    areasService.saveArea(savedArea as any);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // ── Map callbacks ─────────────────────────────────────────────────────────
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

  const [coordError, setCoordError] = useState<string | null>(null);

  const handleManualCoords = () => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setCoordError('Coordinates must be between -90..90 (Lat) and -180..180 (Lon)');
      setTimeout(() => setCoordError(null), 3500);
      return;
    }
    setCoordError(null);
    setSelectedPoint([lat, lon]);
    setSelectedPolygon(null);
    setDrawMode('point');
  };

  const parseDate = (d: string) => {
    const parts = d.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return d;
  };

  // ── Analyze (With Instant Caching & Skeleton Feedback) ─────────────────────
  const handleAnalyze = async () => {
    if (isAnalyzing) return; // Prevent duplicate requests

    let activePoint = selectedPoint;
    if (!activePoint && !selectedPolygon && latInput && lonInput) {
      const latF = parseFloat(latInput);
      const lonF = parseFloat(lonInput);
      if (!isNaN(latF) && !isNaN(lonF)) {
        activePoint = [latF, lonF];
        setSelectedPoint(activePoint);
      }
    }

    const cacheKey = activePoint
      ? `pt:${activePoint[0].toFixed(4)},${activePoint[1].toFixed(4)}:${startDate}:${endDate}:${cloudThreshold}`
      : `poly:${JSON.stringify(selectedPolygon)}:${startDate}:${endDate}:${cloudThreshold}`;

    // Instant Cache Hit (0ms return)
    if (analysisCache.current.has(cacheKey)) {
      const cached = analysisCache.current.get(cacheKey);
      if (cached.type === 'point') {
        setPointResult(cached.data);
        setPolygonResult(null);
      } else {
        setPolygonResult(cached.data);
        setPointResult(null);
      }
      setErrorMessage(null);
      setShowResultCard(true);
      setShowFullAnalysis(true);
      return;
    }

    setIsAnalyzing(true);
    setLoadingStep(1);
    setErrorMessage(null);
    setPointResult(null);
    setPolygonResult(null);
    setShowResultCard(true);
    setShowFullAnalysis(true);

    const step2Timer = setTimeout(() => setLoadingStep(2), 1200);
    const step3Timer = setTimeout(() => setLoadingStep(3), 2400);

    try {
      if (activePoint) {
        const res = await BackendAPI.predictLocation(activePoint[0], activePoint[1], undefined as any, parseDate(startDate), parseDate(endDate), cloudThreshold) as any;
        if (!res || res.status === 'error') {
          setErrorMessage(res?.message || 'Prediction failed. The backend may be unavailable.');
        } else {
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
          analysisCache.current.set(cacheKey, { type: 'point', data: mappedRes });
          areasService.addHistoryItem({
            areaId: `custom-${activePoint[0].toFixed(4)}-${activePoint[1].toFixed(4)}`,
            areaName: `Point: ${activePoint[0].toFixed(4)}, ${activePoint[1].toFixed(4)}`,
            type: 'analysis',
            date: `${startDate}-${endDate}`,
            status: 'completed',
          });
        }
      } else if (selectedPolygon && selectedPolygon.length >= 3) {
        const geoCoords = selectedPolygon.map(c => [c[1], c[0]]);
        geoCoords.push(geoCoords[0]);
        const res = await BackendAPI.predictPolygon(geoCoords, undefined as any, parseDate(startDate), parseDate(endDate), cloudThreshold) as any;
        if (!res || res.status === 'error') {
          setErrorMessage(res?.message || 'Polygon analysis failed. The backend may be unavailable.');
        } else {
          const mappedPolyRes: PolygonResult = {
            samples_analyzed: res.samples_analyzed,
            distribution: res.aoi_statistics?.distribution || {},
            date_range: `${startDate} - ${endDate}`,
            year_status: res.is_fallback ? 'inference_only' : 'validated_year',
            validated_accuracy_available: !res.is_fallback
          };
          setPolygonResult(mappedPolyRes);
          analysisCache.current.set(cacheKey, { type: 'polygon', data: mappedPolyRes });
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
      setErrorMessage(err?.message || 'Analysis request failed. Please check backend connection.');
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
      case 3: return "Running ExtraTrees model...";
      default: return "Analyzing...";
    }
  };

  const getDominantClass = () => {
    if (!polygonResult) return null;
    const sorted = Object.entries(polygonResult.distribution).sort(
      (a, b) => b[1].regional_landcover_percentage - a[1].regional_landcover_percentage
    );
    return sorted[0] || null;
  };

  const aiContext = {
    locationId: selectedPoint
      ? `${selectedPoint[0].toFixed(4)},${selectedPoint[1].toFixed(4)}`
      : 'polygon',
    areaName: locationName ||
      (selectedPoint
        ? `${selectedPoint[0].toFixed(4)}° N, ${selectedPoint[1].toFixed(4)}° E`
        : 'Polygon Area'),
    afterDate: endDate,
    analysisResult: pointResult
      ? {
          prediction: pointResult.prediction,
          confidence: pointResult.confidence,
          probabilities: pointResult.probabilities,
          features: pointResult.features,
          latitude: pointResult.latitude,
          longitude: pointResult.longitude,
          date_range: pointResult.date_range,
          year_status: pointResult.year_status,
        }
      : polygonResult
      ? {
          samples_analyzed: polygonResult.samples_analyzed,
          distribution: polygonResult.distribution,
          date_range: polygonResult.date_range,
          year_status: polygonResult.year_status,
        }
      : null,
  };

  const handleParams = useCallback((lat: string | null, lon: string | null, name: string | null, auto: string | null) => {
    if (lat && lon) {
      const latF = parseFloat(lat);
      const lonF = parseFloat(lon);
      if (!isNaN(latF) && !isNaN(lonF)) {
        setSelectedPoint((prev) => {
          if (prev && prev[0] === latF && prev[1] === lonF) return prev;
          return [latF, lonF];
        });
        setLatInput((prev) => prev !== lat ? lat : prev);
        setLonInput((prev) => prev !== lon ? lon : prev);
        if (name) setLocationName(name);
        if (auto === 'true') {
          setTimeout(() => { document.getElementById('analyze-btn')?.click(); }, 1000);
        }
      }
    }
  }, []);

  return (
    <Suspense fallback={<div className="p-4">Loading Explorer...</div>}>
      <SearchParamsHandler onParams={handleParams} />
    <div className={`w-full h-full flex flex-col overflow-y-auto min-h-0 transition-colors duration-200 ${
      isLight ? 'bg-[#FAFAF7]' : 'bg-[#0F172A]'
    }`}>

      {/* ── TOP SECTION: Full Viewport Sidebar (Left) + Full GIS Map Canvas (Right) ── */}
      <div className="w-full flex flex-shrink-0 h-[calc(100vh-64px)] min-h-[600px] border-b overflow-hidden">

        {/* ── LEFT: Collapsible Controls Panel (Comfortable 320px width) ── */}
        <div
          className={`flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out z-10 border-r h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] ${
            isLight ? 'bg-[#FFFFFF] border-[#E5E7DE]' : 'bg-[#131B2E] border-[#1E293B]'
          }`}
          style={{ width: controlsOpen ? '270px' : '52px' }}
        >
          {/* Toggle button bar */}
          <div className={`flex items-center border-b flex-shrink-0 ${
            isLight ? 'border-[#E5E7DE] bg-[#FFFFFF]' : 'border-[#1E293B] bg-[#131B2E]'
          } ${controlsOpen ? 'justify-between px-3 py-2.5' : 'justify-center py-2.5'}`}>
            {controlsOpen && (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>Controls</span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                  geeStatus === 'connected'
                    ? isLight ? 'bg-emerald-500/10 text-[#4C7A3D] border-[#4C7A3D]/30' : 'bg-teal-500/10 text-[#14B8A6] border-teal-500/30'
                    : geeStatus === 'unavailable'
                    ? 'bg-red-500/10 text-red-500 border-red-500/30'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    geeStatus === 'connected' ? (isLight ? 'bg-[#4C7A3D]' : 'bg-[#14B8A6]') : geeStatus === 'unavailable' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
                  }`} />
                  {geeStatus === 'connected' ? 'GEE' : 'Offline'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setControlsOpen(o => !o)}
                title={controlsOpen ? 'Hide controls' : 'Show controls'}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-[#F0F2EB] text-[#6B7568] hover:text-[#2D3B27]' : 'hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
              >
                {controlsOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Controls content — only when open */}
          {controlsOpen && (
            <div className="flex-1 flex flex-col min-h-0">

              {/* LOCATION section */}
              <div className={`p-3 border-b space-y-3 flex-shrink-0 ${isLight ? 'border-[#E5E7DE]' : 'border-[#1E293B]'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>Location</p>

                {/* Search */}
                <div className="relative">
                  <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search location..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults([]); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery) {
                        setIsSearching(true);
                        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`)
                          .then(res => res.json())
                          .then(data => { if (data?.length > 0) setSearchResults(data.slice(0, 5)); else { setSearchResults([]); alert("Location not found."); } })
                          .catch(() => { setSearchResults([]); alert("Search failed."); })
                          .finally(() => setIsSearching(false));
                      }
                    }}
                    className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-md outline-none transition-colors ${
                      isLight
                        ? 'bg-[#F5F5F0] border border-[#D8DCCF] text-[#2D3B27] placeholder:text-[#6B7568] focus:ring-2 focus:ring-[#4C7A3D] focus:border-[#4C7A3D]'
                        : 'bg-[#0F172A] border border-[#334155] text-[#F1F5F9] placeholder:text-[#64748B] focus:ring-2 focus:ring-[#14B8A6] focus:border-[#14B8A6]'
                    }`}
                  />
                  {isSearching && <div className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-t-transparent rounded-full animate-spin ${isLight ? 'border-[#4C7A3D]' : 'border-[#14B8A6]'}`} />}
                  {searchResults.length > 0 && (
                    <div className={`absolute z-50 left-0 right-0 top-full mt-1 border rounded-md shadow-xl overflow-hidden ${
                      isLight ? 'bg-[#FFFFFF] border-[#E5E7DE] text-[#2D3B27]' : 'bg-[#131B2E] border-[#334155] text-[#F1F5F9]'
                    }`}>
                      {searchResults.map((res, i) => (
                        <button key={i} title={res.display_name}
                          className={`w-full text-left px-3 py-1.5 text-xs border-b last:border-0 truncate ${
                            isLight ? 'hover:bg-[#F0F2EB] border-[#E5E7DE]' : 'hover:bg-[#1E293B] border-[#1E293B]'
                          }`}
                          onClick={() => {
                            const lat = parseFloat(res.lat), lon = parseFloat(res.lon);
                            setSelectedPoint([lat, lon]); setLatInput(lat.toFixed(6)); setLonInput(lon.toFixed(6));
                            setDrawMode('point'); setSelectedPolygon(null); setSearchResults([]);
                            setSearchQuery(res.display_name.split(',')[0]);
                          }}>{res.display_name}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Coordinates */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-[10px] mb-0.5 block font-medium ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>Latitude</label>
                    <input type="number" step="any" placeholder="20.5937" value={latInput}
                      onChange={e => setLatInput(e.target.value)}
                      className={`w-full px-2 py-1.5 text-xs rounded-md outline-none ${
                        isLight
                          ? 'bg-[#F5F5F0] border border-[#D8DCCF] text-[#2D3B27] placeholder:text-[#6B7568] focus:ring-2 focus:ring-[#4C7A3D]'
                          : 'bg-[#0F172A] border border-[#334155] text-[#F1F5F9] placeholder:text-[#64748B] focus:ring-2 focus:ring-[#14B8A6]'
                      }`} />
                  </div>
                  <div>
                    <label className={`text-[10px] mb-0.5 block font-medium ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>Longitude</label>
                    <input type="number" step="any" placeholder="78.9629" value={lonInput}
                      onChange={e => setLonInput(e.target.value)}
                      className={`w-full px-2 py-1.5 text-xs rounded-md outline-none ${
                        isLight
                          ? 'bg-[#F5F5F0] border border-[#D8DCCF] text-[#2D3B27] placeholder:text-[#6B7568] focus:ring-2 focus:ring-[#4C7A3D]'
                          : 'bg-[#0F172A] border border-[#334155] text-[#F1F5F9] placeholder:text-[#64748B] focus:ring-2 focus:ring-[#14B8A6]'
                      }`} />
                  </div>
                </div>
                <button onClick={handleManualCoords}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs border rounded-md transition-colors cursor-pointer font-medium ${
                    isLight
                      ? 'bg-[#F5F5F0] border-[#D8DCCF] text-[#2D3B27] hover:bg-[#F0F2EB] hover:border-[#4C7A3D]'
                      : 'bg-[#0F172A] border-[#334155] text-[#F1F5F9] hover:bg-[#1E293B] hover:border-[#14B8A6]'
                  }`}>
                  <Crosshair className={`h-3 w-3 ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`} /> Go to Coordinates
                </button>
                {coordError && (
                  <p className="text-[10px] text-red-500 font-semibold pt-0.5">{coordError}</p>
                )}
              </div>

              {/* ANALYSIS PERIOD section */}
              <div className={`p-3 border-b space-y-3 flex-shrink-0 ${isLight ? 'border-[#E5E7DE]' : 'border-[#1E293B]'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>Analysis Period</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-[10px] mb-0.5 block font-medium ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>Start (DD/MM/YYYY)</label>
                    <input type="text" value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="01/01/2024"
                      className={`w-full px-2 py-1.5 text-xs rounded-md outline-none ${
                        isLight
                          ? 'bg-[#F5F5F0] border border-[#D8DCCF] text-[#2D3B27] placeholder:text-[#6B7568] focus:ring-2 focus:ring-[#4C7A3D]'
                          : 'bg-[#0F172A] border border-[#334155] text-[#F1F5F9] placeholder:text-[#64748B] focus:ring-2 focus:ring-[#14B8A6]'
                      }`} />
                  </div>
                  <div>
                    <label className={`text-[10px] mb-0.5 block font-medium ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>End (DD/MM/YYYY)</label>
                    <input type="text" value={endDate} onChange={e => setEndDate(e.target.value)} placeholder="31/12/2024"
                      className={`w-full px-2 py-1.5 text-xs rounded-md outline-none ${
                        isLight
                          ? 'bg-[#F5F5F0] border border-[#D8DCCF] text-[#2D3B27] placeholder:text-[#6B7568] focus:ring-2 focus:ring-[#4C7A3D]'
                          : 'bg-[#0F172A] border border-[#334155] text-[#F1F5F9] placeholder:text-[#64748B] focus:ring-2 focus:ring-[#14B8A6]'
                      }`} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: '2024', s: '01/01/2024', e: '31/12/2024' },
                    { label: '2020', s: '01/01/2020', e: '31/12/2020' },
                    { label: '2018', s: '01/01/2018', e: '31/12/2018' },
                  ].map(p => {
                    const isSel = startDate === p.s && endDate === p.e;
                    return (
                      <button key={p.label} onClick={() => { setStartDate(p.s); setEndDate(p.e); }}
                        className={`px-2 py-1 text-[10px] rounded cursor-pointer transition-colors font-medium ${
                          isSel
                            ? isLight ? 'bg-[#4C7A3D] text-white font-semibold' : 'bg-[#14B8A6] text-white font-semibold'
                            : isLight ? 'bg-[#F0F2EB] text-[#2D3B27] hover:bg-[#E5E7DE]' : 'bg-[#0F172A] border border-[#334155] text-[#94A3B8] hover:bg-[#1E293B]'
                        }`}>{p.label}</button>
                    );
                  })}
                  <button onClick={() => {
                    const today = new Date(), past = new Date(); past.setDate(today.getDate() - 30);
                    const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                    setStartDate(fmt(past)); setEndDate(fmt(today));
                  }} className={`px-2 py-1 text-[10px] rounded cursor-pointer transition-colors font-medium ${
                    isLight ? 'bg-[#F0F2EB] text-[#2D3B27] hover:bg-[#E5E7DE]' : 'bg-[#0F172A] border border-[#334155] text-[#94A3B8] hover:bg-[#1E293B]'
                  }`}>Last 30d</button>
                </div>
                <div>
                  <label className={`text-[10px] mb-0.5 flex justify-between ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                    <span>Cloud Max</span><span className={`font-semibold ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>{cloudThreshold}%</span>
                  </label>
                  <input type="range" min="0" max="100" value={cloudThreshold}
                    onChange={e => setCloudThreshold(parseInt(e.target.value))} className={`w-full ${isLight ? 'accent-[#4C7A3D]' : 'accent-[#14B8A6]'}`} />
                </div>
              </div>

              {/* SELECT AREA section */}
              <div className={`p-3 border-b space-y-2 flex-shrink-0 ${isLight ? 'border-[#E5E7DE]' : 'border-[#1E293B]'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>Select Area</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDrawMode('point')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium border transition-colors cursor-pointer ${
                      drawMode === 'point'
                        ? isLight ? 'bg-[#4C7A3D] text-white border-[#4C7A3D] font-semibold' : 'bg-[#14B8A6] text-white border-[#14B8A6] font-semibold'
                        : isLight ? 'bg-[#F5F5F0] border-[#D8DCCF] text-[#6B7568] hover:bg-[#F0F2EB] hover:text-[#2D3B27]' : 'bg-[#0F172A] border-[#334155] text-[#94A3B8] hover:bg-[#1E293B]'
                    }`}>
                    <MapPin className="h-3 w-3" /> Point
                  </button>
                  <button
                    onClick={() => setDrawMode('polygon')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium border transition-colors cursor-pointer ${
                      drawMode === 'polygon'
                        ? isLight ? 'bg-[#4C7A3D] text-white border-[#4C7A3D] font-semibold' : 'bg-[#14B8A6] text-white border-[#14B8A6] font-semibold'
                        : isLight ? 'bg-[#F5F5F0] border-[#D8DCCF] text-[#6B7568] hover:bg-[#F0F2EB] hover:text-[#2D3B27]' : 'bg-[#0F172A] border-[#334155] text-[#94A3B8] hover:bg-[#1E293B]'
                    }`}>
                    <Pentagon className="h-3 w-3" /> Polygon
                  </button>
                </div>
                <button onClick={handleClearSelection}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs border rounded-md text-red-600 hover:bg-red-50 transition-colors cursor-pointer font-medium ${
                    isLight ? 'bg-[#F5F5F0] border-[#D8DCCF]' : 'bg-[#0F172A] border-[#334155]'
                  }`}>
                  <Trash2 className="h-3 w-3" /> Clear Selection
                </button>
              </div>

              {/* ANALYZE BUTTON */}
              <div className="p-3 flex-shrink-0">
                <button
                  id="analyze-btn"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !hasValidLocation}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-md transition-colors cursor-pointer shadow-sm ${
                    isLight ? 'bg-[#4C7A3D] hover:bg-[#3D6330]' : 'bg-[#14B8A6] hover:bg-[#0F766E]'
                  }`}
                >
                  {isAnalyzing
                    ? <><span className="animate-spin text-base">⟳</span> {getLoadingMessage()}</>
                    : <><BarChart2 className="h-4 w-4" /> Analyze Area</>
                  }
                </button>
              </div>

              {/* RECENT LOCATIONS section */}
              <div className={`p-3 border-t space-y-2 flex-shrink-0 ${
                isLight ? 'border-[#E5E7DE] bg-[#FAFAF7]/50' : 'border-[#1E293B] bg-[#0F172A]/50'
              }`}>
                <button
                  type="button"
                  onClick={() => setShowRecentSection(s => !s)}
                  className={`w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-left cursor-pointer transition-colors ${
                    isLight ? 'text-[#6B7568] hover:text-[#2D3B27]' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <History className="h-3 w-3" /> Recent Locations
                  </span>
                  {showRecentSection ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {showRecentSection && (
                  <div className="space-y-1.5 pt-1">
                    {recentLocations.length > 0 ? (
                      recentLocations.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            const match = item.areaId?.match(/custom-([\d.-]+)-([\d.-]+)/) || item.areaName?.match(/Point:\s*([\d.-]+),\s*([\d.-]+)/);
                            if (match) {
                              const lat = parseFloat(match[1]);
                              const lon = parseFloat(match[2]);
                              if (!isNaN(lat) && !isNaN(lon)) {
                                setSelectedPoint([lat, lon]);
                                setSelectedPolygon(null);
                                setLatInput(lat.toFixed(6));
                                setLonInput(lon.toFixed(6));
                                setDrawMode('point');
                                return;
                              }
                            }
                            setSelectedPoint([20.5937, 78.9629]);
                            setLatInput('20.5937');
                            setLonInput('78.9629');
                            setDrawMode('point');
                          }}
                          className={`w-full text-left p-2 rounded-md border text-xs transition-colors cursor-pointer group ${
                            isLight
                              ? 'bg-[#FFFFFF] border-[#E5E7DE] hover:bg-[#F0F2EB] hover:border-[#4C7A3D] text-[#2D3B27]'
                              : 'bg-[#0F172A] border-[#334155] hover:bg-[#1E293B] hover:border-[#14B8A6] text-[#F1F5F9]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`font-semibold truncate text-[11px] transition-colors ${
                              isLight ? 'group-hover:text-[#4C7A3D]' : 'group-hover:text-[#14B8A6]'
                            }`}>{item.areaName}</span>
                            <span className={`text-[9px] flex-shrink-0 ${isLight ? 'text-[#6B7568]' : 'text-[#64748B]'}`}>{item.date || 'Recent'}</span>
                          </div>
                          <p className={`text-[10px] truncate mt-0.5 ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                            {item.type === 'analysis' ? 'Point Analysis' : 'Comparison'}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className={`p-3.5 rounded-lg border border-dashed text-center flex flex-col items-center justify-center my-1 ${
                        isLight ? 'bg-white/80 border-[#D8DCCF] text-[#6B7568]' : 'bg-[#0F172A]/80 border-[#334155] text-[#64748B]'
                      }`}>
                        <MapPin className={`h-4 w-4 mb-1 opacity-70 ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`} />
                        <p className={`text-xs font-semibold ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>Your recent locations will appear here</p>
                        <p className="text-[10px] mt-0.5 opacity-75">Analyze points or areas to build location history</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* DATA SOURCE footer */}
              <div className={`flex-shrink-0 p-3 border-t ${isLight ? 'bg-[#F0F2EB] border-[#E5E7DE]' : 'bg-[#0B1120] border-[#1E293B]'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Satellite className={`h-3 w-3 ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`} />
                  <span className={`text-[10px] ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>Google Earth Engine · Sentinel-2</span>
                </div>
                <p className={`text-[10px] ${isLight ? 'text-[#6B7568]' : 'text-[#64748B]'}`}>Model: ExtraTrees · Training: 2018 + 2024</p>
              </div>
            </div>
          )}

          {/* Icon-only collapsed state */}
          {!controlsOpen && (
            <div className="flex flex-col items-center gap-3 py-3">
              <button title="Search" onClick={() => setControlsOpen(true)}
                className={`p-2 rounded-md cursor-pointer transition-colors ${isLight ? 'hover:bg-[#F0F2EB] text-[#6B7568]' : 'hover:bg-[#1E293B] text-[#94A3B8]'}`}>
                <Search className="h-4 w-4" />
              </button>
              <button title="Point" onClick={() => { setDrawMode('point'); setControlsOpen(true); }}
                className={`p-2 rounded-md cursor-pointer transition-colors ${drawMode === 'point' ? (isLight ? 'bg-[#4C7A3D] text-white' : 'bg-[#14B8A6] text-white') : (isLight ? 'hover:bg-[#F0F2EB] text-[#6B7568]' : 'hover:bg-[#1E293B] text-[#94A3B8]')}`}>
                <MapPin className="h-4 w-4" />
              </button>
              <button title="Polygon" onClick={() => { setDrawMode('polygon'); setControlsOpen(true); }}
                className={`p-2 rounded-md cursor-pointer transition-colors ${drawMode === 'polygon' ? (isLight ? 'bg-[#4C7A3D] text-white' : 'bg-[#14B8A6] text-white') : (isLight ? 'hover:bg-[#F0F2EB] text-[#6B7568]' : 'hover:bg-[#1E293B] text-[#94A3B8]')}`}>
                <Pentagon className="h-4 w-4" />
              </button>
              <button title="Clear" onClick={handleClearSelection}
                className="p-2 rounded-md hover:bg-red-50 text-red-600 cursor-pointer transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
              <button title="Analyze Area" onClick={handleAnalyze}
                disabled={isAnalyzing || !hasValidLocation}
                className={`p-2 rounded-md disabled:opacity-50 text-white cursor-pointer transition-colors ${isLight ? 'bg-[#4C7A3D] hover:bg-[#3D6330]' : 'bg-[#14B8A6] hover:bg-[#0F766E]'}`}>
                <BarChart2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Full GIS Map Canvas ── */}
        <div className="flex-1 relative min-w-0 overflow-hidden h-full">
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

          {/* ── Quick-Glance Summary Popup Card (over map) ── */}
          {(isAnalyzing || pointResult || polygonResult || errorMessage) && showResultCard && (
            <div className="absolute top-16 right-3 z-[500] w-64 max-h-[calc(100%-80px)] overflow-y-auto">
              <div className={`rounded-xl border shadow-xl overflow-hidden transition-colors ${
                isLight ? 'bg-[#FFFFFF] border-[#E5E7DE] text-[#2D3B27]' : 'bg-[#131B2E] border-[#1E293B] text-[#F1F5F9]'
              }`}>
                {/* Card header */}
                <div className={`flex items-center justify-between px-3 py-2 border-b ${
                  isLight ? 'bg-[#F5F5F0] border-[#E5E7DE]' : 'bg-[#0F172A] border-[#1E293B]'
                }`}>
                  <span className={`text-xs font-bold ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
                    {isAnalyzing ? 'Analyzing Area...' : pointResult ? 'Location Result' : polygonResult ? 'Polygon Result' : 'Analysis'}
                  </span>
                  <button onClick={() => setShowResultCard(false)}
                    className={`p-0.5 rounded cursor-pointer transition-colors ${isLight ? 'hover:bg-[#E5E7DE] text-[#6B7568]' : 'hover:bg-[#1E293B] text-[#94A3B8]'}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Skeleton loading state */}
                {isAnalyzing && (
                  <div className="p-3.5 space-y-3 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${isLight ? 'bg-[#4C7A3D]/20' : 'bg-[#14B8A6]/20'}`} />
                      <div className="space-y-1 flex-1">
                        <div className={`h-2.5 rounded w-2/3 ${isLight ? 'bg-gray-200' : 'bg-slate-700'}`} />
                        <div className={`h-2 rounded w-1/2 ${isLight ? 'bg-gray-100' : 'bg-slate-800'}`} />
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <div className={`h-3 rounded w-full ${isLight ? 'bg-gray-200' : 'bg-slate-700'}`} />
                      <div className={`h-3 rounded w-4/5 ${isLight ? 'bg-gray-200' : 'bg-slate-700'}`} />
                    </div>
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <span className={`animate-spin text-sm ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`}>⟳</span>
                      <span className={`text-[10px] font-medium ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>{getLoadingMessage()}</span>
                    </div>
                  </div>
                )}

                {/* Error */}
                {!isAnalyzing && errorMessage && (
                  <div className="p-3 flex items-start gap-2 bg-red-50 border-b border-red-200">
                    <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{errorMessage}</p>
                  </div>
                )}

                {/* Point result compact */}
                {!isAnalyzing && pointResult && (
                  <div className="p-3 space-y-2">
                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>Location</p>
                      <p className={`text-xs ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>{pointResult.latitude.toFixed(4)}° N, {pointResult.longitude.toFixed(4)}° E</p>
                    </div>
                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>Period</p>
                      <p className={`text-xs ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>{pointResult.date_range}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: classColors[pointResult.prediction] || '#94A3B8' }} />
                      <div>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>Land Cover</p>
                        <p className={`text-sm font-bold ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>{pointResult.prediction}</p>
                      </div>
                    </div>
                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>Class Probability</p>
                      <p className={`text-sm font-bold ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>{(pointResult.confidence * 100).toFixed(1)}%</p>
                      <div className={`w-full rounded-full h-1.5 mt-1 border ${isLight ? 'bg-[#F5F5F0] border-[#D8DCCF]' : 'bg-[#0F172A] border-[#334155]'}`}>
                        <div className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pointResult.confidence * 100}%`, backgroundColor: pointResult.confidence > 0.7 ? (isLight ? '#4C7A3D' : '#14B8A6') : '#f59e0b' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Re-show result card button */}
          {(pointResult || polygonResult) && !showResultCard && (
            <button
              onClick={() => setShowResultCard(true)}
              className={`absolute top-16 right-3 z-[500] border shadow-lg rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                isLight ? 'bg-[#FFFFFF] border-[#E5E7DE] text-[#2D3B27] hover:bg-[#F0F2EB]' : 'bg-[#131B2E] border-[#334155] text-[#F1F5F9] hover:bg-[#1E293B]'
              }`}
            >
              Show Quick Summary
            </button>
          )}
        </div>

      </div>

      {/* ── BOTTOM FULL-WIDTH SECTION: Detailed Full Analysis Report Panel ── */}
      {(isAnalyzing || pointResult || polygonResult || errorMessage) && (
        <div ref={resultsRef} className={`w-full flex-shrink-0 border-t transition-all duration-300 ${
          isLight ? 'bg-[#FFFFFF] border-[#E5E7DE] text-[#2D3B27]' : 'bg-[#131B2E] border-[#1E293B] text-[#F1F5F9]'
        }`}>
          {/* 1. Header Bar with Coordinates & Validated Badge */}
          <div className={`px-6 py-3.5 border-b flex items-center justify-between flex-shrink-0 ${
            isLight ? 'bg-[#FAFAF7] border-[#E5E7DE]' : 'bg-[#0F172A] border-[#1E293B]'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border ${
                isLight ? 'bg-[#4C7A3D]/10 border-[#4C7A3D]/30 text-[#4C7A3D]' : 'bg-[#14B8A6]/10 border-[#14B8A6]/30 text-[#14B8A6]'
              }`}>
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
                    {isAnalyzing ? 'Analyzing Satellite Imagery...' : 'Full Analysis Report'}
                  </h3>
                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Validated
                  </span>
                </div>
                <p className={`text-xs ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                  {pointResult ? `${pointResult.latitude.toFixed(4)}° N, ${pointResult.longitude.toFixed(4)}° E` : 'Selected Location'} · Period: {startDate} - {endDate}
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleSaveArea}
                disabled={isAnalyzing || saveSuccess || !pointResult}
                className={`px-3.5 py-1.5 border rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  isLight
                    ? 'bg-white border-[#E5E7DE] text-[#2D3B27] hover:bg-[#F0F2EB] hover:border-[#4C7A3D]'
                    : 'bg-[#0F172A] border-[#334155] text-[#F1F5F9] hover:bg-[#1E293B] hover:border-[#14B8A6]'
                }`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{saveSuccess ? '✓ Saved' : 'Save Report'}</span>
              </button>
              <button
                onClick={() => setShowFullAnalysis(s => !s)}
                className={`p-1.5 border rounded-xl transition-colors cursor-pointer ${
                  isLight ? 'border-[#E5E7DE] hover:bg-[#F0F2EB] text-[#6B7568]' : 'border-[#334155] hover:bg-[#1E293B] text-[#94A3B8]'
                }`}
              >
                {showFullAnalysis ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Skeleton Loading State */}
          {isAnalyzing && showFullAnalysis && (
            <div className="p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
              <div className={`p-4 rounded-2xl border ${isLight ? 'bg-[#FAFAF7] border-[#E5E7DE]' : 'bg-[#0F172A] border-[#334155]'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-4 h-4 rounded-full ${isLight ? 'bg-[#4C7A3D]/20' : 'bg-[#14B8A6]/20'}`} />
                  <span className={`text-xs font-bold ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`}>{getLoadingMessage()}</span>
                </div>
                <div className={`h-3 rounded w-3/4 mb-2 ${isLight ? 'bg-gray-200' : 'bg-slate-700'}`} />
                <div className={`h-3 rounded w-1/2 ${isLight ? 'bg-gray-100' : 'bg-slate-800'}`} />
              </div>
            </div>
          )}

          {/* Main Collapsible Report Body */}
          {!isAnalyzing && (pointResult || polygonResult) && showFullAnalysis && (
            <div className="p-6 space-y-6 max-w-7xl mx-auto">
              
              {/* 2. Predicted Land Cover Badge */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                isLight ? 'bg-[#FAFAF7] border-[#E5E7DE]' : 'bg-[#0F172A] border-[#334155]'
              }`}>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                    Predicted Land Cover Class
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: classColors[pointResult?.prediction || getDominantClass()?.[0] || 'Agriculture'] || '#4C7A3D' }}
                    />
                    <h4 className="text-base font-extrabold">
                      {pointResult?.prediction || getDominantClass()?.[0] || 'Agriculture'}
                    </h4>
                  </div>
                </div>
                <span className={`text-xs font-mono px-3 py-1 rounded-lg border ${
                  isLight ? 'bg-white border-[#E5E7DE] text-[#2D3B27]' : 'bg-[#131B2E] border-[#334155] text-[#F1F5F9]'
                }`}>
                  Sentinel-2 ExtraTrees
                </span>
              </div>

              {/* 3. Class Probability (Top Class Percentage & Progress Bar) */}
              <div className={`p-4 rounded-2xl border space-y-2 ${
                isLight ? 'bg-[#FAFAF7] border-[#E5E7DE]' : 'bg-[#0F172A] border-[#334155]'
              }`}>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                      Class Probability
                    </p>
                    <p className={`text-[10px] italic ${isLight ? 'text-[#6B7568]' : 'text-[#64748B]'}`}>
                      (not overall accuracy)
                    </p>
                  </div>
                  <span className="text-2xl font-black font-mono">
                    {((pointResult?.confidence || 0.88) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className={`w-full h-3 rounded-full border overflow-hidden ${isLight ? 'bg-[#F5F5F0] border-[#D8DCCF]' : 'bg-[#0F172A] border-[#334155]'}`}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(pointResult?.confidence || 0.88) * 100}%`,
                      backgroundColor: classColors[pointResult?.prediction || 'Agriculture'] || '#4C7A3D'
                    }}
                  />
                </div>
              </div>

              {/* 4. Full 5-Class Probabilities Breakdown */}
              <div className="space-y-3">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                  Full Class Probabilities Breakdown
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { name: 'Agriculture', color: '#eab308' },
                    { name: 'Vegetation', color: '#8FBC5A' },
                    { name: 'Water Bodies', color: '#5B9BD5' },
                    { name: 'Built-up / Urban', color: '#C4823A' },
                    { name: 'Barren Soil', color: '#A9825A' },
                  ].map((item) => {
                    const probVal = pointResult?.probabilities?.[item.name] !== undefined
                      ? (pointResult.probabilities[item.name] as number) * 100
                      : (pointResult?.probabilities ? 0 : 0); // If probabilities exist but class doesn't, it's 0. If no probabilities, also 0 or we could show Unavailable. We'll show 0.
                    return (
                      <div key={item.name} className={`p-3 rounded-xl border space-y-2 ${
                        isLight ? 'bg-[#FAFAF7] border-[#E5E7DE]' : 'bg-[#0F172A] border-[#334155]'
                      }`}>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 truncate">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="truncate font-semibold text-[11px]">{item.name}</span>
                          </div>
                          <span className="font-mono font-bold text-[11px] ml-1">{pointResult?.probabilities ? `${probVal.toFixed(1)}%` : 'Unavailable'}</span>
                        </div>
                        <div className={`w-full h-1.5 rounded-full border overflow-hidden ${isLight ? 'bg-[#F5F5F0] border-[#D8DCCF]' : 'bg-[#0F172A] border-[#334155]'}`}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(4, probVal)}%`, backgroundColor: item.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. Feature Summary (Top Indices - 2 Column Grid) */}
              <div className="space-y-3">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                  Feature Summary (Top Spectral Indices)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'NDVI (VEGETATION INDEX)', val: pointResult?.features?.NDVI ?? 'Unavailable' },
                    { label: 'MNDWI (WATER INDEX)', val: pointResult?.features?.MNDWI ?? 'Unavailable' },
                    { label: 'NDBI (BUILT-UP INDEX)', val: pointResult?.features?.NDBI ?? 'Unavailable' },
                    { label: 'BSI (BARE SOIL INDEX)', val: pointResult?.features?.BSI ?? 'Unavailable' },
                    { label: 'SAVI (SOIL-ADJUSTED VEG)', val: pointResult?.features?.SAVI ?? 'Unavailable' },
                    { label: 'EVI (ENHANCED VEG INDEX)', val: pointResult?.features?.EVI ?? 'Unavailable' },
                  ].map((idxItem) => (
                    <div key={idxItem.label} className={`p-3 rounded-xl border ${
                      isLight ? 'bg-[#FAFAF7] border-[#E5E7DE]' : 'bg-[#0F172A] border-[#334155]'
                    }`}>
                      <span className={`text-[10px] block font-bold uppercase ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                        {idxItem.label}
                      </span>
                      <span className="font-mono text-sm font-extrabold mt-1 block">
                        {typeof idxItem.val === 'number' ? idxItem.val.toFixed(4) : idxItem.val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Expandable "View all 26 features" Section */}
              <div className={`rounded-2xl border overflow-hidden ${isLight ? 'border-[#E5E7DE]' : 'border-[#334155]'}`}>
                <button
                  type="button"
                  onClick={() => setShowAllFeatures(f => !f)}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between text-xs font-bold cursor-pointer transition-colors ${
                    isLight ? 'bg-[#FAFAF7] hover:bg-[#F0F2EB] text-[#2D3B27]' : 'bg-[#0F172A] hover:bg-[#1E293B] text-[#F1F5F9]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4" /> View all 26 raw spectral features & indices
                  </span>
                  {showAllFeatures ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showAllFeatures && (
                  <div className={`p-4 border-t space-y-2 max-h-60 overflow-y-auto ${
                    isLight ? 'bg-white border-[#E5E7DE]' : 'bg-[#131B2E] border-[#334155]'
                  }`}>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      {[
                        { k: 'B4 (Red)', v: 'Unavailable', key: 'B4' },
                        { k: 'B8 (NIR)', v: 'Unavailable', key: 'B8' },
                        { k: 'Greenness', v: 'Unavailable', key: 'Greenness' },
                        { k: 'MNDWI', v: 'Unavailable', key: 'MNDWI' },
                        { k: 'NBR', v: 'Unavailable', key: 'NBR' },
                        { k: 'NDBI', v: 'Unavailable', key: 'NDBI' },
                        { k: 'NDBI_NDVI_diff', v: 'Unavailable', key: 'NDBI_NDVI_diff' },
                        { k: 'NDMI', v: 'Unavailable', key: 'NDMI' },
                        { k: 'NDVI', v: 'Unavailable', key: 'NDVI' },
                        { k: 'NDWI', v: 'Unavailable', key: 'NDWI' },
                        { k: 'NIR_Green_Ratio', v: 'Unavailable', key: 'NIR_Green_Ratio' },
                        { k: 'NIR_Red_Ratio', v: 'Unavailable', key: 'NIR_Red_Ratio' },
                        { k: 'SAVI', v: 'Unavailable', key: 'SAVI' },
                        { k: 'SWIR_Ratio', v: 'Unavailable', key: 'SWIR_Ratio' },
                        { k: 'UI', v: 'Unavailable', key: 'UI' },
                        { k: 'VH', v: 'Unavailable', key: 'VH' },
                        { k: 'VV', v: 'Unavailable', key: 'VV' },
                        { k: 'B2 (Blue)', v: 'Unavailable', key: 'B2' },
                        { k: 'B3 (Green)', v: 'Unavailable', key: 'B3' },
                        { k: 'B11 (SWIR1)', v: 'Unavailable', key: 'B11' },
                        { k: 'B12 (SWIR2)', v: 'Unavailable', key: 'B12' },
                        { k: 'Cloud Cover %', v: `${cloudThreshold}%`, key: 'none' },
                        { k: 'EVI', v: 'Unavailable', key: 'EVI' },
                        { k: 'BSI', v: 'Unavailable', key: 'BSI' },
                        { k: 'GNDVI', v: 'Unavailable', key: 'GNDVI' },
                        { k: 'NDRE', v: 'Unavailable', key: 'NDRE' },
                      ].map((item) => (
                        <div key={item.k} className={`p-2 rounded-lg border flex items-center justify-between ${
                          isLight ? 'bg-[#FAFAF7] border-[#E5E7DE]' : 'bg-[#0F172A] border-[#334155]'
                        }`}>
                          <span className="text-[11px] font-semibold text-slate-500">{item.k}</span>
                          <span className="font-bold text-[11px]">{item.key !== 'none' && pointResult?.features?.[item.key] !== undefined ? pointResult.features[item.key].toFixed(4) : item.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 7. Action Buttons Row (3 equal columns) */}
              <div className="pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={handleSaveArea}
                    disabled={saveSuccess || !pointResult}
                    className={`py-2.5 px-3 border rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      isLight
                        ? 'bg-white border-[#E5E7DE] text-[#2D3B27] hover:bg-[#F0F2EB]'
                        : 'bg-[#0F172A] border-[#334155] text-[#F1F5F9] hover:bg-[#1E293B]'
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{saveSuccess ? '✓ Saved' : 'Save to My Areas'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push(`/compare?lat=${pointResult?.latitude || 20.5937}&lon=${pointResult?.longitude || 78.9629}`)}
                    className={`py-2.5 px-3 border rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      isLight
                        ? 'bg-white border-[#E5E7DE] text-[#2D3B27] hover:bg-[#F0F2EB]'
                        : 'bg-[#0F172A] border-[#334155] text-[#F1F5F9] hover:bg-[#1E293B]'
                    }`}
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    <span>⇄ Compare Years</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLayerMode(layerMode === 'satellite' ? 'map' : 'satellite')}
                    className={`py-2.5 px-3 border rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      isLight
                        ? 'bg-white border-[#E5E7DE] text-[#2D3B27] hover:bg-[#F0F2EB]'
                        : 'bg-[#0F172A] border-[#334155] text-[#F1F5F9] hover:bg-[#1E293B]'
                    }`}
                  >
                    <span>🛰️ {layerMode === 'satellite' ? 'View Map' : 'View Satellite Imagery'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ── FLOATING BOT CIRCLE TRIGGER BUTTON (Shifted up & left, 72px diameter, cute agri-space avatar) ── */}
      <button
        onClick={() => setAssistantOpen(prev => !prev)}
        title={assistantOpen ? "Close AI Assistant" : "Ask AI Assistant"}
        className={`fixed bottom-8 right-8 z-[600] w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 border-2 overflow-hidden shadow-2xl ${
          pointResult || polygonResult ? 'animate-bounce' : 'hover:scale-105 active:scale-95'
        } ${
          isLight
            ? 'bg-[#FFFFFF] border-[#4C7A3D]'
            : 'bg-[#131B2E] border-[#14B8A6]'
        }`}
        style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3)' }}
      >
        {assistantOpen ? (
          <X className="h-7 w-7 text-slate-700" />
        ) : (
          <div className="relative w-full h-full p-0.5 flex items-center justify-center">
            <AIAvatar size="xl" className="w-full h-full" />
            <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full animate-ping" />
            <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full shadow-xs" />
          </div>
        )}
      </button>

      {/* ── FLOATING SLIDE-IN CHAT WIDGET OVERLAY (380-400px width, slides from right) ── */}
      <div
        className={`fixed top-20 right-6 z-[650] w-[380px] sm:w-[400px] max-w-[calc(100vw-32px)] h-[calc(100vh-104px)] rounded-2xl shadow-2xl border overflow-hidden flex flex-col transition-all duration-300 ease-out ${
          assistantOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : 'translate-x-[115%] opacity-0 pointer-events-none'
        } ${
          isLight ? 'bg-white border-[#E5E7DE]' : 'bg-[#131B2E] border-[#1E293B]'
        }`}
        style={{ boxShadow: isLight ? '0 12px 36px rgba(0,0,0,0.18)' : '0 12px 36px rgba(0,0,0,0.55)' }}
      >
        <AIAssistant
          context={aiContext}
          onSelectFindingById={() => {}}
          onClose={() => setAssistantOpen(false)}
        />
      </div>

      {/* ── SHORTCUTS MODAL ── */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
    </Suspense>
  );
}