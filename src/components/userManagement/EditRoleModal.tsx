import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { roleService } from '../../services/roleService';
import { Role } from '../../types';
import { useToast } from '../../context/ToastContext';
import { SideDrawer } from '../common/SideDrawer';

interface EditRoleModalProps {
  role: Role | null;
  assignedUsersCount: number;
  isOpen: boolean;
  onClose: () => void;
  onRoleUpdated: () => void;
}

export const EditRoleModal: React.FC<EditRoleModalProps> = ({
  role,
  assignedUsersCount,
  isOpen,
  onClose,
  onRoleUpdated,
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description);
      setStatus(role.status === 'Inactive' || role.status === 'inactive' ? 'Inactive' : 'Active');
      setErrorMessage(null);
    }
  }, [role]);

  if (!role) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await roleService.updateRole(
        role.id,
        {
          name,
          description,
          status,
        },
        assignedUsersCount
      );

      if (result.success) {
        const updatedRoleName = name.trim();
        setIsSubmitting(false);
        onClose();
        onRoleUpdated();
        showSuccess(`${updatedRoleName} role details updated successfully.`);
      } else {
        setIsSubmitting(false);
        const errMsg = result.error || 'Failed to update role.';
        setErrorMessage(errMsg);
        if (errMsg.includes('Cannot deactivate') || errMsg.includes('assigned')) {
          showWarning(errMsg, 'Role Conflict');
        } else {
          showError(errMsg);
        }
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      showError(msg);
    }
  };

  const footerActions = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs disabled:opacity-50"
      >
        {isSubmitting ? 'Updating...' : 'Save Changes'}
      </button>
    </>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Role Details"
      subtitle={`Configure role definition and status (${assignedUsersCount} users currently assigned).`}
      footer={footerActions}
      maxWidth="max-w-[666px]"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Role Name */}
        <div>
          <label htmlFor="edit-role-name" className="block text-xs font-semibold text-neutral-700 mb-1">
            Role Name <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-role-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="edit-role-desc" className="block text-xs font-semibold text-neutral-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="edit-role-desc"
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] transition-colors resize-none"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Role Status
          </label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-800 cursor-pointer">
              <input
                type="radio"
                name="edit-role-status"
                value="Active"
                checked={status === 'Active'}
                onChange={() => setStatus('Active')}
                className="accent-[#71347b]"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-800 cursor-pointer">
              <input
                type="radio"
                name="edit-role-status"
                value="Inactive"
                checked={status === 'Inactive'}
                onChange={() => setStatus('Inactive')}
                className="accent-[#71347b]"
              />
              Inactive
            </label>
          </div>
          {assignedUsersCount > 0 && status === 'Inactive' && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Warning: {assignedUsersCount} user(s) are assigned to this role. Deactivating will be blocked until reassigned.
            </p>
          )}
        </div>
      </form>
    </SideDrawer>
  );
};
