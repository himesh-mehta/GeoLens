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
import { useTranslation } from '@/lib/i18n';

export default function MyAreasPage() {
  const router = useRouter();
  const { t } = useTranslation();
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

  const handleOpen = (areaId: string) => {
    router.push(`/viewer?area=${areaId}`);
  };

  const handleRemove = (areaId: string) => {
    areasService.removeArea(areaId);
    setAreas(prev => prev.filter(a => a.id !== areaId));
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <LoadingState message={t('myAreas.loadingAreas')} size="md" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <ErrorState
          title={t('myAreas.loadError')}
          message={t('common.tryAgain')}
          onRetry={loadAreas}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 md:py-8 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-brand-neutral-900">
            {t('myAreas.title')}
          </h3>
          <p className="text-sm text-brand-neutral-700 mt-1">
            {t('myAreas.subtitle')}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => router.push('/select-area')}
          leftIcon={<PlusCircle className="h-4 w-4" />}
        >
          {t('myAreas.exploreNew')}
        </Button>
      </div>

      {/* Content */}
      {areas.length === 0 ? (
        <EmptyState
          icon={<Map className="h-8 w-8 text-brand-neutral-300" />}
          title={t('myAreas.noAreas')}
          description={t('myAreas.noAreasDesc')}
          actionText={t('myAreas.exploreArea')}
          onAction={() => router.push('/select-area')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {areas.map(area => (
            <AreaCard
              key={area.id}
              area={area}
              onOpen={() => handleOpen(area.id)}
              onRemove={() => handleRemove(area.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
