"use client";

import React from 'react';
import { BarChart2, GitCompare, CheckCircle2, Clock4, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HistoryItem } from '@/services/areas-service';
import { useTranslation } from '@/lib/i18n';

export interface HistoryItemCardProps {
  item: HistoryItem;
  onOpen: () => void;
  onDelete?: () => void;
}

const TypeBadge: React.FC<{ type: HistoryItem['type'] }> = ({ type }) => {
  const { t } = useTranslation();
  if (type === 'analysis') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-blue-50 text-brand-blue-700 border border-brand-blue-100 text-[10px] font-semibold uppercase tracking-wide">
        <BarChart2 className="h-3 w-3" />
        {t('common.analysis')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-purple-50 text-brand-purple-700 border border-brand-purple-100 text-[10px] font-semibold uppercase tracking-wide">
      <GitCompare className="h-3 w-3" />
      {t('common.comparison')}
    </span>
  );
};

const StatusBadge: React.FC<{ status: HistoryItem['status'] }> = ({ status }) => {
  const { t } = useTranslation();
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-brand-green-700 text-[10px] font-semibold">
        <CheckCircle2 className="h-3 w-3" />
        {t('common.completed')}
      </span>
    );
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 text-brand-neutral-700 text-[10px] font-semibold">
        <Clock4 className="h-3 w-3" />
        {t('common.processing')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-status-error-text text-[10px] font-semibold">
      <AlertCircle className="h-3 w-3" />
      {t('common.failed')}
    </span>
  );
};

function formatDateRange(item: HistoryItem): string {
  if (item.type === 'comparison' && item.beforeDate && item.afterDate) {
    return `${item.beforeDate} → ${item.afterDate}`;
  }
  return item.date ?? '';
}

export const HistoryItemCard: React.FC<HistoryItemCardProps> = ({ item, onOpen, onDelete }) => {
  const { t } = useTranslation();
  return (
    <Card className="hover:shadow-brand-md transition-shadow">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: info */}
          <div className="space-y-1.5 min-w-0">
            <h4 className="font-semibold text-brand-neutral-900 text-sm leading-tight truncate">
              {item.areaName}
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={item.type} />
              <StatusBadge status={item.status} />
            </div>
            {formatDateRange(item) && (
              <p className="text-xs text-brand-neutral-700">
                {formatDateRange(item)}
              </p>
            )}
          </div>

          {/* Right: action */}
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpen}
              rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
              className="w-full sm:w-auto"
            >
              {t('common.open')}
            </Button>
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="w-full sm:w-auto text-status-error-text border-status-error-border hover:bg-status-error-bg"
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
