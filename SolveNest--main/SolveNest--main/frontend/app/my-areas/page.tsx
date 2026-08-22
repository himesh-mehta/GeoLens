"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Map, PlusCircle } from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { AreaCard } from '@/components/areas/area-card';
import { areasService, SavedArea } from '@/services/areas-service';
import { useTheme } from '@/lib/theme/theme-context';

export default function MyAreasPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [areas, setAreas] = useState<SavedArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadAreas = () => {
    setHasError(false);
    setIsLoading(true);
    try {
      setTimeout(() => {
        const saved = areasService.getSavedAreas();
        setAreas(saved);
        setIsLoading(false);
      }, 200);
    } catch {
      setHasError(true);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAreas();
  }, []);

  const handleOpen = (area: SavedArea) => {
    router.push(`/explorer?lat=${area.latitude}&lon=${area.longitude}&name=${encodeURIComponent(area.name)}`);
  };

  const handleAnalyzeAgain = (area: SavedArea) => {
    router.push(`/explorer?lat=${area.latitude}&lon=${area.longitude}&name=${encodeURIComponent(area.name)}&auto_analyze=true`);
  };

  const handleViewReport = (area: SavedArea) => {
    router.push(`/reports?area=${area.id}`);
  };

  const handleRemove = (areaId: string) => {
    areasService.removeArea(areaId);
    setAreas(prev => prev.filter(a => a.id !== areaId));
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <LoadingState message="Loading your saved areas..." size="md" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <ErrorState
          title="Failed to load areas"
          message="Please try again."
          onRetry={loadAreas}
        />
      </div>
    );
  }

  return (
    <div className="w-full py-4 px-4 md:px-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h1 className={`text-xl md:text-2xl font-black ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
            My Saved Areas
          </h1>
          <p className={`text-xs mt-1 ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
            Manage your saved locations, satellite metrics, and analysis reports.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/explorer')}
          className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
            isLight ? 'bg-[#4C7A3D] hover:bg-[#3D6330]' : 'bg-[#14B8A6] hover:bg-[#0F766E]'
          }`}
        >
          <PlusCircle className="h-4 w-4" />
          <span>Add New Area</span>
        </button>
      </div>

      {/* Grid or Empty State */}
      {areas.length === 0 ? (
        <EmptyState
          icon={<Map className="h-10 w-10 text-slate-400" />}
          title="No Areas Saved"
          description="You haven't saved any locations yet. Save an area from Map Explorer to track satellite data over time."
          actionText="Find an Area"
          onAction={() => router.push('/explorer')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {areas.map(area => (
            <AreaCard
              key={area.id}
              area={area}
              onOpen={() => handleOpen(area)}
              onAnalyzeAgain={() => handleAnalyzeAgain(area)}
              onViewReport={() => handleViewReport(area)}
              onRemove={() => handleRemove(area.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
