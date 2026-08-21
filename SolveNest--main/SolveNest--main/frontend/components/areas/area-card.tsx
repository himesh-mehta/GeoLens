"use client";

import React, { useState } from 'react';
import { MapPin, Trash2, ExternalLink, Clock, FileText, Activity, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SavedArea } from '@/services/areas-service';

export interface AreaCardProps {
  area: SavedArea;
  onOpen: () => void;
  onAnalyzeAgain: () => void;
  onViewReport: () => void;
  onRemove: () => void;
}

export const AreaCard: React.FC<AreaCardProps> = ({ area, onOpen, onAnalyzeAgain, onViewReport, onRemove }) => {
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const handleRemoveClick = () => setConfirmingRemove(true);
  const handleConfirmRemove = () => {
    onRemove();
    setConfirmingRemove(false);
  };
  const handleCancelRemove = () => setConfirmingRemove(false);
  
  const vStatus = area.latestAnalysis?.verification || "Unknown";
  const isVerified = vStatus === 'Verified Satellite Data';

  return (
    <Card className="hover:shadow-brand-md transition-shadow">
      <CardContent className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-brand-primary-50 text-brand-primary-700 rounded-brand-md flex-shrink-0 mt-0.5">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-brand-neutral-900 text-base leading-tight" title={area.name}>
                {area.name}
              </h4>
              <p className="text-xs text-brand-neutral-500 mt-0.5">
                {area.latitude?.toFixed(4) ?? "N/A"}, {area.longitude?.toFixed(4) ?? "N/A"}
              </p>
              {area.lastAnalyzedDate && (
                <p className="text-xs text-brand-neutral-700 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last Analyzed: {new Date(area.lastAnalyzedDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Verification & Analysis Summary */}
        {area.latestAnalysis && (
          <div className="space-y-2 bg-slate-50 border border-slate-100 rounded-md p-3">
            <div className="flex items-center gap-2 text-xs">
              {isVerified ? (
                <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              )}
              <span className={`font-medium ${isVerified ? 'text-green-700' : 'text-amber-600'}`}>
                {vStatus}
              </span>
            </div>
            
            <div className="text-sm">
              <span className="font-medium text-slate-700">Land Cover: </span>
              <span className="text-brand-primary-700">{area.latestAnalysis.predClass}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200">
              <div className="text-center">
                <p className="text-[10px] text-slate-500 font-medium">NDVI</p>
                <p className="text-xs font-semibold text-slate-700 truncate" title={String(area.latestAnalysis.ndvi)}>
                  {typeof area.latestAnalysis.ndvi === 'number' ? area.latestAnalysis.ndvi.toFixed(3) : 'N/A'}
                </p>
              </div>
              <div className="text-center border-l border-slate-200">
                <p className="text-[10px] text-slate-500 font-medium">NDWI</p>
                <p className="text-xs font-semibold text-slate-700 truncate" title={String(area.latestAnalysis.ndwi)}>
                  {typeof area.latestAnalysis.ndwi === 'number' ? area.latestAnalysis.ndwi.toFixed(3) : 'N/A'}
                </p>
              </div>
              <div className="text-center border-l border-slate-200">
                <p className="text-[10px] text-slate-500 font-medium">NDBI</p>
                <p className="text-xs font-semibold text-slate-700 truncate" title={String(area.latestAnalysis.ndbi)}>
                  {typeof area.latestAnalysis.ndbi === 'number' ? area.latestAnalysis.ndbi.toFixed(3) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action row */}
        {confirmingRemove ? (
          <div className="space-y-2">
            <p className="text-sm text-brand-neutral-900 font-medium">
              Remove {area.name}?
            </p>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" onClick={handleConfirmRemove}>Remove</Button>
              <Button variant="secondary" size="sm" onClick={handleCancelRemove}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="primary" size="sm" onClick={onOpen} leftIcon={<MapPin className="h-3.5 w-3.5" />}>
              Open
            </Button>
            <Button variant="outline" size="sm" onClick={onAnalyzeAgain} leftIcon={<Activity className="h-3.5 w-3.5" />}>
              Analyze
            </Button>
            <Button variant="outline" size="sm" onClick={onViewReport} leftIcon={<FileText className="h-3.5 w-3.5" />}>
              Report
            </Button>
            <div className="flex-1" />
            <button
              onClick={handleRemoveClick}
              className="p-1.5 text-brand-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
              title="Delete Area"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
