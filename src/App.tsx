/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CustomerProfile, Account, Transaction, TransactionCategory, StatementDocument, FinancialSummary } from './types/database.ts';
import { SystemUser, AuditLogEntry, CaseRecord } from './types/operations.ts';
import { api, adminApi, operationsApi, authStorage } from './services/api.ts';
import { supabase } from './supabaseClient.js';
import {
  getBrowserSession,
  handleAuthCallback,
  onBrowserAuthStateChange,
  signOutBrowser,
} from './services/supabaseClient.ts';
import {
  UserRole,
  DEMO_USERS,
  DEMO_CUSTOMER_PRESETS,
  INITIAL_DEMO_ACCOUNTS,
  INITIAL_DEMO_TRANSACTIONS,
  INITIAL_DEMO_GOALS,
  INITIAL_DEMO_CASES,
  INITIAL_DEMO_FRAUD_ALERTS,
  INITIAL_DEMO_STATEMENT_METRICS,
  INITIAL_DEMO_USERS,
  INITIAL_DEMO_AUDIT_LOGS,
  calculateFinancialSummary,
} from './services/demoData.ts';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { LandingHero } from './components/LandingHero.tsx';
import { CustomerDashboard } from './components/CustomerDashboard.tsx';
import { KPICards } from './components/KPICards.tsx';
import { TransactionTable } from './components/TransactionTable.tsx';
import { StatementVault } from './components/StatementVault.tsx';
import { SpendingAnalytics } from './components/SpendingAnalytics.tsx';
import { FinancialTwin } from './components/FinancialTwin.tsx';
import { AskVivModal } from './components/AskVivModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { SupabaseSetupBanner } from './components/SupabaseSetupBanner.tsx';
import { EmployeeDashboard, EmployeeWorkspaceTab } from './components/EmployeeDashboard.tsx';
import { AdminDashboard, AdminWorkspaceTab } from './components/AdminDashboard.tsx';
import { ExcelUploadModal } from './components/ExcelUploadModal.tsx';
import { FinancialProfile } from './components/FinancialProfile.tsx';
import { DatasetControlBanner, ActiveDatasetMeta } from './components/DatasetControlBanner.tsx';
import { AnalysisResult } from './lib/finance/types.ts';
import { chunkFinancialStatement, globalVectorStore } from './lib/rag/index.ts';
import {
  LayoutDashboard,
  Receipt,
  FileSpreadsheet,
  PieChart,
  Sparkles,
  PlusCircle,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  Loader2,
  Briefcase,
  Shield,
  UploadCloud,
  ArrowRight,
  Menu,
  Wallet,
  UserCheck,
  X,
} from 'lucide-react';

