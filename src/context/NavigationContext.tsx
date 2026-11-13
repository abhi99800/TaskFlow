import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { RouteId, NavItemConfig, CurrentUserRole, UserManagementSubTab } from '../types';
import { useAuth } from './AuthContext';

export const ALL_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'projects',
    label: 'Projects',
    path: '#/projects',
    isImplemented: true,
    description: 'Project portfolios, milestones, and work breakdowns',
    allowedRoles: ['manager', 'user'],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '#/dashboard',
    isImplemented: true,
    description: 'Track tasks, manage deadlines, and monitor team progress',
    allowedRoles: ['manager', 'user'],
  },
  {
    id: 'my-tasks',
    label: 'My Tasks',
    path: '#/my-tasks',
    isImplemented: true,
    description: 'Personal task queue and assigned deliverables',
    allowedRoles: ['user'],
  },
  {
    id: 'assign-task',
    label: 'Assign Task',
    path: '#/assign-task',
    isImplemented: true,
    description: 'Delegate tasks and establish team accountability',
    allowedRoles: ['manager'],
  },
  {
    id: 'team',
    label: 'Team Members',
    path: '#/team',
    isImplemented: true,
    description: 'Roster management, workload allocation, and member roles',
    allowedRoles: ['manager', 'user'],
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '#/reports',
    isImplemented: true,
    description: 'Completion metrics, velocity, and audit reports',
    allowedRoles: ['manager'],
  },
  {
    id: 'user-management',
    label: 'User Management',
    path: '#/user-management',
    isImplemented: true,
    description: 'Manage team member accounts and role definitions',
    allowedRoles: ['manager'],
  },
];

interface NavigationContextType {
  currentRoute: RouteId;
  currentUserRole: CurrentUserRole | null;
  userManagementSubTab: UserManagementSubTab;
  setUserManagementSubTab: (tab: UserManagementSubTab) => void;
  navigateTo: (route: RouteId, subTab?: UserManagementSubTab) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  navItems: NavItemConfig[];
  currentNavConfig: NavItemConfig | undefined;
  hasAccessToRoute: (route: RouteId, role?: CurrentUserRole | null) => boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

function parseHash(hash: string): { route: RouteId; subTab: UserManagementSubTab } {
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean || clean === 'signin' || clean === 'login') {
    return { route: 'signin', subTab: 'users' };
  }

  if (clean === 'dashboard') {
    return { route: 'dashboard', subTab: 'users' };
  }

  if (clean.startsWith('user-management')) {
    const parts = clean.split('/');
    const sub = parts[1] === 'roles' ? 'roles' : 'users';
    return { route: 'user-management', subTab: sub };
  }

  const found = ALL_NAV_ITEMS.find((item) => item.id === clean);
  if (found) {
    return { route: found.id, subTab: 'users' };
  }

  return { route: 'not-found', subTab: 'users' };
}

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, role, isLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<RouteId>(() => {
    if (!isAuthenticated) return 'signin';
    const parsed = parseHash(window.location.hash);
    return parsed.route === 'signin' ? 'dashboard' : parsed.route;
  });
  const [userManagementSubTab, setUserManagementSubTab] = useState<UserManagementSubTab>('users');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const hasAccessToRoute = useCallback(
    (route: RouteId, targetRole: CurrentUserRole | null = role): boolean => {
      if (route === 'signin') return true;
      if (!targetRole) return false;
      if (route === 'dashboard' || route === 'not-found') return true;
      const config = ALL_NAV_ITEMS.find((item) => item.id === route);
      if (!config) return false;
      return config.allowedRoles.includes(targetRole);
    },
    [role]
  );

  const navigateTo = useCallback(
    (route: RouteId, subTab?: UserManagementSubTab) => {
      if (!isAuthenticated) {
        window.location.hash = '#/signin';
        setCurrentRoute('signin');
        setIsMobileMenuOpen(false);
        return;
      }

      if (route === 'signin') {
        window.history.replaceState(null, '', '#/dashboard');
        setCurrentRoute('dashboard');
        setIsMobileMenuOpen(false);
        return;
      }

      // Route guard: verify permissions
      if (!hasAccessToRoute(route, role)) {
        window.history.replaceState(null, '', '#/dashboard');
        setCurrentRoute('dashboard');
        setIsMobileMenuOpen(false);
        return;
      }

      if (route === 'user-management') {
        const activeSub = subTab || userManagementSubTab || 'users';
        setUserManagementSubTab(activeSub);
        window.location.hash = `#/user-management/${activeSub}`;
      } else if (route === 'not-found') {
        window.location.hash = '#/404';
      } else {
        window.location.hash = `#/${route}`;
      }

      setCurrentRoute(route);
      setIsMobileMenuOpen(false);
    },
    [isAuthenticated, role, userManagementSubTab, hasAccessToRoute]
  );

  // Synchronize route with authentication status changes
  useEffect(() => {
    if (isLoading) return; // Wait for initial session restoration to complete

    if (!isAuthenticated) {
      if (window.location.hash !== '#/signin') {
        window.history.replaceState(null, '', '#/signin');
      }
      setCurrentRoute('signin');
    } else {
      // User is authenticated
      const parsed = parseHash(window.location.hash);
      if (parsed.route === 'signin') {
        window.history.replaceState(null, '', '#/dashboard');
        setCurrentRoute('dashboard');
      } else if (!hasAccessToRoute(parsed.route, role)) {
        // Guard: redirect to dashboard if user has no permission
        window.history.replaceState(null, '', '#/dashboard');
        setCurrentRoute('dashboard');
      } else {
        setCurrentRoute(parsed.route);
        setUserManagementSubTab(parsed.subTab);
      }
    }
  }, [isAuthenticated, role, isLoading, hasAccessToRoute]);

  // Sync route with browser hash changes (browser back/forward or manual hash entry)
  useEffect(() => {
    const handleHashChange = () => {
      if (isLoading) return;

      if (!isAuthenticated) {
        if (window.location.hash !== '#/signin') {
          window.history.replaceState(null, '', '#/signin');
        }
        setCurrentRoute('signin');
        return;
      }

      const parsed = parseHash(window.location.hash);
      if (parsed.route === 'signin') {
        window.history.replaceState(null, '', '#/dashboard');
        setCurrentRoute('dashboard');
        return;
      }

      // Check role authorization for the requested hash
      if (!hasAccessToRoute(parsed.route, role)) {
        window.history.replaceState(null, '', '#/dashboard');
        setCurrentRoute('dashboard');
        return;
      }

      setCurrentRoute(parsed.route);
      setUserManagementSubTab(parsed.subTab);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [isAuthenticated, role, hasAccessToRoute]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  // Compute allowed navigation tabs strictly for current user role
  const allowedNavItems = role
    ? ALL_NAV_ITEMS.filter((item) => item.allowedRoles.includes(role))
    : [];

  const currentNavConfig = ALL_NAV_ITEMS.find((item) => item.id === currentRoute);

  return (
    <NavigationContext.Provider
      value={{
        currentRoute,
        currentUserRole: role,
        userManagementSubTab,
        setUserManagementSubTab: (tab: UserManagementSubTab) => {
          setUserManagementSubTab(tab);
          window.location.hash = `#/user-management/${tab}`;
        },
        navigateTo,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        toggleMobileMenu,
        navItems: allowedNavItems,
        currentNavConfig,
        hasAccessToRoute,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
