import React, { useState, useEffect } from 'react';
import { Search, UserCheck, Shield, Check } from 'lucide-react';
import { SideDrawer } from '../common/SideDrawer';
import { userService } from '../../services/userService';
import { teamService, ProjectTeamMember } from '../../services/teamService';
import { ManagedUser } from '../../types';
import { useToast } from '../../context/ToastContext';

interface AddTeamMembersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  currentMembers: ProjectTeamMember[];
  onMembersAdded: () => void;
}

export const AddTeamMembersDrawer: React.FC<AddTeamMembersDrawerProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  currentMembers,
  onMembersAdded,
}) => {
  const { showSuccess, showError } = useToast();
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const updateUsers = () => {
      setAllUsers(userService.getUsers());
    };

    updateUsers();
    const unsub = userService.subscribe(updateUsers);

    if (isOpen) {
      userService.fetchUsers().then(updateUsers);
      setSelectedUserIds(new Set());
      setSearchQuery('');
    }

    return () => {
      unsub();
    };
  }, [isOpen]);

  // Exclude users who are already members of the project
  const currentMemberUserIds = new Set(currentMembers.map((m) => m.userId));
  const availableUsers = allUsers.filter(
    (u) => !currentMemberUserIds.has(u.id) && (u.status === 'Active' || u.status === 'active')
  );

  const filteredUsers = availableUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      u.roleName.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const toggleSelectUser = (userId: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelectedUserIds(next);
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredUsers.map((u) => u.id);
    const allSelected = allFilteredIds.every((id) => selectedUserIds.has(id));
    const next = new Set(selectedUserIds);
    if (allSelected) {
      allFilteredIds.forEach((id) => next.delete(id));
    } else {
      allFilteredIds.forEach((id) => next.add(id));
    }
    setSelectedUserIds(next);
  };

  const handleSubmit = async () => {
    if (selectedUserIds.size === 0) {
      showError('Please select at least one team member to add.', 'Selection Required');
      return;
    }

    setIsSubmitting(true);
    const res = await teamService.addTeamMembers(projectId, Array.from(selectedUserIds));
    setIsSubmitting(false);

    if (res.success) {
      showSuccess(
        `Successfully added ${selectedUserIds.size} member(s) to ${projectName}.`,
        'Team Updated'
      );
      onMembersAdded();
      onClose();
    } else {
      showError(res.error || 'Failed to add team members.', 'Error');
    }
  };

  const footerContent = (
    <div className="flex items-center justify-between w-full">
      <span className="text-xs text-neutral-500 font-medium">
        {selectedUserIds.size} user{selectedUserIds.size === 1 ? '' : 's'} selected
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
          disabled={isSubmitting || selectedUserIds.size === 0}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#71347b] hover:bg-[#5d2a65] disabled:opacity-50 rounded-md transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
        >
          {isSubmitting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Adding...</span>
            </>
          ) : (
            <span>Add Members ({selectedUserIds.size})</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add Team Members"
      subtitle={`Select active users from User Management to join ${projectName}`}
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
            placeholder="Search users by name, email, or role..."
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
        {filteredUsers.length > 0 && (
          <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
            <span>Available Users ({filteredUsers.length})</span>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="text-[#71347b] font-medium hover:underline cursor-pointer"
            >
              {filteredUsers.every((u) => selectedUserIds.has(u.id)) ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}

        {/* Users List */}
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto mb-2">
                <UserCheck className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-neutral-800">No available users found</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {searchQuery
                  ? 'No users match your search criteria.'
                  : 'All active users are already members of this project.'}
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isSelected = selectedUserIds.has(user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => toggleSelectUser(user.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-[#71347b] bg-[#f5eff7]/60 shadow-2xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected ? 'bg-[#71347b] text-white' : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 truncate">
                        {user.fullName}
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
                      <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-neutral-100 text-neutral-700">
                        <Shield className="w-3 h-3 text-neutral-400" />
                        <span>{user.roleName}</span>
                      </div>
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
