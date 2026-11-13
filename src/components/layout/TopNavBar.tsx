import React, { useState, useRef, useEffect } from 'react';
import {
  Layers,
  ChevronDown,
  Bell,
  Menu,
  X,
  Shield,
  LogOut,
  Info,
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { RouteId, UserManagementSubTab } from '../../types';
import { SignOutConfirmModal } from '../auth/SignOutConfirmModal';
import { ProjectNavDropdown } from './ProjectNavDropdown';

export const TopNavBar: React.FC = () => {
  const {
    currentRoute,
    currentUserRole,
    userManagementSubTab,
    navigateTo,
    navItems,
    isMobileMenuOpen,
    toggleMobileMenu,
    setIsMobileMenuOpen,
  } = useNavigation();

  const { user, signOut } = useAuth();
  const { showInfo } = useToast();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileMenuOpen(false);
        setIsNotifOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setIsMobileMenuOpen]);

  const handleTabClick = (routeId: RouteId) => {
    if (routeId === 'user-management') {
      navigateTo('user-management', 'users');
    } else {
      navigateTo(routeId);
    }
    setIsMobileMenuOpen(false);
  };

  const handleSubTabClick = (subTab: UserManagementSubTab) => {
    navigateTo('user-management', subTab);
    setIsMobileMenuOpen(false);
  };

  const handleOpenSignOutModal = () => {
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen(false);
    setIsSignOutModalOpen(true);
  };

  const handleConfirmSignOut = async () => {
    setIsSignOutModalOpen(false);
    await signOut();
    showInfo('Signed out successfully.', 'Session Ended');
    navigateTo('signin');
  };

  const userInitial = user?.fullName
    ? user.fullName.charAt(0).toUpperCase()
    : currentUserRole === 'manager'
    ? 'M'
    : 'U';

  const userDisplayName = user?.fullName || (currentUserRole === 'manager' ? 'Operations Manager' : 'Team Member');
  const userDisplayEmail = user?.email || (currentUserRole === 'manager' ? 'manager@demo.com' : 'user@demo.com');

  return (
    <>
      <header className="sticky top-0 z-40 shrink-0">
        {/* Main 50px Top Navigation Bar */}
        <div className="bg-[#71347b] text-white shadow-md h-[50px]">
          <div className="max-w-[1720px] mx-auto px-3 sm:px-5 h-[50px] flex items-center justify-between gap-3">
            {/* Left Zone: Logo & Workspace Title */}
            <div className="flex items-center gap-3 shrink-0 h-full">
              <button
                onClick={() => handleTabClick('dashboard')}
                className="flex items-center gap-2 text-left group focus-visible:outline-2 focus-visible:outline-white rounded h-full cursor-pointer"
                aria-label="TaskFlow Dashboard"
              >
                <div className="w-7 h-7 rounded-md bg-white/15 border border-white/20 text-white flex items-center justify-center font-bold tracking-tight shadow-xs group-hover:bg-white/25 transition-colors shrink-0">
                  <Layers className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5 whitespace-nowrap">
                  TaskFlow
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-white/15 border border-white/20 text-white/90">
                    {currentUserRole === 'manager' ? 'Manager' : 'User'}
                  </span>
                </span>
              </button>
            </div>

            {/* Middle Zone: Horizontal Navigation Bar */}
            <nav
              className="hidden lg:flex items-center gap-2 py-1 h-full overflow-visible"
              aria-label="Main Navigation"
            >
              {navItems.map((item) => {
                if (item.id === 'projects') {
                  return <ProjectNavDropdown key="unified-project-nav" />;
                }

                if (item.id === 'user-management') {
                  const isUserMgmtActive = currentRoute === 'user-management';

                  if (isUserMgmtActive) {
                    return (
                      <div
                        key="user-management-fireflink-capsule"
                        className="inline-flex items-center bg-white rounded-full p-0.5 pr-4 sm:pr-5 shadow-xs shrink-0 select-none"
                        role="group"
                        aria-label="User Management Navigation"
                      >
                        {/* Active Module Indicator: Purple Pill */}
                        <div className="bg-[#71347b] text-white text-xs font-semibold px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full whitespace-nowrap shadow-xs">
                          User Management
                        </div>

                        {/* Submodule Navigation Options: Users & Roles */}
                        <div className="flex items-center gap-3.5 sm:gap-4 ml-3">
                          <button
                            type="button"
                            onClick={() => handleSubTabClick('users')}
                            className={`relative text-xs sm:text-[13px] font-medium transition-colors cursor-pointer py-1 ${
                              userManagementSubTab === 'users'
                                ? 'text-neutral-900 font-semibold'
                                : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                            aria-current={userManagementSubTab === 'users' ? 'page' : undefined}
                          >
                            <span>Users</span>
                            {userManagementSubTab === 'users' && (
                              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#71347b] rounded-full" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSubTabClick('roles')}
                            className={`relative text-xs sm:text-[13px] font-medium transition-colors cursor-pointer py-1 ${
                              userManagementSubTab === 'roles'
                                ? 'text-neutral-900 font-semibold'
                                : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                            aria-current={userManagementSubTab === 'roles' ? 'page' : undefined}
                          >
                            <span>Roles</span>
                            {userManagementSubTab === 'roles' && (
                              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#71347b] rounded-full" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Inactive User Management: regular navbar button
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      className="h-7 px-3 text-xs rounded-full font-medium flex items-center justify-center transition-all whitespace-nowrap shrink-0 cursor-pointer text-white/85 hover:text-white hover:bg-white/10"
                    >
                      {item.label}
                    </button>
                  );
                }

                const isActive = currentRoute === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`h-7 px-3 text-xs rounded-full font-medium flex items-center justify-center transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#71347b] font-semibold shadow-xs'
                        : 'text-white/85 hover:text-white hover:bg-white/10'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Right Zone: Notifications & User Profile Controls */}
            <div className="flex items-center gap-2 shrink-0 h-full">
              {/* Notifications Button */}
              <div className="relative h-full flex items-center" ref={notifRef}>
                <button
                  onClick={() => {
                    setIsNotifOpen((prev) => !prev);
                    setIsProfileMenuOpen(false);
                  }}
                  aria-expanded={isNotifOpen}
                  aria-label="Notifications"
                  className="w-7 h-7 flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 rounded-full transition-colors relative cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                </button>

                {isNotifOpen && (
                  <div
                    className="absolute right-0 top-[45px] w-80 bg-white text-neutral-900 border border-neutral-200 rounded-lg shadow-xl py-2 z-50 text-xs"
                    role="dialog"
                    aria-label="Notification center"
                  >
                    <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 text-sm">Notifications</span>
                      <span className="text-xs text-neutral-400">0 unread</span>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-neutral-700 font-medium text-sm">No new alerts</p>
                      <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                        Task assignments and role updates will generate alerts once real-time notification streams are active.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Avatar / Menu */}
              <div className="relative h-full flex items-center" ref={profileRef}>
                <button
                  onClick={() => {
                    setIsProfileMenuOpen((prev) => !prev);
                    setIsNotifOpen(false);
                  }}
                  aria-expanded={isProfileMenuOpen}
                  aria-label="User account menu"
                  className="flex items-center gap-1.5 p-0.5 rounded-full hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-white text-[#71347b] flex items-center justify-center font-bold text-xs shadow-xs">
                    {userInitial}
                  </div>
                  <ChevronDown className="w-3 h-3 text-white/80 hidden sm:block" />
                </button>

                {isProfileMenuOpen && (
                  <div
                    className="absolute right-0 top-[45px] w-64 bg-white text-neutral-900 border border-neutral-200 rounded-lg shadow-xl py-1 z-50 text-xs animate-in fade-in-0 zoom-in-95"
                    role="menu"
                  >
                    <div className="px-3.5 py-2.5 border-b border-neutral-100">
                      <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">
                        Signed In As
                      </span>
                      <p className="text-neutral-900 font-semibold text-sm">
                        {userDisplayName}
                      </p>
                      <p className="text-xs text-neutral-500 font-mono mt-0.5 truncate">
                        {userDisplayEmail}
                      </p>
                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#f5eff7] text-[#71347b] border border-[#dfcadf]">
                        <Shield className="w-3 h-3" />
                        <span className="capitalize">{currentUserRole || 'User'} Role</span>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={handleOpenSignOutModal}
                        className="w-full text-left px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors cursor-pointer"
                        role="menuitem"
                      >
                        <LogOut className="w-4 h-4 text-red-500" />
                        <span className="font-medium">Sign Out</span>
                      </button>
                    </div>

                    <div className="px-3.5 py-2 border-t border-neutral-100 bg-neutral-50/70 text-xs text-neutral-500 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>Portal: {currentUserRole === 'manager' ? 'Manager Portal' : 'User Portal'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Hamburger Toggle */}
              <button
                onClick={toggleMobileMenu}
                className="lg:hidden w-7 h-7 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-md focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
                aria-label="Toggle navigation menu"
              >
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Drawer / Dropdown */}
          {isMobileMenuOpen && (
            <div className="lg:hidden absolute top-[50px] left-0 right-0 bg-[#5d2a65] border-t border-white/10 px-4 py-3 space-y-2 shadow-lg z-50">
              <div className="flex items-center justify-between text-[11px] font-semibold text-white/70 uppercase tracking-wider px-2 pt-1">
                <span>{currentUserRole === 'manager' ? 'Manager Portal' : 'User Portal'}</span>
                <span className="text-white/90">{userDisplayEmail}</span>
              </div>

              <div className="flex flex-col gap-1 pt-1">
                {navItems.map((item) => {
                  if (item.id === 'projects') {
                    return <ProjectNavDropdown key="mobile-project-nav" isMobile={true} />;
                  }

                  if (item.id === 'user-management') {
                    const isUserMgmtActive = currentRoute === 'user-management';

                    if (isUserMgmtActive) {
                      return (
                        <div
                          key="mobile-user-mgmt"
                          className="bg-white/10 rounded-lg p-2.5 border border-white/20 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#71347b]">
                              User Management
                            </span>
                          </div>
                          <div className="flex items-center gap-4 px-1 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSubTabClick('users')}
                              className={`relative text-xs font-medium pb-1 cursor-pointer ${
                                userManagementSubTab === 'users'
                                  ? 'text-white font-bold'
                                  : 'text-white/70 hover:text-white'
                              }`}
                            >
                              <span>Users</span>
                              {userManagementSubTab === 'users' && (
                                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubTabClick('roles')}
                              className={`relative text-xs font-medium pb-1 cursor-pointer ${
                                userManagementSubTab === 'roles'
                                  ? 'text-white font-bold'
                                  : 'text-white/70 hover:text-white'
                              }`}
                            >
                              <span>Roles</span>
                              {userManagementSubTab === 'roles' && (
                                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabClick(item.id)}
                        className="px-3 py-2 rounded-md text-xs font-medium text-left transition-colors cursor-pointer text-white/85 hover:bg-white/10 hover:text-white"
                      >
                        {item.label}
                      </button>
                    );
                  }

                  const isActive = currentRoute === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      className={`px-3 py-2 rounded-md text-xs font-medium text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-white text-[#71347b] font-semibold shadow-xs'
                          : 'text-white/85 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Mobile Sign Out Action */}
              <div className="pt-2 border-t border-white/15">
                <button
                  onClick={handleOpenSignOutModal}
                  className="w-full px-3 py-2 text-xs font-medium text-red-200 hover:text-white hover:bg-red-600/30 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out ({userDisplayName})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Sign Out Confirmation Modal */}
      <SignOutConfirmModal
        isOpen={isSignOutModalOpen}
        onClose={() => setIsSignOutModalOpen(false)}
        onConfirm={handleConfirmSignOut}
        userEmail={userDisplayEmail}
        userRole={currentUserRole}
      />
    </>
  );
};
