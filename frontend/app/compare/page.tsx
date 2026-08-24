'use client';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, AlertCircle, Search, RefreshCw, Zap } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BackendAPI } from '@/lib/api-client';
import { eoService, Location } from '@/services/eo-service';
import dynamic from 'next/dynamic';
const DynamicMap = dynamic(() => import('@/components/map/DynamicMap'), { ssr: false });

const SPECTRAL_KEYS = ['NDVI', 'NDWI', 'MNDWI', 'NDBI', 'BSI', 'SAVI', 'EVI', 'NBR', 'UI', 'NDMI', 'GRVI'];
const LAND_COVERS = ['Vegetation', 'Built-up', 'Agriculture', 'Water', 'Barren'];
const ALL_METRICS = [...SPECTRAL_KEYS, ...LAND_COVERS];

function parseDate(d: string) {
  const parts = d.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
}

function getVal(r: any, key: string): number | null {
  if (!r) return null;
  // Spectral Indices
  if (r.aoi_statistics?.spectral_means && key in r.aoi_statistics.spectral_means) return r.aoi_statistics.spectral_means[key];
  if (r.spectral_means && key in r.spectral_means) return r.spectral_means[key];
  if (r.point?.features && key in r.point.features) return r.point.features[key];
  if (r.features && key in r.features) return r.features[key];

  // Land Cover Probabilities
  const dist = r.aoi_statistics?.distribution || r.distribution;
  if (dist && dist[key]) return dist[key].regional_landcover_percentage;

  const probs = r.point?.probabilities || r.probabilities;
  if (probs && key in probs) return probs[key] * 100;
  
  if (probs) {
    const match = Object.keys(probs).find(k => k.toLowerCase() === key.toLowerCase());
    if (match) return probs[match] * 100;
  }
  return null;
}

import { useActiveAnalysis } from '@/lib/analysis-context';

