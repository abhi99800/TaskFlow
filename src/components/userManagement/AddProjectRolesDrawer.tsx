import React, { useState, useEffect } from 'react';
import { Search, Shield, Check } from 'lucide-react';
import { SideDrawer } from '../common/SideDrawer';
import { roleService } from '../../services/roleService';
import { projectRolesService } from '../../services/projectRolesService';
import { Role } from '../../types';
import { useToast } from '../../context/ToastContext';

interface AddProjectRolesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  currentRoles: Role[];
  onRolesAdded: () => void;
}

export const AddProjectRolesDrawer: React.FC<AddProjectRolesDrawerProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  currentRoles,
  onRolesAdded,
}) => {
  const { showSuccess, showError } = useToast();
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const updateRoles = () => {
      setAllRoles(roleService.getRoles());
    };

    updateRoles();
    const unsub = roleService.subscribe(updateRoles);

    if (isOpen) {
      roleService.fetchRoles().then(updateRoles);
      setSelectedRoleIds(new Set());
      setSearchQuery('');
    }

    return () => {
      unsub();
    };
  }, [isOpen]);

  // Exclude roles already associated with the project
  const currentRoleIds = new Set(currentRoles.map((r) => r.id));
  const availableRoles = allRoles.filter(
    (r) => !currentRoleIds.has(r.id) && (r.status === 'Active' || r.status === 'active')
  );

  const filteredRoles = availableRoles.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const toggleSelectRole = (roleId: string) => {
    const next = new Set(selectedRoleIds);
    if (next.has(roleId)) {
      next.delete(roleId);
    } else {
      next.add(roleId);
    }
    setSelectedRoleIds(next);
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredRoles.map((r) => r.id);
    const allSelected = allFilteredIds.every((id) => selectedRoleIds.has(id));
    const next = new Set(selectedRoleIds);
    if (allSelected) {
      allFilteredIds.forEach((id) => next.delete(id));
    } else {
      allFilteredIds.forEach((id) => next.add(id));
    }
    setSelectedRoleIds(next);
  };

  const handleSubmit = async () => {
    if (selectedRoleIds.size === 0) {
      showError('Please select at least one role to add.', 'Selection Required');
      return;
    }

    setIsSubmitting(true);
    const res = await projectRolesService.addProjectRoles(projectId, Array.from(selectedRoleIds));
    setIsSubmitting(false);

    if (res.success) {
      showSuccess(
        `Successfully added ${selectedRoleIds.size} role(s) to ${projectName}.`,
        'Roles Updated'
      );
      onRolesAdded();
      onClose();
    } else {
      showError(res.error || 'Failed to add roles to project.', 'Error');
    }
  };

  const footerContent = (
    <div className="flex items-center justify-between w-full">
      <span className="text-xs text-neutral-500 font-medium">
        {selectedRoleIds.size} role{selectedRoleIds.size === 1 ? '' : 's'} selected
      </span>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || selectedRoleIds.size === 0}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#71347b] hover:bg-[#5d2a65] disabled:opacity-50 rounded-md transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
        >
          {isSubmitting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Adding...</span>
            </>
          ) : (
            <span>Add Roles ({selectedRoleIds.size})</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add Roles to Project"
      subtitle={`Select active roles from central management to associate with ${projectName}`}
      footer={footerContent}
    >
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roles by title or description..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-neutral-50 focus:bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              ✕
            </button>
          )}
        </div>

        {/* Selection Header & Select All */}
        {filteredRoles.length > 0 && (
          <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
            <span>Available Roles ({filteredRoles.length})</span>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="text-[#71347b] font-medium hover:underline cursor-pointer"
            >
              {filteredRoles.every((r) => selectedRoleIds.has(r.id)) ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}

        {/* Roles List */}
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {filteredRoles.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto mb-2">
                <Shield className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-neutral-800">No available roles found</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {searchQuery
                  ? 'No roles match your search criteria.'
                  : 'All active centralized roles are already associated with this project.'}
              </p>
            </div>
          ) : (
            filteredRoles.map((role) => {
              const isSelected = selectedRoleIds.has(role.id);
              return (
                <div
                  key={role.id}
                  onClick={() => toggleSelectRole(role.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-[#71347b] bg-[#f5eff7]/60 shadow-2xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected ? 'bg-[#71347b] text-white' : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 truncate">
                        {role.name}
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                        {role.description}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                      isSelected
                        ? 'bg-[#71347b] border-[#71347b] text-white'
                        : 'border-neutral-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </SideDrawer>
  );
};
