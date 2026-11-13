import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { roleService } from '../../services/roleService';
import { userService, UserInputErrors } from '../../services/userService';
import { ManagedUser } from '../../types';
import { useToast } from '../../context/ToastContext';
import { SideDrawer } from '../common/SideDrawer';

interface EditUserModalProps {
  user: ManagedUser | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [errors, setErrors] = useState<UserInputErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setEmail(user.email);
      setPhoneNumber(user.phoneNumber);
      setRoleId(user.roleId);
      const isInactive = user.status === 'Inactive' || user.status === 'inactive';
      setStatus(isInactive ? 'Inactive' : 'Active');
      setErrors({});
      setGeneralError(null);
    }
  }, [user]);

  if (!user) return null;

  const roles = roleService.getRoles();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrors({});
    setGeneralError(null);

    try {
      const result = await userService.updateUser(user.id, {
        fullName,
        email,
        phoneNumber,
        roleId,
        status,
      });

      if (result.success) {
        const updatedName = fullName.trim();
        setIsSubmitting(false);
        onClose();
        onUserUpdated();
        showSuccess(`${updatedName} user details updated successfully.`);
      } else {
        setIsSubmitting(false);
        if (result.errorMessage) {
          setGeneralError(result.errorMessage);
          showError(result.errorMessage);
        } else if (result.errors) {
          setErrors(result.errors);
          if (result.errors.email?.includes('already exists')) {
            showWarning(result.errors.email, 'User Already Exists');
          } else {
            const firstErr =
              result.errors.fullName ||
              result.errors.email ||
              result.errors.phoneNumber ||
              result.errors.roleId ||
              'Failed to update user details.';
            showError(firstErr);
          }
        } else {
          showError('Failed to update user details.');
        }
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : String(err);
      setGeneralError(msg);
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
      title="Edit User Details"
      subtitle="Update account information, permissions, and active status."
      footer={footerActions}
      maxWidth="max-w-[666px]"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {generalError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{generalError}</span>
          </div>
        )}

        {/* Full Name */}
        <div>
          <label htmlFor="edit-user-fullname" className="block text-xs font-semibold text-neutral-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-user-fullname"
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
            }}
            className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:outline-none focus:ring-1 transition-colors ${
              errors.fullName
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-neutral-300 focus:border-[#71347b] focus:ring-[#71347b]'
            }`}
          />
          {errors.fullName && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.fullName}
            </p>
          )}
        </div>

        {/* Email Address */}
        <div>
          <label htmlFor="edit-user-email" className="block text-xs font-semibold text-neutral-700 mb-1">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-user-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:outline-none focus:ring-1 transition-colors ${
              errors.email
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-neutral-300 focus:border-[#71347b] focus:ring-[#71347b]'
            }`}
          />
          {errors.email && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.email}
            </p>
          )}
        </div>

        {/* Phone Number */}
        <div>
          <label htmlFor="edit-user-phone" className="block text-xs font-semibold text-neutral-700 mb-1">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-user-phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              if (errors.phoneNumber) setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
            }}
            className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:outline-none focus:ring-1 transition-colors ${
              errors.phoneNumber
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-neutral-300 focus:border-[#71347b] focus:ring-[#71347b]'
            }`}
          />
          {errors.phoneNumber && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.phoneNumber}
            </p>
          )}
        </div>

        {/* Role Dropdown */}
        <div>
          <label htmlFor="edit-user-role" className="block text-xs font-semibold text-neutral-700 mb-1">
            Role Assignment <span className="text-red-500">*</span>
          </label>
          <select
            id="edit-user-role"
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
              if (errors.roleId) setErrors((prev) => ({ ...prev, roleId: undefined }));
            }}
            className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:outline-none focus:ring-1 transition-colors ${
              errors.roleId
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-neutral-300 focus:border-[#71347b] focus:ring-[#71347b]'
            }`}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} {role.status === 'Inactive' || role.status === 'inactive' ? '(Inactive)' : ''}
              </option>
            ))}
          </select>
          {errors.roleId && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.roleId}
            </p>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Account Status
          </label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-800 cursor-pointer">
              <input
                type="radio"
                name="edit-status"
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
                name="edit-status"
                value="Inactive"
                checked={status === 'Inactive'}
                onChange={() => setStatus('Inactive')}
                className="accent-[#71347b]"
              />
              Inactive
            </label>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Deactivated users are safely preserved in audit history and task references.
          </p>
        </div>
      </form>
    </SideDrawer>
  );
};
