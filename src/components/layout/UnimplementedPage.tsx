import React from 'react';
import { Construction, ArrowLeft, Database, ShieldCheck } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

export const UnimplementedPage: React.FC = () => {
  const { currentNavConfig, navigateTo } = useNavigation();

  const title = currentNavConfig?.label || 'Feature';
  const description = currentNavConfig?.description || 'This section is currently under development.';

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
      <div className="bg-white border border-neutral-200 rounded-lg p-8 sm:p-10 shadow-xs">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600">
            <Construction className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
                {title}
              </h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded border border-[#dfcadf] bg-[#f5eff7] text-[#71347b]">
                Not Yet Implemented
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              {description}
            </p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-neutral-600 leading-relaxed border-t border-b border-neutral-100 py-6">
          <p>
            You have navigated to an application module that is designated for upcoming feature releases.
            In accordance with Feature 1 requirements, unimplemented destinations are cleanly identified and avoid mock or fake data.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-md bg-neutral-50 border border-neutral-200 flex items-start gap-3">
              <Database className="w-4 h-4 text-[#71347b] mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-sm text-neutral-900 block">
                  Data Persistence
                </span>
                <span className="text-[13px] text-neutral-500 block mt-0.5">
                  Tables and relationships will be created via PostgreSQL/Supabase.
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-md bg-neutral-50 border border-neutral-200 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-[#71347b] mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-sm text-neutral-900 block">
                  Role-Based Security
                </span>
                <span className="text-[13px] text-neutral-500 block mt-0.5">
                  Manager and Team Member permissions will govern record access.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => navigateTo('dashboard')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <span className="text-xs text-neutral-400 font-mono">
            Route: {currentNavConfig?.path}
          </span>
        </div>
      </div>
    </div>
  );
};
