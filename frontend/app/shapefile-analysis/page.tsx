"use client";

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw, Download, Map as MapIcon, ChevronDown, ChevronUp, FileImage } from 'lucide-react';
import { BackendAPI } from '@/lib/api-client';
import dynamic from 'next/dynamic';
import { useTheme } from '@/lib/theme/theme-context';
import { clsx } from 'clsx';

// Dynamically import the map to avoid SSR issues with Leaflet
const DynamicMap = dynamic(() => import('@/components/map/DynamicMap'), { ssr: false });

import { useActiveAnalysis } from '@/lib/analysis-context';

export default function ShapefileAnalysisPage() {
  const { setActiveAnalysis } = useActiveAnalysis();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [tiffFile, setTiffFile] = useState<File | null>(null);
  const [p1Start, setP1Start] = useState("2020-01-01");
  const [p1End, setP1End] = useState("2020-12-31");
  const [p2Start, setP2Start] = useState("2024-01-01");
  const [p2End, setP2End] = useState("2024-12-31");
  const [cloudThreshold, setCloudThreshold] = useState(20);

  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'complete' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    if (results) {
      setActiveAnalysis({
        page: 'shapefile-analysis',
        filename: zipFile?.name,
        summary: results.summary,
        features: results.features,
        transitionStats: results.transition_statistics,
        overallChange: results.overall_change
      });
    }
  }, [results]);
  
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'} | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (idx: number) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(idx)) {
      newSet.delete(idx);
    } else {
      newSet.add(idx);
    }
    setExpandedRows(newSet);
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setZipFile(e.target.files[0]);
    }
  };

  const handleTiffChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTiffFile(e.target.files[0]);
    }
  };

  const startAnalysis = async () => {
    if (!zipFile) return;
    setStatus('uploading');
    setStatusMessage("Uploading shapefile and initializing analysis...");
    try {
      const res = await BackendAPI.uploadShapefile(zipFile, p1Start, p1End, p2Start, p2End, cloudThreshold, tiffFile || undefined);
      if (res && res.jobId) {
        setJobId(res.jobId);
        setStatus('analyzing');
      } else {
        setStatus('error');
        setStatusMessage(res?.message || "Failed to start analysis");
      }
    } catch (e: any) {
      setStatus('error');
      setStatusMessage(e.message || "Network error");
    }
  };

  useEffect(() => {
    let interval: any;
    if (status === 'analyzing' && jobId) {
      interval = setInterval(async () => {
        try {
          const res = await BackendAPI.getShapefileStatus(jobId);
          const st = (res.status || '').toLowerCase();
          if (st === 'error' || st === 'not found') {
            setStatus('error');
            setStatusMessage(res.error || "Job expired or failed. Please upload shapefile again.");
            clearInterval(interval);
          } else if (st === 'complete') {
            setStatus('complete');
            setStatusMessage("Analysis complete. Loading results...");
            const finalRes = await BackendAPI.getShapefileResults(jobId);
            setResults(finalRes);
            clearInterval(interval);
          } else {
            setStatusMessage(res.status);
          }
        } catch (e) {
          // ignore transient poll errors
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [status, jobId]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedFeatures = () => {
    if (!results || !results.features) return [];
    let sortable = [...results.features];
    if (sortConfig !== null) {
      sortable.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        // Handle "Not available" strings by pushing them to the bottom
        if (aVal === "Not available" || aVal === null) aVal = -99999;
        if (bVal === "Not available" || bVal === null) bVal = -99999;
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  };

  const downloadCSV = () => {
    if (!results || !results.features) return;
    
    // The exact headers requested by the user
    const exportHeaders = [
      "Feature_ID", "Feature_Name",
      "MNDWI_period1", "MNDWI_period2", "mean_MNDWI_change",
      "NDBI_period1", "NDBI_period2", "mean_NDBI_change",
      "NDVI_period1", "NDVI_period2", "mean_NDVI_change",
      "NDWI_period1", "NDWI_period2", "mean_NDWI_change",
      "SAVI_period1", "SAVI_period2", "mean_SAVI_change",
      "BSI_period1", "BSI_period2", "mean_BSI_change"
    ];
    
    // Mapping from requested export headers to our internal data keys
    const keyMapping: Record<string, string> = {
      "Feature_ID": "feature_id",
      "Feature_Name": "feature_name",
      "MNDWI_period1": "mndwi_period1",
      "MNDWI_period2": "mndwi_period2",
      "mean_MNDWI_change": "mndwi_change",
      "NDBI_period1": "ndbi_period1",
      "NDBI_period2": "ndbi_period2",
      "mean_NDBI_change": "ndbi_change",
      "NDVI_period1": "ndvi_period1",
      "NDVI_period2": "ndvi_period2",
      "mean_NDVI_change": "ndvi_change",
      "NDWI_period1": "ndwi_period1",
      "NDWI_period2": "ndwi_period2",
      "mean_NDWI_change": "ndwi_change",
      "SAVI_period1": "savi_period1",
      "SAVI_period2": "savi_period2",
      "mean_SAVI_change": "savi_change",
      "BSI_period1": "bsi_period1",
      "BSI_period2": "bsi_period2",
      "mean_BSI_change": "bsi_change"
    };
    
    let csvContent = exportHeaders.join(",") + "\n";
    
    results.features.forEach((row: any) => {
      let rowArray = exportHeaders.map(header => {
        let val = row[keyMapping[header]];
        if (val === null || val === undefined) return "";
        if (typeof val === 'string') return `"${val}"`;
        return val;
      });
      csvContent += rowArray.join(",") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `shapefile_analysis_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={clsx("min-h-screen p-6", isLight ? "bg-[#FAFAF7]" : "bg-[#0F172A]")}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div>
          <h1 className={clsx("text-2xl font-bold", isLight ? "text-[#2D3B27]" : "text-[#F1F5F9]")}>Shapefile Analysis</h1>
          <p className={clsx("mt-1", isLight ? "text-slate-600" : "text-slate-400")}>Upload a geographic boundary and analyze satellite-derived environmental changes.</p>
        </div>

        {/* Upload & Params Form (hide when analyzing or complete) */}
        {(status === 'idle' || status === 'error') && (
          <div className={clsx("p-6 rounded-2xl border", isLight ? "bg-white border-[#E5E7DE]" : "bg-[#131B2E] border-[#1E293B]")}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* File Uploads */}
              <div className="space-y-6">
                <div>
                  <h3 className={clsx("font-semibold mb-3", isLight ? "text-[#2D3B27]" : "text-white")}>1. Upload Shapefile (Required)</h3>
                  <div className={clsx("border-2 border-dashed rounded-xl p-6 text-center transition-colors", 
                    isLight ? "border-[#A3B899] hover:bg-[#F0F2EB]" : "border-[#334155] hover:bg-[#1E293B]")}>
                    <input type="file" accept=".zip" onChange={handleZipChange} className="hidden" id="zip-upload" />
                    <label htmlFor="zip-upload" className="cursor-pointer flex flex-col items-center">
                      <UploadCloud className={clsx("h-10 w-10 mb-2", isLight ? "text-[#4C7A3D]" : "text-[#14B8A6]")} />
                      <span className="font-semibold text-sm">Choose Shapefile ZIP</span>
                      <span className="text-xs text-slate-500 mt-1">Must contain .shp, .shx, .dbf, .prj</span>
                    </label>
                    {zipFile && <p className="mt-3 text-sm font-semibold text-emerald-600">Selected: {zipFile.name}</p>}
                  </div>
                </div>

                <div>
                  <h3 className={clsx("font-semibold mb-3", isLight ? "text-[#2D3B27]" : "text-white")}>2. Land-Cover Change GeoTIFF (Optional)</h3>
                  <div className={clsx("border-2 border-dashed rounded-xl p-6 text-center transition-colors", 
                    isLight ? "border-[#A3B899] hover:bg-[#F0F2EB]" : "border-[#334155] hover:bg-[#1E293B]")}>
                    <input type="file" accept=".tif,.tiff" onChange={handleTiffChange} className="hidden" id="tiff-upload" />
                    <label htmlFor="tiff-upload" className="cursor-pointer flex flex-col items-center">
                      <FileImage className={clsx("h-10 w-10 mb-2", isLight ? "text-slate-400" : "text-slate-500")} />
                      <span className="font-semibold text-sm">Choose GeoTIFF</span>
                      <span className="text-xs text-slate-500 mt-1">For advanced land-cover visualization</span>
                    </label>
                    {tiffFile && <p className="mt-3 text-sm font-semibold text-blue-500">Selected: {tiffFile.name}</p>}
                  </div>
                </div>
              </div>

              {/* Params */}
              <div className="space-y-6">
                <div>
                  <h3 className={clsx("font-semibold mb-3", isLight ? "text-[#2D3B27]" : "text-white")}>3. Analysis Parameters</h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Period 1 Start</label>
                        <input type="date" value={p1Start} onChange={e => setP1Start(e.target.value)} 
                          className={clsx("w-full px-3 py-2 rounded-lg border text-sm", isLight ? "bg-white" : "bg-[#0B1120] border-[#334155] text-white")} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Period 1 End</label>
                        <input type="date" value={p1End} onChange={e => setP1End(e.target.value)} 
                          className={clsx("w-full px-3 py-2 rounded-lg border text-sm", isLight ? "bg-white" : "bg-[#0B1120] border-[#334155] text-white")} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Period 2 Start</label>
                        <input type="date" value={p2Start} onChange={e => setP2Start(e.target.value)} 
                          className={clsx("w-full px-3 py-2 rounded-lg border text-sm", isLight ? "bg-white" : "bg-[#0B1120] border-[#334155] text-white")} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Period 2 End</label>
                        <input type="date" value={p2End} onChange={e => setP2End(e.target.value)} 
                          className={clsx("w-full px-3 py-2 rounded-lg border text-sm", isLight ? "bg-white" : "bg-[#0B1120] border-[#334155] text-white")} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">Cloud Cover Threshold (%)</label>
                      <input type="number" min="0" max="100" value={cloudThreshold} onChange={e => setCloudThreshold(parseInt(e.target.value))} 
                        className={clsx("w-full px-3 py-2 rounded-lg border text-sm", isLight ? "bg-white" : "bg-[#0B1120] border-[#334155] text-white")} />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={startAnalysis}
                    disabled={!zipFile}
                    className={clsx("w-full py-3 rounded-xl font-bold text-white transition-transform active:scale-[0.98]",
                      !zipFile ? "bg-slate-400 cursor-not-allowed" : isLight ? "bg-[#4C7A3D] hover:bg-[#3D6331]" : "bg-[#14B8A6] hover:bg-[#0D9488]"
                    )}
                  >
                    Run Shapefile Analysis
                  </button>
                  {status === 'error' && (
                    <div className="mt-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <span>{statusMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Polling State */}
        {(status === 'uploading' || status === 'analyzing') && (
          <div className={clsx("p-12 rounded-2xl border text-center flex flex-col items-center", isLight ? "bg-white border-[#E5E7DE]" : "bg-[#131B2E] border-[#1E293B]")}>
            <RefreshCw className={clsx("h-12 w-12 animate-spin mb-4", isLight ? "text-[#4C7A3D]" : "text-[#14B8A6]")} />
            <h2 className={clsx("text-xl font-bold mb-2", isLight ? "text-[#2D3B27]" : "text-white")}>Analysis in Progress</h2>
            <p className={clsx("font-mono text-sm", isLight ? "text-slate-600" : "text-slate-400")}>{statusMessage}</p>
            <p className="mt-4 text-xs text-slate-400 max-w-sm">Google Earth Engine is processing Sentinel-2 imagery for your requested periods. This may take a few minutes depending on the size of your shapefile.</p>
          </div>
        )}

        {/* Results */}
        {status === 'complete' && results && (
          <div className="space-y-6">
            
            {/* Summary Header */}
            <div className={clsx("p-6 rounded-2xl border flex items-center justify-between", isLight ? "bg-white border-[#E5E7DE]" : "bg-[#131B2E] border-[#1E293B]")}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Google Earth Engine Verified</span>
                </div>
                <h2 className={clsx("text-2xl font-bold", isLight ? "text-[#2D3B27]" : "text-white")}>SHAPEFILE ANALYSIS REPORT</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadCSV} className={clsx("flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm", isLight ? "bg-[#F0F2EB] text-[#2D3B27] hover:bg-[#E5E7DE]" : "bg-[#1E293B] text-white hover:bg-[#334155]")}>
                  <Download className="h-4 w-4" /> Download CSV
                </button>
                <button onClick={() => setStatus('idle')} className={clsx("flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm border", isLight ? "border-[#E5E7DE] hover:bg-slate-50" : "border-[#334155] hover:bg-[#1E293B] text-white")}>
                  New Analysis
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={clsx("p-4 rounded-2xl border", isLight ? "bg-white border-[#E5E7DE]" : "bg-[#131B2E] border-[#1E293B]")}>
                <div className="text-xs font-semibold text-slate-500 mb-1">Total Features</div>
                <div className={clsx("text-xl font-bold", isLight ? "text-[#2D3B27]" : "text-white")}>{results.summary.feature_count}</div>
              </div>
              <div className={clsx("p-4 rounded-2xl border", isLight ? "bg-white border-[#E5E7DE]" : "bg-[#131B2E] border-[#1E293B]")}>
                <div className="text-xs font-semibold text-slate-500 mb-1">Total Area</div>
                <div className={clsx("text-xl font-bold", isLight ? "text-[#2D3B27]" : "text-white")}>~{results.summary.total_area_sqkm} km²</div>
              </div>
              <div className={clsx("p-4 rounded-2xl border", isLight ? "bg-white border-[#E5E7DE]" : "bg-[#131B2E] border-[#1E293B]")}>
                <div className="text-xs font-semibold text-slate-500 mb-1">Period 1</div>
                <div className={clsx("text-sm font-bold", isLight ? "text-[#2D3B27]" : "text-white")}>{results.period1}</div>
              </div>
              <div className={clsx("p-4 rounded-2xl border", isLight ? "bg-white border-[#E5E7DE]" : "bg-[#131B2E] border-[#1E293B]")}>
                <div className="text-xs font-semibold text-slate-500 mb-1">Period 2</div>
                <div className={clsx("text-sm font-bold", isLight ? "text-[#2D3B27]" : "text-white")}>{results.period2}</div>
              </div>
            </div>

            {/* Spectral Summary */}
            <div className={clsx("p-6 rounded-2xl border", isLight ? "bg-white border-[#E5E7DE]" : "bg-[#131B2E] border-[#1E293B]")}>
              <h3 className={clsx("text-lg font-bold mb-4", isLight ? "text-[#2D3B27]" : "text-white")}>SPECTRAL INDEX SUMMARY</h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { k: "NDVI", v: results.summary.overall_ndvi_change },
                  { k: "NDWI", v: results.summary.overall_ndwi_change },
                  { k: "MNDWI", v: results.summary.overall_mndwi_change },
                  { k: "NDBI", v: results.summary.overall_ndbi_change },
                  { k: "BSI", v: results.summary.overall_bsi_change },
                  { k: "SAVI", v: results.summary.overall_savi_change },
                ].map(item => (
                  <div key={item.k} className={clsx("p-3 rounded-xl border text-center", isLight ? "bg-[#FAFAF7]" : "bg-[#0B1120] border-[#334155]")}>
                    <div className="text-xs font-bold text-slate-500">{item.k} Change</div>
                    <div className={clsx("text-sm font-extrabold mt-1", item.v > 0 ? "text-emerald-500" : item.v < 0 ? "text-red-500" : "text-slate-400")}>
                      {item.v > 0 ? '+' : ''}{item.v}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-4 italic">Note: These values are derived mathematically from Google Earth Engine Sentinel-2 composites. Negative NDVI often indicates vegetation loss, while positive NDBI indicates increased built-up structures.</p>
            </div>

            {/* Feature Table */}
            <div className={clsx("rounded-2xl border overflow-hidden", isLight ? "bg-white border-[#E5E7DE]" : "bg-[#131B2E] border-[#1E293B]")}>
              <div className={clsx("p-4 border-b", isLight ? "border-[#E5E7DE]" : "border-[#334155]")}>
                <h3 className={clsx("text-lg font-bold", isLight ? "text-[#2D3B27]" : "text-white")}>FEATURE LEVEL ANALYSIS</h3>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className={clsx("sticky top-0 z-10 text-xs uppercase font-bold", isLight ? "bg-[#F0F2EB] text-[#6B7568]" : "bg-[#0B1120] text-[#94A3B8]")}>
                    <tr>
                      <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('feature_name')}>Feature ↕</th>
                      <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('ndvi_change')}>NDVI Change ↕</th>
                      <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('ndwi_change')}>NDWI Change ↕</th>
                      <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('ndbi_change')}>NDBI Change ↕</th>
                      <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('bsi_change')}>BSI Change ↕</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedFeatures().map((f: any, idx: number) => (
                      <React.Fragment key={idx}>
                        <tr onClick={() => toggleRow(idx)} className={clsx("border-b last:border-0 cursor-pointer", isLight ? "border-[#E5E7DE] hover:bg-slate-50" : "border-[#1E293B] hover:bg-[#1E293B]", expandedRows.has(idx) ? (isLight ? "bg-slate-50" : "bg-[#1E293B]") : "")}>
                          <td className="px-4 py-3 font-semibold flex items-center gap-2">
                            {expandedRows.has(idx) ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            {f.feature_name}
                          </td>
                          <td className={clsx("px-4 py-3 font-mono", f.ndvi_change > 0 ? "text-emerald-500" : f.ndvi_change < 0 ? "text-red-500" : "")}>{f.ndvi_change > 0 ? '+' : ''}{f.ndvi_change} ({f.ndvi_change_percent}%)</td>
                          <td className={clsx("px-4 py-3 font-mono", f.ndwi_change > 0 ? "text-blue-500" : f.ndwi_change < 0 ? "text-orange-500" : "")}>{f.ndwi_change > 0 ? '+' : ''}{f.ndwi_change}</td>
                          <td className={clsx("px-4 py-3 font-mono", f.ndbi_change > 0 ? "text-purple-500" : f.ndbi_change < 0 ? "text-emerald-500" : "")}>{f.ndbi_change > 0 ? '+' : ''}{f.ndbi_change}</td>
                          <td className="px-4 py-3 font-mono text-slate-500">{f.bsi_change > 0 ? '+' : ''}{f.bsi_change}</td>
                        </tr>
                        {expandedRows.has(idx) && (
                          <tr className={clsx("border-b", isLight ? "bg-slate-100 border-[#E5E7DE]" : "bg-[#0B1120] border-[#1E293B]")}>
                            <td colSpan={5} className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                {['ndvi', 'ndwi', 'mndwi', 'ndbi', 'bsi', 'savi'].map(idxKey => (
                                  <div key={idxKey} className={clsx("p-3 rounded-lg text-xs", isLight ? "bg-white shadow-sm" : "bg-[#131B2E]")}>
                                    <div className="font-bold uppercase text-slate-500 mb-2">{idxKey}</div>
                                    <div className="flex justify-between mb-1">
                                      <span>Period 1:</span>
                                      <span className="font-mono font-semibold">{f[`${idxKey}_period1`] ?? 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between mb-1">
                                      <span>Period 2:</span>
                                      <span className="font-mono font-semibold">{f[`${idxKey}_period2`] ?? 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                                      <span>Change:</span>
                                      <span className={clsx("font-mono font-bold", f[`${idxKey}_change`] > 0 ? "text-emerald-500" : f[`${idxKey}_change`] < 0 ? "text-red-500" : "")}>
                                        {f[`${idxKey}_change`] > 0 ? '+' : ''}{f[`${idxKey}_change`]}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {f.geotiff_stats && (
                                <div className="mt-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                                  <div className="font-bold text-indigo-700 dark:text-indigo-400 text-xs uppercase mb-2 flex items-center gap-1">
                                    <FileImage className="w-3 h-3" /> GeoTIFF Land Cover Classes (Pixel Counts)
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(f.geotiff_stats).map(([cls, count]: any) => (
                                      <div key={cls} className="px-2 py-1 text-xs font-mono bg-white dark:bg-[#131B2E] rounded border border-indigo-200 dark:border-indigo-700">
                                        Class {cls}: <span className="font-bold">{count} px</span>
                                      </div>
                                    ))}
                                    {Object.keys(f.geotiff_stats).length === 0 && <span className="text-xs italic text-slate-500">No data within geometry bounds</span>}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Land Cover GeoTIFF Info (If uploaded) */}
            {results.geotiff_metadata && (
              <div className={clsx("p-6 rounded-2xl border", isLight ? "bg-white border-[#E5E7DE]" : "bg-[#131B2E] border-[#1E293B]")}>
                <h3 className={clsx("text-lg font-bold mb-4", isLight ? "text-[#2D3B27]" : "text-white")}>LAND-COVER CHANGE</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">GeoTIFF Filename</div>
                    <div className="text-sm font-bold">{results.geotiff_metadata.filename}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">CRS</div>
                    <div className="text-sm font-bold">{results.geotiff_metadata.crs}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Dimensions</div>
                    <div className="text-sm font-bold">{results.geotiff_metadata.width} x {results.geotiff_metadata.height} px</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Bands</div>
                    <div className="text-sm font-bold">{results.geotiff_metadata.count} ({results.geotiff_metadata.dtypes[0]})</div>
                  </div>
                </div>
              </div>
            )}

            {/* Map */}
            <div className={clsx("rounded-2xl border overflow-hidden flex flex-col", isLight ? "border-[#E5E7DE]" : "border-[#1E293B]")} style={{ height: 500 }}>
              <div className={clsx("p-3 border-b flex justify-between items-center", isLight ? "bg-[#FAFAF7]" : "bg-[#0B1120]")}>
                <span className="font-bold text-sm flex items-center gap-2"><MapIcon className="h-4 w-4" /> Spatial Boundary</span>
              </div>
              <div className="flex-1 relative z-0">
                <DynamicMap 
                  geoJson={results.geojson} 
                  boundingBox={results.bounding_box}
                />
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
