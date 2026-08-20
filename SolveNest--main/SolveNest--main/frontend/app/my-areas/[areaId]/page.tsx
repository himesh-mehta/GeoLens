"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, Leaf, Columns, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { areasService, SavedArea } from '@/services/areas-service';
import { useTranslation } from '@/lib/i18n';

export default function AreaOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();
  const areaId = typeof params?.areaId === 'string' ? params.areaId : '';

  const [area, setArea] = useState<SavedArea | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!areaId) {
      router.push('/my-areas');
      return;
    }
    setTimeout(() => {
      const found = areasService.getAreaById(areaId);
      if (found) {
        setArea(found);
      } else {
        setNotFound(true);
      }
      setIsLoading(false);
    }, 300);
  }, [areaId, router]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <LoadingState message={t('common.loading')} size="md" />
      </div>
    );
  }

  if (notFound || !area) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <ErrorState
          title={t('areaOverview.notFound')}
          message={t('areaOverview.notFoundDesc')}
          onRetry={() => router.push('/my-areas')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-4 md:py-8 space-y-6">
      {/* Back */}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => router.push('/my-areas')}
        leftIcon={<ArrowLeft className="h-4 w-4" />}
      >
        {t('nav.myAreas')}
      </Button>

      {/* Area header */}
      <div>
        <h3 className="text-xl md:text-2xl font-bold text-brand-neutral-900">
          {area.name}
          {area.state && (
            <span className="text-brand-neutral-700 font-normal">, {area.state}</span>
          )}
        </h3>
      </div>

      {/* Overview card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          {area.lastChecked && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand-neutral-100 text-brand-neutral-700 rounded-brand-md flex-shrink-0">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-brand-neutral-700 tracking-wider block">
                  {t('areaOverview.lastChecked')}
                </span>
                <span className="text-sm font-semibold text-brand-neutral-900">
                  {area.lastChecked}
                </span>
              </div>
            </div>
          )}

          {area.recentFinding && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand-green-50 text-brand-green-700 rounded-brand-md flex-shrink-0">
                <Leaf className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-brand-neutral-700 tracking-wider block">
                  {t('areaOverview.recentFinding')}
                </span>
                <span className="text-sm font-semibold text-brand-neutral-900">
                  {area.recentFinding}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          onClick={() => router.push(`/viewer?area=${area.id}`)}
          leftIcon={<BarChart2 className="h-4 w-4" />}
          className="flex-1"
        >
          {t('areaOverview.viewLatest')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => router.push(`/compare?area=${area.id}`)}
          leftIcon={<Columns className="h-4 w-4" />}
          className="flex-1"
        >
          {t('areaOverview.compareDates')}
        </Button>
      </div>
    </div>
  );
}
