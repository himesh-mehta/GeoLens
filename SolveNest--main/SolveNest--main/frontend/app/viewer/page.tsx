"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw, Calendar, ImageIcon, Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { eoService, Location, ImageryDate } from '@/services/eo-service';
import { analysisService, AnalysisResult, Finding } from '@/services/analysis-service';
import { areasService } from '@/services/areas-service';
import { AnalysisProgress } from '@/components/analysis/analysis-progress';
import { FindingsList } from '@/components/analysis/findings-list';
import { AIAssistant } from '@/components/analysis/ai-assistant';
import { TechDetailsPanel, TechDetailGroup } from '@/components/analysis/tech-details-panel';
import { useTranslation } from '@/lib/i18n';

function ViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const areaId = searchParams.get('area');
  const { t } = useTranslation();

  // State variables from Phase 2
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isChangingDate, setIsChangingDate] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [dates, setDates] = useState<ImageryDate[]>([]);
  const [selectedDateId, setSelectedDateId] = useState<string>('');
  const [imageryUrl, setImageryUrl] = useState<string | null>(null);
  const [imgZoom, setImgZoom] = useState(1);

  // New Phase 3 State variables
  const [viewMode, setViewMode] = useState<'viewer' | 'progress' | 'results'>('viewer');
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Phase 6: Save area state
  const [isSaved, setIsSaved] = useState(false);

  // Phase 7 visual summary state
  const [beforeThumbUrl, setBeforeThumbUrl] = useState<string | null>(null);
  const [afterThumbUrl, setAfterThumbUrl] = useState<string | null>(null);

  // Fetch location metadata and dates list on load
  useEffect(() => {
    if (!areaId) {
      router.push('/select-area');
      return;
    }

    const initViewer = async () => {
      try {
        const loc = await eoService.getLocationById(areaId);
        if (!loc) {
          setLocation(null);
          setIsLoadingLocation(false);
          return;
        }

        setLocation(loc);
        
        // Fetch all dates (available and unavailable)
        const dateOptions = await eoService.getAvailableDates(areaId);
        setDates(dateOptions);

        // Select the first available date by default
        const defaultDate = dateOptions.find(d => d.isAvailable) || dateOptions[0];
        if (defaultDate) {
          setSelectedDateId(defaultDate.id);
        }
      } catch (err) {
        console.error("Failed to load viewer data", err);
      } finally {
        setIsLoadingLocation(false);
      }
    };

    initViewer();
  }, [areaId, router]);

  // Sync save state when location loads
  useEffect(() => {
    if (location) {
      setIsSaved(areasService.isAreaSaved(location.id));
    }
  }, [location]);

  // Fetch imagery when selected date changes
  useEffect(() => {
    if (!location || !selectedDateId) return;

    const fetchImagery = async () => {
      setIsChangingDate(true);
      setImgZoom(1); // Reset zoom on image switch
      
      // Reset analysis results if date is changed (forces user to re-analyze for new dates)
      setViewMode('viewer');
      setAnalysisResult(null);
      setSelectedFinding(null);
      
      try {
        const url = await eoService.getImagery(location.id, selectedDateId);
        setImageryUrl(url);
      } catch (err) {
        console.error("Failed to fetch imagery", err);
        setImageryUrl(null);
      } finally {
        setIsChangingDate(false);
      }
    };

    fetchImagery();
  }, [location, selectedDateId]);

  // Fetch comparison thumbnails once location is ready
  useEffect(() => {
    if (!location) return;
    const fetchThumbs = async () => {
      try {
        const dateOptions = await eoService.getAvailableDates(location.id);
        const available = dateOptions.filter(d => d.isAvailable);
        if (available.length >= 2) {
          const bUrl = await eoService.getImagery(location.id, available[0].id);
          const aUrl = await eoService.getImagery(location.id, available[available.length - 1].id);
          setBeforeThumbUrl(bUrl);
          setAfterThumbUrl(aUrl);
        }
      } catch (err) {
        console.error("Failed to load comparison thumbnails", err);
      }
    };
    fetchThumbs();
  }, [location]);

  const handleZoomIn = () => {
    setImgZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setImgZoom(prev => Math.max(prev - 0.25, 1));
  };

  const handleResetZoom = () => {
    setImgZoom(1);
  };

  // Save / unsave area toggle
  const handleToggleSave = () => {
    if (!location) return;
    if (isSaved) {
      areasService.removeArea(location.id);
      setIsSaved(false);
    } else {
      areasService.saveArea({
        id: location.id,
        name: location.name,
        state: location.region,
        lastChecked: 'May 2025',
      });
      setIsSaved(true);
    }
  };

  // Run mock analysis
  const handleStartAnalysis = async () => {
    if (!location) return;
    setViewMode('progress');
    setAnalysisStep(0);
    setSelectedFinding(null);

    try {
      const result = await analysisService.runAnalysis(location.id, selectedDateId, (stepIndex) => {
        setAnalysisStep(stepIndex);
      });
      setAnalysisResult(result);
      setViewMode('results');

      // Phase 6: record history entry
      const firstFinding = result.findings[0];
      areasService.addHistoryItem({
        areaId: location.id,
        areaName: location.name,
        type: 'analysis',
        date: 'May 2025',
        status: 'completed',
      });
      // Also update the saved area's recent finding if already saved
      if (areasService.isAreaSaved(location.id) && firstFinding) {
        areasService.saveArea({
          id: location.id,
          name: location.name,
          state: location.region,
          lastChecked: 'May 2025',
          recentFinding: `${firstFinding.title} ${firstFinding.statusLabel.toLowerCase()}`,
        });
      }
    } catch (err: any) {
      console.error("Analysis failed", err);
      if (err.message) {
        alert(err.message);
      }
      setViewMode('viewer');
    }
  };

  // Handle Select Finding by ID from contextual assistant evidence click
  const handleSelectFindingById = (findingId: string) => {
    if (!analysisResult) return;
    const match = analysisResult.findings.find(f => f.id === findingId);
    if (match) {
      setSelectedFinding(match);
    }
  };

  if (isLoadingLocation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingState 
          message={t('viewer.loadingViewer')} 
          description={t('viewer.loadingViewerDesc')} 
          size="lg"
        />
      </div>
    );
  }

  // Location not found error
  if (!location) {
    return (
      <div className="py-8">
        <ErrorState
          title={t('viewer.locationNotFound')}
          message={t('viewer.locationNotFoundDesc')}
          onRetry={() => router.push('/select-area')}
        />
      </div>
    );
  }

  // Progressive highlights bounding box color resolver
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

  // Construct TechDetails groups dynamically safely
  const getTechDetailsGroups = (): TechDetailGroup[] => {
    const tech = analysisResult?.technicalDetails;
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
        heading: t('techPanel.analysisInfo'),
        fields: [
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
          <button
            onClick={handleToggleSave}
            title={isSaved ? `${t('common.saved')} (${t('nav.myAreas')})` : `${t('common.save')} (${location.name})`}
            aria-label={isSaved ? t('common.saved') : t('common.save')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-brand-md border border-brand-neutral-200 bg-white text-[10px] font-bold transition-colors hover:bg-brand-neutral-100 cursor-pointer"
          >
            {isSaved
              ? <><BookmarkCheck className="h-3 w-3 text-brand-green-700" /><span className="text-brand-green-700">{t('common.saved')}</span></>
              : <><Bookmark className="h-3 w-3 text-brand-neutral-700" /><span className="text-brand-neutral-700">{t('common.save')}</span></>
            }
          </button>
        </div>

        <div className="flex items-center gap-3">
          {viewMode !== 'progress' && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-neutral-700" />
              <select
                value={selectedDateId}
                disabled={viewMode === 'results'}
                onChange={(e) => setSelectedDateId(e.target.value)}
                className="border border-brand-neutral-200 bg-white rounded-brand-md px-2.5 py-1 text-xs font-semibold text-brand-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-green-700 cursor-pointer disabled:opacity-50"
              >
                {dates.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} {!d.isAvailable && `(${t('viewer.unavailable')})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/select-area')}
            leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
          >
            {t('viewer.changeArea')}
          </Button>
        </div>
      </div>

      {viewMode === 'progress' ? (
        // Loading Analysis Processing State
        <div className="py-8">
          <AnalysisProgress currentStep={analysisStep} />
        </div>
      ) : (
        // Main 3-Column Grid Layout (Responsive Stacking on mobile)
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* CENTER PANEL: EO Viewer, findings and comparison summary - Takes 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* EO Image card (Dominant element) */}
            <Card className="overflow-hidden relative bg-brand-neutral-100 border border-brand-neutral-200">
              {/* Viewer Controls Layer */}
              {imageryUrl && !isChangingDate && (
                <div className="absolute bottom-4 right-4 z-10 flex gap-1 bg-white p-1 rounded-brand-md border border-brand-neutral-200 shadow-brand-sm">
                  <button
                    onClick={handleZoomIn}
                    className="p-2 hover:bg-brand-neutral-100 rounded text-brand-neutral-700 hover:text-brand-neutral-900 transition-colors cursor-pointer"
                    title="Zoom In"
                    aria-label="Zoom In"
                  >
                    <ZoomIn className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-2 hover:bg-brand-neutral-100 rounded text-brand-neutral-700 hover:text-brand-neutral-900 transition-colors cursor-pointer"
                    title="Zoom Out"
                    aria-label="Zoom Out"
                  >
                    <ZoomOut className="h-4.5 w-4.5" />
                  </button>
                  <div className="border-l border-brand-neutral-200 mx-1" />
                  <button
                    onClick={handleResetZoom}
                    className="p-2 hover:bg-brand-neutral-100 rounded text-brand-neutral-700 hover:text-brand-neutral-900 transition-colors cursor-pointer"
                    title="Reset Zoom"
                    aria-label="Reset Zoom"
                  >
                    <RotateCcw className="h-4.5 w-4.5" />
                  </button>
                </div>
              )}

              {/* Content Display (Image Area) */}
              <div className="w-full h-[350px] md:h-[500px] flex items-center justify-center overflow-hidden">
                {isChangingDate ? (
                  <LoadingState
                    message={t('viewer.loadingImagery')}
                    description={t('viewer.loadingImageryDesc')}
                  />
                ) : imageryUrl ? (
                  <div 
                    className="w-full h-full transition-transform duration-200 ease-out flex items-center justify-center relative"
                    style={{ transform: `scale(${imgZoom})` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageryUrl}
                      alt={`Satellite Observation of ${location.name}`}
                      className="object-cover w-full h-full max-w-full max-h-full"
                      draggable={false}
                    />

                    {/* Data Integrity Watermark / Status Badge */}
                    <div className="absolute top-3 left-3 z-10">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-brand-md text-[11px] font-semibold tracking-wide bg-amber-500/90 text-white shadow-sm backdrop-blur-xs border border-amber-400/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Demo / Feature-Derived Visualization
                      </span>
                    </div>

                    {/* Bounding box vector highlight overlay */}
                    {viewMode === 'results' && selectedFinding && selectedFinding.highlight && (
                      <div className="absolute inset-0 pointer-events-none">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <rect
                            x={selectedFinding.highlight.x}
                            y={selectedFinding.highlight.y}
                            width={selectedFinding.highlight.w}
                            height={selectedFinding.highlight.h}
                            fill={getHighlightFillColor(selectedFinding.category)}
                            stroke={getHighlightStrokeColor(selectedFinding.category)}
                            strokeWidth="2"
                            strokeDasharray="4,4"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 w-full">
                    <ErrorState
                      title={t('viewer.noImagery')}
                      message={t('viewer.noImageryDesc')}
                      details={`Location ID: ${location.id}\nSelected Date ID: ${selectedDateId}`}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Selected Finding Detail Description */}
            {viewMode === 'results' && selectedFinding && (
              <Card className="border-l-4 border-l-brand-green-700 bg-brand-green-50/10">
                <CardContent className="p-4 md:p-5 space-y-2">
                  <h5 className="font-bold text-brand-neutral-900 text-sm md:text-base">
                    {selectedFinding.title} — {selectedFinding.statusLabel} {t('analysis.selectedFindingDetails')}
                  </h5>
                  <p className="text-xs md:text-sm text-brand-neutral-700 leading-relaxed">
                    {selectedFinding.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* WHAT WE FOUND: Grid of Findings Cards (Desktop: 3 col, Tablet: 2 col, Mobile: 1 col) */}
            {viewMode === 'results' && analysisResult && (
              <Card>
                <CardContent className="p-4 md:p-5 space-y-4">
                  <h4 className="font-bold text-brand-neutral-900 text-base border-b border-brand-neutral-100 pb-2">
                    {t('analysis.whatWeFound')}
                  </h4>
                  <p className="text-xs text-brand-neutral-700 leading-normal">
                    {t('analysis.selectFindingHint')}
                  </p>
                  <FindingsList
                    findings={analysisResult.findings}
                    selectedFindingId={selectedFinding?.id || null}
                    onSelectFinding={(f) => setSelectedFinding(f)}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  />
                </CardContent>
              </Card>
            )}

            {/* WHAT CHANGED: Visual side-by-side thumbnails and compare action */}
            {viewMode === 'results' && (
              <Card>
                <CardContent className="p-4 md:p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-brand-neutral-100 pb-2">
                    <h4 className="font-bold text-brand-neutral-900 text-base">
                      {t('compare.changeSummary')}
                    </h4>
                    <span className="text-xs text-brand-neutral-700 font-semibold">
                      May 2022 vs May 2025
                    </span>
                  </div>
                  
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Visual Before/After Thumbs */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="space-y-1 text-center">
                        <span className="text-[10px] uppercase font-bold text-brand-neutral-700 tracking-wider">Before</span>
                        <div className="w-24 h-16 md:w-32 md:h-20 bg-brand-neutral-100 rounded-brand-md overflow-hidden border border-brand-neutral-200 flex items-center justify-center">
                          {beforeThumbUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={beforeThumbUrl} alt="Before" className="object-cover w-full h-full" />
                          ) : (
                            <div className="animate-pulse bg-brand-neutral-200 w-full h-full" />
                          )}
                        </div>
                      </div>
                      
                      <span className="text-brand-neutral-700 font-bold text-lg mt-4">→</span>
                      
                      <div className="space-y-1 text-center">
                        <span className="text-[10px] uppercase font-bold text-brand-neutral-700 tracking-wider">After</span>
                        <div className="w-24 h-16 md:w-32 md:h-20 bg-brand-neutral-100 rounded-brand-md overflow-hidden border border-brand-neutral-200 flex items-center justify-center">
                          {afterThumbUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={afterThumbUrl} alt="After" className="object-cover w-full h-full" />
                          ) : (
                            <div className="animate-pulse bg-brand-neutral-200 w-full h-full" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Summary text and action */}
                    <div className="flex-1 space-y-3 text-center md:text-left">
                      <p className="text-xs md:text-sm text-brand-neutral-700 leading-relaxed">
                        A 3-year gap analysis shows major land changes in the selected area, including a decline in vegetation cover and construction of developed built-up structures.
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => router.push(`/compare?area=${location.id}`)}
                      >
                        {t('viewer.seeWhatChanged')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Before-analysis Sidebar placeholder in Center area if viewer mode */}
            {viewMode === 'viewer' && imageryUrl && !isChangingDate && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Analyze Area Button Card */}
                <Card className="bg-brand-green-50/10 border-brand-green-100 flex flex-col justify-between">
                  <CardContent className="p-4 md:p-5 space-y-4 text-center flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <h4 className="font-bold text-brand-green-800 text-sm md:text-base">{t('viewer.analyzeReady')}</h4>
                      <p className="text-xs text-brand-neutral-900 leading-normal">
                        {t('viewer.analyzeDesc')}
                      </p>
                    </div>
                    <div className="space-y-2 pt-4">
                      <Button
                        variant="primary"
                        className="w-full"
                        onClick={handleStartAnalysis}
                      >
                        {t('viewer.analyzeBtn')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => router.push(`/compare?area=${location.id}`)}
                      >
                        {t('viewer.compareBtn')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Simple Explanation Card */}
                <Card className="bg-brand-green-50/30 border-brand-green-100">
                  <CardContent className="p-4 md:p-5 flex items-start gap-3">
                    <div className="p-2 bg-brand-green-50 text-brand-green-700 rounded-brand-md flex-shrink-0">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="font-semibold text-brand-green-800 text-xs md:text-sm">
                        {t('viewer.whatViewing')}
                      </h5>
                      <p className="text-xs text-brand-neutral-900 leading-relaxed">
                        {t('viewer.whatViewingDesc')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: GPT-OSS AI Assistant (Desktop: 1 column, Mobile: Stacks under center content) */}
          <div className="lg:col-span-1 space-y-6">
            {viewMode === 'results' ? (
              <Card className="h-full">
                <CardContent className="p-4 md:p-5">
                  <AIAssistant
                    context={{
                      locationId: location.id,
                      areaName: location.name,
                      findings: analysisResult?.findings || []
                    }}
                    onSelectFindingById={handleSelectFindingById}
                  />
                </CardContent>
              </Card>
            ) : (
              // Default Metadata details in right sidebar before analysis
              <Card>
                <CardContent className="p-4 md:p-5 space-y-4">
                  <h4 className="font-semibold text-brand-neutral-900 text-sm md:text-base border-b border-brand-neutral-100 pb-2">
                    {t('viewer.imageryDetails')}
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-brand-neutral-700 tracking-wider">
                        {t('viewer.locationName')}
                      </span>
                      <p className="text-sm font-semibold text-brand-neutral-900 mt-0.5">
                        {location.name}, {location.region}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-brand-neutral-700 tracking-wider">
                        {t('viewer.observationDate')}
                      </span>
                      <p className="text-sm font-semibold text-brand-neutral-900 mt-0.5">
                        {dates.find(d => d.id === selectedDateId)?.label || selectedDateId}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-brand-neutral-700 tracking-wider">
                        {t('viewer.availabilityStatus')}
                      </span>
                      <div className="mt-1">
                        {imageryUrl ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-brand-green-50 text-brand-green-700 border border-brand-green-100 text-[10px] font-semibold">
                            {t('viewer.imageryLoaded')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-status-error-bg text-status-error-text border border-status-error-border text-[10px] font-semibold">
                            {t('viewer.unavailable')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TECHNICAL DETAILS: Collapsed by default, placed at the very bottom of the page */}
      {viewMode === 'results' && (
        <div className="mt-6">
          <TechDetailsPanel groups={getTechDetailsGroups()} />
        </div>
      )}
    </div>
  );
}

export default function ViewerPage() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingState 
          message={t('viewer.loadingViewer')} 
          description={t('viewer.loadingViewerDesc')} 
          size="lg"
        />
      </div>
    }>
      <ViewerContent />
    </Suspense>
  );
}
