import React from 'react';
import { Leaf, Building2, Droplets } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Finding } from '@/services/analysis-service';

interface FindingsListProps {
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (finding: Finding) => void;
  className?: string;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  selectedFindingId,
  onSelectFinding,
  className
}) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'vegetation':
        return <Leaf className="h-5 w-5 text-brand-green-700" />;
      case 'built-up':
        return <Building2 className="h-5 w-5 text-brand-purple-700" />;
      case 'water':
        return <Droplets className="h-5 w-5 text-brand-blue-700" />;
      default:
        return <Leaf className="h-5 w-5" />;
    }
  };

  return (
    <div className={className || "space-y-3"}>
      {findings.map((finding) => {
        const isSelected = selectedFindingId === finding.id;

        return (
          <Card
            key={finding.id}
            onClick={() => onSelectFinding(finding)}
            className={clsx(
              "cursor-pointer transition-all border",
              {
                "border-brand-green-700 bg-brand-green-50/20 shadow-brand-sm": isSelected,
                "border-brand-neutral-200 hover:border-brand-neutral-300 hover:bg-brand-neutral-50/50 bg-white": !isSelected
              }
            )}
          >
            <CardContent className="p-4 flex gap-3.5 items-start">
              {/* Category icon container */}
              <div
                className={clsx(
                  "p-2 rounded-brand-md flex-shrink-0",
                  {
                    "bg-brand-green-50": finding.category === 'vegetation',
                    "bg-brand-purple-50": finding.category === 'built-up',
                    "bg-brand-blue-50": finding.category === 'water'
                  }
                )}
              >
                {getCategoryIcon(finding.category)}
              </div>

              {/* Title & badge */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h5 className="font-semibold text-brand-neutral-900 text-sm md:text-base leading-none">
                    {finding.title}
                  </h5>
                  <Badge variant={finding.status}>
                    {finding.statusLabel}
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-brand-neutral-700 leading-normal">
                  {finding.subtitle}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
