"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Columns, Calendar, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { eoService, Location, ImageryDate } from '@/services/eo-service';
import { comparisonService, ComparisonResult, ChangeFinding } from '@/services/comparison-service';
import { FindingsList } from '@/components/analysis/findings-list';
import { Finding } from '@/services/analysis-service';
import { AIAssistant } from '@/components/analysis/ai-assistant';
import { TechDetailsPanel, TechDetailGroup } from '@/components/analysis/tech-details-panel';
import { areasService } from '@/services/areas-service';
import { useTranslation } from '@/lib/i18n';

import { BackendAPI } from '@/lib/api-client';

const AVAILABLE_YEARS = [
  { year: 2018, status: 'validated' },
  { year: 2019, status: 'unseen_inference' },
  { year: 2020, status: 'unseen_inference' },
  { year: 2021, status: 'unseen_inference' },
  { year: 2022, status: 'unseen_inference' },
  { year: 2023, status: 'unseen_inference' },
  { year: 2024, status: 'validated' },
];

function DynamicCompareContent({ lat, lon, polygonStr }: { lat?: string, lon?: string, polygonStr?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([2018, 2024]);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasRunInitial, setHasRunInitial] = useState(false);

  const handleRunComparison = async () => {
    setIsAnalyzing(true);
    setError(null);
    setResults([]);
    try {
      const newResults = [];
      for (const year of selectedYears.sort()) {
        let res;
        if (lat && lon) {
          res = await BackendAPI.predictLocation(parseFloat(lat), parseFloat(lon), year);
        } else if (polygonStr) {
          const poly = JSON.parse(polygonStr);
          // ensure polygon is properly closed and flipped if needed, same as explorer
          const geoCoords = poly.map((c: any) => [c[1], c[0]]);
          if (geoCoords.length > 0 && (geoCoords[0][0] !== geoCoords[geoCoords.length-1][0] || geoCoords[0][1] !== geoCoords[geoCoords.length-1][1])) {
             geoCoords.push(geoCoords[0]);
          }
          res = await BackendAPI.predictPolygon(geoCoords, year);
        }
        if (res && res.status !== 'error') {
          newResults.push(res);
        }
      }
      setResults(newResults);
      if (newResults.length >= 2) {
        areasService.addHistoryItem({
          areaId: lat && lon ? `custom-${lat}-${lon}` : `polygon-${Date.now()}`,
          areaName: lat && lon ? `Compare Point: ${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}` : `Compare Polygon Area`,
          type: 'comparison',
          beforeDate: String(selectedYears[0]),
          afterDate: String(selectedYears[selectedYears.length - 1]),
          status: 'completed',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Comparison failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!hasRunInitial && searchParams.get('autorun') === 'true') {
      setHasRunInitial(true);
      
      const beforeStr = searchParams.get('before');
      const afterStr = searchParams.get('after');
      if (beforeStr && afterStr) {
        setSelectedYears([parseInt(beforeStr), parseInt(afterStr)]);
      }
      
      // We must wait for state to update or just run it with the explicit years
      const yearsToRun = beforeStr && afterStr ? [parseInt(beforeStr), parseInt(afterStr)] : selectedYears;
      
      setIsAnalyzing(true);
      setError(null);
      setResults([]);
      
      const runAuto = async () => {
        try {
          const newResults = [];
          for (const year of yearsToRun.sort()) {
            let res;
            if (lat && lon) {
              res = await BackendAPI.predictLocation(parseFloat(lat), parseFloat(lon), year);
            } else if (polygonStr) {
              const poly = JSON.parse(polygonStr);
              const geoCoords = poly.map((c: any) => [c[1], c[0]]);
              if (geoCoords.length > 0 && (geoCoords[0][0] !== geoCoords[geoCoords.length-1][0] || geoCoords[0][1] !== geoCoords[geoCoords.length-1][1])) {
                 geoCoords.push(geoCoords[0]);
              }
              res = await BackendAPI.predictPolygon(geoCoords, year);
            }
            if (res && res.status !== 'error') {
              newResults.push(res);
            }
          }
          setResults(newResults);
        } catch (err: any) {
          setError(err.message || 'Comparison failed');
        } finally {
          setIsAnalyzing(false);
        }
      };
      
      runAuto();
    }
  }, [hasRunInitial, searchParams, lat, lon, polygonStr]);

  const toggleYear = (y: number) => {
    if (selectedYears.includes(y)) {
      if (selectedYears.length > 2) {
        setSelectedYears(selectedYears.filter(year => year !== y));
      }
    } else {
      setSelectedYears([...selectedYears, y]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-8">
      <div className="flex items-center gap-4 border-b border-brand-neutral-200 pb-4">
        <Button variant="secondary" size="sm" onClick={() => router.push('/explorer')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Explorer
        </Button>
        <h2 className="text-2xl font-bold text-brand-neutral-900">Multi-Year Dynamic Comparison</h2>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold uppercase text-brand-neutral-700 tracking-wider mb-3">Select Years to Compare (Min 2)</h3>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_YEARS.map(y => (
                <button
                  key={y.year}
                  onClick={() => toggleYear(y.year)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    selectedYears.includes(y.year)
                      ? 'bg-brand-green-700 text-white border-brand-green-700'
                      : 'bg-white text-brand-neutral-700 border-brand-neutral-300 hover:bg-brand-neutral-50'
                  }`}
                >
                  {y.year} {y.status === 'validated' && '★'}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleRunComparison} disabled={isAnalyzing || selectedYears.length < 2} className="bg-brand-green-700 text-white">
            {isAnalyzing ? 'Analyzing...' : 'Run Comparison'}
          </Button>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((res, i) => {
            const isVal = res.year_status === 'validated_year';
            return (
              <Card key={i} className="border-brand-neutral-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold">{res.year}</span>
                    <Badge variant={isVal ? 'success' : 'warning'}>
                      {isVal ? 'Validated' : 'Inference Only'}
                    </Badge>
                  </div>
                  {res.prediction && (
                    <div>
                      <h4 className="text-xs text-brand-neutral-500 uppercase">Predicted Class</h4>
                      <p className="text-lg font-bold">{res.prediction}</p>
                      <p className="text-sm text-brand-neutral-500">Confidence: {(res.confidence * 100).toFixed(1)}%</p>
                    </div>
                  )}
                  {res.distribution && (
                    <div>
                      <h4 className="text-xs text-brand-neutral-500 uppercase mb-2">Class Distribution</h4>
                      {Object.entries(res.distribution).map(([cls, data]: any) => (
                        <div key={cls} className="flex justify-between text-sm mb-1">
                          <span>{cls}</span>
                          <span className="font-bold">{data.regional_landcover_percentage}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const areaId = searchParams.get('area');
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const polygonStr = searchParams.get('polygon');

  if (lat && lon || polygonStr) {
    return <DynamicCompareContent lat={lat || undefined} lon={lon || undefined} polygonStr={polygonStr || undefined} />;
  }

  if (areaId && areaId.startsWith('custom-')) {
    const parts = areaId.split('-');
    if (parts.length >= 3) {
      return <DynamicCompareContent lat={parts[1]} lon={parts[2]} />;
    }
  }

  const { t } = useTranslation();

  // Core Data States
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [location, setLocation] = useState<Location | null>(null);
  const [dates, setDates] = useState<ImageryDate[]>([]);
  
  // Date Picker selections
  const [beforeDateId, setBeforeDateId] = useState<string>('may-2022');
  const [afterDateId, setAfterDateId] = useState<string>('may-2025');

  // Mode and Comparison States
  const [compareMode, setCompareMode] = useState<'side-by-side' | 'swipe'>('side-by-side');
  const [compareState, setCompareState] = useState<'setup' | 'progress' | 'results' | 'error'>('setup');
  const [compareStep, setCompareStep] = useState(0);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [selectedChange, setSelectedChange] = useState<ChangeFinding | null>(null);
  const [imgZoom, setImgZoom] = useState(1);
  const [swipePosition, setSwipePosition] = useState(50);

  // Image URLs resolved from service
  const [beforeImageUrl, setBeforeImageUrl] = useState<string | null>(null);
  const [afterImageUrl, setAfterImageUrl] = useState<string | null>(null);

  // Load location and available dates list
  useEffect(() => {
    if (!areaId) {
      setIsLoadingLocation(false);
      return;
    }

    const initCompare = async () => {
      try {
        const loc = await eoService.getLocationById(areaId);
        if (!loc) {
          setLocation(null);
          setIsLoadingLocation(false);
          return;
        }

        setLocation(loc);

        const dateOptions = await eoService.getAvailableDates(areaId);
        setDates(dateOptions);

        const available = dateOptions.filter(d => d.isAvailable);
        if (available.length >= 2) {
          setBeforeDateId(available[0].id);
          setAfterDateId(available[1].id);
        }
      } catch (err) {
        console.error("Failed to load compare context", err);
      } finally {
        setIsLoadingLocation(false);
      }
    };

    initCompare();
  }, [areaId]);

  // Execute comparison whenever location or dates selection changes
  useEffect(() => {
    if (!location || !beforeDateId || !afterDateId) return;

    const executeComparison = async () => {
      setCompareState('progress');
      setCompareStep(0);
      setSelectedChange(null);

      try {
        const beforeUrl = await eoService.getImagery(location.id, beforeDateId);
        const afterUrl = await eoService.getImagery(location.id, afterDateId);
        setBeforeImageUrl(beforeUrl);
        setAfterImageUrl(afterUrl);

        // Run mock comparison service logic
        const result = await comparisonService.runComparison(
          location.id,
          beforeDateId,
          afterDateId,
          (stepIndex) => setCompareStep(stepIndex)
        );
        
        setComparisonResult(result);
        setCompareState('results');

        // Phase 6: record comparison history
        const beforeLabel = dates.find(d => d.id === beforeDateId)?.label ?? beforeDateId;
        const afterLabel = dates.find(d => d.id === afterDateId)?.label ?? afterDateId;
        areasService.addHistoryItem({
          areaId: location.id,
          areaName: location.name,
          type: 'comparison',
          beforeDate: beforeLabel,
          afterDate: afterLabel,
          status: 'completed',
        });
      } catch (err) {
        console.error("Comparison failed", err);
        setCompareState('error');
      }
    };

    executeComparison();
  }, [location, beforeDateId, afterDateId]);

  // Handle Select Finding by ID from contextual assistant evidence click
  const handleSelectFindingById = (findingId: string) => {
    if (!comparisonResult) return;
    const match = comparisonResult.changes.find(c => c.id === findingId);
    if (match) {
      setSelectedChange(match);
    }
  };

  if (isLoadingLocation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingState 
          message={t('compare.loadingComparison')} 
          description={t('compare.loadingDesc')} 
          size="lg"
        />
      </div>
    );
  }

  // Empty state: No area selected
  if (!areaId || !location) {
    return (
      <div className="max-w-md mx-auto py-8">
        <ErrorState
          title={t('compare.noArea')}
          message={t('compare.noAreaDesc')}
          onRetry={() => router.push('/select-area')}
          retryText={t('compare.selectArea')}
        />
      </div>
    );
  }

  // Empty state: Less than 2 observation dates available
  const availableDates = dates.filter(d => d.isAvailable);
  if (availableDates.length < 2) {
    return (
      <div className="max-w-md mx-auto py-8">
        <ErrorState
          title={t('compare.notEnoughImages')}
          message={t('compare.notEnoughImagesDesc')}
          onRetry={() => router.push('/select-area')}
          retryText={t('selectArea.changeArea')}
        />
      </div>
    );
  }

  // Helper colors
  const getHighlightStrokeColor = (category: string) => {
    switch (category) {
      case 'vegetation': return '#16a34a'; // Green
      case 'built-up': return '#7c3aed';  // Purple
      case 'water': return '#0284c7';     // Blue
      default: return '#cbd5e1';
    }
  };

  const getHighlightFillColor = (category: string) => {
    switch (category) {
      case 'vegetation': return 'rgba(22, 163, 74, 0.06)';
      case 'built-up': return 'rgba(124, 88, 237, 0.06)';
      case 'water': return 'rgba(2, 132, 199, 0.06)';
      default: return 'transparent';
    }
  };

  // Convert ChangeFinding items to Finding compatible objects for FindingsList component
  const changeFindingsAsFindings: Finding[] = (comparisonResult?.changes || []).map(c => ({
    id: c.id,
    category: c.category,
    title: c.title,
    statusLabel: c.statusLabel,
    status: c.status,
    subtitle: c.subtitle,
    description: c.description,
    highlight: c.highlight
  }));

  const getTechDetailsGroups = (): TechDetailGroup[] => {
    const tech = comparisonResult?.technicalDetails;
    return [
      {
        heading: t('techPanel.eoData'),
        fields: [
          { label: t('techPanel.sensor'), value: tech?.sensor },
          { label: t('techPanel.resolution'), value: tech?.resolution },
          { label: t('techPanel.source'), value: tech?.source },
        ]
      },
      {
        heading: t('techPanel.location'),
        fields: [
          { label: t('techPanel.area'), value: `${location.name}, ${location.region}` },
          { label: t('techPanel.coordinates'), value: tech?.coordinates },
        ]
      },
      {
        heading: t('techPanel.changeAnalysis'),
        fields: [
          { label: t('techPanel.beforeDate'), value: dates.find(d => d.id === beforeDateId)?.label || beforeDateId },
          { label: t('techPanel.afterDate'), value: dates.find(d => d.id === afterDateId)?.label || afterDateId },
          { label: t('techPanel.pipeline'), value: tech?.processing },
        ]
      }
    ];
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-2 md:py-4">
      {/* Top Location Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-neutral-200 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase font-bold text-brand-neutral-700 tracking-wider">Location:</span>
          <h3 className="text-lg md:text-xl font-bold text-brand-neutral-900">
            {location.name}, {location.region}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Comparison View Mode Pills */}
          <div className="flex items-center gap-2 bg-brand-neutral-100 p-1 rounded-brand-md self-start sm:self-auto">
            <button
              onClick={() => setCompareMode('side-by-side')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                compareMode === 'side-by-side'
                  ? 'bg-white text-brand-neutral-900 shadow-brand-sm'
                  : 'text-brand-neutral-700 hover:text-brand-neutral-900'
              }`}
            >
              {t('compare.sideBySide')}
            </button>
            <button
              onClick={() => setCompareMode('swipe')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                compareMode === 'swipe'
                  ? 'bg-white text-brand-neutral-900 shadow-brand-sm'
                  : 'text-brand-neutral-700 hover:text-brand-neutral-900'
              }`}
            >
              {t('compare.swipe')}
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/viewer?area=${location.id}`)}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            {t('compare.backToViewer')}
          </Button>
        </div>
      </div>

      {/* Date Pickers Controls */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Earlier Date selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-neutral-700 uppercase tracking-wider">{t('compare.beforeDate')}:</span>
              <select
                value={beforeDateId}
                onChange={(e) => setBeforeDateId(e.target.value)}
                className="border border-brand-neutral-200 bg-white rounded-brand-md px-3 py-1.5 text-xs md:text-sm font-semibold text-brand-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-green-700 cursor-pointer"
              >
                {availableDates.map((d) => (
                  <option key={d.id} value={d.id} disabled={d.id === afterDateId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-brand-neutral-700 font-bold text-sm hidden sm:inline">→</span>

            {/* Later Date selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-neutral-700 uppercase tracking-wider">{t('compare.afterDate')}:</span>
              <select
                value={afterDateId}
                onChange={(e) => setAfterDateId(e.target.value)}
                className="border border-brand-neutral-200 bg-white rounded-brand-md px-3 py-1.5 text-xs md:text-sm font-semibold text-brand-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-green-700 cursor-pointer"
              >
                {availableDates.map((d) => (
                  <option key={d.id} value={d.id} disabled={d.id === beforeDateId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Badge variant="info">
            Comparing 3-year gap
          </Badge>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {compareState === 'progress' ? (
        <div className="py-12">
          <LoadingState
            message={t('compare.loadingComparison')}
            description={t('compare.loadingDesc')}
            size="lg"
          />
        </div>
      ) : (
        // Main 3-Column Grid Layout (Responsive Stacking on mobile)
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* CENTER PANEL: Comparison display and findings - Takes 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            
            {compareMode === 'side-by-side' ? (
              // Side-by-Side Dual Frame Display
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Frame 1: Before Image */}
                <Card className="overflow-hidden border border-brand-neutral-200">
                  <div className="bg-brand-neutral-100 border-b border-brand-neutral-200 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {t('compare.before')}: {dates.find(d => d.id === beforeDateId)?.label}
                    </span>
                  </div>
                  <div className="w-full h-[250px] md:h-[380px] bg-brand-neutral-50 relative flex items-center justify-center overflow-hidden">
                    {beforeImageUrl ? (
                      <div className="w-full h-full relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={beforeImageUrl}
                          alt="Earlier Observation"
                          className="object-cover w-full h-full"
                          draggable={false}
                        />
                        {/* Integrity Disclaimer Badge */}
                        <div className="absolute top-2 left-2 z-10">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/90 text-white shadow-xs">
                            Demo / Feature-Derived
                          </span>
                        </div>
                        {/* Vector bounding box overlay */}
                        {selectedChange && selectedChange.highlight && (
                          <div className="absolute inset-0 pointer-events-none">
                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                              <rect
                                x={selectedChange.highlight.x}
                                y={selectedChange.highlight.y}
                                width={selectedChange.highlight.w}
                                height={selectedChange.highlight.h}
                                fill={getHighlightFillColor(selectedChange.category)}
                                stroke={getHighlightStrokeColor(selectedChange.category)}
                                strokeWidth="2"
                                strokeDasharray="4,4"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-brand-neutral-700">{t('common.loading')}</span>
                    )}
                  </div>
                </Card>

                {/* Frame 2: After Image */}
                <Card className="overflow-hidden border border-brand-neutral-200">
                  <div className="bg-brand-neutral-100 border-b border-brand-neutral-200 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {t('compare.after')}: {dates.find(d => d.id === afterDateId)?.label}
                    </span>
                  </div>
                  <div className="w-full h-[250px] md:h-[380px] bg-brand-neutral-50 relative flex items-center justify-center overflow-hidden">
                    {afterImageUrl ? (
                      <div className="w-full h-full relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={afterImageUrl}
                          alt="Recent Observation"
                          className="object-cover w-full h-full"
                          draggable={false}
                        />
                        {/* Integrity Disclaimer Badge */}
                        <div className="absolute top-2 left-2 z-10">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/90 text-white shadow-xs">
                            Demo / Feature-Derived
                          </span>
                        </div>
                        {/* Vector bounding box overlay */}
                        {selectedChange && selectedChange.highlight && (
                          <div className="absolute inset-0 pointer-events-none">
                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                              <rect
                                x={selectedChange.highlight.x}
                                y={selectedChange.highlight.y}
                                width={selectedChange.highlight.w}
                                height={selectedChange.highlight.h}
                                fill={getHighlightFillColor(selectedChange.category)}
                                stroke={getHighlightStrokeColor(selectedChange.category)}
                                strokeWidth="2"
                                strokeDasharray="4,4"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-brand-neutral-700">{t('common.loading')}</span>
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              // Interactive Swipe Comparison Frame
              <Card className="overflow-hidden relative bg-brand-neutral-100 border border-brand-neutral-200 h-[350px] md:h-[500px] select-none">
                <div className="w-full h-full relative overflow-hidden">
                  {/* Bottom Image (Before Date - May 2022) */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {beforeImageUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={beforeImageUrl} 
                        className="object-cover w-full h-full" 
                        alt="Earlier Observation" 
                        draggable={false}
                      />
                    )}
                  </div>

                  {/* Top Image (Recent Date - May 2025) with dynamic clip path */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center pointer-events-none" 
                    style={{ clipPath: `polygon(${swipePosition}% 0, 100% 0, 100% 100%, ${swipePosition}% 100%)` }}
                  >
                    {afterImageUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={afterImageUrl} 
                        className="object-cover w-full h-full" 
                        alt="Recent Observation" 
                        draggable={false}
                      />
                    )}
                  </div>

                  {/* SVG highlight overlay over the entire zoomed frame */}
                  {selectedChange && selectedChange.highlight && (
                    <div className="absolute inset-0 pointer-events-none z-10">
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <rect
                          x={selectedChange.highlight.x}
                          y={selectedChange.highlight.y}
                          width={selectedChange.highlight.w}
                          height={selectedChange.highlight.h}
                          fill={getHighlightFillColor(selectedChange.category)}
                          stroke={getHighlightStrokeColor(selectedChange.category)}
                          strokeWidth="2"
                          strokeDasharray="4,4"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Vertical separator line at slider pos */}
                  <div 
                    className="absolute top-0 bottom-0 z-20 pointer-events-none w-[2px] bg-brand-green-700 flex items-center justify-center"
                    style={{ left: `${swipePosition}%` }}
                  >
                    {/* Drag slider handle pill */}
                    <div className="absolute p-2 bg-brand-green-700 text-white rounded-brand-full border border-white shadow-brand-lg pointer-events-auto cursor-ew-resize flex items-center justify-center">
                      <Columns className="h-4.5 w-4.5 rotate-90" />
                    </div>
                  </div>
                </div>

                {/* Draggable transparent range slider covering image */}
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={swipePosition} 
                  onChange={(e) => setSwipePosition(Number(e.target.value))}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-ew-resize z-30"
                />
              </Card>
            )}

            {/* Selected Finding Detail Description */}
            {selectedChange && (
              <Card className="border-l-4 border-l-brand-green-700 bg-brand-green-50/10">
                <CardContent className="p-4 md:p-5 space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <h5 className="font-bold text-brand-neutral-900 text-sm md:text-base">
                      {selectedChange.title} — {selectedChange.statusLabel} {t('analysis.selectedFindingDetails')}
                    </h5>
                    {/* Statistics list */}
                    {selectedChange.statistics && (
                      <div className="flex gap-3 text-xs bg-white px-2.5 py-1 rounded-brand-md border border-brand-neutral-200">
                        <div>
                          <span className="text-brand-neutral-700 font-medium">{t('compare.before')}:</span>{' '}
                          <span className="font-bold text-brand-neutral-900">{selectedChange.statistics.before}</span>
                        </div>
                        <div>
                          <span className="text-brand-neutral-700 font-medium">{t('compare.after')}:</span>{' '}
                          <span className="font-bold text-brand-neutral-900">{selectedChange.statistics.after}</span>
                        </div>
                        <div>
                          <span className="text-brand-neutral-700 font-medium">{t('compare.changeSummary')}:</span>{' '}
                          <span className="font-bold text-brand-green-700">{selectedChange.statistics.change}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs md:text-sm text-brand-neutral-700 leading-relaxed">
                    {selectedChange.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* WHAT CHANGED: Grid of findings cards (Desktop: 3 col, Tablet: 2 col, Mobile: 1 col) */}
            {comparisonResult && (
              <Card>
                <CardContent className="p-4 md:p-5 space-y-4">
                  <h4 className="font-bold text-brand-neutral-900 text-base border-b border-brand-neutral-100 pb-2">
                    {t('compare.whatChanged')}
                  </h4>
                  <p className="text-xs text-brand-neutral-700 leading-normal">
                    {t('compare.selectChangeHint')}
                  </p>
                  <FindingsList
                    findings={changeFindingsAsFindings}
                    selectedFindingId={selectedChange?.id || null}
                    onSelectFinding={(f) => {
                      const match = comparisonResult?.changes.find(c => c.id === f.id);
                      if (match) setSelectedChange(match);
                    }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT PANEL: GPT-OSS AI Assistant (Desktop: 1 column, Mobile: Stacks under center content) */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="h-full">
              <CardContent className="p-4 md:p-5">
                <AIAssistant
                  context={{
                    locationId: location.id,
                    areaName: location.name,
                    beforeDate: beforeDateId,
                    afterDate: afterDateId,
                    findings: comparisonResult?.changes || [],
                    comparison: comparisonResult || undefined
                  }}
                  onSelectFindingById={handleSelectFindingById}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TECHNICAL DETAILS: Collapsed by default, placed at the very bottom of the page */}
      {compareState === 'results' && (
        <div className="mt-6">
          <TechDetailsPanel groups={getTechDetailsGroups()} />
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingState 
          message={t('compare.loadingComparison')} 
          description={t('compare.loadingDesc')} 
          size="lg"
        />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
