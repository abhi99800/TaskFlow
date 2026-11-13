import React, { useState } from 'react';
import { Layers, Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNavigation } from '../../context/NavigationContext';

export const SignInPage: React.FC = () => {
  const { signIn, demoAccounts } = useAuth();
  const { showError, showSuccess } = useToast();
  const { navigateTo } = useNavigation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFillCredentials = (demoEmail: string) => {
    const account = demoAccounts[demoEmail];
    if (account) {
      setEmail(account.email);
      setPassword(account.password);
      setEmailError(null);
      setPasswordError(null);
      setGeneralError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    let hasError = false;
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setEmailError('Email address is required.');
      hasError = true;
    }

    if (!trimmedPassword) {
      setPasswordError('Password is required.');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signIn(trimmedEmail, trimmedPassword);

      if (result.success && result.user) {
        showSuccess(`Welcome back, ${result.user.fullName}!`, 'Signed In');
        navigateTo('dashboard');
      } else {
        const errorMsg = result.error || 'Invalid email or password. Please try again.';
        setGeneralError(errorMsg);
        showError(errorMsg, 'Authentication Failed');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected authentication error occurred.';
      setGeneralError(errorMsg);
      showError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen sm:h-screen bg-[#fbfbfa] flex flex-col justify-center items-center py-4 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      {/* Container */}
      <div className="w-full max-w-md space-y-4 my-auto">
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#71347b] text-white shadow-md mb-1">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            TaskFlow
          </h1>
          <h2 className="text-lg font-semibold text-neutral-800">
            Welcome Back!
          </h2>
          <p className="text-xs text-neutral-500">
            Sign in to access your workspace.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow-xs p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* General Error Banner */}
            {generalError && (
              <div
                className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700 animate-in fade-in-0 duration-200"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{generalError}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="signin-email"
                className="block text-xs font-semibold text-neutral-700 mb-1.5"
              >
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                    if (generalError) setGeneralError(null);
                  }}
                  placeholder="e.g. manager@demo.com"
                  className={`w-full pl-9 pr-3 py-2 text-sm bg-white border rounded-lg focus:outline-none transition-colors ${
                    emailError
                      ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-neutral-300 focus:border-[#71347b] focus:ring-1 focus:ring-[#71347b]'
                  }`}
                />
              </div>
              {emailError && (
                <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="signin-password"
                className="block text-xs font-semibold text-neutral-700 mb-1.5"
              >
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                    if (generalError) setGeneralError(null);
                  }}
                  placeholder="Enter your password"
                  className={`w-full pl-9 pr-10 py-2 text-sm bg-white border rounded-lg focus:outline-none transition-colors ${
                    passwordError
                      ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-neutral-300 focus:border-[#71347b] focus:ring-1 focus:ring-[#71347b]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors focus-visible:outline-2 focus-visible:outline-[#71347b]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {passwordError}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-lg transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-[#71347b] disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Panel */}
          <div className="mt-4 pt-3.5 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                Working Demo Accounts
              </span>
              <span className="text-[10px] bg-[#f5eff7] text-[#71347b] px-1.5 py-0.5 rounded font-medium">
                Click to Auto-fill
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Manager Demo Account */}
              <button
                type="button"
                onClick={() => handleFillCredentials('manager@demo.com')}
                className="p-2 text-left border border-neutral-200 rounded-lg hover:border-[#71347b] hover:bg-[#fbf7fc] transition-all group flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-semibold text-neutral-900 group-hover:text-[#71347b] text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#71347b]" />
                  <span>Manager Role</span>
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-500 font-mono truncate">
                  manager@demo.com
                </div>
                <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                  Manager@123
                </div>
              </button>

              {/* User Demo Account */}
              <button
                type="button"
                onClick={() => handleFillCredentials('user@demo.com')}
                className="p-2 text-left border border-neutral-200 rounded-lg hover:border-[#71347b] hover:bg-[#fbf7fc] transition-all group flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-semibold text-neutral-900 group-hover:text-[#71347b] text-xs">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>User Role</span>
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-500 font-mono truncate">
                  user@demo.com
                </div>
                <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                  User@123
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-[11px] text-neutral-400">
          <span>TaskFlow Enterprise Workspace • Role-based Access Control</span>
        </div>
      </div>
    </div>
  );
};