function ComparePageContent() {
  const { setActiveAnalysis } = useActiveAnalysis();
  const router = useRouter();
  const searchParams = useSearchParams();

  const areaId = searchParams.get('area');
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');
  const polygonStr = searchParams.get('polygon');

  const [locationName, setLocationName] = useState<string>('Custom Location');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  // In-memory cache for compare page GEE requests
  const compareCache = useRef<Map<string, any>>(new Map());

  const [locations, setLocations] = useState<Location[]>([]);
  useEffect(() => {
    eoService.getAllLocations().then(setLocations);
  }, []);

  useEffect(() => {
    async function initLoc() {
      if (latParam && lonParam) {
        setLat(parseFloat(latParam));
        setLon(parseFloat(lonParam));
        setLocationName(`Point: ${parseFloat(latParam).toFixed(4)}, ${parseFloat(lonParam).toFixed(4)}`);
      } else if (areaId) {
        if (areaId.startsWith('custom-')) {
          const parts = areaId.split('-');
          setLat(parseFloat(parts[1]));
          setLon(parseFloat(parts[2]));
          setLocationName(`Point: ${parseFloat(parts[1]).toFixed(4)}, ${parseFloat(parts[2]).toFixed(4)}`);
        } else {
          const loc = await eoService.getLocationById(areaId);
          if (loc) {
            setLocationName(loc.name);
            if (loc.coordinates) {
              const parts = loc.coordinates.split(',').map(s => s.trim());
              setLat(parseFloat(parts[0]));
              setLon(parseFloat(parts[1]));
            }
          }
        }
      } else if (polygonStr) {
        setLocationName('Custom Polygon AOI');
      }
    }
    initLoc();
  }, [areaId, latParam, lonParam, polygonStr]);

  const [p1Start, setP1Start] = useState('01/01/2018');
  const [p1End, setP1End] = useState('31/12/2018');
  const [p2Start, setP2Start] = useState('01/01/2024');
  const [p2End, setP2End] = useState('31/12/2024');
  const [cloudThresh, setCloudThresh] = useState(20);

  const [p1Data, setP1Data] = useState<any>(null);
  const [p2Data, setP2Data] = useState<any>(null);

  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [isBothFetching, setIsBothFetching] = useState(false);

  const [step1Msg, setStep1Msg] = useState('Querying Sentinel-2 imagery...');
  const [step2Msg, setStep2Msg] = useState('Querying Sentinel-2 imagery...');

  const [error1, setError1] = useState<string | null>(null);
  const [error2, setError2] = useState<string | null>(null);

  const [showCompare, setShowCompare] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{lat: string, lon: string, display_name: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-enable & trigger comparison when both periods are loaded
  useEffect(() => {
    if (p1Data && p2Data) {
      setShowCompare(true);
      setActiveAnalysis({
        page: 'compare',
        location: locationName,
        period1: { start: p1Start, end: p1End, data: p1Data },
        period2: { start: p2Start, end: p2End, data: p2Data }
      });
    }
  }, [p1Data, p2Data]);

  // Auto-scroll to Comparison Results once generated
  useEffect(() => {
    if (showCompare && p1Data && p2Data) {
      const timer = setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [showCompare, p1Data, p2Data]);

  const fetchPeriodData = async (num: 1 | 2) => {
    const isP1 = num === 1;
    const s = parseDate(isP1 ? p1Start : p2Start);
    const e = parseDate(isP1 ? p1End : p2End);

    const cacheKey = lat !== null && lon !== null
      ? `compare:pt:${lat.toFixed(4)},${lon.toFixed(4)}:${s}:${e}:${cloudThresh}`
      : `compare:poly:${polygonStr}:${s}:${e}:${cloudThresh}`;

    // Cache hit
    if (compareCache.current.has(cacheKey)) {
      const cached = compareCache.current.get(cacheKey);
      if (isP1) { setP1Data(cached); setError1(null); }
      else { setP2Data(cached); setError2(null); }
      return cached;
    }

    if (isP1) {
      setLoading1(true); setError1(null); setP1Data(null);
      setStep1Msg('Querying Sentinel-2 imagery...');
    } else {
      setLoading2(true); setError2(null); setP2Data(null);
      setStep2Msg('Querying Sentinel-2 imagery...');
    }

    const step2Timer = setTimeout(() => {
      isP1 ? setStep1Msg('Processing classification...') : setStep2Msg('Processing classification...');
    }, 1200);

    try {
      let apiPromise: Promise<any>;
      if (lat !== null && lon !== null) {
        apiPromise = BackendAPI.predictLocation(lat, lon, undefined as any, s, e, cloudThresh);
      } else if (polygonStr) {
        const poly = JSON.parse(polygonStr);
        const geoCoords = poly.map((c: any) => [c[1], c[0]]);
        if (geoCoords.length > 0 && (geoCoords[0][0] !== geoCoords[geoCoords.length - 1][0] || geoCoords[0][1] !== geoCoords[geoCoords.length - 1][1])) {
          geoCoords.push(geoCoords[0]);
        }
        apiPromise = BackendAPI.predictPolygon(geoCoords, undefined as any, s, e, cloudThresh);
      } else {
        throw new Error("No location coordinates or polygon found.");
      }

      // 25-second timeout wrapper
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("GEE request timed out, tap to retry")), 25000)
      );

      const res = await Promise.race([apiPromise, timeoutPromise]) as any;

      if (!res || res.status === 'error') {
        throw new Error(res?.message || "GEE data unavailable for this period");
      }

      compareCache.current.set(cacheKey, res);
      if (isP1) setP1Data(res);
      else setP2Data(res);

      return res;
    } catch (err: any) {
      const errMsg = err.message || 'Error fetching GEE data';
      if (isP1) setError1(errMsg);
      else setError2(errMsg);
      throw err;
    } finally {
      clearTimeout(step2Timer);
      if (isP1) setLoading1(false);
      else setLoading2(false);
    }
  };

  // Parallel Dual Period Fetching
  const fetchBothPeriods = async () => {
    setIsBothFetching(true);
    try {
      await Promise.allSettled([fetchPeriodData(1), fetchPeriodData(2)]);
    } finally {
      setIsBothFetching(false);
    }
  };

  return (
    <div className="w-full space-y-5 py-4 px-4 md:px-6">
      {/* CONSOLIDATED HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                onClick={() => router.push('/compare')}
                className="text-base sm:text-lg font-bold text-[#6B7568] dark:text-slate-400 hover:text-[#2D3B27] dark:hover:text-[#F1F5F9] cursor-pointer transition-colors"
              >
                Compare
              </span>
              <span className="text-sm font-bold text-[#6B7568] dark:text-slate-400">›</span>
              <h1 className="text-base sm:text-lg font-extrabold text-[#4C7A3D] dark:text-[#14B8A6] truncate max-w-md">
                {locationName}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select location & dual date ranges to analyze multi-temporal GEE spectral changes.
            </p>
          </div>
        </div>

        {/* Dual Parallel Fetch Action */}
        <Button
          onClick={fetchBothPeriods}
          disabled={loading1 || loading2 || isBothFetching || lat === null || lon === null || isNaN(lat) || isNaN(lon)}
          className="bg-[#4C7A3D] hover:bg-[#3D6330] dark:bg-[#14B8A6] dark:hover:bg-[#0F766E] text-white font-bold text-xs flex items-center gap-1.5 shadow-md py-2.5 px-4 rounded-xl cursor-pointer"
        >
          {isBothFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          <span>FETCH & COMPARE BOTH PERIODS</span>
        </Button>
      </div>

      {/* LOCATION INPUTS */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-brand-neutral-800 mb-4">Analysis Location</h3>
          
          <div className="mb-4">
            <label className="text-xs font-semibold text-brand-neutral-600 block mb-1">Quick Select (Predefined Areas)</label>
            <select 
              className="w-full text-sm border rounded p-2 focus:ring-1 focus:ring-brand-green-700 outline-none bg-slate-50"
              onChange={(e) => {
                const loc = locations.find(l => l.id === e.target.value);
                if (loc && loc.coordinates) {
                  const parts = loc.coordinates.split(',').map(s => s.trim());
                  setLat(parseFloat(parts[0]));
                  setLon(parseFloat(parts[1]));
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>-- Select a predefined region --</option>
              {locations.slice(0, 5).map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.region})</option>
              ))}
            </select>
          </div>

          <div className="mb-4 relative">
            <label className="text-xs font-semibold text-brand-neutral-600 block mb-1">Search Global Location (Geocoding)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-neutral-400" />
              <input
                type="text"
                placeholder="Type a city or address and press Enter..."
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
                          alert('Location not found.');
                        }
                      })
                      .catch(err => {
                        setSearchResults([]);
                        alert('Search failed.');
                      })
                      .finally(() => setIsSearching(false));
                  }
                }}
                className="w-full pl-10 pr-4 py-2 text-sm border rounded focus:ring-1 focus:ring-brand-green-700 outline-none bg-white"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-3 h-3 border-2 border-brand-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border rounded shadow-lg overflow-hidden">
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      title={res.display_name}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 border-b last:border-0 truncate"
                      onClick={() => {
                        const l = parseFloat(res.lat);
                        const ln = parseFloat(res.lon);
                        setLat(l);
                        setLon(ln);
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

          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-semibold text-brand-neutral-600 block mb-1">Latitude (e.g. 18.5214)</label>
                <input type="number" value={lat || ''} onChange={e => setLat(parseFloat(e.target.value))} className="w-full text-sm border rounded p-2 focus:ring-1 focus:ring-brand-green-700 outline-none" placeholder="Enter Latitude..." />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-brand-neutral-600 block mb-1">Longitude (e.g. 73.8545)</label>
                <input type="number" value={lon || ''} onChange={e => setLon(parseFloat(e.target.value))} className="w-full text-sm border rounded p-2 focus:ring-1 focus:ring-brand-green-700 outline-none" placeholder="Enter Longitude..." />
              </div>
            </div>
            
            <div className="h-[360px] w-full border rounded-xl overflow-hidden relative z-0">
              <DynamicMap 
                drawMode="point" 
                showFeatureControls={true}
                onPointSelected={(l, ln) => { setLat(l); setLon(ln); }} 
                selectedPoint={lat !== null && lon !== null ? [lat, lon] : null}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* PERIOD 1 */}
            <div className="space-y-4 border p-4 rounded-lg bg-slate-50">
              <h3 className="text-lg font-bold text-brand-neutral-800">Period 1</h3>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-brand-neutral-600">Start Date</label>
                  <input type="text" value={p1Start} onChange={e => setP1Start(e.target.value)} className="w-full text-sm border rounded p-1.5" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-brand-neutral-600">End Date</label>
                  <input type="text" value={p1End} onChange={e => setP1End(e.target.value)} className="w-full text-sm border rounded p-1.5" />
                </div>
              </div>
              <div className="w-1/2">
                  <label className="text-xs font-semibold text-brand-neutral-600">Cloud Threshold %</label>
                  <input type="number" value={cloudThresh} onChange={e => setCloudThresh(parseInt(e.target.value))} className="w-full text-sm border rounded p-1.5" />
              </div>

              <Button onClick={() => fetchPeriodData(1)} disabled={loading1 || lat === null || lon === null || isNaN(lat) || isNaN(lon)} className="w-full bg-slate-800 text-white hover:bg-slate-900 cursor-pointer">
                {loading1 ? (
                  <span className="flex items-center gap-2 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Fetching satellite data... ({step1Msg})</span>
                  </span>
                ) : (
                  'GET PERIOD 1 DATA FROM GEE'
                )}
              </Button>

              {error1 && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-600 text-xs font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span>{error1}</span>
                  </div>
                  <button onClick={() => fetchPeriodData(1)} className="text-[11px] underline font-bold cursor-pointer hover:text-red-800">
                    Retry
                  </button>
                </div>
              )}
              
              {p1Data && (
                <div className="bg-white border rounded p-4 text-sm space-y-3 shadow-sm mt-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-emerald-700">PERIOD 1 — GEE VERIFIED</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Verified: true</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <span className="text-slate-500 font-semibold">Source:</span><span className="font-medium text-right text-slate-800">Google Earth Engine</span>
                    <span className="text-slate-500 font-semibold">Images found:</span><span className="font-mono text-right text-slate-800">{p1Data.samples_analyzed || p1Data.images_found || 'N/A'}</span>
                    <span className="text-slate-500 font-semibold">Acquisition dates:</span><span className="text-right text-slate-800 truncate" title={p1Data.actual_dates?.join(', ') || 'N/A'}>{p1Data.actual_dates ? p1Data.actual_dates.length + ' dates' : 'N/A'}</span>
                    
                    <div className="col-span-2 border-t mt-1 pt-2"></div>
                    
                    <span className="text-slate-500 font-semibold">NDVI:</span><span className="font-mono text-right text-slate-800">{getVal(p1Data, 'NDVI')?.toFixed(4) || 'N/A'}</span>
                    <span className="text-slate-500 font-semibold">NDWI:</span><span className="font-mono text-right text-slate-800">{getVal(p1Data, 'NDWI')?.toFixed(4) || 'N/A'}</span>
                    <span className="text-slate-500 font-semibold">NDBI:</span><span className="font-mono text-right text-slate-800">{getVal(p1Data, 'NDBI')?.toFixed(4) || 'N/A'}</span>
                    <span className="text-slate-500 font-semibold">Predicted Class:</span><span className="font-mono text-right text-slate-800">{p1Data.point?.prediction || 'N/A'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* PERIOD 2 */}
            <div className="space-y-4 border p-4 rounded-lg bg-slate-50">
              <h3 className="text-lg font-bold text-brand-neutral-800">Period 2</h3>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-brand-neutral-600">Start Date</label>
                  <input type="text" value={p2Start} onChange={e => setP2Start(e.target.value)} className="w-full text-sm border rounded p-1.5" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-brand-neutral-600">End Date</label>
                  <input type="text" value={p2End} onChange={e => setP2End(e.target.value)} className="w-full text-sm border rounded p-1.5" />
                </div>
              </div>
              <div className="w-1/2">
                  <label className="text-xs font-semibold text-brand-neutral-600">Cloud Threshold %</label>
                  <input type="number" value={cloudThresh} onChange={e => setCloudThresh(parseInt(e.target.value))} className="w-full text-sm border rounded p-1.5" />
              </div>

              <Button onClick={() => fetchPeriodData(2)} disabled={loading2 || lat === null || lon === null || isNaN(lat) || isNaN(lon)} className="w-full bg-slate-800 text-white hover:bg-slate-900 cursor-pointer">
                {loading2 ? (
                  <span className="flex items-center gap-2 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Fetching satellite data... ({step2Msg})</span>
                  </span>
                ) : (
                  'GET PERIOD 2 DATA FROM GEE'
                )}
              </Button>

              {error2 && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-600 text-xs font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span>{error2}</span>
                  </div>
                  <button onClick={() => fetchPeriodData(2)} className="text-[11px] underline font-bold cursor-pointer hover:text-red-800">
                    Retry
                  </button>
                </div>
              )}
              
              {p2Data && (
                <div className="bg-white border rounded p-4 text-sm space-y-3 shadow-sm mt-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-emerald-700">PERIOD 2 — GEE VERIFIED</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Verified: true</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <span className="text-slate-500 font-semibold">Source:</span><span className="font-medium text-right text-slate-800">Google Earth Engine</span>
                    <span className="text-slate-500 font-semibold">Images found:</span><span className="font-mono text-right text-slate-800">{p2Data.samples_analyzed || p2Data.images_found || 'N/A'}</span>
                    <span className="text-slate-500 font-semibold">Acquisition dates:</span><span className="text-right text-slate-800 truncate" title={p2Data.actual_dates?.join(', ') || 'N/A'}>{p2Data.actual_dates ? p2Data.actual_dates.length + ' dates' : 'N/A'}</span>
                    
                    <div className="col-span-2 border-t mt-1 pt-2"></div>
                    
                    <span className="text-slate-500 font-semibold">NDVI:</span><span className="font-mono text-right text-slate-800">{getVal(p2Data, 'NDVI')?.toFixed(4) || 'N/A'}</span>
                    <span className="text-slate-500 font-semibold">NDWI:</span><span className="font-mono text-right text-slate-800">{getVal(p2Data, 'NDWI')?.toFixed(4) || 'N/A'}</span>
                    <span className="text-slate-500 font-semibold">NDBI:</span><span className="font-mono text-right text-slate-800">{getVal(p2Data, 'NDBI')?.toFixed(4) || 'N/A'}</span>
                    <span className="text-slate-500 font-semibold">Predicted Class:</span><span className="font-mono text-right text-slate-800">{p2Data.point?.prediction || 'N/A'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <Button 
                onClick={() => setShowCompare(true)} 
                disabled={!p1Data || !p2Data}
                className="w-full md:w-auto px-12 py-6 text-lg font-bold bg-brand-green-700 hover:bg-brand-green-800 text-white shadow-md disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
            >
              COMPARE PERIOD 1 AND PERIOD 2
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* COMPARISON RESULTS */}
      {showCompare && p1Data && p2Data && (
        <div ref={resultsRef}>
          <Card className="border-emerald-200 shadow-md">
          <CardContent className="p-0">
            <div className="bg-slate-50 p-6 border-b">
                <h3 className="text-xl font-bold text-slate-800 mb-2">GEE Verified Change Analysis</h3>
                <p className="text-sm text-slate-600">Calculated strictly as `change = Period 2 - Period 1` from independent GEE responses.</p>
            </div>
            
            <div className="overflow-x-auto p-6">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-700">Metric</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Period 1 Value</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Period 2 Value</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Change (P2 - P1)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ALL_METRICS.map(metric => {
                    const v1 = getVal(p1Data, metric);
                    const v2 = getVal(p2Data, metric);
                    if (v1 === null || v2 === null) return null;
                    
                    const change = v2 - v1;
                    const isPositive = change > 0;
                    const absChange = Math.abs(change);
                    
                    if (absChange < 0.0001) return null;

                    return (
                      <tr key={metric} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{metric}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{v1.toFixed(4)}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{v2.toFixed(4)}</td>
                        <td className={`px-4 py-3 font-mono font-bold ${isPositive ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {isPositive ? '+' : ''}{change.toFixed(4)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* CHART */}
            <div className="p-6 border-t bg-white">
              <h4 className="text-base font-bold text-slate-800 mb-4">Metric Shift Visualization</h4>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={SPECTRAL_KEYS.map(m => {
                      const v1 = getVal(p1Data, m);
                      const v2 = getVal(p2Data, m);
                      return { name: m, 'Period 1': v1 !== null ? Number(v1.toFixed(3)) : 0, 'Period 2': v2 !== null ? Number(v2.toFixed(3)) : 0 };
                    }).filter(d => d['Period 1'] !== 0 || d['Period 2'] !== 0)}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Period 1" fill="#64748b" />
                    <Bar dataKey="Period 2" fill="#047857" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-slate-500 font-medium">Loading Compare Tool...</div>
    }>
      <ComparePageContent />
    </Suspense>
  );
}
