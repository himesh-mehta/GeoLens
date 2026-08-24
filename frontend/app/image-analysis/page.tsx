"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, FileType, Info, AlertTriangle,
  CheckCircle, Loader2, BrainCircuit, Download, Image as ImageIcon, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackendAPI } from '@/lib/api-client';
import { useTheme } from '@/lib/theme/theme-context';

interface BandInfo {
  code: string;
  name: string;
  spectrum: string;
  badgeBgLight: string;
  badgeTextLight: string;
  badgeBorderLight: string;
  badgeBgDark: string;
  badgeTextDark: string;
  badgeBorderDark: string;
  iconEmoji: string;
}

const SENTINEL2_BANDS: Record<string, BandInfo> = {
  B01: { code: 'B01', name: 'Coastal Aerosol', spectrum: '443 nm', badgeBgLight: 'bg-cyan-50', badgeTextLight: 'text-cyan-800', badgeBorderLight: 'border-cyan-200', badgeBgDark: 'bg-cyan-950/60', badgeTextDark: 'text-cyan-300', badgeBorderDark: 'border-cyan-800/60', iconEmoji: '🌊' },
  B02: { code: 'B02', name: 'Blue', spectrum: '490 nm', badgeBgLight: 'bg-blue-50', badgeTextLight: 'text-blue-800', badgeBorderLight: 'border-blue-200', badgeBgDark: 'bg-blue-950/60', badgeTextDark: 'text-blue-300', badgeBorderDark: 'border-blue-800/60', iconEmoji: '🔵' },
  B03: { code: 'B03', name: 'Green', spectrum: '560 nm', badgeBgLight: 'bg-emerald-50', badgeTextLight: 'text-emerald-800', badgeBorderLight: 'border-emerald-200', badgeBgDark: 'bg-emerald-950/60', badgeTextDark: 'text-emerald-300', badgeBorderDark: 'border-emerald-800/60', iconEmoji: '🟢' },
  B04: { code: 'B04', name: 'Red', spectrum: '665 nm', badgeBgLight: 'bg-rose-50', badgeTextLight: 'text-rose-800', badgeBorderLight: 'border-rose-200', badgeBgDark: 'bg-rose-950/60', badgeTextDark: 'text-rose-300', badgeBorderDark: 'border-rose-800/60', iconEmoji: '🔴' },
  B05: { code: 'B05', name: 'Red Edge 1', spectrum: '705 nm', badgeBgLight: 'bg-amber-50', badgeTextLight: 'text-amber-800', badgeBorderLight: 'border-amber-200', badgeBgDark: 'bg-amber-950/60', badgeTextDark: 'text-amber-300', badgeBorderDark: 'border-amber-800/60', iconEmoji: '🔻' },
  B06: { code: 'B06', name: 'Red Edge 2', spectrum: '740 nm', badgeBgLight: 'bg-amber-50', badgeTextLight: 'text-amber-800', badgeBorderLight: 'border-amber-200', badgeBgDark: 'bg-amber-950/60', badgeTextDark: 'text-amber-300', badgeBorderDark: 'border-amber-800/60', iconEmoji: '🔻' },
  B07: { code: 'B07', name: 'Red Edge 3', spectrum: '783 nm', badgeBgLight: 'bg-amber-50', badgeTextLight: 'text-amber-800', badgeBorderLight: 'border-amber-200', badgeBgDark: 'bg-amber-950/60', badgeTextDark: 'text-amber-300', badgeBorderDark: 'border-amber-800/60', iconEmoji: '🔻' },
  B08: { code: 'B08', name: 'NIR', spectrum: '842 nm', badgeBgLight: 'bg-purple-50', badgeTextLight: 'text-purple-800', badgeBorderLight: 'border-purple-200', badgeBgDark: 'bg-purple-950/60', badgeTextDark: 'text-purple-300', badgeBorderDark: 'border-purple-800/60', iconEmoji: '🟣' },
  B8A: { code: 'B8A', name: 'Narrow NIR', spectrum: '865 nm', badgeBgLight: 'bg-purple-50', badgeTextLight: 'text-purple-800', badgeBorderLight: 'border-purple-200', badgeBgDark: 'bg-purple-950/60', badgeTextDark: 'text-purple-300', badgeBorderDark: 'border-purple-800/60', iconEmoji: '🟣' },
  B09: { code: 'B09', name: 'Water Vapour', spectrum: '945 nm', badgeBgLight: 'bg-sky-50', badgeTextLight: 'text-sky-800', badgeBorderLight: 'border-sky-200', badgeBgDark: 'bg-sky-950/60', badgeTextDark: 'text-sky-300', badgeBorderDark: 'border-sky-800/60', iconEmoji: '☁️' },
  B11: { code: 'B11', name: 'SWIR 1', spectrum: '1610 nm', badgeBgLight: 'bg-orange-50', badgeTextLight: 'text-orange-800', badgeBorderLight: 'border-orange-200', badgeBgDark: 'bg-orange-950/60', badgeTextDark: 'text-orange-300', badgeBorderDark: 'border-orange-800/60', iconEmoji: '🟠' },
  B12: { code: 'B12', name: 'SWIR 2', spectrum: '2190 nm', badgeBgLight: 'bg-stone-100', badgeTextLight: 'text-stone-800', badgeBorderLight: 'border-stone-300', badgeBgDark: 'bg-stone-900', badgeTextDark: 'text-stone-300', badgeBorderDark: 'border-stone-700', iconEmoji: '🟤' },
  UNKNOWN: { code: 'UNKNOWN', name: 'Unknown Band', spectrum: 'N/A', badgeBgLight: 'bg-slate-100', badgeTextLight: 'text-slate-700', badgeBorderLight: 'border-slate-300', badgeBgDark: 'bg-slate-800/80', badgeTextDark: 'text-slate-300', badgeBorderDark: 'border-slate-700', iconEmoji: '⚪' },
};

