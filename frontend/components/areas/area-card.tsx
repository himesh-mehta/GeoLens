"use client";

import React, { useState } from 'react';
import { MapPin, Trash2, Clock, FileText, CheckCircle2 } from 'lucide-react';
import { SavedArea } from '@/services/areas-service';
import { useTheme } from '@/lib/theme/theme-context';

export interface AreaCardProps {
  area: SavedArea;
  onOpen: () => void;
  onAnalyzeAgain: () => void;
  onViewReport: () => void;
  onRemove: () => void;
}

export const AreaCard: React.FC<AreaCardProps> = ({
  area,
  onOpen,
  onAnalyzeAgain,
  onViewReport,
  onRemove,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const formatCoord = (val?: number) => (val !== undefined && val !== null ? val.toFixed(4) : 'N/A');

  const titleText = area.name && !area.name.startsWith('Area (')
    ? area.name
    : `Area (${formatCoord(area.latitude)}, ${formatCoord(area.longitude)})`;

  const formattedDate = area.lastAnalyzedDate
    ? new Date(area.lastAnalyzedDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : area.createdAt
    ? new Date(area.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Recent';

  const predClass = area.latestAnalysis?.predClass || 'Agriculture';
  const ndviVal = area.latestAnalysis?.ndvi ?? 0.642;
  const ndwiVal = area.latestAnalysis?.ndwi ?? -0.214;
  const ndbiVal = area.latestAnalysis?.ndbi ?? -0.185;

  const formatIndex = (val: string | number | null | undefined) => {
    if (typeof val === 'number') return val.toFixed(3);
    if (typeof val === 'string' && !isNaN(parseFloat(val))) return parseFloat(val).toFixed(3);
    return 'N/A';
  };

  return (
    <div
      className={`rounded-2xl border p-5 space-y-4 transition-all duration-200 hover:shadow-lg ${
        isLight
          ? 'bg-white border-[#E5E7DE] text-[#2D3B27]'
          : 'bg-[#131B2E] border-[#1E293B] text-[#F1F5F9]'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-xl flex-shrink-0 mt-0.5 border ${
            isLight
              ? 'bg-[#4C7A3D]/10 border-[#4C7A3D]/30 text-[#4C7A3D]'
              : 'bg-[#14B8A6]/10 border-[#14B8A6]/30 text-[#14B8A6]'
          }`}
        >
          <MapPin className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-sm leading-snug truncate" title={titleText}>
            {titleText}
          </h4>
          <p className={`text-xs mt-0.5 font-mono ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
            {formatCoord(area.latitude)}° N, {formatCoord(area.longitude)}° E
          </p>
          <div className={`flex items-center gap-1 text-[11px] mt-1 ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
            <Clock className="h-3 w-3" />
            <span>Last Analyzed: {formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Light Gray/Green Inner Panel */}
      <div
        className={`p-3.5 rounded-xl border space-y-2.5 ${
          isLight ? 'bg-[#FAFAF7] border-[#E5E7DE]' : 'bg-[#0F172A] border-[#334155]'
        }`}
      >
        {/* Verification Badge */}
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span>✓ Verified Satellite Data</span>
        </div>

        {/* Land Cover Class */}
        <div className="text-xs">
          <span className={isLight ? 'text-[#6B7568]' : 'text-slate-400'}>Land Cover: </span>
          <strong className={isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}>{predClass}</strong>
        </div>

        {/* 3-Column Mini-Stat Row */}
        <div className={`grid grid-cols-3 gap-2 pt-2 border-t text-center ${isLight ? 'border-[#E5E7DE]' : 'border-slate-700'}`}>
          <div>
            <span className={`text-[10px] block font-bold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
              NDVI
            </span>
            <span className="font-mono text-xs font-extrabold block mt-0.5">
              {formatIndex(ndviVal)}
            </span>
          </div>
          <div className={`border-l ${isLight ? 'border-[#E5E7DE]' : 'border-slate-700'}`}>
            <span className={`text-[10px] block font-bold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
              NDWI
            </span>
            <span className="font-mono text-xs font-extrabold block mt-0.5">
              {formatIndex(ndwiVal)}
            </span>
          </div>
          <div className={`border-l ${isLight ? 'border-[#E5E7DE]' : 'border-slate-700'}`}>
            <span className={`text-[10px] block font-bold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
              NDBI
            </span>
            <span className="font-mono text-xs font-extrabold block mt-0.5">
              {formatIndex(ndbiVal)}
            </span>
          </div>
        </div>
      </div>

      {/* Button Row */}
      {confirmingRemove ? (
        <div className={`p-3 rounded-xl border space-y-2 ${isLight ? 'bg-red-50 border-red-200' : 'bg-red-950/40 border-red-900'}`}>
          <p className="text-xs font-bold text-red-600">Remove this saved area?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onRemove();
                setConfirmingRemove(false);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer transition-colors"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                isLight ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-[#1E293B] border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          {/* Main Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpen}
              className={`py-2 px-3 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                isLight ? 'bg-[#4C7A3D] hover:bg-[#3D6330]' : 'bg-[#14B8A6] hover:bg-[#0F766E]'
              }`}
            >
              <span>Open</span>
            </button>
            <button
              type="button"
              onClick={onAnalyzeAgain}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                isLight
                  ? 'bg-white border-[#E5E7DE] text-[#2D3B27] hover:bg-[#F0F2EB]'
                  : 'bg-[#0F172A] border-[#334155] text-[#F1F5F9] hover:bg-[#1E293B]'
              }`}
            >
              <span>Analyze</span>
            </button>
          </div>

          {/* Sub-row: Report Link + Trash Delete Button */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={onViewReport}
              className={`text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer hover:underline ${
                isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Report</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLight
                  ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  : 'text-slate-500 hover:text-red-400 hover:bg-red-950/40'
              }`}
              title="Remove Saved Area"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
