import React from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

export const NotFoundPage: React.FC = () => {
  const { navigateTo } = useNavigation();

  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 mx-auto mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
        404 - Page Not Found
      </h2>
      <p className="text-sm text-neutral-500 mt-2 mb-6">
        The requested navigation path does not exist in TaskFlow.
      </p>
      <button
        onClick={() => navigateTo('dashboard')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Dashboard
      </button>
    </div>
  );
};
