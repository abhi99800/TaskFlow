import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

export const UnauthorizedPage: React.FC = () => {
  const { navigateTo, currentUserRole } = useNavigation();

  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mx-auto mb-4">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
        Access Restricted
      </h2>
      <p className="text-sm text-neutral-500 mt-2 mb-2">
        Your authenticated session does not have Manager authorization to access this administrative module.
      </p>
      <p className="text-xs text-neutral-400 mb-6">
        Manager privileges are determined automatically by login credentials upon authentication.
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
