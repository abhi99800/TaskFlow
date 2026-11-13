import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface SummaryCardProps {
  label: string;
  count: number | null;
  icon: LucideIcon;
  sublabel?: string;
  statusColor?: 'brand' | 'neutral' | 'amber' | 'blue' | 'emerald' | 'red';
  isLoading?: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  count,
  icon: Icon,
  sublabel = 'Awaiting database connection',
  statusColor = 'neutral',
  isLoading = false,
}) => {
  const isUnconnected = count === null;

  const colorStyles = {
    brand: 'text-[#71347b] bg-[#f5eff7] border-[#dfcadf]',
    neutral: 'text-neutral-600 bg-neutral-100 border-neutral-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    red: 'text-red-700 bg-red-50 border-red-200',
  }[statusColor];

  return (
    <div
      role="region"
      aria-label={`${label} metric summary`}
      className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col justify-between hover:border-neutral-300 transition-colors shadow-xs"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-md flex items-center justify-center border ${colorStyles} shrink-0`}
          aria-hidden="true"
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {isLoading ? (
          <div className="h-8 w-20 bg-neutral-100 rounded animate-pulse my-0.5" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight ${
                isUnconnected ? 'text-neutral-400 font-mono' : 'text-neutral-900 font-mono tabular-nums'
              }`}
            >
              {isUnconnected ? '—' : count}
            </span>
            {isUnconnected && (
              <span className="text-xs text-neutral-400 font-normal">
                (Unconnected)
              </span>
            )}
          </div>
        )}

        <p className="text-xs text-neutral-500 mt-1 leading-normal">
          {isUnconnected ? sublabel : `${count} tasks recorded`}
        </p>
      </div>
    </div>
  );
};
