import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldPlus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Edit2,
  Power,
  Shield,
  X,
  Users,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { roleService } from '../../services/roleService';
import { userService } from '../../services/userService';
import { projectRolesService } from '../../services/projectRolesService';
import { Role } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useProject } from '../../context/ProjectContext';
import { CreateRoleModal } from './CreateRoleModal';
import { EditRoleModal } from './EditRoleModal';
import { AddProjectRolesDrawer } from './AddProjectRolesDrawer';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const RolesPage: React.FC = () => {
  const { showSuccess, showWarning, showError } = useToast();
  const { selectedProjectId, selectedProject } = useProject();

  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddRoleDrawerOpen, setIsAddRoleDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const handleDeleteRoleClick = (role: Role) => {
    const assignedCount = userService.getUsersCountForRole(role.id);
    if (assignedCount > 0) {
      showWarning(
        'This role cannot be deleted because it is assigned to one or more users. Reassign those users to another role before deleting it.',
        'Role In Use'
      );
      return;
    }
    setRoleToDelete(role);
  };

  const handleConfirmDeleteRole = async () => {
    if (!roleToDelete) return;

    setIsDeletingRole(true);
    const assignedCount = userService.getUsersCountForRole(roleToDelete.id);
    const res = await roleService.deleteRole(roleToDelete.id, assignedCount);
    setIsDeletingRole(false);

    if (res.success) {
      showSuccess(`Role "${roleToDelete.name}" was deleted successfully.`);
      setRoleToDelete(null);
      refreshRoles();
    } else {
      showError(res.error || 'Failed to delete role.');
    }
  };

  const refreshRoles = useCallback(async () => {
    setIsLoading(true);
    await roleService.fetchRoles();

    if (selectedProjectId === 'all') {
      setRoles(roleService.getRoles());
    } else {
      const res = await projectRolesService.fetchProjectRoles(selectedProjectId);
      if (res.success) {
        setRoles(res.roles);
      } else {
        setRoles([]);
      }
    }
    setIsLoading(false);
  }, [selectedProjectId]);

  useEffect(() => {
    refreshRoles();
    const unsubRole = roleService.subscribe(() => {
      if (selectedProjectId === 'all') setRoles(roleService.getRoles());
    });
    const unsubProjectRole = projectRolesService.subscribe(() => {
      if (selectedProjectId !== 'all') refreshRoles();
    });
    return () => {
      unsubRole();
      unsubProjectRole();
    };
  }, [selectedProjectId, refreshRoles]);

  const handleToggleStatus = async (role: Role) => {
    if (selectedProjectId !== 'all') {
      showError('Status changes must be performed in All Projects mode.');
      return;
    }
    if (updatingRoleId) return;
    setUpdatingRoleId(role.id);

    try {
      const assignedCount = userService.getUsersCountForRole(role.id);
      const res = await roleService.toggleRoleStatus(role.id, assignedCount);
      if (!res.success) {
        if (res.isRlsBlocked) {
          showError(res.error || 'Row-Level Security blocked role status update.');
        } else if (res.error?.includes('while') || res.error?.includes('assigned')) {
          showWarning(res.error, 'Role In Use');
        } else {
          showError(res.error || 'Failed to toggle status.');
        }
      } else {
        const isCurrentlyActive = role.status === 'Active' || role.status === 'active';
        showSuccess(
          `Role "${role.name}" status changed to ${isCurrentlyActive ? 'Inactive' : 'Active'}.`
        );
        refreshRoles();
      }
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRemoveFromProject = async (roleId: string, roleName: string) => {
    if (selectedProjectId === 'all') return;
    const res = await projectRolesService.removeProjectRole(selectedProjectId, roleId);
    if (res.success) {
      showSuccess(`Removed role "${roleName}" from ${selectedProject?.name || 'project'}.`);
      refreshRoles();
    } else {
      showError(res.error || 'Failed to remove role from project.');
    }
  };

  // Filtered roles
  const filteredRoles = roles.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    const isRoleActive = r.status === 'Active' || r.status === 'active';
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && isRoleActive) ||
      (statusFilter === 'inactive' && !isRoleActive);
    return matchesSearch && matchesStatus;
  });

  const isAllProjects = selectedProjectId === 'all';

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-neutral-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            {isAllProjects ? 'Role Management (All Projects)' : `Roles — ${selectedProject?.name || 'Project'}`}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            {isAllProjects
              ? 'Configure centralized authorization profiles, role descriptions, and member assignments.'
              : `Manage roles associated with ${selectedProject?.name}. Adding roles here associates them with this project without duplicating role definitions.`}
          </p>
        </div>

        {isAllProjects ? (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            <ShieldPlus className="w-4 h-4" />
            <span>+ Roles</span>
          </button>
        ) : (
          <button
            onClick={() => setIsAddRoleDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            <ShieldPlus className="w-4 h-4" />
            <span>+ Add Role</span>
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3 sm:p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <label htmlFor="role-search" className="sr-only">
            Search roles by name or description
          </label>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            id="role-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roles by title or scope..."
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

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-neutral-50 border border-neutral-300 rounded-md">
          <Filter className="w-3.5 h-3.5 text-neutral-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-transparent text-sm text-neutral-800 font-medium focus:outline-none cursor-pointer pr-1"
            aria-label="Filter roles by status"
          >
            <option value="all">All Statuses ({roles.length})</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/75 text-neutral-700 text-[13px] font-semibold">
                <th scope="col" className="py-3 px-5">
                  Role Name
                </th>
                <th scope="col" className="py-3 px-4">
                  Description
                </th>
                <th scope="col" className="py-3 px-4">
                  Assigned Users
                </th>
                <th scope="col" className="py-3 px-4">
                  Status
                </th>
                <th scope="col" className="py-3 px-4">
                  {isAllProjects ? 'Created Date' : 'Association'}
                </th>
                <th scope="col" className="py-3 px-5 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100 text-sm">
              {filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 mb-3">
                        <Shield className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-neutral-800 mb-1">
                        No roles found
                      </h3>
                      <p className="text-[13px] text-neutral-500 mb-4 leading-relaxed">
                        {searchQuery || statusFilter !== 'all'
                          ? 'No role titles match your search criteria.'
                          : isAllProjects
                          ? 'No custom roles have been configured yet.'
                          : `No roles have been associated with ${selectedProject?.name || 'this project'} yet.`}
                      </p>
                      {searchQuery || statusFilter !== 'all' ? (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                          }}
                          className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
                        >
                          Reset Filter
                        </button>
                      ) : isAllProjects ? (
                        <button
                          onClick={() => setIsCreateModalOpen(true)}
                          className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors"
                        >
                          + Create First Role
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsAddRoleDrawerOpen(true)}
                          className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors"
                        >
                          + Add Roles to Project
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => {
                  const assignedCount = userService.getUsersCountForRole(role.id);
                  const createdFormatted = new Date(role.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr key={role.id} className="hover:bg-neutral-50/60 transition-colors">
                      {/* Role Name */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-[#f5eff7] text-[#71347b] border border-[#dfcadf] flex items-center justify-center shrink-0">
                            <Shield className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-semibold text-neutral-900 block leading-tight">
                              {role.name}
                            </span>
                            {role.isSystem && (
                              <span className="text-[10px] text-neutral-400 font-normal">
                                System Core
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 text-neutral-600 max-w-md">
                        <p className="line-clamp-2 text-xs leading-relaxed" title={role.description}>
                          {role.description}
                        </p>
                      </td>

                      {/* Assigned Users */}
                      <td className="py-3.5 px-4 font-mono text-sm tabular-nums text-neutral-700">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{assignedCount} {assignedCount === 1 ? 'user' : 'users'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {(() => {
                          const isRoleActive = role.status === 'Active' || role.status === 'active';
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium ${
                                isRoleActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                              }`}
                            >
                              {isRoleActive ? (
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <XCircle className="w-3 h-3 text-neutral-400" />
                              )}
                              {isRoleActive ? 'Active' : 'Inactive'}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Created Date / Association */}
                      <td className="py-3.5 px-4 text-neutral-500 font-mono text-[13px] tabular-nums">
                        {isAllProjects ? createdFormatted : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-[#71347b] border border-purple-200">
                            Associated with Project
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isAllProjects ? (
                            <>
                              <button
                                onClick={() => setEditingRole(role)}
                                className="p-1.5 text-neutral-500 hover:text-[#71347b] hover:bg-[#fbf7fc] rounded-md transition-colors"
                                title="View Details"
                                aria-label="View Details"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {(() => {
                                const isRoleActive = role.status === 'Active' || role.status === 'active';
                                return (
                                  <button
                                    onClick={() => handleToggleStatus(role)}
                                    disabled={updatingRoleId === role.id}
                                    className={`p-1.5 rounded-md transition-colors ${
                                      updatingRoleId === role.id ? 'opacity-50 cursor-wait' : ''
                                    } ${
                                      isRoleActive
                                        ? 'text-neutral-500 hover:text-amber-600 hover:bg-amber-50'
                                        : 'text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50'
                                    }`}
                                    title={isRoleActive ? 'Deactivate' : 'Activate'}
                                    aria-label={isRoleActive ? 'Deactivate' : 'Activate'}
                                  >
                                    <Power className="w-4 h-4" />
                                  </button>
                                );
                              })()}

                              <button
                                onClick={() => handleDeleteRoleClick(role)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                                title="Delete"
                                aria-label="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleRemoveFromProject(role.id, role.name)}
                              className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Remove role from project"
                              aria-label={`Remove role ${role.name} from project`}
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

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 text-[13px] text-neutral-600 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Displaying <strong className="font-mono tabular-nums text-neutral-900">{filteredRoles.length}</strong> of{' '}
            <strong className="font-mono tabular-nums text-neutral-900">{roles.length}</strong> {isAllProjects ? 'defined roles' : `roles in ${selectedProject?.name}`}
          </span>
          <span className="text-xs text-neutral-400">
            {isAllProjects ? 'Active roles are automatically populated into user selectors' : 'Project-level role association'}
          </span>
        </div>
      </div>

      {/* Create Role Modal (All Projects) */}
      <CreateRoleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onRoleCreated={refreshRoles}
      />

      {/* Add Roles Drawer (Individual Project) */}
      {!isAllProjects && selectedProject && (
        <AddProjectRolesDrawer
          isOpen={isAddRoleDrawerOpen}
          onClose={() => setIsAddRoleDrawerOpen(false)}
          projectId={selectedProjectId}
          projectName={selectedProject.name}
          currentRoles={roles}
          onRolesAdded={refreshRoles}
        />
      )}

      {/* Edit Role Modal */}
      <EditRoleModal
        role={editingRole}
        assignedUsersCount={editingRole ? userService.getUsersCountForRole(editingRole.id) : 0}
        isOpen={!!editingRole}
        onClose={() => setEditingRole(null)}
        onRoleUpdated={refreshRoles}
      />

      {/* Role Deletion Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(roleToDelete)}
        title="Delete Role"
        message="Are you sure you want to delete this role? This action cannot be undone."
        taskTitle={roleToDelete ? `${roleToDelete.name}` : undefined}
        confirmLabel="Delete Role"
        cancelLabel="Cancel"
        confirmVariant="danger"
        isLoading={isDeletingRole}
        onConfirm={handleConfirmDeleteRole}
        onCancel={() => setRoleToDelete(null)}
      />
    </div>
  );
};
