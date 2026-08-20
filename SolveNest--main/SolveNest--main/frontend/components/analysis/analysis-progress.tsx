import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

interface AnalysisProgressProps {
  currentStep: number;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ currentStep }) => {
  const steps = [
    "Preparing the image",
    "Checking the area",
    "Finding changes",
    "Preparing results"
  ];

  return (
    <Card className="max-w-md mx-auto my-10 border-brand-neutral-200">
      <CardContent className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col items-center text-center">
          <Loader2 className="h-10 w-10 text-brand-green-700 animate-spin mb-4" />
          <h4 className="text-base md:text-lg font-bold text-brand-neutral-900">Analyzing your area...</h4>
          <p className="text-xs md:text-sm text-brand-neutral-700 mt-1">Comparing historical satellite scans</p>
        </div>

        <div className="border-t border-brand-neutral-100" />

        <ul className="space-y-4">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;

            return (
              <li
                key={step}
                className="flex items-center gap-3 transition-colors duration-200"
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-brand-green-700 flex-shrink-0" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 text-brand-green-700 animate-spin flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-brand-neutral-300 flex-shrink-0" />
                )}
                <span
                  className={
                    isCompleted
                      ? "text-sm font-medium text-brand-neutral-900"
                      : isActive
                      ? "text-sm font-semibold text-brand-green-700"
                      : "text-sm text-brand-neutral-700"
                  }
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
};
