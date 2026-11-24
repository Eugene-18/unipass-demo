import React from 'react';
import type { Step } from '../types';
import { Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StepIndicatorProps {
  currentStep: Step;
}

const steps: { id: Step; label: string }[] = [
  { id: 'personal', label: '基本資料' },
  { id: 'ranking', label: '志願填報' },
  { id: 'upload', label: '書審資料' },
  { id: 'payment', label: '繳費' },
  { id: 'confirm', label: '最終確認' },
];

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="w-full py-2">
      <div className="flex items-center justify-center w-full px-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;

          return (
            <React.Fragment key={step.id}>
              <div className="relative flex min-w-0 flex-col items-center group">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl border-2 shadow-sm transition-all duration-500 sm:h-12 sm:w-12 sm:rounded-2xl",
                    isCompleted
                      ? "bg-gradient-to-br from-green-400 to-green-500 border-green-500 text-white shadow-green-200"
                      : isActive
                      ? "bg-gradient-to-br from-indigo-bloom to-indigo-2 border-indigo-bloom text-white shadow-indigo-200 ring-4 ring-indigo-bloom/10 scale-110"
                      : "bg-white border-slate-200 text-slate-400"
                  )}
                >
                  {isCompleted ? (
                    <Check size={24} strokeWidth={3} className="animate-in zoom-in duration-300" />
                  ) : (
                    <span className="text-xs font-black sm:text-sm">{index + 1}</span>
                  )}
                </div>
                <div className="absolute -bottom-7 hidden flex-col items-center sm:flex">
                  <span
                    className={cn(
                      "whitespace-nowrap text-[11px] font-black transition-colors duration-300",
                      isActive ? "text-indigo-bloom" : isCompleted ? "text-green-600" : "text-slate-400"
                    )}
                  >
                    {step.label}
                  </span>
                  {isActive && (
                    <div className="w-1 h-1 rounded-full bg-indigo-bloom mt-1 animate-bounce" />
                  )}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="mx-1.5 h-1 flex-1 overflow-hidden rounded-full bg-slate-100 sm:mx-4">
                  <div
                    className={cn(
                      "h-full transition-all duration-700 ease-out",
                      index < currentIndex ? "w-full bg-green-400" : "w-0 bg-indigo-bloom"
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs font-semibold text-slate-600 sm:hidden">
        第 {currentIndex + 1} / {steps.length} 步：{steps[currentIndex]?.label}
      </p>
    </div>
  );
}
