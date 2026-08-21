"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Map, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { AreaCard } from '@/components/areas/area-card';
import { areasService, SavedArea } from '@/services/areas-service';

export default function MyAreasPage() {
  const router = useRouter();
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
      }, 300);
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
      <div className="max-w-4xl mx-auto py-8">
        <LoadingState message="Loading your saved areas..." size="md" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <ErrorState
          title="Failed to load areas"
          message="Please try again."
          onRetry={loadAreas}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-4 md:py-8 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-brand-neutral-900">
            My Areas
          </h3>
          <p className="text-sm text-brand-neutral-700 mt-1">
            Manage your saved locations and analysis results.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => router.push('/select-area')}
          leftIcon={<PlusCircle className="h-4 w-4" />}
        >
          Add New Area
        </Button>
      </div>

      {/* Content */}
      {areas.length === 0 ? (
        <EmptyState
          icon={<Map className="h-8 w-8 text-brand-neutral-300" />}
          title="No Areas Saved"
          description="You haven't saved any locations yet. Add a new area to track satellite data over time."
          actionText="Find an Area"
          onAction={() => router.push('/select-area')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
