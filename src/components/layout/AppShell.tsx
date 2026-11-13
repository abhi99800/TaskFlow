import React from 'react';
import { TopNavBar } from './TopNavBar';
import { DashboardPage } from '../dashboard/DashboardPage';
import { UserManagementContainer } from '../userManagement/UserManagementContainer';
import { ProjectsPage } from '../projects/ProjectsPage';
import { AssignTaskPage } from '../tasks/AssignTaskPage';
import { MyTasksPage } from '../tasks/MyTasksPage';
import { SignInPage } from '../auth/SignInPage';
import { UnimplementedPage } from './UnimplementedPage';
import { NotFoundPage } from './NotFoundPage';
import { UnauthorizedPage } from './UnauthorizedPage';
import { TeamMembersPage } from '../team/TeamMembersPage';
import { ReportsPage } from '../reports/ReportsPage';
import { useNavigation } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';

export const AppShell: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { currentRoute, currentNavConfig, hasAccessToRoute } = useNavigation();

  // Show lightweight loader during initial session restoration
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#fbfbfa]">
        <div className="w-8 h-8 border-2 border-[#71347b]/20 border-t-[#71347b] rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-neutral-500">Checking session...</p>
      </div>
    );
  }

  // 1. If unauthenticated or on signin route, render SignInPage
  if (!isAuthenticated || currentRoute === 'signin') {
    return <SignInPage />;
  }

  const renderCurrentPage = () => {
    // 2. Role-based access validation
    if (!hasAccessToRoute(currentRoute)) {
      return <UnauthorizedPage />;
    }

    // 3. 404 handler
    if (currentRoute === 'not-found') {
      return <NotFoundPage />;
    }

    // 4. Implemented modules
    if (currentRoute === 'user-management') {
      return <UserManagementContainer />;
    }

    if (currentRoute === 'dashboard') {
      return <DashboardPage />;
    }

    if (currentRoute === 'my-tasks') {
      return <MyTasksPage />;
    }

    if (currentRoute === 'projects') {
      return <ProjectsPage />;
    }

    if (currentRoute === 'assign-task') {
      return <AssignTaskPage />;
    }

    if (currentRoute === 'team') {
      return <TeamMembersPage />;
    }

    if (currentRoute === 'reports') {
      return <ReportsPage />;
    }

    // 5. Planned roadmap modules (e.g. reports)
    if (currentNavConfig && !currentNavConfig.isImplemented) {
      return <UnimplementedPage />;
    }

    return <NotFoundPage />;
  };

  return (
    <div className="h-screen max-h-screen bg-[#fbfbfa] flex flex-col antialiased overflow-hidden">
      {/* Top Navigation Bar with exact 50px height */}
      <TopNavBar />

      {/* Full-width Responsive Main Content Area */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-4 sm:p-5 lg:p-6 overflow-y-auto">
        {renderCurrentPage()}
      </main>
    </div>
  );
};
