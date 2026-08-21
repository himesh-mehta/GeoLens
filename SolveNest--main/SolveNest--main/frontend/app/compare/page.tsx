'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, AlertCircle, Search } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BackendAPI } from '@/lib/api-client';
import { eoService, Location } from '@/services/eo-service';
import { LoadingState } from '@/components/ui/loading-state';
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

function ComparePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const areaId = searchParams.get('area');
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');
  const polygonStr = searchParams.get('polygon');

  const [locationName, setLocationName] = useState<string>('Custom Location');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

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

  const [error1, setError1] = useState<string | null>(null);
  const [error2, setError2] = useState<string | null>(null);

  const [showCompare, setShowCompare] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{lat: string, lon: string, display_name: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchPeriod = async (num: 1 | 2) => {
    const isP1 = num === 1;
    isP1 ? setLoading1(true) : setLoading2(true);
    isP1 ? setError1(null) : setError2(null);
    isP1 ? setP1Data(null) : setP2Data(null);
    setShowCompare(false);

    try {
      const s = parseDate(isP1 ? p1Start : p2Start);
      const e = parseDate(isP1 ? p1End : p2End);

      console.log(`[COMPARE PAGE] PERIOD ${num} REQUEST`);
      console.log(`LAT: ${lat}, LON: ${lon}, START: ${s}, END: ${e}, CLOUD: ${cloudThresh}`);

      let res;
      if (lat !== null && lon !== null) {
        res = await BackendAPI.predictLocation(lat, lon, undefined as any, s, e, cloudThresh);
      } else if (polygonStr) {
        const poly = JSON.parse(polygonStr);
        const geoCoords = poly.map((c: any) => [c[1], c[0]]);
        if (geoCoords.length > 0 && (geoCoords[0][0] !== geoCoords[geoCoords.length - 1][0] || geoCoords[0][1] !== geoCoords[geoCoords.length - 1][1])) {
          geoCoords.push(geoCoords[0]);
        }
        res = await BackendAPI.predictPolygon(geoCoords, undefined as any, s, e, cloudThresh);
      } else {
        throw new Error("No location coordinates or polygon found.");
      }

      console.log(`[COMPARE PAGE] PERIOD ${num} RESPONSE`, res);

      if (!res || res.status === 'error') {
        throw new Error(res?.message || "GEE data unavailable for this period");
      }

      isP1 ? setP1Data(res) : setP2Data(res);
    } catch (err: any) {
      isP1 ? setError1(err.message || 'Error fetching GEE data') : setError2(err.message || 'Error fetching GEE data');
    } finally {
      isP1 ? setLoading1(false) : setLoading2(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-8 px-4">
      {/* HEADER */}
      <div className="flex items-center gap-4 border-b border-brand-neutral-200 pb-4">
        <Button variant="secondary" size="sm" onClick={() => router.push('/explorer')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-2xl font-bold text-brand-neutral-900">GEE Data Comparison: {locationName}</h2>
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
            
            <div className="h-[300px] w-full border rounded-md overflow-hidden relative z-0">
              <DynamicMap 
                drawMode="point" 
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

              <Button onClick={() => fetchPeriod(1)} disabled={loading1 || lat === null || lon === null || isNaN(lat) || isNaN(lon)} className="w-full bg-slate-800 text-white hover:bg-slate-900">
                {loading1 && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                GET PERIOD 1 DATA FROM GEE
              </Button>

              {error1 && <div className="text-red-500 text-sm font-semibold flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error1}</div>}
              
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

              <Button onClick={() => fetchPeriod(2)} disabled={loading2 || lat === null || lon === null || isNaN(lat) || isNaN(lon)} className="w-full bg-slate-800 text-white hover:bg-slate-900">
                {loading2 && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                GET PERIOD 2 DATA FROM GEE
              </Button>

              {error2 && <div className="text-red-500 text-sm font-semibold flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error2}</div>}
              
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
                className="w-full md:w-auto px-12 py-6 text-lg font-bold bg-brand-green-700 hover:bg-brand-green-800 text-white shadow-md disabled:bg-slate-200 disabled:text-slate-400"
            >
              COMPARE PERIOD 1 AND PERIOD 2
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* COMPARISON RESULTS */}
      {showCompare && p1Data && p2Data && (
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
                    
                    // Skip tiny floating point changes
                    if (absChange < 0.0001) return null;
                    
                    return (
                      <tr key={metric} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800">{metric} {LAND_COVERS.includes(metric) ? '(%)' : ''}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{v1.toFixed(4)}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{v2.toFixed(4)}</td>
                        <td className={`px-4 py-3 font-mono font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPositive ? '+' : ''}{change.toFixed(4)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* GRAPHS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-t bg-white">
              <div>
                <h4 className="text-center font-bold text-slate-700 mb-4">Spectral Indices</h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={SPECTRAL_KEYS.map(metric => {
                        const v1 = getVal(p1Data, metric);
                        const v2 = getVal(p2Data, metric);
                        if (v1 === null || v2 === null) return null;
                        return { name: metric, "Period 1": Number(v1.toFixed(4)), "Period 2": Number(v2.toFixed(4)) };
                      }).filter(Boolean)}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="Period 1" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="Period 2" fill="#047857" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-center font-bold text-slate-700 mb-4">Land Cover (%)</h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={LAND_COVERS.map(metric => {
                        const v1 = getVal(p1Data, metric);
                        const v2 = getVal(p2Data, metric);
                        if (v1 === null || v2 === null) return null;
                        return { name: metric, "Period 1": Number(v1.toFixed(2)), "Period 2": Number(v2.toFixed(2)) };
                      }).filter(Boolean)}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="Period 1" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="Period 2" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <ComparePageContent />
    </Suspense>
  );
}
