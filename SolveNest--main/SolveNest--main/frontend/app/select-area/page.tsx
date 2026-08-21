"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, ArrowLeft, Crosshair, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/lib/i18n';

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

interface UnifiedSelection {
  lat: number;
  lon: number;
  name: string;
  method: 'search' | 'manual' | 'map';
}

export default function SelectAreaPage() {
  const router = useRouter();
  const { t } = useTranslation();
  
  // State variables
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [activeTab, setActiveTab] = useState<'search' | 'manual'>('search');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{lat: string, lon: string, display_name: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Manual state
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Unified selection
  const [selectedArea, setSelectedArea] = useState<UnifiedSelection | null>(null);

  useEffect(() => {
    // Simulate map loading delay
    const timer = setTimeout(() => {
      setIsLoadingMap(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await response.json();
      if (data && data.display_name) {
        // Just take the first 3 parts of the address for brevity
        return data.display_name.split(',').slice(0, 3).join(',');
      }
    } catch (err) {
      console.error("Reverse geocoding failed", err);
    }
    return `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setSelectedArea(null);

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        setSearchResults(data.slice(0, 5));
      } else {
        setSearchError("No locations found. Please try a different search term.");
      }
    } catch (err) {
      setSearchError("Search failed. Please check your connection.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setManualError("Latitude must be between -90 and 90.");
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setManualError("Longitude must be between -180 and 180.");
      return;
    }

    const name = await reverseGeocode(lat, lon);
    
    setSelectedArea({
      lat,
      lon,
      name,
      method: 'manual'
    });
  };

  const handleMapClick = async (lat: number, lon: number) => {
    const name = await reverseGeocode(lat, lon);
    setSelectedArea({
      lat,
      lon,
      name,
      method: 'map'
    });
  };

  const handleSelectResult = (result: {lat: string, lon: string, display_name: string}) => {
    setSelectedArea({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      name: result.display_name.split(',').slice(0, 3).join(','),
      method: 'search'
    });
    setSearchResults([]);
  };

  const handleAnalyze = () => {
    if (selectedArea) {
      router.push(`/explorer?lat=${selectedArea.lat}&lon=${selectedArea.lon}&name=${encodeURIComponent(selectedArea.name)}`);
    }
  };

  if (isLoadingMap) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingState 
          message={t('selectArea.loadingMap')} 
          size="lg"
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2 md:py-4">
      {/* Header */}
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
          <div className="h-[500px] rounded-brand-md overflow-hidden border border-brand-neutral-200 z-0 relative shadow-sm">
            <MapComponent
              drawMode="point"
              selectedPoint={selectedArea ? [selectedArea.lat, selectedArea.lon] : null}
              center={selectedArea ? [selectedArea.lat, selectedArea.lon] : [20.5937, 78.9629]}
              zoom={selectedArea ? 10 : 5}
              onPointSelected={handleMapClick}
            />
          </div>
          <p className="text-sm text-slate-500 text-center">
            You can also click anywhere on the map to select a location.
          </p>
        </div>

        {/* Sidebar Controls */}
        <div className="flex flex-col gap-4">
          <Card className="border-brand-neutral-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-brand-neutral-100">
              <div className="flex border-b border-brand-neutral-200">
                <button
                  className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeTab === 'search' ? 'text-brand-primary-600 border-b-2 border-brand-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setActiveTab('search')}
                >
                  Search Place
                </button>
                <button
                  className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeTab === 'manual' ? 'text-brand-primary-600 border-b-2 border-brand-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setActiveTab('manual')}
                >
                  Coordinates
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {activeTab === 'search' ? (
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Location Name</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="e.g., Ghatkopar, Mumbai"
                          className="w-full pl-9 pr-3 py-2 bg-white border border-brand-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 text-sm"
                        />
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      </div>
                      <Button type="submit" disabled={isSearching} variant="primary">
                        {isSearching ? 'Searching...' : 'Find'}
                      </Button>
                    </div>
                    {searchError && (
                      <p className="text-sm text-red-500 mt-2">{searchError}</p>
                    )}
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="border border-slate-200 rounded-md overflow-hidden divide-y divide-slate-100">
                      {searchResults.map((res, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSelectResult(res)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex flex-col"
                        >
                          <span className="text-sm font-medium text-slate-800 line-clamp-1">{res.display_name}</span>
                          <span className="text-xs text-slate-500">{parseFloat(res.lat).toFixed(4)}, {parseFloat(res.lon).toFixed(4)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </form>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        placeholder="e.g., 19.0760"
                        className="w-full px-3 py-2 bg-white border border-brand-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={manualLon}
                        onChange={(e) => setManualLon(e.target.value)}
                        placeholder="e.g., 72.8777"
                        className="w-full px-3 py-2 bg-white border border-brand-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 text-sm"
                        required
                      />
                    </div>
                  </div>
                  {manualError && (
                    <p className="text-sm text-red-500">{manualError}</p>
                  )}
                  <Button type="submit" variant="primary" className="w-full" leftIcon={<Crosshair className="h-4 w-4" />}>
                    Locate on Map
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Selected Area Card */}
          {selectedArea && (
            <Card className="border-brand-primary-200 bg-brand-primary-50 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-brand-primary-800 text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location Selected
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white rounded-md p-3 border border-brand-primary-100">
                  <p className="text-sm font-medium text-slate-800 line-clamp-2" title={selectedArea.name}>
                    {selectedArea.name}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <div>
                      <span className="font-medium">Lat:</span> {selectedArea.lat.toFixed(5)}
                    </div>
                    <div>
                      <span className="font-medium">Lon:</span> {selectedArea.lon.toFixed(5)}
                    </div>
                  </div>
                  <div className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    Method: {selectedArea.method}
                  </div>
                </div>
                
                <Button 
                  variant="primary" 
                  className="w-full shadow-sm"
                  onClick={handleAnalyze}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Analyze in Map Explorer
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
