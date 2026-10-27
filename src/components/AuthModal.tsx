/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient.js';
import { api, authStorage } from '../services/api.ts';
import { CustomerProfile } from '../types/database.ts';
import { UserRole, DEMO_USERS } from '../services/demoData.ts';
import {
  Lock,
  UserPlus,
  LogIn,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Clock,
  Sparkles,
  Mail,
  RotateCw,
  Briefcase,
  Shield,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';

export interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (customer: CustomerProfile, role?: UserRole) => void;
  onClose?: () => void;
  defaultMode?: 'login' | 'register';
  portalRole?: UserRole;
  prefillEmail?: string;
  initialSuccess?: string | null;
  initialError?: string | null;
  onSelectDemoRole?: (role: UserRole) => void;
  onSelectPortalRole?: (role: UserRole) => void;
  onNavigate?: (path: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
  defaultMode = 'login',
  portalRole = 'customer',
  prefillEmail = '',
  initialSuccess = null,
  initialError = null,
  onSelectDemoRole,
  onSelectPortalRole,
  onNavigate,
}) => {
  const [tab, setTab] = useState<'production' | 'demo'>('production');
  const [selectedPortal, setSelectedPortal] = useState<UserRole>(portalRole || 'customer');
  const [isRegister, setIsRegister] = useState(defaultMode === 'register' && portalRole === 'customer');
  const [email, setEmail] = useState(prefillEmail || '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [successMessage, setSuccessMessage] = useState<string | null>(initialSuccess);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showResendButton, setShowResendButton] = useState(false);

  const isSubmittingRef = useRef(false);

  // Sync mode, portal, and messages when props change
  useEffect(() => {
    if (portalRole) {
      setSelectedPortal(portalRole);
      if (portalRole !== 'customer') {
        setIsRegister(false);
      } else {
        setIsRegister(defaultMode === 'register');
      }
    }
    if (prefillEmail) {
      setEmail(prefillEmail);
    } else {
      const savedEmail = typeof window !== 'undefined' ? localStorage.getItem('vivpay_last_registered_email') : null;
      if (savedEmail && !email) {
        setEmail(savedEmail);
      }
    }
    if (initialError !== undefined) setError(initialError);
    if (initialSuccess !== undefined) setSuccessMessage(initialSuccess);
  }, [defaultMode, portalRole, prefillEmail, initialError, initialSuccess]);

  // Rate-limit cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  if (!isOpen) return null;

  const handleSwitchPortal = (p: UserRole) => {
    setSelectedPortal(p);
    setError(null);
    setSuccessMessage(null);
    if (p !== 'customer') {
      setIsRegister(false);
    }
    if (onSelectPortalRole) {
      onSelectPortalRole(p);
    }
  };

  // Development Demo Quick Login
  const handleLaunchDemoRole = (role: UserRole) => {
    const demoUser = DEMO_USERS[role];
    const demoProfile: CustomerProfile = {
      id: demoUser.id,
      email: demoUser.email,
      fullName: demoUser.name,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (onSelectDemoRole) {
      onSelectDemoRole(role);
    }
    onSuccess(demoProfile, role);
    if (onClose) onClose();
  };

  // Resend Email Confirmation Link
  const handleResendConfirmation = async () => {
    const targetEmail = email.trim() || (typeof window !== 'undefined' ? localStorage.getItem('vivpay_last_registered_email') : '') || '';
    if (!targetEmail || !targetEmail.includes('@')) {
      setError('Please enter your email address to receive a new confirmation link.');
      return;
    }

    setResending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '';
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (resendErr) {
        throw resendErr;
      }

      setSuccessMessage(`A fresh confirmation link has been sent to ${targetEmail}. Please check your inbox.`);
      setShowResendButton(false);
    } catch (err: any) {
      console.error('Resend confirmation link error:', err);
      setError(err.message || 'Could not resend confirmation email. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || loading || (isRegister && cooldownSeconds > 0)) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setShowResendButton(false);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (isRegister && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    // Compute actual application origin for email confirmation redirect
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '';

    try {
      if (isRegister) {
        // Public signup should create a Customer account by default
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName.trim(),
              currency: currency || 'USD',
              role: 'customer', // Public registration is strictly customer
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        // Security check: NEVER automatically log the user in after registration
        if (data?.session) {
          try {
            await supabase.auth.signOut();
          } catch {}
          authStorage.clearToken();
        }

        // Save email in localStorage for prefilling & resend support
        if (typeof window !== 'undefined') {
          localStorage.setItem('vivpay_last_registered_email', trimmedEmail);
        }

        // Switch to Sign In mode, prefill email, clear password
        setIsRegister(false);
        setPassword('');
        setEmail(trimmedEmail);

        // Instruct user to confirm their email
        setSuccessMessage('Registration successful! Please check your email and confirm your account before logging in.');
        setShowResendButton(true);
      } else {
        // Sign in with Supabase Auth
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        if (!data?.session) {
          setError('Authentication failed: No active session created.');
          return;
        }

        // Verify active session with supabase.auth.getSession()
        const { data: sessionData, error: sessionVerifyError } = await supabase.auth.getSession();
        if (sessionVerifyError || !sessionData?.session?.access_token) {
          setError('Authentication session verification failed. Please try again.');
          return;
        }

        const verifiedSession = sessionData.session;
        authStorage.setToken(verifiedSession.access_token);

        let customerProfile: CustomerProfile;
        let authoritativeRole: UserRole = 'customer';

        try {
          // Synchronize session with backend & obtain authoritative role from public.system_users
          const syncRes = await api.syncSession(verifiedSession.access_token);
          customerProfile = syncRes.customer;
          if (syncRes.role) authoritativeRole = syncRes.role;
        } catch {
          customerProfile = {
            id: data.user.id,
            email: data.user.email || trimmedEmail,
            fullName: data.user.user_metadata?.full_name || 'VivPay Customer',
            currency: 'USD',
            createdAt: data.user.created_at || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }

        // =====================================================================
        // ROLE-BASED ACCESS CHECKS FOR SELECTED LOGIN OPTION
        // =====================================================================
        if (selectedPortal === 'admin') {
          if (authoritativeRole !== 'admin') {
            // Immediately terminate Supabase session to prevent unauthorized access
            await supabase.auth.signOut();
            authStorage.clearToken();
            setError(
              `Access Denied: Your account (${trimmedEmail}) is authorized as '${authoritativeRole.toUpperCase()}', not an Administrator. You cannot sign in through the Admin Portal. Please use the Customer Login or contact a system administrator.`
            );
            return;
          }
        } else if (selectedPortal === 'employee') {
          if (authoritativeRole !== 'employee' && authoritativeRole !== 'admin') {
            // Immediately terminate Supabase session to prevent unauthorized access
            await supabase.auth.signOut();
            authStorage.clearToken();
            setError(
              `Access Denied: Your account (${trimmedEmail}) is authorized as '${authoritativeRole.toUpperCase()}', not an Operations Employee. You cannot sign in through the Employee Portal. Please use the Customer Login.`
            );
            return;
          }
        }

        // =====================================================================
        // DASHBOARD NAVIGATION:
        // Customer users enter Customer dashboard
        // Employee users enter Employee/Operations dashboard
        // Admin users enter Admin dashboard
        // Authoritative role from system_users RBAC
        const destinationRole: UserRole = authoritativeRole;

        // Redirect to Home page ("/") using application router
        if (onNavigate) {
          onNavigate('/');
        } else if (typeof window !== 'undefined' && window.location.pathname !== '/') {
          window.history.pushState(null, '', '/');
        }

        onSuccess(customerProfile, destinationRole);
        if (onClose) onClose();
      }
    } catch (err: any) {
      console.error('Supabase authentication error:', err);
      const errMessage = (err.message || '').trim();
      const lower = errMessage.toLowerCase();

      if (lower.includes('invalid login credentials')) {
        setError('Invalid email or password. Please verify your credentials and try again.');
      } else if (lower.includes('email not confirmed')) {
        setError('Your email has not been confirmed yet. Please check your inbox and verify your email before logging in.');
        setShowResendButton(true);
      } else if (lower.includes('user already registered') || lower.includes('already in use') || err.status === 422) {
        setError('An account with this email already exists. Please sign in instead.');
        setIsRegister(false);
        setPassword('');
      } else if (lower.includes('rate limit') || lower.includes('security purposes') || err.status === 429) {
        const match = errMessage.match(/after (\d+) seconds/i);
        const waitSec = match ? parseInt(match[1], 10) : 60;
        setCooldownSeconds(waitSec);
        setError(`Request limit reached for security. Please wait ${waitSec}s before retrying.`);
      } else {
        setError(errMessage || 'Authentication failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="text-center mb-4">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white mx-auto mb-2.5 shadow-lg ${
              selectedPortal === 'admin'
                ? 'bg-gradient-to-tr from-amber-600 to-purple-600 shadow-amber-600/30'
                : selectedPortal === 'employee'
                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-600/30'
                : 'bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-purple-600/30'
            }`}
          >
            {selectedPortal === 'admin' ? (
              <Shield className="w-5 h-5" />
            ) : selectedPortal === 'employee' ? (
              <Briefcase className="w-5 h-5" />
            ) : (
              <UserCheck className="w-5 h-5" />
            )}
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            {selectedPortal === 'admin'
              ? 'Admin Governance Login'
              : selectedPortal === 'employee'
              ? 'Employee & Operations Login'
              : 'Customer Portal Login'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {selectedPortal === 'admin'
              ? 'Privileged access for platform governance and audit control'
              : selectedPortal === 'employee'
              ? 'Operations desk, fraud triage, and case investigation'
              : isRegister
              ? 'Create your personal finance account'
              : 'Sign in to personal financial twin & statements'}
          </p>
        </div>

        {/* Three Clearly Separated Login Entry Points Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 mb-4">
          <button
            type="button"
            onClick={() => handleSwitchPortal('customer')}
            className={`py-2 px-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              selectedPortal === 'customer'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Customer</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchPortal('employee')}
            className={`py-2 px-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              selectedPortal === 'employee'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Employee</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchPortal('admin')}
            className={`py-2 px-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              selectedPortal === 'admin'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        </div>

        {/* Top Tab Selector: Real Email Auth vs Dev Demo */}
        <div className="flex bg-zinc-950/80 p-1 rounded-xl border border-zinc-800/80 mb-4">
          <button
            type="button"
            onClick={() => {
              setTab('production');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === 'production'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Supabase Email Auth</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('demo')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === 'demo'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Dev Demo Sandbox</span>
          </button>
        </div>

        {/* 1. Production Authentication Flow (Pure Email & Password) */}
        {tab === 'production' && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            {/* Customer portal allows Sign In / Create Account toggle */}
            {selectedPortal === 'customer' ? (
              <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    !isRegister
                      ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isRegister
                      ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </div>
            ) : (
              /* Notice for Employee/Admin portals: Self-service registration disabled */
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  selectedPortal === 'admin'
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                    : 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
                }`}
              >
                {selectedPortal === 'admin' ? (
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                ) : (
                  <Lock className="w-4 h-4 shrink-0 text-blue-400" />
                )}
                <span className="text-[11px] leading-tight">
                  {selectedPortal === 'admin'
                    ? 'Administrator accounts are strictly provisioned. Public self-service signup is disabled.'
                    : 'Operations accounts are strictly provisioned. Public self-service signup is disabled.'}
                </span>
              </div>
            )}

            {cooldownSeconds > 0 ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-2.5">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-amber-200">Rate Limit Active</p>
                  <p className="text-amber-300/90 leading-relaxed text-[11px]">
                    Please wait <strong>{cooldownSeconds}s</strong> before submitting again.
                  </p>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-3">
              {isRegister && selectedPortal === 'customer' && (
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Rivera"
                    disabled={loading}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  {selectedPortal === 'admin'
                    ? 'Administrator Email'
                    : selectedPortal === 'employee'
                    ? 'Staff Email Address'
                    : 'Email Address'}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      selectedPortal === 'admin'
                        ? 'admin@vivpay.internal'
                        : selectedPortal === 'employee'
                        ? 'ops@vivpay.internal'
                        : 'name@example.com'
                    }
                    disabled={loading}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                  />
                  <Mail className="w-4 h-4 text-zinc-500 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-zinc-300">Password</label>
                  <span className="text-[10px] text-zinc-500">Min. 6 characters</span>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                />
              </div>

              {/* Error message under the form fields */}
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <div className="flex-1 space-y-1.5">
                    <p className="text-[11px] leading-relaxed">{error}</p>
                    {showResendButton && (
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resending}
                        className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 underline cursor-pointer flex items-center gap-1"
                      >
                        {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                        <span>Resend confirmation email</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Success message under the form fields */}
              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <div className="flex-1 space-y-1.5">
                    <p className="text-[11px] leading-relaxed">{successMessage}</p>
                    {showResendButton && (
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resending}
                        className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 underline cursor-pointer flex items-center gap-1"
                      >
                        {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                        <span>Didn't receive email? Click to resend</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (isRegister && cooldownSeconds > 0)}
                className={`w-full font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md active:scale-[0.99] ${
                  selectedPortal === 'admin'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                    : selectedPortal === 'employee'
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
                }`}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>
                  {selectedPortal === 'admin'
                    ? 'Sign In to Admin Governance'
                    : selectedPortal === 'employee'
                    ? 'Sign In to Operations Desk'
                    : isRegister
                    ? 'Create Customer Account'
                    : 'Sign In as Customer'}
                </span>
              </button>

              <div className="text-center pt-1">
                {selectedPortal === 'customer' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(!isRegister);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Create Account"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSwitchPortal('customer')}
                    className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Looking for personal finance? Switch to Customer Login
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* 2. Development Demo Quick Login Tab */}
        {tab === 'demo' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl">
              <p className="text-xs font-semibold text-zinc-200">Interactive Role Testing</p>
              <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                Launch any of the three distinct workspaces instantly with realistic financial records and audit ledgers:
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleLaunchDemoRole('customer')}
                className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-900 transition-all text-left flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-purple-300">Customer Workspace</p>
                    <p className="text-[10px] text-zinc-400">Alex Rivera (Personal Financial Twin & Statements)</p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                  Launch
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleLaunchDemoRole('employee')}
                className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-900 transition-all text-left flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-blue-300">Operations Workspace</p>
                    <p className="text-[10px] text-zinc-400">Jordan Taylor (Case Management & Ingestion Queue)</p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  Launch
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleLaunchDemoRole('admin')}
                className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900 transition-all text-left flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-amber-300">Admin Governance</p>
                    <p className="text-[10px] text-zinc-400">Marcus Vance (Audit Ledgers & User Governance)</p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Launch
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