function detectBandCode(filename: string, serverBand?: string): string {
  if (serverBand && serverBand !== 'UNKNOWN' && SENTINEL2_BANDS[serverBand]) {
    return serverBand;
  }

  const upper = filename.toUpperCase();

  const patterns: [RegExp, string][] = [
    [/[\._\-]B8A[\._\-]/i, 'B8A'],
    [/[\._\-]B0?1[\._\-]/i, 'B01'],
    [/[\._\-]B0?2[\._\-]/i, 'B02'],
    [/[\._\-]B0?3[\._\-]/i, 'B03'],
    [/[\._\-]B0?4[\._\-]/i, 'B04'],
    [/[\._\-]B0?5[\._\-]/i, 'B05'],
    [/[\._\-]B0?6[\._\-]/i, 'B06'],
    [/[\._\-]B0?7[\._\-]/i, 'B07'],
    [/[\._\-]B0?8[\._\-]/i, 'B08'],
    [/[\._\-]B0?9[\._\-]/i, 'B09'],
    [/[\._\-]B11[\._\-]/i, 'B11'],
    [/[\._\-]B12[\._\-]/i, 'B12'],
    [/B8A(?=\.\w+$)/i, 'B8A'],
    [/B0?1(?=\.\w+$)/i, 'B01'],
    [/B0?2(?=\.\w+$)/i, 'B02'],
    [/B0?3(?=\.\w+$)/i, 'B03'],
    [/B0?4(?=\.\w+$)/i, 'B04'],
    [/B0?5(?=\.\w+$)/i, 'B05'],
    [/B0?6(?=\.\w+$)/i, 'B06'],
    [/B0?7(?=\.\w+$)/i, 'B07'],
    [/B0?8(?=\.\w+$)/i, 'B08'],
    [/B0?9(?=\.\w+$)/i, 'B09'],
    [/B11(?=\.\w+$)/i, 'B11'],
    [/B12(?=\.\w+$)/i, 'B12'],
    [/\bB8A\b/i, 'B8A'],
    [/\bB01\b/i, 'B01'], [/\bB02\b/i, 'B02'], [/\bB03\b/i, 'B03'], [/\bB04\b/i, 'B04'],
    [/\bB05\b/i, 'B05'], [/\bB06\b/i, 'B06'], [/\bB07\b/i, 'B07'], [/\bB08\b/i, 'B08'],
    [/\bB09\b/i, 'B09'], [/\bB11\b/i, 'B11'], [/\bB12\b/i, 'B12'],
  ];

  for (const [regex, code] of patterns) {
    if (regex.test(upper)) return code;
  }

  if (upper.includes('SWIR1') || upper.includes('SWIR-1')) return 'B11';
  if (upper.includes('SWIR2') || upper.includes('SWIR-2')) return 'B12';
  if (upper.includes('NIR')) return 'B08';
  if (upper.includes('REDEDGE') || upper.includes('RED_EDGE')) return 'B05';

  return 'UNKNOWN';
}

import { useActiveAnalysis } from '@/lib/analysis-context';

