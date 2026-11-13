import React, { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { roleService } from '../../services/roleService';
import { useToast } from '../../context/ToastContext';
import { SideDrawer } from '../common/SideDrawer';

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoleCreated: () => void;
}

export const CreateRoleModal: React.FC<CreateRoleModalProps> = ({
  isOpen,
  onClose,
  onRoleCreated,
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await roleService.createRole({
        name,
        description,
        status,
      });

      if (result.success) {
        const createdRoleName = name.trim();
        setIsSubmitting(false);
        handleClose();
        onRoleCreated();
        showSuccess(`${createdRoleName} role created successfully.`);
      } else {
        setIsSubmitting(false);
        const errMsg = result.error || 'Failed to create role.';
        setErrorMessage(errMsg);
        if (errMsg.includes('already exists')) {
          showWarning(errMsg, 'Role Already Exists');
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

  const handleClose = () => {
    setName('');
    setDescription('');
    setStatus('Active');
    setErrorMessage(null);
    setIsSubmitting(false);
    onClose();
  };

  const footerActions = (
    <>
      <button
        type="button"
        onClick={handleClose}
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
        {isSubmitting ? 'Creating Role...' : 'Create Role'}
      </button>
    </>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Role"
      subtitle="Define role responsibilities, permissions, and assignment state."
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
          <label htmlFor="role-name" className="block text-xs font-semibold text-neutral-700 mb-1">
            Role Name <span className="text-red-500">*</span>
          </label>
          <input
            id="role-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="e.g. Senior Security Auditor"
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] transition-colors"
          />
          <p className="text-[11px] text-neutral-500 mt-1">
            Must be unique across the workspace (case-insensitive).
          </p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="role-desc" className="block text-xs font-semibold text-neutral-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="role-desc"
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="Describe scope, responsibilities, and access levels..."
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] transition-colors resize-none"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Initial Status
          </label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-800 cursor-pointer">
              <input
                type="radio"
                name="role-status"
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
                name="role-status"
                value="Inactive"
                checked={status === 'Inactive'}
                onChange={() => setStatus('Inactive')}
                className="accent-[#71347b]"
              />
              Inactive
            </label>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Active roles are immediately selectable in Add User.
          </p>
        </div>
      </form>
    </SideDrawer>
  );
};
