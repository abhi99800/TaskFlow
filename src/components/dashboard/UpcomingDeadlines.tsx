import React from 'react';
import { CalendarClock, Clock, AlertCircle } from 'lucide-react';
import { UpcomingDeadlineItem, ViewStateMode } from '../../types';
import { EmptyState } from '../common/EmptyState';

interface UpcomingDeadlinesProps {
  items: UpcomingDeadlineItem[];
  viewState?: ViewStateMode;
  isLoading?: boolean;
  hasError?: boolean;
}

export const UpcomingDeadlines: React.FC<UpcomingDeadlinesProps> = ({
  items,
  viewState,
  isLoading: propIsLoading,
  hasError: propHasError,
}) => {
  const isLoading = viewState === 'loading' || Boolean(propIsLoading);
  const isError = viewState === 'error' || Boolean(propHasError);

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col h-full shadow-xs">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Upcoming Deadlines
          </h2>
          <p className="text-[13px] text-neutral-500 mt-0.5">
            Prioritized tasks requiring completion in the next 7 days.
          </p>
        </div>
        <div className="w-8 h-8 rounded-md bg-[#f5eff7] text-[#71347b] border border-[#dfcadf] flex items-center justify-center">
          <CalendarClock className="w-4 h-4" />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {isLoading && (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-3 border border-neutral-100 rounded-md animate-pulse space-y-2"
              >
                <div className="h-4 bg-neutral-100 rounded w-3/4" />
                <div className="flex justify-between">
                  <div className="h-3 bg-neutral-50 rounded w-1/3" />
                  <div className="h-3 bg-neutral-50 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <div className="p-6 text-center">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-neutral-800">
              Unable to load schedule
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Database connection required to calculate task milestones.
            </p>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={Clock}
            title="No upcoming deadlines"
            description="Active deadline schedules and countdowns will appear here once tasks with due dates are scheduled."
            helperText="Tasks with upcoming deadlines will show up here"
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="space-y-2.5">
            {items.map((item) => {
              const formattedDate = item.dueAt
                ? new Date(item.dueAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'No date';

              return (
                <div
                  key={item.id}
                  className="p-3 border border-neutral-200 rounded-md hover:border-neutral-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-neutral-900 line-clamp-1">
                      {item.taskTitle}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-amber-700 font-semibold shrink-0">
                      {formattedDate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-500 mt-2">
                    <span className="font-medium text-neutral-700">{item.projectName}</span>
                    <span>{item.assignedUserName || 'Unassigned'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-3 mt-4 border-t border-neutral-100 text-xs text-neutral-400 flex items-center justify-between">
        <span>Calendar schedule view</span>
        <span className="font-mono tabular-nums text-neutral-600 font-semibold">
          {items.length} {items.length === 1 ? 'item' : 'items'} upcoming
        </span>
      </div>
    </div>
  );
};