export default function ImageAnalysisPage() {
  const { setActiveAnalysis } = useActiveAnalysis();
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [serverBands, setServerBands] = useState<Record<string, string>>({});
  const [isInspecting, setIsInspecting] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressStage, setProgressStage] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (result) {
      setActiveAnalysis({
        page: 'image-analysis',
        filename: selectedFiles[0]?.name,
        analysis_result: result,
        predictedClass: result.predicted_class,
        confidence: result.confidence_score,
        spectralIndices: result.spectral_indices,
        spectralStats: result.spectral_stats
      });
    }
  }, [result]);

  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validTypes = ['image/png', 'image/jpeg', 'image/tiff'];
    
    for (const file of fileArray) {
      if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.tif') && !file.name.toLowerCase().endsWith('.tiff')) {
        setError('Unsupported format. Please upload PNG, JPG, or GeoTIFF.');
        return;
      }
    }

    setSelectedFiles(fileArray);
    setError(null);
    setResult(null);
    setAiResult(null);
    setProgressStage(0);

    // Call server band inspection asynchronously for GeoTIFF files
    const tiffFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.tif') || f.name.toLowerCase().endsWith('.tiff'));
    if (tiffFiles.length > 0) {
      setIsInspecting(true);
      BackendAPI.inspectBands(tiffFiles)
        .then(res => {
          if (res && res.status === 'success' && Array.isArray(res.bands)) {
            const mapped: Record<string, string> = {};
            res.bands.forEach((b: any) => {
              if (b.filename && b.detected_band) {
                mapped[b.filename] = b.detected_band;
              }
            });
            setServerBands(prev => ({ ...prev, ...mapped }));
          }
        })
        .catch(err => console.warn('[Band Inspection] Async error:', err))
        .finally(() => setIsInspecting(false));
    }

    if (fileArray.length === 1 && fileArray[0].type.startsWith('image/') && !fileArray[0].name.toLowerCase().endsWith('.tif') && !fileArray[0].name.toLowerCase().endsWith('.tiff')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(fileArray[0]);
    } else {
      setPreviewUrl(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const simulateProgress = async () => {
    setProgressStage(1);
    setProgressText(selectedFiles.length > 1 ? "Uploading TIFFs..." : "Uploading image...");
    setProgressPercent(10);
    await new Promise(r => setTimeout(r, 500));
    
    setProgressStage(2);
    setProgressText("Reading raster metadata...");
    setProgressPercent(25);
    await new Promise(r => setTimeout(r, 600));

    setProgressStage(3);
    setProgressText(selectedFiles.length > 1 ? "Detecting Sentinel-2 bands..." : "Inspecting image properties...");
    setProgressPercent(40);
    await new Promise(r => setTimeout(r, 600));

    setProgressStage(4);
    setProgressText(selectedFiles.length > 1 ? "Validating spatial alignment..." : "Detecting image type...");
    setProgressPercent(60);
    await new Promise(r => setTimeout(r, 500));

    setProgressStage(5);
    setProgressText(selectedFiles.length > 1 ? "Processing valid pixels..." : "Extracting visual features...");
    setProgressPercent(75);
    await new Promise(r => setTimeout(r, 600));

    setProgressStage(6);
    setProgressText(selectedFiles.length > 1 ? "Calculating spectral indices..." : "Generating land-cover prediction...");
    setProgressPercent(85);
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    setAiResult(null);
    setResult(null);
    setProgressPercent(0);

    try {
      const progressPromise = simulateProgress();
      // Send multiple files if array has > 1, else send the single file
      const resPromise = BackendAPI.analyzeImage(selectedFiles.length === 1 ? selectedFiles[0] : selectedFiles);
      
      await progressPromise; // wait for initial progress steps
      const res = await resPromise; // wait for real api call
      
      setProgressStage(7);
      setProgressText("Preparing analysis...");
      setProgressPercent(95);
      await new Promise(r => setTimeout(r, 400));
      
      if (res && (res as any).success) {
        setProgressStage(8);
        setProgressText("Complete");
        setProgressPercent(100);
        await new Promise(r => setTimeout(r, 200));
        
        const data = res as any;
        setResult(data);
        
        // Detailed console logging required by spec
        console.log("==========================================");
        if (selectedFiles.length === 1) {
          console.log("[IMAGE ANALYZER] File:", selectedFiles[0].name);
          console.log("[IMAGE ANALYZER] MIME:", selectedFiles[0].type);
        } else {
          console.log("[IMAGE ANALYZER] Files:", selectedFiles.map(f => f.name));
        }
        console.log("[IMAGE ANALYZER] Analysis type:", data.analysis_type);
        console.log("[IMAGE ANALYZER] Source:", data.source);
        console.log("[IMAGE ANALYZER] Verification:", data.verification);
        console.log("[IMAGE ANALYZER] Prediction:", data.prediction);
        console.log("[IMAGE ANALYZER] Spectral indices:", data.spectral_indices);
        console.log("[IMAGE ANALYZER] Image quality:", data.image_quality);
        if (data.analysis_type === "multispectral" && data.image_quality) {
          console.log("[IMAGE ANALYZER] Bands detected:", data.image_quality.bands);
          console.log("[IMAGE ANALYZER] Available spectral bands:", data.image_quality.detected_bands);
          console.log("[IMAGE ANALYZER] Valid pixel percentage:", data.image_quality.valid_pixel_percentage);
        }
        console.log("==========================================");
        
      } else {
        setError((res as any)?.error || 'Image analysis could not be completed.');
      }
    } catch (err) {
      console.error(err);
      setError('Image analysis could not be completed.');
    } finally {
      setIsAnalyzing(false);
      setProgressStage(9);
    }
  };

  const handleAiAnalyze = async () => {
    if (!result) return;
    setIsAiAnalyzing(true);
    setAiError(null);

    try {
      const res = await BackendAPI.aiAnalyzeImage({
        analysis_result: result
      });
      if (res && (res as any).status === 'success') {
        setAiResult((res as any).analysis);
      } else {
        setAiError((res as any)?.message || 'AI interpretation failed.');
      }
    } catch (err) {
      setAiError('Failed to reach the AI analysis backend.');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to results container once analysis is completed
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) {
        setPreviewUrl(null);
      } else if (updated.length === 1 && updated[0].type.startsWith('image/') && !updated[0].name.toLowerCase().endsWith('.tif') && !updated[0].name.toLowerCase().endsWith('.tiff')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target?.result as string);
        reader.readAsDataURL(updated[0]);
      }
      return updated;
    });
  };

  const getBandAnalysisSummary = () => {
    if (selectedFiles.length === 0) return null;

    const detectedMap = selectedFiles.map(f => {
      const code = detectBandCode(f.name, serverBands[f.name]);
      return { file: f, band: SENTINEL2_BANDS[code] || SENTINEL2_BANDS.UNKNOWN };
    });

    const detectedCodes = detectedMap.map(d => d.band.code).filter(c => c !== 'UNKNOWN');

    // Find duplicates
    const codeCounts: Record<string, number> = {};
    detectedCodes.forEach(c => { codeCounts[c] = (codeCounts[c] || 0) + 1; });
    const duplicateCodes = Object.keys(codeCounts).filter(c => codeCounts[c] > 1);

    const hasB02 = detectedCodes.includes('B02');
    const hasB03 = detectedCodes.includes('B03');
    const hasB04 = detectedCodes.includes('B04');
    const hasB08 = detectedCodes.includes('B08') || detectedCodes.includes('B8A');
    const hasB11 = detectedCodes.includes('B11');
    const hasB12 = detectedCodes.includes('B12');

    if (duplicateCodes.length > 0) {
      const dupNames = duplicateCodes.map(c => `${SENTINEL2_BANDS[c].iconEmoji} ${c} (${SENTINEL2_BANDS[c].name})`).join(', ');
      return {
        type: 'warning',
        bgLight: 'bg-amber-50/90 border-amber-200 text-amber-900',
        bgDark: 'bg-amber-950/40 border-amber-800/60 text-amber-200',
        icon: '⚠️',
        title: `Duplicate band detected`,
        details: `Multiple uploaded files are mapped to ${dupNames}. Please review selected files before starting analysis.`
      };
    }

    if (selectedFiles.length > 1 && !hasB08) {
      return {
        type: 'warning',
        bgLight: 'bg-amber-50/90 border-amber-200 text-amber-900',
        bgDark: 'bg-amber-950/40 border-amber-800/60 text-amber-200',
        icon: '⚠️',
        title: `Missing NIR (B08) band`,
        details: `Bands detected: ${detectedCodes.join(', ') || 'None'}. Without NIR (B08), key vegetation indices like NDVI and EVI will not be computed.`
      };
    }

    if (hasB02 && hasB03 && hasB04 && hasB08) {
      const capabilities = ['NDVI', 'NDWI', 'EVI', 'True-Color RGB'];
      if (hasB11 || hasB12) capabilities.push('NDBI (Built-up)');
      return {
        type: 'success',
        bgLight: 'bg-emerald-50/90 border-emerald-200 text-emerald-900',
        bgDark: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200',
        icon: '✅',
        title: `Bands detected: ${detectedCodes.join(', ')}`,
        details: `Ready for ${capabilities.join(', ')} quantitative analysis.`
      };
    }

    if (detectedCodes.length > 0) {
      const readyCaps: string[] = [];
      if (hasB04 && hasB08) readyCaps.push('NDVI');
      if (hasB03 && hasB08) readyCaps.push('NDWI');
      if (hasB02 && hasB03 && hasB04) readyCaps.push('True-Color RGB');

      return {
        type: 'info',
        bgLight: 'bg-blue-50/90 border-blue-200 text-blue-900',
        bgDark: 'bg-blue-950/40 border-blue-800/60 text-blue-200',
        icon: 'ℹ️',
        title: `Bands detected: ${detectedCodes.join(', ')}`,
        details: readyCaps.length > 0
          ? `Sufficient for ${readyCaps.join(' & ')} calculations.`
          : `Band files registered. Upload B02, B03, B04, and B08 for full spectral analysis.`
      };
    }

    return {
      type: 'info',
      bgLight: 'bg-[#FAFAF7] border-[#E5E7DE] text-[#2D3B27]',
      bgDark: 'bg-[#131B2E] border-[#1E293B] text-[#F1F5F9]',
      icon: '📷',
      title: `Single RGB / Image file loaded`,
      details: `Ready for visual feature classification & land cover prediction.`
    };
  };

  return (
    <div className="w-full py-4 px-4 md:px-6 space-y-6">
      {selectedFiles.length === 0 ? (
        <div
          className={`border-2 border-dashed rounded-2xl p-10 md:p-14 text-center transition-all cursor-pointer shadow-2xs ${
            dragOver
              ? isLight
                ? 'border-[#4C7A3D] bg-[#4C7A3D]/10 text-[#2D3B27] scale-[1.005]'
                : 'border-[#14B8A6] bg-[#14B8A6]/10 text-[#F1F5F9] scale-[1.005]'
              : isLight
              ? 'border-[#D8DCCF] bg-white hover:border-[#4C7A3D] hover:bg-[#FAFAF7]'
              : 'border-[#1E293B] bg-[#0B1120] hover:border-[#14B8A6] hover:bg-[#131B2E]'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".png,.jpg,.jpeg,.tif,.tiff"
            multiple
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border transition-colors ${
              dragOver
                ? isLight
                  ? 'bg-[#4C7A3D]/20 border-[#4C7A3D] text-[#4C7A3D]'
                  : 'bg-[#14B8A6]/20 border-[#14B8A6] text-[#14B8A6]'
                : isLight
                ? 'bg-[#4C7A3D]/10 border-[#4C7A3D]/30 text-[#4C7A3D]'
                : 'bg-[#14B8A6]/10 border-[#14B8A6]/30 text-[#14B8A6]'
            }`}
          >
            <Layers className="h-8 w-8" />
          </div>
          <h3 className={`text-lg font-extrabold mb-1 ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
            {dragOver ? 'Drop files here to upload...' : 'Upload Sentinel-2 Bands or Image'}
          </h3>
          <p className={`text-xs mb-6 max-w-md mx-auto ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
            Drag & drop multiple GeoTIFF bands (B02, B03, B04, B08) or a single JPG/PNG file here
          </p>
          <Button
            type="button"
            className={`font-bold text-xs py-2.5 px-6 rounded-xl cursor-pointer shadow-xs text-white ${
              isLight ? 'bg-[#4C7A3D] hover:bg-[#3D6330]' : 'bg-[#14B8A6] hover:bg-[#0F766E]'
            }`}
          >
            Browse Files
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {previewUrl && (
            <div className="relative h-64 md:h-96 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
          
          {selectedFiles.length > 0 && (
            <div className={`p-4 rounded-2xl border ${
              isLight ? 'bg-[#FAFAF7] border-[#E5E7DE]' : 'bg-[#131B2E] border-[#1E293B]'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className={`font-bold text-xs flex items-center gap-2 uppercase tracking-wider ${
                  isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'
                }`}>
                  <Layers className={`h-4 w-4 ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`} /> SELECTED FILES ({selectedFiles.length})
                </h4>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`text-xs font-bold transition-colors hover:underline cursor-pointer ${
                    isLight ? 'text-[#4C7A3D] hover:text-[#3D6330]' : 'text-[#14B8A6] hover:text-[#0D9488]'
                  }`}
                >
                  + Add More Files
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {selectedFiles.map((f, i) => {
                  const bandCode = detectBandCode(f.name, serverBands[f.name]);
                  const bandInfo = SENTINEL2_BANDS[bandCode] || SENTINEL2_BANDS.UNKNOWN;

                  return (
                    <div
                      key={i}
                      className={`flex items-start justify-between gap-2.5 text-xs font-medium p-3 rounded-xl border shadow-2xs transition-colors ${
                        isLight
                          ? 'bg-white border-[#E5E7DE]'
                          : 'bg-[#0F172A] border-[#1E293B]'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <CheckCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                          isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'
                        }`} />
                        <div className="flex flex-col min-w-0 flex-1 space-y-1">
                          <span className={`truncate font-semibold text-xs ${
                            isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'
                          }`} title={f.name}>
                            {f.name}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[11px] font-medium ${
                              isLight ? 'text-[#6B7568]' : 'text-slate-400'
                            }`}>
                              {(f.size / (1024 * 1024)).toFixed(2)} MB · {f.name.split('.').pop()?.toUpperCase() || 'FILE'}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-2xs ${
                              isLight
                                ? `${bandInfo.badgeBgLight} ${bandInfo.badgeTextLight} ${bandInfo.badgeBorderLight}`
                                : `${bandInfo.badgeBgDark} ${bandInfo.badgeTextDark} ${bandInfo.badgeBorderDark}`
                            }`}>
                              <span>{bandInfo.iconEmoji}</span>
                              <span>{bandInfo.code !== 'UNKNOWN' ? `${bandInfo.code} (${bandInfo.name})` : 'Unknown Band'}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className={`p-1 rounded-md transition-colors cursor-pointer flex-shrink-0 text-base font-bold leading-none ${
                          isLight
                            ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-slate-400 hover:text-red-400 hover:bg-red-950/40'
                        }`}
                        title="Remove file"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* BAND ANALYSIS SUMMARY BANNER ABOVE ANALYZE BUTTON */}
          {(() => {
            const summary = getBandAnalysisSummary();
            if (!summary) return null;
            return (
              <div className={`p-4 rounded-xl border flex items-start gap-3 transition-colors shadow-2xs ${
                isLight ? summary.bgLight : summary.bgDark
              }`}>
                <span className="text-lg leading-none flex-shrink-0 mt-0.5">{summary.icon}</span>
                <div className="space-y-0.5 text-xs min-w-0 flex-1">
                  <h5 className="font-extrabold text-sm">{summary.title}</h5>
                  <p className="leading-relaxed opacity-95">{summary.details}</p>
                </div>
              </div>
            );
          })()}

          <div className="flex gap-3">
            <Button
              type="button"
              className={`flex-1 relative overflow-hidden font-bold text-sm py-3 px-6 rounded-xl cursor-pointer shadow-xs text-white transition-colors ${
                isLight ? 'bg-[#4C7A3D] hover:bg-[#3D6330]' : 'bg-[#14B8A6] hover:bg-[#0F766E]'
              }`}
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing && (
                <div
                  className={`absolute left-0 top-0 bottom-0 transition-all duration-300 ${
                    isLight ? 'bg-[#3D6330]' : 'bg-[#0F766E]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              )}
              <span className="relative flex items-center justify-center gap-2">
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {progressText} ({progressPercent}%)
                  </>
                ) : 'Analyze Image'}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className={`font-bold text-sm py-3 px-6 rounded-xl transition-colors cursor-pointer border ${
                isLight
                  ? 'bg-white border-[#E5E7DE] text-[#2D3B27] hover:bg-[#FAFAF7]'
                  : 'bg-[#0F172A] border-[#1E293B] text-[#F1F5F9] hover:bg-[#1E293B]'
              }`}
              onClick={() => { setSelectedFiles([]); setPreviewUrl(null); setResult(null); setError(null); setAiResult(null); }}
            >
              Clear
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-[#fef2f2] border border-[#fecaca] rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[#ef4444] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#b91c1c]">{error}</p>
            </div>
          )}

          {result && (
            <div ref={resultsRef} className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-white border border-[#e2e8f0] rounded-lg">
                  <h3 className="font-bold text-[#0f172a] text-lg mb-4">IMAGE ANALYSIS RESULT</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs text-[#64748b] uppercase font-semibold">Data Source</span>
                      <p className="font-medium text-[#0f172a]">{result.source || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[#64748b] uppercase font-semibold">Processing</span>
                      <p className="font-medium text-[#0f172a]">{result.analysis_type === 'visual' ? 'Visual Analysis Only' : 'Raster-based spectral analysis'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[#64748b] uppercase font-semibold">Satellite Verification</span>
                      <div className="flex items-center gap-1">
                        {result.verification === 'Source metadata dependent' || result.verification === 'Available' ? <CheckCircle className="h-4 w-4 text-[#10b981]" /> : <AlertTriangle className="h-4 w-4 text-[#f59e0b]" />}
                        <p className="font-medium text-[#0f172a]">{result.verification}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* For Multispectral, show detected bands again here */}
                  {result.analysis_type === 'multispectral' && result.image_quality?.detected_bands && (
                    <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
                      <span className="text-xs text-[#64748b] uppercase font-semibold mb-2 block">Bands Detected</span>
                      <div className="flex flex-wrap gap-2">
                        {result.image_quality.detected_bands.map((band: string) => (
                           <span key={band} className="px-2 py-1 bg-[#eff6ff] text-[#1e40af] text-xs font-medium rounded">
                             {band}
                           </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* IMAGE QUALITY SECTION */}
                <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg">
                   <h4 className="text-sm font-bold text-[#0f172a] mb-4">DATA QUALITY</h4>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><span className="text-[#64748b] block mb-1">Resolution</span><p className="font-medium text-[#0f172a]">{result.image_quality?.width} x {result.image_quality?.height}</p></div>
                      <div><span className="text-[#64748b] block mb-1">Bands available</span><p className="font-medium text-[#0f172a]">{result.image_quality?.bands || 3}</p></div>
                      <div><span className="text-[#64748b] block mb-1">Valid pixels</span><p className="font-medium text-[#0f172a]">{result.image_quality?.valid_pixel_percentage !== undefined ? `${result.image_quality.valid_pixel_percentage}%` : 'N/A'}</p></div>
                      <div><span className="text-[#64748b] block mb-1">NoData pixels</span><p className="font-medium text-[#0f172a]">{result.image_quality?.nodata_percentage !== undefined ? `${result.image_quality.nodata_percentage}%` : '0%'}</p></div>
                      <div><span className="text-[#64748b] block mb-1">CRS</span><p className="font-medium text-[#0f172a]">{result.image_quality?.geo_referenced ? 'Verified via GeoKeys' : 'Unknown'}</p></div>
                      <div><span className="text-[#64748b] block mb-1">Band alignment</span><p className="font-medium text-[#0f172a]">{result.analysis_type === 'multispectral' ? 'Verified' : 'N/A'}</p></div>
                   </div>
                   
                   {/* Rasterio Resampling / Metadata */}
                   {result.image_quality?.resampling_performed && result.image_quality.resampling_performed.length > 0 && (
                     <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
                       <span className="text-xs text-[#64748b] uppercase font-semibold mb-2 block">Resampling Performed</span>
                       <ul className="list-disc pl-5 text-sm text-[#0f172a]">
                         {result.image_quality.resampling_performed.map((info: string, idx: number) => (
                           <li key={idx}>{info}</li>
                         ))}
                       </ul>
                     </div>
                   )}
                   {result.image_quality?.band_metadata && (
                     <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
                       <span className="text-xs text-[#64748b] uppercase font-semibold mb-2 block">Native Resolutions</span>
                       <div className="flex flex-wrap gap-2 text-sm">
                         {Object.entries(result.image_quality.band_metadata).map(([band, res]: [string, any]) => (
                           <span key={band} className="text-[#0f172a]"><strong>{band}:</strong> {res}</span>
                         ))}
                       </div>
                     </div>
                   )}
                </div>

                {/* PREDICTION SECTION (RESTORED) */}
                <div className="p-4 bg-white border border-[#e2e8f0] rounded-lg">
                  <h4 className="text-sm font-bold text-[#0f172a] mb-4">
                    {result.analysis_type === 'visual' ? 'VISUAL IMAGE RESULT' : 'PREDICTION RESULT'}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card className="bg-[#f8fafc] border-[#e2e8f0]">
                      <CardContent className="p-4">
                        <p className="text-xs text-[#64748b] uppercase font-semibold">Predicted Land Cover</p>
                        <p className="text-lg font-bold mt-1 text-[#0f172a]">{result.prediction?.class || 'Unknown'}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#f8fafc] border-[#e2e8f0]">
                      <CardContent className="p-4">
                        <p className="text-xs text-[#64748b] uppercase font-semibold">Prediction Confidence</p>
                        <p className="text-lg font-bold mt-1 text-[#0f172a]">{result.prediction?.confidence ? `${Math.round(result.prediction.confidence * 100)}%` : 'Not Available'}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#f8fafc] border-[#e2e8f0]">
                      <CardContent className="p-4">
                        <p className="text-xs text-[#64748b] uppercase font-semibold">Validation Accuracy</p>
                        <p className="text-lg font-bold mt-1 text-[#64748b]">Not Available</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* SPECTRAL INDICES (ONLY FOR MULTISPECTRAL) */}
                {result.is_quantitative && (
                  <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg">
                    <h4 className="text-sm font-bold text-[#0f172a] mb-4">SPECTRAL ANALYSIS</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* NDVI */}
                      <Card className="bg-white border-[#e2e8f0]">
                        <CardContent className="p-4">
                          <p className="text-xs text-[#64748b] uppercase font-semibold">NDVI</p>
                          {result.spectral_indices?.ndvi?.value !== undefined && result.spectral_indices?.ndvi?.value !== null && typeof result.spectral_indices.ndvi.value === 'number' ? (
                            <>
                              <p className="text-lg font-bold mt-1 text-[#0f172a]">{result.spectral_indices.ndvi.value}</p>
                              <p className="text-xs text-[#64748b] mt-1">Calculated from B08 + B04</p>
                              {result.spectral_indices.ndvi.interpretation && (
                                <p className="text-sm mt-2 text-[#0f172a]"><strong>Interpretation:</strong> {result.spectral_indices.ndvi.interpretation}</p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm mt-1 font-medium text-[#ef4444]">{result.spectral_indices?.ndvi?.value || result.spectral_indices?.ndvi || 'Unavailable'}</p>
                          )}
                        </CardContent>
                      </Card>
                      
                      {/* NDWI */}
                      <Card className="bg-white border-[#e2e8f0]">
                        <CardContent className="p-4">
                          <p className="text-xs text-[#64748b] uppercase font-semibold">NDWI</p>
                          {result.spectral_indices?.ndwi?.value !== undefined && result.spectral_indices?.ndwi?.value !== null && typeof result.spectral_indices.ndwi.value === 'number' ? (
                            <>
                              <p className="text-lg font-bold mt-1 text-[#0f172a]">{result.spectral_indices.ndwi.value}</p>
                              <p className="text-xs text-[#64748b] mt-1">Calculated from B03 + B08</p>
                              {result.spectral_indices.ndwi.interpretation && (
                                <p className="text-sm mt-2 text-[#0f172a]"><strong>Interpretation:</strong> {result.spectral_indices.ndwi.interpretation}</p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm mt-1 font-medium text-[#ef4444]">{result.spectral_indices?.ndwi?.value || result.spectral_indices?.ndwi || 'Unavailable'}</p>
                          )}
                        </CardContent>
                      </Card>
                      
                      {/* NDBI */}
                      <Card className="bg-white border-[#e2e8f0]">
                        <CardContent className="p-4">
                          <p className="text-xs text-[#64748b] uppercase font-semibold">NDBI</p>
                          {result.spectral_indices?.ndbi?.value !== undefined && result.spectral_indices?.ndbi?.value !== null && typeof result.spectral_indices.ndbi.value === 'number' ? (
                            <>
                              <p className="text-lg font-bold mt-1 text-[#0f172a]">{result.spectral_indices.ndbi.value}</p>
                              <p className="text-xs text-[#64748b] mt-1">Calculated from B11 + B08</p>
                              {result.spectral_indices.ndbi.interpretation && (
                                <p className="text-sm mt-2 text-[#0f172a]"><strong>Interpretation:</strong> {result.spectral_indices.ndbi.interpretation}</p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm mt-1 font-medium text-[#ef4444]">{result.spectral_indices?.ndbi?.value || result.spectral_indices?.ndbi || 'Unavailable'}</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
                {/* ANALYSIS SUMMARY */}
                {result.analysis && (
                  <Card className="border-[#e2e8f0]">
                    <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0] py-3">
                      <CardTitle className="text-sm font-semibold text-[#0f172a]">Analysis Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <p className="text-sm text-[#334155] mt-1">{result.analysis}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* AI REPORT */}
              <div className="pt-4 border-t border-[#e2e8f0]">
                {isAiAnalyzing ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-12 h-12 bg-[#eff6ff] rounded-full flex items-center justify-center">
                      <BrainCircuit className="h-6 w-6 text-[#3b82f6] animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#0f172a]">AI is analyzing the extracted properties...</h4>
                      <p className="text-sm text-[#64748b]">Generating scientific interpretation.</p>
                    </div>
                  </div>
                ) : aiResult ? (
                  <Card className="border-[#bfdbfe] bg-[#f8fafc]">
                    <CardHeader className="pb-3 border-b border-[#e2e8f0]">
                      <CardTitle className="flex items-center gap-2 text-lg text-[#1e40af]">
                        <BrainCircuit className="h-5 w-5 text-[#3b82f6]" /> AI Scientific Interpretation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      {aiResult.executive_summary && (
                        <div>
                          <h4 className="font-semibold text-[#0f172a] text-sm uppercase tracking-wider mb-2">Executive Summary</h4>
                          <p className="text-[#334155] text-sm leading-relaxed">{aiResult.executive_summary}</p>
                        </div>
                      )}
                      {aiResult.land_cover_interpretation && (
                        <div>
                          <h4 className="font-semibold text-[#0f172a] text-sm uppercase tracking-wider mb-2">Land Cover</h4>
                          <p className="text-[#334155] text-sm leading-relaxed">{aiResult.land_cover_interpretation}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Button onClick={handleAiAnalyze} variant="outline" className="w-full h-12 border-[#cbd5e1] text-[#334155]">
                    <BrainCircuit className="h-4 w-4 mr-2 text-[#3b82f6]" /> Generate AI Interpretation
                  </Button>
                )}
                
                {aiError && (
                  <div className="mt-4 p-4 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
                    <p className="text-sm text-[#b91c1c]">{aiError}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
