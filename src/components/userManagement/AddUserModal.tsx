import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Lock,
  Mail,
  Key,
  Terminal,
  Eye,
  EyeOff,
} from 'lucide-react';
import { roleService } from '../../services/roleService';
import { userService, UserInputErrors } from '../../services/userService';
import { useToast } from '../../context/ToastContext';
import { SideDrawer } from '../common/SideDrawer';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: () => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onUserAdded,
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<UserInputErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isEdgeFunctionMissing, setIsEdgeFunctionMissing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success view state with invitation link
  const [createdUserInfo, setCreatedUserInfo] = useState<{
    fullName: string;
    email: string;
    roleName: string;
    inviteLink?: string | null;
    authUserId?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  const activeRoles = roleService.getActiveRoles();

  const handleCopyLink = async () => {
    if (!createdUserInfo?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(createdUserInfo.inviteLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      showSuccess('Invitation / password setup link copied to clipboard.');
    } catch {
      showError('Failed to copy link. Please select and copy manually.');
    }
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText('supabase functions deploy create-user');
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2500);
      showSuccess('Command copied to clipboard.');
    } catch {
      showError('Failed to copy command.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrors({});
    setGeneralError(null);
    setIsEdgeFunctionMissing(false);
    if (password.trim() && password.trim().length < 6) {
      setIsSubmitting(false);
      setErrors({ password: 'Password must be at least 6 characters.' });
      return;
    }

    try {
      const result = await userService.createUser({
        fullName,
        email,
        phoneNumber,
        roleId,
        status,
        password: password.trim() ? password.trim() : undefined,
      });

      if (result.success && result.user) {
        setIsSubmitting(false);
        const selectedRole = roleService.getRoleById(roleId);

        // Keep created info in modal to allow copying invitation link
        setCreatedUserInfo({
          fullName: result.user.fullName,
          email: result.user.email,
          roleName: selectedRole ? selectedRole.name : result.user.roleName,
          inviteLink: result.inviteLink,
          authUserId: result.authUserId,
        });

        onUserAdded();
        showSuccess(
          `${result.user.fullName} created successfully. Supabase Authentication account and profile linked.`
        );
      } else {
        setIsSubmitting(false);
        if (result.isEdgeFunctionMissing) {
          setIsEdgeFunctionMissing(true);
          setGeneralError(result.errorMessage || 'Edge Function not deployed on Supabase.');
          showError(
            'Supabase Edge Function "create-user" is not deployed. Please deploy it to enable authentication account creation.'
          );
        } else if (result.errorMessage) {
          setGeneralError(result.errorMessage);
          showError(result.errorMessage);
        } else if (result.errors) {
          setErrors(result.errors);
          if (result.errors.email?.includes('already exists') || result.isDuplicateEmail) {
            showWarning(result.errors.email || 'User already exists', 'Account Exists');
          } else {
            const firstErrorMessage =
              result.errors.fullName ||
              result.errors.email ||
              result.errors.phoneNumber ||
              result.errors.roleId ||
              'Failed to create user. Please review the form fields.';
            showError(firstErrorMessage);
          }
        } else {
          showError('An unexpected issue occurred while creating user.');
        }
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : String(err);
      setGeneralError(msg);
      showError(msg);
    }
  };

  const handleClose = () => {
    setFullName('');
    setEmail('');
    setPhoneNumber('');
    setRoleId('');
    setStatus('Active');
    setPassword('');
    setShowPassword(false);
    setErrors({});
    setGeneralError(null);
    setIsEdgeFunctionMissing(false);
    setIsSubmitting(false);
    setCreatedUserInfo(null);
    setCopiedLink(false);
    onClose();
  };

  const renderSuccessState = () => {
    if (!createdUserInfo) return null;

    return (
      <div className="space-y-5 animate-in fade-in-50 duration-200">
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 space-y-1">
            <p className="font-semibold text-emerald-950 text-sm">
              User & Authentication Account Created
            </p>
            <p>
              <strong>{createdUserInfo.fullName}</strong> ({createdUserInfo.email}) has been provisioned
              in Supabase Authentication and linked to their <code className="bg-emerald-100 px-1 py-0.5 rounded text-[11px]">public.app_users</code> profile.
            </p>
            {createdUserInfo.authUserId && (
              <p className="text-[11px] text-emerald-700">
                Auth User ID: <span className="font-mono">{createdUserInfo.authUserId}</span>
              </p>
            )}
          </div>
        </div>

        {/* Invitation & Password Setup Link Card */}
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
            <Key className="w-4 h-4 text-[#71347b]" />
            <span>Invitation & Password Setup Link</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            The user can use this secure link to set their own permanent password and log in through the
            existing login page.
          </p>

          {createdUserInfo.inviteLink ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdUserInfo.inviteLink}
                  className="w-full px-3 py-2 text-xs font-mono bg-neutral-50 border border-neutral-300 rounded-md text-neutral-700 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-neutral-500">
                Tip: Share this link directly with the user via chat, or have them check their inbox.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md text-xs text-neutral-600">
              User was provisioned with the specified temporary password. They can log in immediately through the login page.
            </div>
          )}
        </div>

        {/* Account Details Summary */}
        <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg text-xs space-y-2">
          <p className="font-semibold text-neutral-800">Account Summary:</p>
          <div className="grid grid-cols-2 gap-2 text-neutral-600">
            <div>
              <span className="text-neutral-500">Full Name:</span> {createdUserInfo.fullName}
            </div>
            <div>
              <span className="text-neutral-500">Role:</span> {createdUserInfo.roleName}
            </div>
            <div className="col-span-2">
              <span className="text-neutral-500">Login Email:</span> {createdUserInfo.email}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const footerActions = createdUserInfo ? (
    <button
      type="button"
      onClick={handleClose}
      className="px-4 py-2 text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs"
    >
      Done
    </button>
  ) : (
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
        {isSubmitting ? 'Creating User & Auth Account...' : 'Create User'}
      </button>
    </>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title={createdUserInfo ? 'User Account Ready' : 'Add New User'}
      subtitle={
        createdUserInfo
          ? 'Supabase Authentication account and database profile linked successfully.'
          : 'Provision Supabase Authentication account and database user profile.'
      }
      footer={footerActions}
      maxWidth="max-w-[666px]"
    >
      {createdUserInfo ? (
        renderSuccessState()
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General Error Banner */}
          {generalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <span className="font-medium">{generalError}</span>
              </div>
            </div>
          )}

          {/* Edge Function Missing Guidance Callout */}
          {isEdgeFunctionMissing && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2.5">
              <div className="flex items-center gap-2 font-semibold text-amber-900">
                <Terminal className="w-4 h-4 text-amber-700" />
                <span>Supabase Edge Function Deployment Required</span>
              </div>
              <p className="text-amber-800 leading-relaxed text-[11px]">
                To securely create Authentication accounts in Supabase without exposing your service-role key in frontend code, deploy the included Edge Function to your Supabase project:
              </p>
              <div className="flex items-center gap-2">
                <code className="w-full px-2.5 py-1.5 font-mono text-[11px] bg-white border border-amber-300 rounded text-amber-950 select-all">
                  supabase functions deploy create-user
                </code>
                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className="px-2.5 py-1.5 text-[11px] font-medium bg-amber-200 hover:bg-amber-300 text-amber-900 rounded transition-colors shrink-0 flex items-center gap-1"
                >
                  {copiedCommand ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCommand ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label htmlFor="user-fullname" className="block text-xs font-semibold text-neutral-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="user-fullname"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              placeholder="e.g. Rachel Adams"
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
            <label htmlFor="user-email" className="block text-xs font-semibold text-neutral-700 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="e.g. rachel.adams@taskflow.internal"
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
            <p className="text-[11px] text-neutral-500 mt-1">
              Used as the login credential in Supabase Authentication.
            </p>
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="user-phone" className="block text-xs font-semibold text-neutral-700 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              id="user-phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                if (errors.phoneNumber) setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
              }}
              placeholder="e.g. +1 (555) 019-2834"
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
            <label htmlFor="user-role" className="block text-xs font-semibold text-neutral-700 mb-1">
              Role Assignment <span className="text-red-500">*</span>
            </label>
            <select
              id="user-role"
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
              <option value="">-- Select an active role --</option>
              {activeRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {errors.roleId && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.roleId}
              </p>
            )}
            {activeRoles.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No active roles found. Please create or activate a role in Role Management first.
              </p>
            )}
          </div>

          {/* Temporary Password (Optional) */}
          <div className="pt-1">
            <label htmlFor="user-password" className="block text-xs font-semibold text-neutral-700 mb-1">
              Temporary Password <span className="text-neutral-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <input
                id="user-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                placeholder="Leave blank to send an email invitation"
                className={`w-full px-3 py-2 pr-10 text-sm bg-white border rounded-md focus:outline-none focus:ring-1 transition-colors ${
                  errors.password
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-300 focus:border-[#71347b] focus:ring-[#71347b]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.password}
              </p>
            )}
            <p className="text-[11px] text-neutral-500 mt-1">
              Leave blank to send an email invitation so the user can set their own password.
            </p>
          </div>

          {/* Status Radio / Select */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Account Status
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-neutral-800 cursor-pointer">
                <input
                  type="radio"
                  name="status"
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
                  name="status"
                  value="Inactive"
                  checked={status === 'Inactive'}
                  onChange={() => setStatus('Inactive')}
                  className="accent-[#71347b]"
                />
                Inactive
              </label>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Active users can be assigned tasks; inactive accounts cannot receive new assignments.
            </p>
          </div>
        </form>
      )}
    </SideDrawer>
  );
};
