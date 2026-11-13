import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CurrentUserRole, UserProfile, AuthState } from '../types';
import { authService, DEMO_ACCOUNTS, DemoAccountInfo } from '../services/authService';

interface AuthContextType {
  user: UserProfile | null;
  role: CurrentUserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  signOut: () => Promise<void>;
  demoAccounts: Record<string, DemoAccountInfo>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => authService.getAuthState());

  useEffect(() => {
    const unsubscribe = authService.subscribe((updatedState) => {
      setAuthState(updatedState);
    });
    authService.init();
    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    return authService.signIn(email, password);
  }, []);

  const signOut = useCallback(async () => {
    return authService.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: authState.user,
        role: authState.user?.role || null,
        isAuthenticated: authState.isAuthenticated && authState.user !== null,
        isLoading: authState.isLoading,
        signIn,
        signOut,
        demoAccounts: DEMO_ACCOUNTS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
