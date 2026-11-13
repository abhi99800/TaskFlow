import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Edit2,
  Power,
  Users as UsersIcon,
  X,
  Phone,
  Mail,
  Shield,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { userService } from '../../services/userService';
import { roleService } from '../../services/roleService';
import { teamService, ProjectTeamMember } from '../../services/teamService';
import { ManagedUser, Role } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { taskService } from '../../services/taskService';
import { AddUserModal } from './AddUserModal';
import { EditUserModal } from './EditUserModal';
import { AddTeamMembersDrawer } from '../team/AddTeamMembersDrawer';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isManager = currentUser?.role === 'manager';
  const { showSuccess, showError } = useToast();
  const { selectedProjectId, selectedProject, projects } = useProject();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [projectTeamMembers, setProjectTeamMembers] = useState<ProjectTeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>(roleService.getRoles());
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);

  // Deletion modal state for managers on deactivated users
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);

    await Promise.all([roleService.fetchRoles(), userService.fetchUsers()]);
    setRoles(roleService.getRoles());

    if (selectedProjectId === 'all') {
      setUsers(userService.getUsers());
      setFetchError(userService.getLastError());
    } else {
      const res = await teamService.fetchTeamMembers(selectedProjectId);
      if (res.success) {
        setProjectTeamMembers(res.members);
        // Map project team members to ManagedUser format for display
        const mapped: ManagedUser[] = res.members.map((m) => ({
          id: m.userId,
          fullName: m.name,
          email: m.email,
          phoneNumber: m.phoneNumber || '-',
          roleId: m.roleId,
          roleName: m.roleName,
          status: m.status,
          createdAt: m.createdAt,
        }));
        setUsers(mapped);
      } else {
        setUsers([]);
        setFetchError(res.error || 'Failed to load project team members.');
      }
    }
    setIsLoading(false);
  }, [selectedProjectId]);

  useEffect(() => {
    refreshData();
    const unsubUser = userService.subscribe(() => {
      if (selectedProjectId === 'all') setUsers(userService.getUsers());
    });
    const unsubRole = roleService.subscribe(() => {
      setRoles(roleService.getRoles());
    });
    const unsubTeam = teamService.subscribe(() => {
      if (selectedProjectId !== 'all') refreshData();
    });

    return () => {
      unsubUser();
      unsubRole();
      unsubTeam();
    };
  }, [selectedProjectId, refreshData]);

  const isUserActive = (u: ManagedUser) => u.status === 'Active' || u.status === 'active';

  const handleToggleStatus = async (user: ManagedUser) => {
    if (selectedProjectId !== 'all') {
      showError('Status changes must be performed in All Projects mode.');
      return;
    }
    if (updatingUserId) return; // Prevent duplicate clicks
    setUpdatingUserId(user.id);

    try {
      const isCurrentlyActive = isUserActive(user);
      const res = await userService.toggleUserStatus(user.id, () => taskService.getTasks());
      if (!res.success) {
        if (res.isBlockedByTasks || res.error?.includes('cannot be deactivated')) {
          showError(res.error || 'This user cannot be deactivated because tasks are assigned to them. Reassign the tasks before deactivating this user.');
        } else if (res.isRlsBlocked) {
          showError(res.error || 'Row-Level Security blocked user status update.');
        } else {
          showError(res.error || 'Failed to update user status in Supabase.');
        }
      } else {
        if (isCurrentlyActive) {
          showSuccess('User deactivated successfully.');
        } else {
          showSuccess(`User "${user.fullName}" status updated to Active.`);
        }
        refreshData();
      }
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRemoveFromProject = async (userId: string, userName: string) => {
    if (selectedProjectId === 'all') return;
    const res = await teamService.removeTeamMember(selectedProjectId, userId);
    if (res.success) {
      showSuccess(`Removed ${userName} from ${selectedProject?.name || 'project'}.`);
      refreshData();
    } else {
      showError(res.error || 'Failed to remove user from project.');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete || !isManager) return;

    setIsDeletingUser(true);
    const res = await userService.deleteUser(userToDelete.id, () => taskService.getTasks());
    setIsDeletingUser(false);

    if (res.success) {
      showSuccess('User deleted successfully.');
      setUserToDelete(null);
      refreshData();
    } else {
      showError(res.error || 'Failed to delete user.');
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.roleId === roleFilter;
    const active = isUserActive(u);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && active) ||
      (statusFilter === 'inactive' && !active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const isAllProjects = selectedProjectId === 'all';

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-neutral-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            {isAllProjects ? 'User Management (All Projects)' : `Users — ${selectedProject?.name || 'Project'}`}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            {isAllProjects
              ? 'Maintain centralized team member directories, contact profiles, and role allocations.'
              : `Manage team members assigned to ${selectedProject?.name}. Adding users here associates them with this project without duplicating profiles.`}
          </p>
        </div>

        {isAllProjects ? (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ User</span>
          </button>
        ) : (
          <button
            onClick={() => setIsAddDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add User</span>
          </button>
        )}
      </div>

      {/* Error banner if Supabase fetch failed */}
      {fetchError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3 sm:p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <label htmlFor="user-search" className="sr-only">
            Search users by name, email, or phone
          </label>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            id="user-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-9 pr-8 py-1.5 text-sm bg-neutral-50 focus:bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] placeholder:text-neutral-400 text-neutral-900 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-neutral-50 border border-neutral-300 rounded-md">
            <Shield className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-sm text-neutral-800 font-medium focus:outline-none cursor-pointer pr-1"
              aria-label="Filter by role"
            >
              <option value="all">All Roles ({roles.length})</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-neutral-50 border border-neutral-300 rounded-md">
            <Filter className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-sm text-neutral-800 font-medium focus:outline-none cursor-pointer pr-1"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/75 text-neutral-700 text-[13px] font-semibold">
                <th scope="col" className="py-3 px-5">
                  Name
                </th>
                <th scope="col" className="py-3 px-4">
                  Email
                </th>
                <th scope="col" className="py-3 px-4">
                  Phone Number
                </th>
                <th scope="col" className="py-3 px-4">
                  Role
                </th>
                <th scope="col" className="py-3 px-4">
                  Status
                </th>
                <th scope="col" className="py-3 px-4">
                  {isAllProjects ? 'Created Date' : 'Assigned Status'}
                </th>
                <th scope="col" className="py-3 px-5 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 mb-3">
                        <UsersIcon className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-neutral-800 mb-1">
                        No user records found
                      </h3>
                      <p className="text-[13px] text-neutral-500 mb-4 leading-relaxed">
                        {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                          ? 'No users match your current filter query. Try clearing filters.'
                          : isAllProjects
                          ? 'No user accounts have been added yet.'
                          : `No users have been assigned to ${selectedProject?.name || 'this project'} yet.`}
                      </p>
                      {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setRoleFilter('all');
                            setStatusFilter('all');
                          }}
                          className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
                        >
                          Reset Filters
                        </button>
                      ) : isAllProjects ? (
                        <button
                          onClick={() => setIsAddModalOpen(true)}
                          className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors"
                        >
                          + Add First User
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsAddDrawerOpen(true)}
                          className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors"
                        >
                          + Add Users to Project
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const createdFormatted = new Date(user.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr key={user.id} className="hover:bg-neutral-50/60 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#f5eff7] text-[#71347b] border border-[#dfcadf] flex items-center justify-center font-semibold text-xs shrink-0">
                            {user.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-neutral-900 block leading-tight">
                              {user.fullName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-neutral-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={user.email}>
                            {user.email}
                          </span>
                        </div>
                      </td>

                      {/* Phone Number */}
                      <td className="py-3.5 px-4 text-neutral-600 font-mono text-[13px] tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{user.phoneNumber}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                          {user.roleName}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium ${
                            isUserActive(user)
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                          }`}
                        >
                          {isUserActive(user) ? (
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-neutral-400" />
                          )}
                          {isUserActive(user) ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Created Date / Association */}
                      <td className="py-3.5 px-4 text-neutral-500 font-mono text-[13px] tabular-nums">
                        {isAllProjects ? createdFormatted : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-[#71347b] border border-purple-200">
                            Assigned to Project
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right relative">
                        <div className="inline-flex items-center gap-1.5">
                          {isAllProjects ? (
                            <>
                              <button
                                onClick={() => setEditingUser(user)}
                                className="p-1.5 text-neutral-500 hover:text-[#71347b] hover:bg-[#fbf7fc] rounded-md transition-colors"
                                title="View Details"
                                aria-label="View Details"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleToggleStatus(user)}
                                disabled={updatingUserId === user.id}
                                className={`p-1.5 rounded-md transition-colors ${
                                  updatingUserId === user.id ? 'opacity-50 cursor-wait' : ''
                                } ${
                                  isUserActive(user)
                                    ? 'text-neutral-500 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={isUserActive(user) ? 'Deactivate' : 'Activate'}
                                aria-label={isUserActive(user) ? 'Deactivate' : 'Activate'}
                              >
                                <Power className="w-4 h-4" />
                              </button>

                              {/* Manager-only deletion */}
                              {isManager && (
                                <button
                                  onClick={() => setUserToDelete(user)}
                                  disabled={isUserActive(user)}
                                  className={`p-1.5 rounded-md transition-colors ${
                                    isUserActive(user)
                                      ? 'text-neutral-300 cursor-not-allowed opacity-40 hover:bg-transparent'
                                      : 'text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer'
                                  }`}
                                  title={isUserActive(user) ? 'User must be deactivated before deletion' : 'Delete'}
                                  aria-label={isUserActive(user) ? 'Delete (Disabled for Active users)' : 'Delete'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => handleRemoveFromProject(user.id, user.fullName)}
                              className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Remove user from project"
                              aria-label={`Remove ${user.fullName} from project`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 text-[13px] text-neutral-600 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Displaying <strong className="font-mono tabular-nums text-neutral-900">{filteredUsers.length}</strong> of{' '}
            <strong className="font-mono tabular-nums text-neutral-900">{users.length}</strong> {isAllProjects ? 'registered users' : `users in ${selectedProject?.name}`}
          </span>
          <span className="text-xs text-neutral-400">
            {isAllProjects ? 'Audit-safe records · Hard deletion allowed for deactivated users' : 'Project-level membership association'}
          </span>
        </div>
      </div>

      {/* Add User Modal (All Projects) */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUserAdded={refreshData}
      />

      {/* Add Team Members Drawer (Individual Project) */}
      {!isAllProjects && selectedProject && (
        <AddTeamMembersDrawer
          isOpen={isAddDrawerOpen}
          onClose={() => setIsAddDrawerOpen(false)}
          projectId={selectedProjectId}
          projectName={selectedProject.name}
          currentMembers={projectTeamMembers}
          onMembersAdded={refreshData}
        />
      )}

      {/* Edit User Modal */}
      <EditUserModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onUserUpdated={refreshData}
      />

      {/* Manager Permanent Deletion Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(userToDelete)}
        title="Delete User Account"
        message="Are you sure you want to permanently delete this deactivated user account? This will permanently remove their profile and all associated project memberships. This action cannot be undone."
        taskTitle={userToDelete ? `${userToDelete.fullName} (${userToDelete.email})` : undefined}
        confirmLabel="Delete User"
        cancelLabel="Cancel"
        confirmVariant="danger"
        isLoading={isDeletingUser}
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
};
