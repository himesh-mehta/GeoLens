"use client";

import React, { useState } from 'react';
import { MapPin, Trash2, ExternalLink, Clock, Leaf } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SavedArea } from '@/services/areas-service';
import { useTranslation } from '@/lib/i18n';

export interface AreaCardProps {
  area: SavedArea;
  onOpen: () => void;
  onRemove: () => void;
}

export const AreaCard: React.FC<AreaCardProps> = ({ area, onOpen, onRemove }) => {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const { t } = useTranslation();

  const handleRemoveClick = () => {
    setConfirmingRemove(true);
  };

  const handleConfirmRemove = () => {
    onRemove();
    setConfirmingRemove(false);
  };

  const handleCancelRemove = () => {
    setConfirmingRemove(false);
  };

  return (
    <Card className="hover:shadow-brand-md transition-shadow">
      <CardContent className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-brand-green-50 text-brand-green-700 rounded-brand-md flex-shrink-0 mt-0.5">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-brand-neutral-900 text-base leading-tight">
                {area.name}
                {area.state && (
                  <span className="text-brand-neutral-700 font-normal">, {area.state}</span>
                )}
              </h4>
              {area.lastChecked && (
                <p className="text-xs text-brand-neutral-700 mt-0.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t('myAreas.lastChecked')}: {area.lastChecked}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Recent finding */}
        {area.recentFinding && (
          <div className="flex items-center gap-2 text-xs text-brand-neutral-700 bg-brand-neutral-50 border border-brand-neutral-100 rounded-brand-md px-3 py-2">
            <Leaf className="h-3.5 w-3.5 text-brand-green-700 flex-shrink-0" />
            <span>{area.recentFinding}</span>
          </div>
        )}

        {/* Action row */}
        {confirmingRemove ? (
          <div className="space-y-2">
            <p className="text-sm text-brand-neutral-900 font-medium">
              {t('areaCard.removeConfirm', { name: area.name })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmRemove}
              >
                {t('common.remove')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelRemove}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={onOpen}
              rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
            >
              {t('common.open')}
            </Button>
            <button
              onClick={handleRemoveClick}
              className="p-2 text-brand-neutral-700 hover:text-status-error-text hover:bg-status-error-bg rounded-brand-md transition-colors cursor-pointer"
              title={`${t('common.remove')} ${area.name}`}
              aria-label={`${t('common.remove')} ${area.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
