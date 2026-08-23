"use client";

/**
 * TechDetailsPanel
 *
 * A reusable, collapsible disclosure panel for technical/expert metadata.
 *
 * - Hidden by default (progressive disclosure).
 * - Groups with all-empty fields are not rendered.
 * - Rows with empty/nullish values are not rendered.
 * - No "undefined" or "null" is ever shown to the user.
 * - Keyboard accessible (Enter/Space on trigger).
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface TechDetailField {
  label: string;
  value?: string | number | null;
}

export interface TechDetailGroup {
  heading: string;
  fields: TechDetailField[];
}

export interface TechDetailsPanelProps {
  groups: TechDetailGroup[];
  /** Open by default? False = simple mode default. */
  defaultOpen?: boolean;
}

export const TechDetailsPanel: React.FC<TechDetailsPanelProps> = ({
  groups,
  defaultOpen = false,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Filter out groups where every field is empty
  const visibleGroups = groups
    .map(g => ({
      ...g,
      fields: g.fields.filter(
        f => f.value !== undefined && f.value !== null && f.value !== ''
      ),
    }))
    .filter(g => g.fields.length > 0);

  // If there's nothing to show, render nothing
  if (visibleGroups.length === 0) return null;

  return (
    <div className="border border-brand-neutral-200 rounded-brand-md overflow-hidden">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-controls="tech-details-content"
        className="w-full flex items-center justify-between px-4 py-3 bg-brand-neutral-50 hover:bg-brand-neutral-100 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-brand-neutral-700 uppercase tracking-wider">
          {t('common.techDetails')}
        </span>
        {isOpen
          ? <ChevronUp className="h-4 w-4 text-brand-neutral-700 flex-shrink-0" />
          : <ChevronDown className="h-4 w-4 text-brand-neutral-700 flex-shrink-0" />
        }
      </button>

      {/* Content */}
      {isOpen && (
        <div id="tech-details-content" className="divide-y divide-brand-neutral-100">
          {visibleGroups.map((group) => (
            <div key={group.heading} className="px-4 py-3 space-y-2">
              {/* Group heading */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-neutral-700">
                {group.heading}
              </p>
              {/* Fields */}
              <dl className="space-y-1.5">
                {group.fields.map((field) => (
                  <div
                    key={field.label}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="text-xs text-brand-neutral-700 flex-shrink-0 min-w-[120px]">
                      {field.label}
                    </dt>
                    <dd className="text-xs font-medium text-brand-neutral-900 text-right">
                      {String(field.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