export default function App() {
  // Authentication & Session State
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('customer');
  const [authoritativeRole, setAuthoritativeRole] = useState<UserRole>('customer');
  const [roleAccessError, setRoleAccessError] = useState<{ targetRole: UserRole; message: string } | null>(null);
  const [adminNotification, setAdminNotification] = useState<{
    type: 'error' | 'success';
    message: string;
  } | null>(null);
  const [pendingUserActionIds, setPendingUserActionIds] = useState<Set<string>>(new Set());
  const userUpdateSeqRef = useRef<Map<string, number>>(new Map());
  const [isDemoSession, setIsDemoSession] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPortalRole, setAuthPortalRole] = useState<UserRole>('customer');
  const [authDefaultMode, setAuthDefaultMode] = useState<'login' | 'register'>('login');
  const [authPrefillEmail, setAuthPrefillEmail] = useState('');
  const [authInitialSuccess, setAuthInitialSuccess] = useState<string | null>(null);
  const [authInitialError, setAuthInitialError] = useState<string | null>(null);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // URL Route State & Route Navigation
  const [currentPath, setCurrentPath] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  const navigate = useCallback((path: string) => {
    if (typeof window !== 'undefined') {
      if (customer && !isDemoSession) {
        if ((path === '/employee' || path === '/operations') && authoritativeRole !== 'employee' && authoritativeRole !== 'admin') {
          window.history.replaceState(null, '', '/');
          setCurrentPath('/');
          setActiveRole('customer');
          setRoleAccessError({
            targetRole: 'employee',
            message: 'Access Denied: Customer accounts cannot access the Employee Operations workspace.',
          });
          return;
        }
        if (path === '/admin' && authoritativeRole !== 'admin') {
          window.history.replaceState(null, '', '/');
          setCurrentPath('/');
          setActiveRole('customer');
          setRoleAccessError({
            targetRole: 'admin',
            message: 'Access Denied: Customer accounts cannot access the Admin workspace.',
          });
          return;
        }
      }
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path);
      }
      setCurrentPath(path);
    }
  }, [customer, isDemoSession, authoritativeRole]);

  const handleOpenPortalLogin = useCallback((portal: UserRole = 'customer', mode: 'login' | 'register' = 'login') => {
    setAuthPortalRole(portal);
    setAuthDefaultMode(mode);
    setAuthModalOpen(true);
    setRoleAccessError(null);
    navigate(`/login?portal=${portal}`);
  }, [navigate]);

  // Financial Data State (Customer)
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<(Transaction & { categoryName: string; categoryColor: string })[]>([]);
  const [analyticsTransactions, setAnalyticsTransactions] = useState<(Transaction & { categoryName: string; categoryColor: string })[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [documents, setDocuments] = useState<StatementDocument[]>([]);
  const [goals, setGoals] = useState<any[]>(INITIAL_DEMO_GOALS);
  const [selectedDemoCustomerId, setSelectedDemoCustomerId] = useState<string>('alex');
  const [activeDataset, setActiveDataset] = useState<ActiveDatasetMeta | null>(null);
  const [excelUploadMode, setExcelUploadMode] = useState<'upload' | 'replace'>('upload');
  const [datasetInitialized, setDatasetInitialized] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisResult | null>(null);

  // Operations & Admin Data State
  const [cases, setCases] = useState(INITIAL_DEMO_CASES);
  const [fraudAlerts, setFraudAlerts] = useState(INITIAL_DEMO_FRAUD_ALERTS);
  const [statementMetrics, setStatementMetrics] = useState(INITIAL_DEMO_STATEMENT_METRICS);
  const [systemUsers, setSystemUsers] = useState(INITIAL_DEMO_USERS);
  const [auditLogs, setAuditLogs] = useState(INITIAL_DEMO_AUDIT_LOGS);

  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'vault' | 'analytics' | 'twin' | 'profile'>('overview');
  const [activeEmployeeTab, setActiveEmployeeTab] = useState<EmployeeWorkspaceTab>('overview');
  const [activeAdminTab, setActiveAdminTab] = useState<AdminWorkspaceTab>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [askVivOpen, setAskVivOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Table pagination & filtering
  const [tableLoading, setTableLoading] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
  });
  const [filters, setFilters] = useState<{
    search?: string;
    categoryId?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: string;
  }>({});

  // Protect private pages with supabase.auth.getSession() — if no session, redirect to /login
  const verifySessionOrRedirect = useCallback(async (): Promise<boolean> => {
    if (isDemoSession) return true;
    try {
      let { data, error } = await supabase.auth.getSession();
      let session = data?.session;

      // Proactively refresh if session is expired or within 60 seconds of expiring
      if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) {
        try {
          const { data: refData, error: refErr } = await supabase.auth.refreshSession();
          if (!refErr && refData?.session) {
            session = refData.session;
          }
        } catch (refEx) {
          console.warn('verifySessionOrRedirect proactive refresh:', refEx);
        }
      }

      if (error || !session?.access_token) {
        authStorage.clearToken();
        setCustomer(null);
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/login');
          setCurrentPath('/login');
        }
        setAuthDefaultMode('login');
        setAuthModalOpen(true);
        return false;
      }

      authStorage.setToken(session.access_token);
      return true;
    } catch {
      authStorage.clearToken();
      setCustomer(null);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/login');
        setCurrentPath('/login');
      }
      setAuthDefaultMode('login');
      setAuthModalOpen(true);
      return false;
    }
  }, [isDemoSession]);

  // Listen to browser popstate events for backward/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = typeof window !== 'undefined' ? window.location.pathname : '/';
      setCurrentPath(path);
      if (path === '/login' && !customer && !isDemoSession) {
        const searchParams = new URLSearchParams(window.location.search);
        const portal = searchParams.get('portal') as UserRole;
        if (portal && ['customer', 'employee', 'admin'].includes(portal)) {
          setAuthPortalRole(portal);
        }
        setAuthDefaultMode('login');
        setAuthModalOpen(true);
      } else if (customer && !isDemoSession) {
        if (authoritativeRole === 'customer') {
          if (path === '/employee' || path === '/operations' || path === '/admin') {
            window.history.replaceState(null, '', '/');
            setCurrentPath('/');
            setActiveRole('customer');
            setRoleAccessError({
              targetRole: path === '/admin' ? 'admin' : 'employee',
              message: `Access Denied: Customer accounts cannot access the ${path === '/admin' ? 'Admin' : 'Operations'} workspace.`,
            });
          }
        } else if (authoritativeRole === 'employee') {
          if (path === '/admin' || path === '/') {
            window.history.replaceState(null, '', '/employee');
            setCurrentPath('/employee');
            setActiveRole('employee');
            setRoleAccessError({
              targetRole: path === '/admin' ? 'admin' : 'customer',
              message: `Access Denied: Employee accounts cannot access the ${path === '/admin' ? 'Admin' : 'Customer'} workspace.`,
            });
          }
        } else if (authoritativeRole === 'admin') {
          if (path === '/employee' || path === '/operations' || path === '/') {
            window.history.replaceState(null, '', '/admin');
            setCurrentPath('/admin');
            setActiveRole('admin');
            setRoleAccessError({
              targetRole: path === '/' ? 'customer' : 'employee',
              message: `Access Denied: Administrator accounts cannot access the ${path === '/' ? 'Customer' : 'Operations'} workspace.`,
            });
          }
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [customer, isDemoSession, authoritativeRole]);

  // Reactive URL route guard to enforce role boundaries on active path changes
  useEffect(() => {
    if (customer && !isDemoSession) {
      if (authoritativeRole === 'customer') {
        if (currentPath === '/employee' || currentPath === '/operations' || currentPath === '/admin') {
          window.history.replaceState(null, '', '/');
          setCurrentPath('/');
          setActiveRole('customer');
          setRoleAccessError({
            targetRole: currentPath === '/admin' ? 'admin' : 'employee',
            message: `Access Denied: Customer accounts cannot access the ${currentPath === '/admin' ? 'Admin' : 'Operations'} workspace.`,
          });
        }
      } else if (authoritativeRole === 'employee') {
        if (currentPath === '/admin' || currentPath === '/') {
          window.history.replaceState(null, '', '/employee');
          setCurrentPath('/employee');
          setActiveRole('employee');
          setRoleAccessError({
            targetRole: currentPath === '/admin' ? 'admin' : 'customer',
            message: `Access Denied: Employee accounts cannot access the ${currentPath === '/admin' ? 'Admin' : 'Customer'} workspace.`,
          });
        }
      } else if (authoritativeRole === 'admin') {
        if (currentPath === '/employee' || currentPath === '/operations' || currentPath === '/') {
          window.history.replaceState(null, '', '/admin');
          setCurrentPath('/admin');
          setActiveRole('admin');
          setRoleAccessError({
            targetRole: currentPath === '/' ? 'customer' : 'employee',
            message: `Access Denied: Administrator accounts cannot access the ${currentPath === '/' ? 'Customer' : 'Operations'} workspace.`,
          });
        }
      }
    }
  }, [currentPath, customer, isDemoSession, authoritativeRole]);

  const sanitizeRouteForRole = useCallback((role: UserRole) => {
    if (typeof window === 'undefined') return;
    const curPath = window.location.pathname;
    if (role === 'admin') {
      if (curPath !== '/admin') {
        window.history.replaceState(null, '', '/admin');
        setCurrentPath('/admin');
        setActiveRole('admin');
      }
    } else if (role === 'employee') {
      if (curPath !== '/employee' && curPath !== '/operations') {
        window.history.replaceState(null, '', '/employee');
        setCurrentPath('/employee');
        setActiveRole('employee');
      }
    } else {
      if (curPath === '/employee' || curPath === '/operations' || curPath === '/admin') {
        window.history.replaceState(null, '', '/');
        setCurrentPath('/');
        setActiveRole('customer');
        setRoleAccessError({
          targetRole: curPath === '/admin' ? 'admin' : 'employee',
          message: `Access Denied: Customer accounts cannot access the ${curPath === '/admin' ? 'Admin' : 'Operations'} workspace.`,
        });
      } else if (curPath === '/login') {
        window.history.replaceState(null, '', '/');
        setCurrentPath('/');
        setAuthModalOpen(false);
      }
    }
  }, []);

  // 1. Initial Health, Supabase Confirmation callback, and Authentication session restoration
  const checkHealthAndAuth = useCallback(async () => {
    try {
      try {
        const health = await api.getHealth();
        if (health?.supabase) {
          setSupabaseStatus(health.supabase);
        }
      } catch (healthErr) {
        console.warn('Initial health check notice (using defaults):', healthErr);
      }

      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const searchParams = new URLSearchParams(search);
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : '');

      const errorCode = searchParams.get('error_code') || hashParams.get('error_code');
      const errorMsg = searchParams.get('error_description') || hashParams.get('error_description') || searchParams.get('error') || hashParams.get('error');
      const code = searchParams.get('code');
      const isSignupHash = hash.includes('type=signup');

      // A. Handle expired or already-used confirmation links
      if (errorCode === 'otp_expired' || errorMsg?.toLowerCase().includes('expired') || errorMsg?.toLowerCase().includes('already') || errorMsg?.toLowerCase().includes('invalid')) {
        const lastEmail = typeof window !== 'undefined' ? localStorage.getItem('vivpay_last_registered_email') || '' : '';
        window.history.replaceState(null, '', '/login');
        setCurrentPath('/login');
        setAuthDefaultMode('login');
        setAuthPrefillEmail(lastEmail);
        setAuthInitialError('Your confirmation link has expired or has already been used. Please request a new confirmation email below or sign in if you already confirmed.');
        setAuthInitialSuccess(null);
        setAuthModalOpen(true);
        setInitialLoading(false);
        return;
      }

      // B. Handle Email Confirmation callback (PKCE authorization code flow)
      if (code) {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;

          const confirmedEmail = data?.session?.user?.email || (typeof window !== 'undefined' ? localStorage.getItem('vivpay_last_registered_email') || '' : '');

          // Requirements 5 & 8: Never automatically log in after email confirmation.
          // Sign out immediately and redirect to Sign In page with success message and prefilled email.
          try {
            await supabase.auth.signOut();
          } catch {}
          authStorage.clearToken();
          setCustomer(null);

          window.history.replaceState(null, '', '/login');
          setCurrentPath('/login');
          setAuthDefaultMode('login');
          setAuthPrefillEmail(confirmedEmail);
          setAuthInitialSuccess('Email verified successfully! You can now sign in with your password.');
          setAuthInitialError(null);
          setAuthModalOpen(true);
          setInitialLoading(false);
          return;
        } catch (exchangeErr: any) {
          console.error('Email confirmation PKCE exchange error:', exchangeErr);
          const lastEmail = typeof window !== 'undefined' ? localStorage.getItem('vivpay_last_registered_email') || '' : '';
          window.history.replaceState(null, '', '/login');
          setCurrentPath('/login');
          setAuthDefaultMode('login');
          setAuthPrefillEmail(lastEmail);
          setAuthModalOpen(true);
          setAuthInitialError('Your confirmation link has expired or has already been used. Please request a new confirmation email below.');
          setAuthInitialSuccess(null);
          setInitialLoading(false);
          return;
        }
      } else if (isSignupHash) {
        try {
          const { data } = await supabase.auth.getSession();
          const confirmedEmail = data?.session?.user?.email || (typeof window !== 'undefined' ? localStorage.getItem('vivpay_last_registered_email') || '' : '');

          // Never automatically log in after email confirmation
          try {
            await supabase.auth.signOut();
          } catch {}
          authStorage.clearToken();
          setCustomer(null);

          window.history.replaceState(null, '', '/login');
          setCurrentPath('/login');
          setAuthDefaultMode('login');
          setAuthPrefillEmail(confirmedEmail);
          setAuthInitialSuccess('Email verified successfully! You can now sign in with your password.');
          setAuthInitialError(null);
          setAuthModalOpen(true);
          setInitialLoading(false);
          return;
        } catch (hashErr) {
          console.warn('Hash confirmation error:', hashErr);
        }
      }

      // C. Check active browser Supabase session using supabase.auth.getSession()
      let activeSession = null;
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (!sessionErr && sessionData?.session?.access_token) {
          activeSession = sessionData.session;
        }
      } catch (sessErr) {
        console.warn('supabase.auth.getSession initial check:', sessErr);
      }

          if (activeSession?.access_token) {
        authStorage.setToken(activeSession.access_token);
        try {
          const syncRes = await api.syncSession(activeSession.access_token);
          setCustomer(syncRes.customer);
          const verifiedRole = syncRes.role || 'customer';
          setAuthoritativeRole(verifiedRole);
          setActiveRole(verifiedRole);
          setIsDemoSession(false);
          sanitizeRouteForRole(verifiedRole);
        } catch (syncErr: any) {
          console.error('Failed to sync restored Supabase session:', syncErr);
          try {
            const { data: refData, error: refErr } = await supabase.auth.refreshSession();
            if (!refErr && refData?.session?.access_token) {
              authStorage.setToken(refData.session.access_token);
              const retryRes = await api.syncSession(refData.session.access_token);
              setCustomer(retryRes.customer);
              const verifiedRole = retryRes.role || 'customer';
              setAuthoritativeRole(verifiedRole);
              setActiveRole(verifiedRole);
              setIsDemoSession(false);
              sanitizeRouteForRole(verifiedRole);
            } else {
              authStorage.clearToken();
              setCustomer(null);
            }
          } catch {
            authStorage.clearToken();
            setCustomer(null);
          }
        }
      } else {
        const token = authStorage.getToken();
        let restored = false;
        if (token) {
          try {
            const me = await api.getMe();
            setCustomer(me.customer);
            const verifiedRole = me.role || 'customer';
            setAuthoritativeRole(verifiedRole);
            setActiveRole(verifiedRole);
            setIsDemoSession(false);
            restored = true;
            sanitizeRouteForRole(verifiedRole);
          } catch {
            authStorage.clearToken();
            setCustomer(null);
            setAuthoritativeRole('customer');
            setActiveRole('customer');
          }
        }

        // If no active session exists:
        if (!restored) {
          const path = window.location.pathname;
          const searchParams = new URLSearchParams(window.location.search);
          const portalParam = searchParams.get('portal') as UserRole;
          if (portalParam && ['customer', 'employee', 'admin'].includes(portalParam)) {
            setAuthPortalRole(portalParam);
          }
          if (path === '/login') {
            setAuthDefaultMode('login');
            setAuthModalOpen(true);
          } else if (path !== '/' && !path.startsWith('/#')) {
            window.history.replaceState(null, '', '/login');
            setCurrentPath('/login');
            setAuthDefaultMode('login');
            setAuthModalOpen(true);
          }
        }
      }
    } catch (err) {
      console.error('Initial startup check error:', err);
    } finally {
      setInitialLoading(false);
    }
  }, [sanitizeRouteForRole]);

  useEffect(() => {
    checkHealthAndAuth();
  }, [checkHealthAndAuth]);

  // Listen to Supabase Auth state changes (SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, SIGNED_OUT)
  useEffect(() => {
    const { data: authListener } = onBrowserAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.access_token) {
        authStorage.setToken(session.access_token);
        try {
          const res = await api.syncSession(session.access_token);
          setCustomer(res.customer);
          const verifiedRole = res.role || 'customer';
          setAuthoritativeRole(verifiedRole);
          setActiveRole(verifiedRole);
          setIsDemoSession(false);
          sanitizeRouteForRole(verifiedRole);
        } catch (err) {
          console.error('Failed to sync profile on auth state change:', err);
        }
      } else if (event === 'SIGNED_OUT') {
        if (!isDemoSession) {
          authStorage.clearToken();
          setCustomer(null);
          setAuthoritativeRole('customer');
          setActiveRole('customer');
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [isDemoSession, sanitizeRouteForRole]);

  // Switch between controlled demo customer datasets (e.g. Alex Rivera vs Priya Sharma)
  const handleSwitchDemoCustomer = useCallback((presetId: string) => {
    const preset = DEMO_CUSTOMER_PRESETS.find((p) => p.id === presetId) || DEMO_CUSTOMER_PRESETS[0];
    setSelectedDemoCustomerId(preset.id);
    setCustomer(preset.customerProfile);
    setAccounts(preset.accounts);
    setTransactions(preset.transactions);
    setAnalyticsTransactions(preset.transactions);
    setGoals(preset.goals);
    setSummary(calculateFinancialSummary(preset.accounts, preset.transactions));
    setPagination({
      total: preset.transactions.length,
      page: 1,
      limit: 15,
      totalPages: Math.ceil(preset.transactions.length / 15),
    });
    const dates = preset.transactions.map((t) => t.date).sort();
    setActiveDataset({
      fileName: preset.statementFileName,
      transactionCount: preset.transactions.length,
      dateRange: {
        from: dates[0] || '2026-08-01',
        to: dates[dates.length - 1] || '2026-10-14',
      },
      totalInflow: preset.accounts.reduce((sum, a) => sum + (a.balance > 0 ? a.balance : 0), 0),
      source: 'demo',
      importedAt: new Date().toISOString(),
    });
  }, []);

  const handleAccountCreated = useCallback((newAcc: Account) => {
    setAccounts((prev) => [newAcc, ...prev]);
  }, []);

  const handleAccountUpdated = useCallback((updatedAcc: Account) => {
    setAccounts((prev) => prev.map((a) => (a.id === updatedAcc.id ? updatedAcc : a)));
  }, []);

  const handleAccountDeleted = useCallback((accId: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== accId));
    if (selectedAccountId === accId) {
      setSelectedAccountId('all');
    }
  }, [selectedAccountId]);

  // 2. Fetch Customer Financial Data (Handles both Production and Demo modes)
  const loadCustomerData = useCallback(async () => {
    if (!customer) return;

    if (isDemoSession) {
      if (!datasetInitialized) {
        handleSwitchDemoCustomer(selectedDemoCustomerId);
        setDatasetInitialized(true);
      }
      return;
    }

    const hasSession = await verifySessionOrRedirect();
    if (!hasSession) return;

    try {
      const accParam = selectedAccountId !== 'all' ? selectedAccountId : undefined;
      const [accRes, catRes, sumRes, docRes, goalsRes, allTxRes] = await Promise.all([
        api.getAccounts(),
        api.getCategories(),
        api.getAnalyticsSummary({ accountId: accParam }),
        api.getDocuments(),
        api.getGoals().catch(() => ({ goals: [] })),
        api.getAllTransactions({ accountId: accParam }).catch(() => ({ transactions: [], count: 0 })),
      ]);

      setAccounts(accRes.accounts || []);
      setCategories(catRes.categories || []);
      setSummary(sumRes.summary || null);
      setDocuments(docRes.documents || []);
      setGoals(goalsRes?.goals || []);
      setAnalyticsTransactions(allTxRes.transactions || []);

      // If active persisted documents exist, restore active dataset metadata
      const activeDocs = (docRes.documents || []).filter(
        (d) => d.processingStatus === 'completed' || d.processingStatus === 'uploaded'
      );
      if (activeDocs.length > 0) {
        const latestDoc = activeDocs[0];
        const allTxs = allTxRes?.transactions || [];
        const sortedDates = allTxs.map((t) => t.date).filter(Boolean).sort();
        setActiveDataset({
          fileName: latestDoc.originalName || latestDoc.fileName,
          transactionCount: sumRes.summary?.totalTransactions || latestDoc.importedCount || latestDoc.extractedCount || allTxs.length,
          dateRange: {
            from: sortedDates[0] || '',
            to: sortedDates[sortedDates.length - 1] || '',
          },
          totalInflow: sumRes.summary?.grossCredits,
          totalOutflow: sumRes.summary?.grossDebits,
          netCashFlow: sumRes.summary?.netCashFlow,
          source: 'persisted',
          importedAt: latestDoc.createdAt,
        });
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.isAuthExpired) {
        console.warn('Supabase authentication session expired or invalidated. Redirecting to login.');
        authStorage.clearToken();
        setCustomer(null);
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/login');
          setCurrentPath('/login');
        }
        setAuthDefaultMode('login');
        setAuthModalOpen(true);
      } else {
        console.error('Failed to load financial data:', err);
      }
    }
  }, [customer, isDemoSession, selectedAccountId, datasetInitialized, verifySessionOrRedirect, handleSwitchDemoCustomer, selectedDemoCustomerId]);

  // 3. Fetch Transactions
  const loadTransactions = useCallback(async () => {
    if (!customer || isDemoSession) return;

    const hasSession = await verifySessionOrRedirect();
    if (!hasSession) return;

    setTableLoading(true);

    try {
      const accParam = selectedAccountId !== 'all' ? selectedAccountId : undefined;
      const res = await api.getTransactions({
        accountId: accParam,
        categoryId: filters.categoryId,
        type: filters.type,
        search: filters.search,
        sortBy: filters.sortBy || 'date',
        sortOrder: filters.sortOrder || 'desc',
        page: pagination.page,
        limit: pagination.limit,
      });

      setTransactions(res.transactions || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
      if (res.transactions && res.transactions.length > 0) {
        const sortedDates = res.transactions.map((t) => t.date).filter(Boolean).sort();
        setActiveDataset((prev) =>
          prev
            ? {
                ...prev,
                transactionCount: res.pagination?.total || res.transactions.length,
                dateRange: {
                  from: sortedDates[0] || prev.dateRange.from,
                  to: sortedDates[sortedDates.length - 1] || prev.dateRange.to,
                },
              }
            : null
        );
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.isAuthExpired) {
        console.warn('Supabase authentication session expired for transaction ledger.');
        authStorage.clearToken();
        setCustomer(null);
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/login');
          setCurrentPath('/login');
        }
        setAuthDefaultMode('login');
        setAuthModalOpen(true);
      } else {
        console.error('Failed to load transactions:', err);
      }
    } finally {
      setTableLoading(false);
    }
  }, [customer, isDemoSession, selectedAccountId, filters, pagination.page, pagination.limit, verifySessionOrRedirect]);

  useEffect(() => {
    if (customer) {
      loadCustomerData();
      loadTransactions();
    }
  }, [customer, selectedAccountId, loadCustomerData, loadTransactions, refreshTrigger]);

  // Periodic and tab switch session protection check for authenticated sessions
  useEffect(() => {
    if (customer && !isDemoSession) {
      verifySessionOrRedirect();
    }
  }, [customer, isDemoSession, activeTab, activeRole, verifySessionOrRedirect]);

  const loadOperationsData = useCallback(async () => {
    try {
      const [casesRes, alertsRes, metricsRes] = await Promise.allSettled([
        operationsApi.getCases(),
        operationsApi.getFraudAlerts(),
        operationsApi.getStatementMetrics(),
      ]);
      if (casesRes.status === 'fulfilled' && casesRes.value.cases) {
        setCases(casesRes.value.cases);
      }
      if (alertsRes.status === 'fulfilled' && alertsRes.value.alerts) {
        setFraudAlerts(alertsRes.value.alerts);
      }
      if (metricsRes.status === 'fulfilled' && metricsRes.value.metrics) {
        setStatementMetrics(metricsRes.value.metrics);
      }
    } catch (err: any) {
      console.warn('Load operations data note:', err.message);
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    try {
      const [usersRes, auditRes] = await Promise.allSettled([
        adminApi.getUsers(),
        adminApi.getAuditLogs({ limit: 100 }),
      ]);
      if (usersRes.status === 'fulfilled' && usersRes.value.users) {
        setSystemUsers(usersRes.value.users);
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.auditLogs) {
        setAuditLogs(auditRes.value.auditLogs);
      }
    } catch (err: any) {
      console.warn('Load admin data note:', err.message);
    }
  }, []);

  useEffect(() => {
    if (activeRole === 'employee' || activeRole === 'admin') {
      loadOperationsData();
    }
    if (activeRole === 'admin') {
      loadAdminData();
    }
  }, [activeRole, refreshTrigger, loadOperationsData, loadAdminData]);

  const handleRefreshAll = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSelectRole = async (targetRole: UserRole) => {
    if (isDemoSession) {
      setActiveRole(targetRole);
      handleLaunchDemoRole(targetRole);
      return;
    }

    // Role switching is strictly prohibited for authenticated sessions
    if (targetRole !== authoritativeRole) {
      setRoleAccessError({
        targetRole,
        message: `Access Denied: Role switching is disabled. Your authenticated account is assigned as '${authoritativeRole.toUpperCase()}'. You cannot switch to '${targetRole.toUpperCase()}'.`,
      });
      setActiveRole(authoritativeRole);
      return;
    }

    setRoleAccessError(null);
  };

  const handleLogout = async () => {
    if (!isDemoSession) {
      try {
        await api.logout();
      } catch {}
      await signOutBrowser();
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    authStorage.clearToken();
    setCustomer(null);
    setAuthoritativeRole('customer');
    setActiveRole('customer');
    setRoleAccessError(null);
    setOauthError(null);
    setIsDemoSession(false);
    setAccounts([]);
    setTransactions([]);
    setSummary(null);
    setDocuments([]);
    setCases([]);
    setFraudAlerts([]);
    setStatementMetrics([]);
    setSystemUsers([]);
    setAuditLogs([]);

    // Redirect to /login
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/login');
      setCurrentPath('/login');
    }
    setAuthDefaultMode('login');
    setAuthModalOpen(true);
  };

  // Launch role in demo mode
  const handleLaunchDemoRole = (role: UserRole = 'customer') => {
    setIsDemoSession(true);
    setActiveRole(role);

    if (role === 'customer') {
      handleSwitchDemoCustomer(selectedDemoCustomerId);
      setDatasetInitialized(true);
      return;
    }

    const demoUser = DEMO_USERS[role];
    const demoProfile: CustomerProfile = {
      id: demoUser.id,
      email: demoUser.email,
      fullName: demoUser.name,
      currency: 'INR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCustomer(demoProfile);
    setAccounts(INITIAL_DEMO_ACCOUNTS);
    setTransactions(INITIAL_DEMO_TRANSACTIONS);
    setSummary(calculateFinancialSummary(INITIAL_DEMO_ACCOUNTS, INITIAL_DEMO_TRANSACTIONS));
    setPagination({
      total: INITIAL_DEMO_TRANSACTIONS.length,
      page: 1,
      limit: 15,
      totalPages: Math.ceil(INITIAL_DEMO_TRANSACTIONS.length / 15),
    });

    const initialDates = INITIAL_DEMO_TRANSACTIONS.map((t) => t.date).sort();
    setActiveDataset({
      fileName: 'PhonePe_Sample_Statement_Oct2026.xlsx',
      transactionCount: INITIAL_DEMO_TRANSACTIONS.length,
      dateRange: {
        from: initialDates[0],
        to: initialDates[initialDates.length - 1],
      },
      totalInflow: 75850,
      totalOutflow: 15123.5,
      netCashFlow: 60726.5,
      source: 'demo',
      importedAt: new Date().toISOString(),
    });
    setDatasetInitialized(true);
  };

  const handleOpenUpload = (mode: 'upload' | 'replace' = 'upload') => {
    setExcelUploadMode(mode);
    setExcelModalOpen(true);
  };

  const handleRemoveDataset = () => {
    const custId = customer?.id || 'demo-customer-uuid-001';
    globalVectorStore.clearCustomer(custId);
    setTransactions([]);
    setActiveDataset(null);
    setDocuments([]);
    setLatestAnalysis(null);
    const resetSummary = calculateFinancialSummary(accounts, []);
    setSummary(resetSummary);
    setPagination({
      total: 0,
      page: 1,
      limit: 15,
      totalPages: 1,
    });
    // Explicitly preserves financial profile, commitments, and financial goals!
  };

  const handleExcelImportSuccess = (
    importedCount: number,
    duplicateCount: number,
    newTxList: any[],
    uploadedFileName?: string,
    isReplace?: boolean,
    analysisResult?: AnalysisResult
  ) => {
    const finalFileName = uploadedFileName || 'PhonePe_Statement_Imported.xlsx';
    const custId = customer?.id || 'demo-customer-uuid-001';
    if (analysisResult) {
      setLatestAnalysis(analysisResult);
      // Ingest semantic chunks into customer-isolated vector store for RAG
      const docChunks = chunkFinancialStatement({
        documentId: `doc-${Date.now()}`,
        customerId: custId,
        documentTitle: finalFileName,
        transactions: analysisResult.transactions,
      });
      globalVectorStore.addChunks(custId, docChunks);
    } else if (isReplace) {
      setLatestAnalysis(null);
    }

    if (isDemoSession) {
      const updatedList = isReplace ? [...newTxList] : [...newTxList, ...transactions];
      setTransactions(updatedList);

      const delta = updatedList.reduce((accDelta, t) => accDelta + (t.type === 'credit' ? t.amount : -t.amount), 0);
      const updatedAccounts = accounts.map((acc, i) => {
        if (i === 0) {
          return { ...acc, balance: Number((80000 + delta).toFixed(2)) };
        }
        return acc;
      });
      setAccounts(updatedAccounts);

      const freshSummary = calculateFinancialSummary(updatedAccounts, updatedList);
      setSummary(freshSummary);

      setPagination({
        total: updatedList.length,
        page: 1,
        limit: 15,
        totalPages: Math.max(1, Math.ceil(updatedList.length / 15)),
      });

      // Update active dataset metadata
      if (updatedList.length > 0) {
        const dates = updatedList.map((t) => t.date).filter(Boolean).sort();
        const totalInflow = updatedList
          .filter((t) => t.type === 'credit')
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const totalOutflow = updatedList
          .filter((t) => t.type === 'debit')
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        setActiveDataset({
          fileName: finalFileName,
          transactionCount: updatedList.length,
          dateRange: {
            from: dates[0] || '',
            to: dates[dates.length - 1] || '',
          },
          totalInflow: Number(totalInflow.toFixed(2)),
          totalOutflow: Number(totalOutflow.toFixed(2)),
          netCashFlow: Number((totalInflow - totalOutflow).toFixed(2)),
          source: 'demo',
          importedAt: new Date().toISOString(),
        });
      } else {
        setActiveDataset(null);
      }

      // Synchronize Statement Vault with the newly imported document record
      if (importedCount > 0) {
        const newDoc: StatementDocument = {
          id: `doc-${Date.now()}`,
          customerId: customer?.id || 'demo-customer-uuid-001',
          accountId: updatedAccounts[0]?.id || 'acc-demo-1',
          fileName: finalFileName,
          originalName: finalFileName,
          fileSizeBytes: 24500,
          mimeType: finalFileName.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          checksum: `doc-chk-${Date.now()}`,
          processingStatus: 'completed',
          extractedCount: importedCount + duplicateCount,
          importedCount,
          duplicateCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setDocuments((prev) => (isReplace ? [newDoc] : [newDoc, ...prev]));
      }

      setStatementMetrics((prev) => [
        {
          id: `spm-${Date.now()}`,
          documentName: finalFileName,
          format: finalFileName.endsWith('.csv') ? 'CSV' : 'XLSX',
          uploadedBy: customer?.fullName || 'Demo Customer',
          accountName: updatedAccounts[0]?.accountName || 'Primary Checking',
          extractedCount: importedCount + duplicateCount,
          importedCount,
          duplicateCount,
          parsingTimeMs: 110,
          status: 'completed',
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);

      // Fire dependent analytical recalculations
      setRefreshTrigger((prev) => prev + 1);
    } else {
      handleRefreshAll();
    }
  };

  const handleUpdateCaseStatus = async (caseId: string, status: any, notes?: string) => {
    try {
      await operationsApi.updateCase(caseId, { status, ...(notes && { notes }) });
    } catch (err: any) {
      console.warn('Update case status note:', err.message);
    }
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              status,
              ...(notes && { notes: c.notes ? `${c.notes}\n${notes}` : notes }),
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    );
  };

  const handleUpdateCaseDetails = async (caseId: string, updates: Partial<CaseRecord>) => {
    try {
      await operationsApi.updateCase(caseId, updates);
    } catch (err: any) {
      console.warn('Update case details note:', err.message);
    }
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c))
    );
  };

  const handleCreateCase = async (caseData: any) => {
    try {
      const res = await operationsApi.createCase(caseData);
      if (res?.case) {
        setCases((prev) => [res.case, ...prev]);
        return;
      }
    } catch (err: any) {
      console.warn('Create case API note:', err.message);
    }
    const fallbackCase: any = {
      id: `case-${Date.now()}`,
      caseNumber: `CAS-2026-${String(Date.now()).slice(-4)}`,
      title: caseData.title,
      customerName: caseData.customerName,
      customerId: caseData.customerId || '',
      accountNumberMasked: caseData.accountNumberMasked,
      category: caseData.category,
      priority: caseData.priority,
      status: 'open',
      assignedTo: caseData.assignedTo || 'Unassigned',
      notes: caseData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCases((prev) => [fallbackCase, ...prev]);
  };

  const handleUpdateAlertStatus = async (alertId: string, status: any, note?: string) => {
    try {
      await operationsApi.updateFraudAlert(alertId, { status, ...(note && { investigatorNotes: note }) });
    } catch (err: any) {
      console.warn('Update alert status note:', err.message);
    }
    setFraudAlerts((prev) =>
      prev.map((f) =>
        f.id === alertId ? { ...f, status, ...(note && { investigatorNotes: note }) } : f
      )
    );
  };

  const handleToggleUserStatus = async (userId: string) => {
    if (pendingUserActionIds.has(userId)) return;

    const current = systemUsers.find((u) => u.id === userId);
    if (!current) return;
    const prevStatus = current.status;
    const newStatus = prevStatus === 'active' ? ('suspended' as const) : ('active' as const);

    const updateSeq = Date.now();
    userUpdateSeqRef.current.set(userId, updateSeq);
    setPendingUserActionIds((prev) => new Set(prev).add(userId));
    setAdminNotification(null);

    if (isDemoSession) {
      setSystemUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
      const newAuditLog: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorEmail: customer?.email || 'marcus.vance@admin.vivpay.internal',
        actorRole: 'admin',
        action: 'USER_STATUS_CHANGE',
        resource: `${current.email} (${newStatus})`,
        ipAddress: '10.240.0.12',
        status: 'SUCCESS',
      };
      setAuditLogs((prevLogs) => [newAuditLog, ...prevLogs]);
      setAdminNotification({
        type: 'success',
        message: `User '${current.email}' status successfully changed to ${newStatus}.`,
      });
      setPendingUserActionIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      return;
    }

    try {
      const res = await adminApi.updateUser(userId, { status: newStatus });
      // Ensure rollback cannot overwrite a newer successful update
      if (userUpdateSeqRef.current.get(userId) === updateSeq) {
        const updated = res?.user || { ...current, status: newStatus };
        setSystemUsers((prev) =>
          prev.map((u) => (u.id === userId ? updated : u))
        );
        const newAuditLog: AuditLogEntry = {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorEmail: customer?.email || 'admin@vivpay.internal',
          actorRole: 'admin',
          action: 'USER_STATUS_CHANGE',
          resource: `${current.email} (${newStatus})`,
          ipAddress: '10.240.0.12',
          status: 'SUCCESS',
        };
        setAuditLogs((prevLogs) => [newAuditLog, ...prevLogs]);
        setAdminNotification({
          type: 'success',
          message: `User '${current.email}' is now ${newStatus}.`,
        });
      }
    } catch (err: any) {
      // Revert / rollback reliably
      if (userUpdateSeqRef.current.get(userId) === updateSeq) {
        setSystemUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: prevStatus } : u))
        );
        const errorMessage = err?.code === 'CANNOT_LOCKOUT_LAST_ADMIN'
          ? 'Cannot suspend the last active Administrator account. Promote another active administrator first to prevent system lockout.'
          : err?.message || 'Failed to update user status. Server or network error.';
        setAdminNotification({
          type: 'error',
          message: errorMessage,
        });
      }
      throw err;
    } finally {
      setPendingUserActionIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleUpdateUserRole = async (userId: string, role: SystemUser['role'], department?: string) => {
    if (pendingUserActionIds.has(userId)) return;

    const targetUser = systemUsers.find((u) => u.id === userId);
    if (!targetUser) return;
    const prevRole = targetUser.role;
    const prevDept = targetUser.department;

    const updateSeq = Date.now();
    userUpdateSeqRef.current.set(userId, updateSeq);
    setPendingUserActionIds((prev) => new Set(prev).add(userId));
    setAdminNotification(null);

    if (isDemoSession) {
      setSystemUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role, department: department !== undefined ? department : u.department } : u
        )
      );
      const newAuditLog: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorEmail: customer?.email || 'marcus.vance@admin.vivpay.internal',
        actorRole: 'admin',
        action: 'USER_ROLE_ASSIGNMENT',
        resource: `${targetUser.email} (${role})`,
        ipAddress: '10.240.0.12',
        status: 'SUCCESS',
      };
      setAuditLogs((prevLogs) => [newAuditLog, ...prevLogs]);
      setAdminNotification({
        type: 'success',
        message: `Role for '${targetUser.email}' updated to ${role}.`,
      });
      setPendingUserActionIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      return;
    }

    try {
      const res = await adminApi.updateUser(userId, { role, department });
      if (userUpdateSeqRef.current.get(userId) === updateSeq) {
        const updated = res?.user || {
          ...targetUser,
          role,
          department: department !== undefined ? department : targetUser.department,
        };
        setSystemUsers((prev) =>
          prev.map((u) => (u.id === userId ? updated : u))
        );
        const newAuditLog: AuditLogEntry = {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorEmail: customer?.email || 'admin@vivpay.internal',
          actorRole: 'admin',
          action: 'USER_ROLE_ASSIGNMENT',
          resource: `${targetUser.email} (${role})`,
          ipAddress: '10.240.0.12',
          status: 'SUCCESS',
        };
        setAuditLogs((prevLogs) => [newAuditLog, ...prevLogs]);
        setAdminNotification({
          type: 'success',
          message: `Role for '${targetUser.email}' successfully updated to ${role.toUpperCase()}.`,
        });
      }
    } catch (err: any) {
      if (userUpdateSeqRef.current.get(userId) === updateSeq) {
        setSystemUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, role: prevRole, department: prevDept } : u
          )
        );
        const errorMessage = err?.code === 'CANNOT_LOCKOUT_LAST_ADMIN'
          ? 'Cannot demote the last active Administrator account. Promote another active administrator first to prevent system lockout.'
          : err?.message || 'Failed to update user role. Server or network error.';
        setAdminNotification({
          type: 'error',
          message: errorMessage,
        });
      }
      throw err;
    } finally {
      setPendingUserActionIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleProvisionUser = async (data: {
    authUserId?: string;
    email?: string;
    name?: string;
    role: 'employee' | 'admin';
    department?: string;
  }) => {
    const res = await adminApi.provisionUser(data);
    if (res.user) {
      setSystemUsers((prev) => {
        const filtered = prev.filter((u) => u.id !== res.user.id);
        return [res.user, ...filtered];
      });
      const newAuditLog: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorEmail: customer?.email || 'admin@vivpay.internal',
        actorRole: 'admin',
        action: 'USER_ROLE_ASSIGNMENT',
        resource: `${res.user.email} -> ${res.user.role.toUpperCase()} (${res.user.department || 'N/A'})`,
        ipAddress: '10.240.0.12',
        status: 'SUCCESS',
      };
      setAuditLogs((prevLogs) => [newAuditLog, ...prevLogs]);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-800">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Initializing VivPay Financial Twin...</p>
        </div>
      </div>
    );
  }

  // RENDER UNREGISTERED PUBLIC LANDING EXPERIENCE
  if (!customer) {
    return (
      <div className="min-h-screen bg-vivpay-gradient text-slate-900 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
        <Navbar
          customer={null}
          authoritativeRole="customer"
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={setSelectedAccountId}
          onOpenAskViv={() => setAskVivOpen(true)}
          onLogout={handleLogout}
          onOpenAuth={() => handleOpenPortalLogin('customer', 'login')}
          onOpenPortalAuth={handleOpenPortalLogin}
          activeRole={activeRole}
          onSelectRole={(r) => handleSelectRole(r)}
          isDemoSession={false}
          onScrollToSection={(sec) => {
            const el = document.getElementById(sec);
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <SupabaseSetupBanner status={supabaseStatus} onRefresh={checkHealthAndAuth} />

          <LandingHero
            onGetStarted={() => handleOpenPortalLogin('customer', 'register')}
            onTryDemo={handleLaunchDemoRole}
            onLogin={(portal) => handleOpenPortalLogin(portal || 'customer', 'login')}
            onSelectPortal={handleOpenPortalLogin}
          />
        </main>

        <AuthModal
          isOpen={authModalOpen}
          defaultMode={authDefaultMode}
          portalRole={authPortalRole}
          onSelectPortalRole={setAuthPortalRole}
          prefillEmail={authPrefillEmail}
          initialSuccess={authInitialSuccess}
          initialError={authInitialError}
          onSuccess={(profile, role) => {
            setCustomer(profile);
            const destinationRole: UserRole = (role === 'admin' || role === 'employee') ? role : 'customer';
            setIsDemoSession(false);
            setActiveRole(destinationRole);
            setAuthoritativeRole(destinationRole);
            setAuthModalOpen(false);
            setAuthInitialSuccess(null);
            setAuthInitialError(null);
            setRoleAccessError(null);
            const targetPath = destinationRole === 'admin' ? '/admin' : destinationRole === 'employee' ? '/employee' : '/';
            navigate(targetPath);
            handleRefreshAll();
          }}
          onClose={() => {
            setAuthModalOpen(false);
            setAuthInitialSuccess(null);
            setAuthInitialError(null);
            if (!customer && !isDemoSession && currentPath.startsWith('/login')) {
              window.history.replaceState(null, '', '/');
              setCurrentPath('/');
            }
          }}
          onSelectDemoRole={(r) => handleLaunchDemoRole(r)}
          onNavigate={navigate}
        />
      </div>
    );
  }

  // RENDER AUTHENTICATED / DEMO WORKSPACE WITH PERSISTENT SIDEBAR
  const selectedAccountObj = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="min-h-screen bg-vivpay-gradient text-slate-900 flex font-sans selection:bg-purple-500 selection:text-white">
      {/* Persistent Left Sidebar Matching Lovable Reference Design */}
      <Sidebar
        customer={customer}
        activeRole={activeRole}
        authoritativeRole={authoritativeRole}
        onSelectRole={handleSelectRole}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeEmployeeTab={activeEmployeeTab}
        onSelectEmployeeTab={setActiveEmployeeTab}
        activeAdminTab={activeAdminTab}
        onSelectAdminTab={setActiveAdminTab}
        transactionCount={pagination.total || transactions.length}
        documentCount={documents.length}
        isDemoSession={isDemoSession}
        onOpenUpload={() => setExcelModalOpen(true)}
        onOpenAskViv={() => setAskVivOpen(true)}
        onLogout={handleLogout}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Workspace Canvas */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Sticky Top Header Bar */}
        <header className="h-20 glass-nav sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Left: Mobile Toggle & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl neu-subtle text-[#64748B] hover:text-[#172B4D] cursor-pointer"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
              <span className="text-[#172B4D] font-extrabold hidden sm:inline">VivPay</span>
              <span className="text-[#DCE7F6] hidden sm:inline">/</span>
              <span className="capitalize text-[#172B4D] bg-[#EAF3FF] px-2.5 py-0.5 rounded-full border border-[#5878FF]/20 font-bold">
                {activeRole === 'customer'
                  ? (activeTab === 'profile'
                      ? 'Financial Profile & Identity'
                      : activeTab === 'twin'
                      ? 'Financial Twin'
                      : activeTab === 'overview'
                      ? 'Financial Overview'
                      : activeTab === 'vault'
                      ? 'Statement Vault'
                      : activeTab === 'analytics'
                      ? 'Spending Analytics'
                      : 'Ledger Transactions')
                  : activeRole === 'employee'
                  ? `Operations / ${
                      activeEmployeeTab === 'overview'
                        ? 'Overview'
                        : activeEmployeeTab === 'transactions'
                        ? 'Surveillance & Monitoring'
                        : activeEmployeeTab === 'fraud'
                        ? 'Fraud & AML Alerts'
                        : activeEmployeeTab === 'investigations'
                        ? 'Forensic Investigations'
                        : activeEmployeeTab === 'cases'
                        ? 'Service Cases'
                        : activeEmployeeTab === 'customers'
                        ? 'Customer Profiles'
                        : activeEmployeeTab === 'statements'
                        ? 'Statement Processing'
                        : activeEmployeeTab === 'analytics'
                        ? 'Operational Analytics'
                        : 'Knowledge Assistant'
                    }`
                  : `Admin / ${
                      activeAdminTab === 'overview'
                        ? 'Governance Overview'
                        : activeAdminTab === 'users'
                        ? 'User & Role Management'
                        : activeAdminTab === 'knowledge'
                        ? 'Knowledge & Document Management'
                        : activeAdminTab === 'audit'
                        ? 'Security Audit Activity'
                        : activeAdminTab === 'config'
                        ? 'System & Integration Configuration'
                        : 'Access Control & Privacy Boundaries'
                    }`}
              </span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5">
            {/* Account Selector Dropdown in Customer Role */}
            {activeRole === 'customer' && accounts.length > 0 && (
              <div className="hidden md:flex items-center gap-1.5 neu-subtle rounded-xl px-2.5 py-1.5">
                <Wallet className="w-4 h-4 text-[#5878FF]" />
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="bg-transparent text-xs text-[#172B4D] font-semibold focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all">All Accounts ({accounts.length})</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName} ({customer.currency === 'INR' ? '₹' : '$'}{acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setExcelModalOpen(true)}
              className="btn-sky-primary text-white text-xs font-semibold px-3.5 py-2 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload Statement</span>
              <span className="sm:hidden">Upload</span>
            </button>

            <button
              onClick={() => setAskVivOpen(true)}
              className="glass-pill flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 hover:bg-[#EAF3FF] text-[#172B4D] transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#5878FF]" />
              <span className="hidden sm:inline">Ask Viv</span>
            </button>

            <button
              onClick={handleRefreshAll}
              className="p-2 text-[#64748B] hover:text-[#172B4D] neu-subtle rounded-xl transition-colors cursor-pointer"
              title="Sync live records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Supabase Diagnostics Banner */}
          <SupabaseSetupBanner status={supabaseStatus} onRefresh={checkHealthAndAuth} />

          {/* Role Access Denied Error Banner */}
          {roleAccessError && (
            <div className="bg-rose-50 border border-rose-200/90 px-4 py-3 rounded-2xl flex items-center justify-between text-xs text-rose-900 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="leading-relaxed">{roleAccessError.message}</span>
              </div>
              <button
                onClick={() => setRoleAccessError(null)}
                className="text-rose-600 hover:text-rose-800 font-bold p-1 cursor-pointer shrink-0 ml-3"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Demo Mode Notice Banner */}
          {isDemoSession && (
            <div className="bg-purple-50 border border-purple-200/90 px-4 py-3 rounded-2xl flex items-center justify-between text-xs text-purple-900 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                <span>
                  <strong>Interactive Demo Workspace Active ({activeRole.toUpperCase()}):</strong> Ingest bank statements, simulate cash flow, and inspect role views.
                </span>
              </div>
              <button
                onClick={() => {
                  setAuthDefaultMode('login');
                  setAuthModalOpen(true);
                }}
                className="text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
              >
                Switch to Live Supabase
              </button>
            </div>
          )}

          {/* CUSTOMER DASHBOARD EXPERIENCE */}
          {activeRole === 'customer' && (
            <>
              {/* Active Statement Dataset Banner & Controls */}
              <DatasetControlBanner
                dataset={activeDataset}
                currency={customer.currency}
                isDemo={isDemoSession}
                onOpenUpload={() => handleOpenUpload('upload')}
                onOpenReplace={() => handleOpenUpload('replace')}
                onRemoveDataset={handleRemoveDataset}
              />

              {/* Dashboard Navigation Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === 'overview'
                        ? 'bg-purple-100/70 text-purple-800 border border-purple-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Overview</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === 'transactions'
                        ? 'bg-purple-100/70 text-purple-800 border border-purple-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Transactions</span>
                    {transactions.length > 0 && (
                      <span className="text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded-full font-bold">
                        {pagination.total || transactions.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('vault')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === 'vault'
                        ? 'bg-purple-100/70 text-purple-800 border border-purple-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Statement Vault</span>
                    {documents.length > 0 && (
                      <span className="text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded-full font-bold">
                        {documents.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === 'analytics'
                        ? 'bg-purple-100/70 text-purple-800 border border-purple-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <PieChart className="w-3.5 h-3.5" />
                    <span>Spending Analytics</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('twin')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === 'twin'
                        ? 'bg-purple-100/70 text-purple-800 border border-purple-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Financial Twin</span>
                    <span className="text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded-full font-bold">
                      AI
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === 'profile'
                        ? 'bg-purple-100/70 text-purple-800 border border-purple-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Financial Profile</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                      Identity
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => handleOpenUpload('upload')}
                    className="btn-primary-gradient text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Excel / CSV</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <KPICards summary={summary} loading={tableLoading} transactions={analyticsTransactions} />
                  <SpendingAnalytics
                    selectedAccountId={selectedAccountId}
                    onSelectAccount={(id) => setSelectedAccountId(id)}
                    currency={customer.currency}
                    refreshTrigger={refreshTrigger}
                    transactions={analyticsTransactions}
                    accounts={accounts}
                    summary={summary}
                    isDemo={isDemoSession}
                    analysis={latestAnalysis}
                    onRefreshAccounts={handleRefreshAll}
                    onAccountCreated={handleAccountCreated}
                    onAccountUpdated={handleAccountUpdated}
                    onAccountDeleted={handleAccountDeleted}
                    onNavigateToLedger={(f) => {
                      setActiveTab('transactions');
                      if (f?.categoryId) setFilters((prev) => ({ ...prev, categoryId: f.categoryId }));
                      if (f?.search) setFilters((prev) => ({ ...prev, search: f.search }));
                    }}
                  />
                  <TransactionTable
                    transactions={transactions}
                    categories={categories}
                    accounts={accounts}
                    selectedAccountId={selectedAccountId}
                    loading={tableLoading}
                    pagination={pagination}
                    onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
                    onFilterChange={(f) => setFilters(f)}
                    onRefresh={handleRefreshAll}
                    currency={customer.currency}
                  />
                </div>
              )}

              {/* Tab 2: Transactions */}
              {activeTab === 'transactions' && (
                <TransactionTable
                  transactions={transactions}
                  categories={categories}
                  accounts={accounts}
                  selectedAccountId={selectedAccountId}
                  loading={tableLoading}
                  pagination={pagination}
                  onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
                  onFilterChange={(f) => setFilters(f)}
                  onRefresh={handleRefreshAll}
                  currency={customer.currency}
                />
              )}

              {/* Tab 3: Statement Vault */}
              {activeTab === 'vault' && (
                <StatementVault
                  documents={documents}
                  accounts={accounts}
                  selectedAccountId={selectedAccountId}
                  onRefresh={handleRefreshAll}
                  currency={customer.currency}
                  activeDataset={activeDataset}
                  onOpenReplace={() => handleOpenUpload('replace')}
                  onRemoveDataset={handleRemoveDataset}
                  onOpenUploadModal={() => handleOpenUpload('upload')}
                />
              )}

              {/* Tab 4: Spending Analytics */}
              {activeTab === 'analytics' && (
                <SpendingAnalytics
                  selectedAccountId={selectedAccountId}
                  onSelectAccount={(id) => setSelectedAccountId(id)}
                  currency={customer.currency}
                  refreshTrigger={refreshTrigger}
                  transactions={analyticsTransactions}
                  accounts={accounts}
                  summary={summary}
                  isDemo={isDemoSession}
                  analysis={latestAnalysis}
                  onRefreshAccounts={handleRefreshAll}
                  onAccountCreated={handleAccountCreated}
                  onAccountUpdated={handleAccountUpdated}
                  onAccountDeleted={handleAccountDeleted}
                  onNavigateToLedger={(f) => {
                    setActiveTab('transactions');
                    if (f?.categoryId) setFilters((prev) => ({ ...prev, categoryId: f.categoryId }));
                    if (f?.search) setFilters((prev) => ({ ...prev, search: f.search }));
                  }}
                />
              )}

              {/* Tab 5: Financial Twin & Simulation */}
              {activeTab === 'twin' && (
                <FinancialTwin
                  summary={summary}
                  accounts={accounts}
                  transactions={analyticsTransactions}
                  currency={customer.currency}
                  onOpenUpload={() => setExcelModalOpen(true)}
                  onNavigateTab={(tab) => setActiveTab(tab as any)}
                />
              )}

              {/* Tab 6: Financial Profile & Identity */}
              {activeTab === 'profile' && (
                <FinancialProfile
                  role={activeRole}
                  transactions={analyticsTransactions}
                  onOpenUpload={() => setExcelModalOpen(true)}
                />
              )}
            </>
          )}

          {/* EMPLOYEE / OPERATIONS WORKSPACE */}
          {activeRole === 'employee' && (
            <EmployeeDashboard
              cases={cases}
              fraudAlerts={fraudAlerts}
              statementMetrics={statementMetrics}
              activeTab={activeEmployeeTab}
              onSelectTab={setActiveEmployeeTab}
              onUpdateCaseStatus={handleUpdateCaseStatus}
              onUpdateAlertStatus={handleUpdateAlertStatus}
              onUpdateCaseDetails={handleUpdateCaseDetails}
              onCreateCase={handleCreateCase}
            />
          )}

          {/* ADMIN GOVERNANCE WORKSPACE */}
          {activeRole === 'admin' && (
            <AdminDashboard
              systemUsers={systemUsers}
              auditLogs={auditLogs}
              supabaseStatus={supabaseStatus}
              activeTab={activeAdminTab}
              onSelectTab={setActiveAdminTab}
              onRefreshHealth={checkHealthAndAuth}
              onToggleUserStatus={handleToggleUserStatus}
              onUpdateUserRole={handleUpdateUserRole}
              onProvisionUser={handleProvisionUser}
              pendingUserIds={pendingUserActionIds}
              adminNotification={adminNotification}
              onDismissNotification={() => setAdminNotification(null)}
            />
          )}
        </main>
      </div>

      {/* Excel / CSV Ingestion Wizard Modal */}
      <ExcelUploadModal
        isOpen={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        accounts={accounts}
        selectedAccountId={selectedAccountId !== 'all' ? selectedAccountId : undefined}
        isDemo={isDemoSession}
        existingTransactions={transactions}
        onImportSuccess={handleExcelImportSuccess}
        initialMode={excelUploadMode}
        currentDataset={activeDataset}
        currency={customer?.currency || 'INR'}
      />


      {/* Ask Viv AI Copilot Modal */}
      <AskVivModal
        isOpen={askVivOpen}
        onClose={() => setAskVivOpen(false)}
        customer={customer}
        isDemo={isDemoSession}
        transactions={transactions}
        accounts={accounts}
        summary={summary}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        defaultMode={authDefaultMode}
        portalRole={authPortalRole}
        onSelectPortalRole={setAuthPortalRole}
        prefillEmail={authPrefillEmail}
        initialSuccess={authInitialSuccess}
        initialError={authInitialError}
        onSuccess={(profile, role) => {
          setCustomer(profile);
          const targetRole: UserRole = (role === 'admin' || role === 'employee') ? role : 'customer';
          setIsDemoSession(false);
          setActiveRole(targetRole);
          setAuthoritativeRole(targetRole);
          setAuthModalOpen(false);
          setAuthInitialSuccess(null);
          setAuthInitialError(null);
          setRoleAccessError(null);
          const destinationPath = targetRole === 'admin' ? '/admin' : targetRole === 'employee' ? '/employee' : '/';
          navigate(destinationPath);
          handleRefreshAll();
        }}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthInitialSuccess(null);
          setAuthInitialError(null);
        }}
        onSelectDemoRole={(r) => handleLaunchDemoRole(r)}
        onNavigate={navigate}
      />
    </div>
  );
}
