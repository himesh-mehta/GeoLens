"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { History, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { HistoryItemCard } from '@/components/areas/history-item-card';
import { areasService, HistoryItem } from '@/services/areas-service';
import { clsx } from 'clsx';
import { useTranslation } from '@/lib/i18n';

type TypeFilter = 'all' | 'analysis' | 'comparison';

export default function HistoryPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [filtered, setFiltered] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const loadHistory = () => {
    setHasError(false);
    setIsLoading(true);
    try {
      setTimeout(() => {
        const items = areasService.getHistory();
        setAllHistory(items);
        setFiltered(items);
        setIsLoading(false);
      }, 300);
    } catch {
      setHasError(true);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Apply filters whenever query or type changes
  useEffect(() => {
    const type = typeFilter === 'all' ? undefined : typeFilter;
    const results = areasService.searchHistory(query, type);
    setFiltered(results);
  }, [query, typeFilter, allHistory]);

  const handleOpen = (item: HistoryItem) => {
    if (item.type === 'comparison') {
      const before = item.beforeDate?.substring(0, 4) || '2018';
      const after = item.afterDate?.substring(0, 4) || '2024';
      router.push(`/compare?area=${item.areaId}&autorun=true&before=${before}&after=${after}`);
    } else {
      if (item.areaId.startsWith('custom-') || item.areaId.startsWith('polygon-')) {
        const year = item.date || '2024';
        router.push(`/compare?area=${item.areaId}&autorun=true&before=${year}&after=${year === '2024' ? '2018' : '2024'}`);
      } else {
        router.push(`/viewer?area=${item.areaId}`);
      }
    }
  };

  const handleDelete = (id: string) => {
    areasService.deleteHistoryItem(id);
    loadHistory();
  };

  const clearSearch = () => {
    setQuery('');
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <LoadingState message={t('history.loadingHistory')} size="md" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <ErrorState
          title={t('history.loadError')}
          message={t('common.tryAgain')}
          onRetry={loadHistory}
        />
      </div>
    );
  }

  const filterPills: { label: string; value: TypeFilter }[] = [
    { label: t('history.filterAll'), value: 'all' },
    { label: t('history.filterAnalysis'), value: 'analysis' },
    { label: t('history.filterComparison'), value: 'comparison' },
  ];

  return (
    <div className="max-w-4xl mx-auto py-4 md:py-8 space-y-6">
      {/* Page header */}
      <div>
        <h3 className="text-xl md:text-2xl font-bold text-brand-neutral-900">
          {t('history.title')}
        </h3>
        <p className="text-sm text-brand-neutral-700 mt-1">
          {t('history.subtitle')}
        </p>
      </div>

      {/* No history at all */}
      {allHistory.length === 0 ? (
        <EmptyState
          icon={<History className="h-8 w-8 text-brand-neutral-300" />}
          title={t('history.noHistory')}
          description={t('history.noHistoryDesc')}
          actionText={t('history.exploreArea')}
          onAction={() => router.push('/select-area')}
        />
      ) : (
        <>
          {/* Search + filter controls */}
          <div className="space-y-3">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-neutral-700 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('history.searchPlaceholder')}
                className="w-full pl-10 pr-10 py-2.5 text-sm border border-brand-neutral-200 bg-white rounded-brand-md text-brand-neutral-900 placeholder:text-brand-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-green-700 focus:border-transparent"
                id="history-search"
              />
              {query && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-brand-neutral-700 hover:text-brand-neutral-900 transition-colors cursor-pointer"
                  aria-label={t('common.clear')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Type filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {filterPills.map(pill => (
                <button
                  key={pill.value}
                  onClick={() => setTypeFilter(pill.value)}
                  className={clsx(
                    'px-3 py-1.5 rounded-brand-full text-xs font-semibold border transition-colors cursor-pointer',
                    typeFilter === pill.value
                      ? 'bg-brand-green-700 text-white border-brand-green-700'
                      : 'bg-white text-brand-neutral-700 border-brand-neutral-200 hover:bg-brand-neutral-100'
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-brand-neutral-700">
                {t('history.noResults', { query })}
              </p>
              <Button variant="secondary" size="sm" onClick={clearSearch}>
                {t('history.clearSearch')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(item => (
                <HistoryItemCard
                  key={item.id}
                  item={item}
                  onOpen={() => handleOpen(item)}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
