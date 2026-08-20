"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import dynamic from 'next/dynamic';
import { eoService, Location } from '@/services/eo-service';

const MapComponent = dynamic(
  () => import('@/components/map/MapComponent'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 font-medium animate-pulse">Loading Map...</div>
      </div>
    ),
  }
);
import { useTranslation } from '@/lib/i18n';

export default function SelectAreaPage() {
  const router = useRouter();
  const { t } = useTranslation();
  
  // State variables
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Load locations on mount and simulate map loading
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const allLocs = await eoService.getAllLocations();
        setLocations(allLocs);
      } catch (err) {
        console.error("Failed to load locations", err);
      } finally {
        setIsLoadingMap(false);
      }
    };
    
    // Simulate map loading delay
    const timer = setTimeout(() => {
      fetchLocations();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Handle location search
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const result = await eoService.searchLocation(searchQuery);
      if (result) {
        setSelectedLocation(result);
      } else {
        setSearchError(t('selectArea.notFound'));
        setSelectedLocation(null);
      }
    } catch (err) {
      setSearchError(t('selectArea.searchError'));
    } finally {
      setIsSearching(false);
    }
  };

  // Continue to EO Viewer
  // Continue to EO Viewer or Compare
  const handleConfirmSelection = () => {
    if (selectedLocation) {
      if (selectedLocation.id.startsWith('custom-')) {
        const parts = selectedLocation.id.split('-');
        if (parts.length >= 3) {
          router.push(`/compare?lat=${parts[1]}&lon=${parts[2]}`);
          return;
        }
      }
      router.push(`/compare?area=${selectedLocation.id}`);
    }
  };

  if (isLoadingMap) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingState 
          message={t('selectArea.loadingMap')} 
          description={t('selectArea.loadingMapDesc')} 
          size="lg"
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2 md:py-4">
      {/* Back Button and Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push('/')}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          {t('common.back')}
        </Button>
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-brand-neutral-900">{t('selectArea.title')}</h3>
          <p className="text-xs md:text-sm text-brand-neutral-700">{t('selectArea.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[400px] rounded-brand-md overflow-hidden border border-brand-neutral-200 z-0 relative">
            <MapComponent
              drawMode="point"
              selectedPoint={selectedLocation ? [
                parseFloat(selectedLocation.coordinates?.split(',')[0] || '20.5937'),
                parseFloat(selectedLocation.coordinates?.split(',')[1] || '78.9629')
              ] : null}
              onPointSelected={(lat, lon) => {
                setSelectedLocation({
                  id: `custom-${lat.toFixed(4)}-${lon.toFixed(4)}`,
                  name: `Custom Location`,
                  region: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                  x: 0,
                  y: 0,
                  availableDates: ["2018", "2024", "may-2022"],
                  coordinates: `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`
                });
                setSearchError(null);
              }}
            />
          </div>
          <p className="text-xs text-brand-neutral-700 italic">
            {t('selectArea.mapTip')}
          </p>
        </div>

        {/* Search & Action Panel Column */}
        <div className="space-y-6">
          {/* Search Card */}
          <Card>
            <CardContent className="p-4 md:p-6 space-y-4">
              <h4 className="font-semibold text-brand-neutral-900 text-sm md:text-base">{t('selectArea.searchLabel')}</h4>
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  placeholder={t('selectArea.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-brand-neutral-200 rounded-brand-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-green-700 focus:border-transparent text-brand-neutral-900"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-2 top-2 text-brand-neutral-700 hover:text-brand-neutral-900 disabled:opacity-50 cursor-pointer"
                  aria-label={t('common.search')}
                >
                  <Search className="h-5 w-5" />
                </button>
              </form>

              {/* Search Feedback / Errors */}
              {isSearching && (
                <p className="text-xs text-brand-neutral-700">{t('selectArea.searching')}</p>
              )}

              {searchError && (
                <div className="flex items-start gap-2 text-status-warning-text bg-status-warning-bg/10 p-3 rounded-brand-md border border-status-warning-border">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p className="text-xs">{searchError}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Place Details Card */}
          <Card className="bg-white">
            <CardContent className="p-4 md:p-6 space-y-6">
              <div>
                <h4 className="font-semibold text-brand-neutral-700 text-xs uppercase tracking-wider">
                  {t('selectArea.selectedArea')}
                </h4>
                {selectedLocation ? (
                  <div className="mt-3 flex items-start gap-3">
                    <div className="p-2 bg-brand-green-50 text-brand-green-700 rounded-brand-md">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-brand-neutral-900 text-base md:text-lg">
                        {selectedLocation.name}, {selectedLocation.region}
                      </h5>
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-brand-green-50 text-brand-green-700 border border-brand-green-100 text-[10px] font-semibold mt-1">
                        {t('selectArea.areaSelected')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-brand-neutral-700 mt-2">
                    {t('selectArea.noAreaSelected')}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-brand-neutral-100">
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={!selectedLocation}
                  onClick={handleConfirmSelection}
                >
                  {t('selectArea.viewThisArea')}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => router.push('/')}
                >
                  {t('selectArea.changeArea')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
