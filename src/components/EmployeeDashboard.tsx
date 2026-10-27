/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Inbox,
  AlertTriangle,
  FileCheck2,
  Clock,
  Search,
  CheckCircle,
  Filter,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  TrendingUp,
  UserCheck,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
  Receipt,
  FolderKanban,
  Users,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import {
  CaseRecord,
  FraudAlert,
  StatementProcessingMetric,
  InvestigationRecord,
  CustomerOpsRecord,
  MonitoredTransaction,
  OperationalAnalyticsData,
} from '../types/operations.ts';
import {
  INITIAL_DEMO_INVESTIGATIONS,
  INITIAL_DEMO_CUSTOMERS_OPS,
  INITIAL_DEMO_MONITORED_TRANSACTIONS,
  INITIAL_DEMO_OPERATIONAL_ANALYTICS,
} from '../services/demoData.ts';
import { operationsApi } from '../services/api.ts';

// Import the 9 Employee Workspace Pages
import { EmployeeOverviewPage } from './employee/EmployeeOverviewPage.tsx';
import { TransactionMonitoringPage } from './employee/TransactionMonitoringPage.tsx';
import { FraudAlertsPage } from './employee/FraudAlertsPage.tsx';
import { InvestigationsPage } from './employee/InvestigationsPage.tsx';
import { ServiceCasesPage } from './employee/ServiceCasesPage.tsx';
import { CustomersOpsPage } from './employee/CustomersOpsPage.tsx';
import { StatementProcessingPage } from './employee/StatementProcessingPage.tsx';
import { OperationalAnalyticsPage } from './employee/OperationalAnalyticsPage.tsx';
import { KnowledgeAssistantPage } from './employee/KnowledgeAssistantPage.tsx';

export type EmployeeWorkspaceTab =
  | 'overview'
  | 'transactions'
  | 'fraud'
  | 'investigations'
  | 'cases'
  | 'customers'
  | 'statements'
  | 'analytics'
  | 'knowledge';

interface EmployeeDashboardProps {
  cases: CaseRecord[];
  fraudAlerts: FraudAlert[];
  statementMetrics: StatementProcessingMetric[];
  activeTab?: EmployeeWorkspaceTab;
  onSelectTab?: (tab: EmployeeWorkspaceTab) => void;
  onUpdateCaseStatus?: (caseId: string, status: CaseRecord['status'], notes?: string) => void;
  onUpdateAlertStatus?: (alertId: string, status: FraudAlert['status'], note?: string) => void;
  onUpdateCaseDetails?: (caseId: string, updates: Partial<CaseRecord>) => void;
  onCreateCase?: (caseData: any) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({
  cases,
  fraudAlerts,
  statementMetrics,
  activeTab: externalActiveTab,
  onSelectTab: externalOnSelectTab,
  onUpdateCaseStatus,
  onUpdateAlertStatus,
  onUpdateCaseDetails,
  onCreateCase,
}) => {
  const [internalTab, setInternalTab] = useState<EmployeeWorkspaceTab>('overview');
  const activeTab = externalActiveTab || internalTab;

  const handleSelectTab = (tab: EmployeeWorkspaceTab) => {
    if (externalOnSelectTab) {
      externalOnSelectTab(tab);
    } else {
      setInternalTab(tab);
    }
  };

  // State for investigations, operational customers, and monitored transactions
  const [investigations, setInvestigations] = useState<InvestigationRecord[]>(INITIAL_DEMO_INVESTIGATIONS);
  const [customers, setCustomers] = useState<CustomerOpsRecord[]>(INITIAL_DEMO_CUSTOMERS_OPS);
  const [monitoredTxs, setMonitoredTxs] = useState<MonitoredTransaction[]>(INITIAL_DEMO_MONITORED_TRANSACTIONS);
  const [analytics, setAnalytics] = useState<OperationalAnalyticsData>(INITIAL_DEMO_OPERATIONAL_ANALYTICS);

  // Sync with operations API if available
  useEffect(() => {
    let isMounted = true;
    async function syncData() {
      try {
        const invRes = await operationsApi.getInvestigations();
        if (isMounted && invRes.investigations) setInvestigations(invRes.investigations);
      } catch {
        // use in-memory fallback
      }
      try {
        const custRes = await operationsApi.getCustomers();
        if (isMounted && custRes.customers) setCustomers(custRes.customers);
      } catch {
        // use in-memory fallback
      }
      try {
        const txRes = await operationsApi.getMonitoredTransactions();
        if (isMounted && txRes.transactions) setMonitoredTxs(txRes.transactions);
      } catch {
        // use in-memory fallback
      }
      try {
        const anaRes = await operationsApi.getAnalytics();
        if (isMounted && anaRes.analytics) setAnalytics(anaRes.analytics);
      } catch {
        // use in-memory fallback
      }
    }

    syncData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handlers
  const handleCreateInvestigation = async (data: {
    title: string;
    targetCustomerId: string;
    targetCustomerName: string;
    linkedAlertId?: string;
    priority: InvestigationRecord['priority'];
    leadInvestigator: string;
    initialEvidence?: string;
    flaggedAmount?: number;
    currency?: string;
  }) => {
    try {
      const res = await operationsApi.createInvestigation(data);
      if (res.investigation) {
        setInvestigations((prev) => [res.investigation, ...prev]);
        return;
      }
    } catch {
      // In-memory fallback
    }

    const newInv: InvestigationRecord = {
      id: `inv-${Date.now()}`,
      caseNumber: `INV-2026-${String(investigations.length + 41).padStart(3, '0')}`,
      title: data.title,
      targetCustomerId: data.targetCustomerId,
      targetCustomerName: data.targetCustomerName,
      linkedAlertId: data.linkedAlertId,
      priority: data.priority,
      status: 'open',
      leadInvestigator: data.leadInvestigator,
      evidenceNotes: data.initialEvidence ? [data.initialEvidence] : [],
      flaggedAmount: data.flaggedAmount || 0,
      currency: data.currency || 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setInvestigations((prev) => [newInv, ...prev]);
  };

  const handleUpdateInvestigation = async (id: string, updates: Partial<InvestigationRecord>) => {
    try {
      await operationsApi.updateInvestigation(id, updates);
    } catch {
      // fallback
    }
    setInvestigations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i))
    );
  };

  const handleAddEvidenceNote = async (id: string, note: string) => {
    try {
      await operationsApi.addEvidenceNote(id, note);
    } catch {
      // fallback
    }
    const timestamp = new Date().toISOString().substring(0, 19).replace('T', ' ');
    setInvestigations((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, evidenceNotes: [...i.evidenceNotes, `[${timestamp}] ${note}`], updatedAt: new Date().toISOString() }
          : i
      )
    );
  };

  const handleUpdateTxStatus = async (id: string, status: MonitoredTransaction['status']) => {
    try {
      await operationsApi.updateMonitoredTransactionStatus(id, status);
    } catch {
      // fallback
    }
    setMonitoredTxs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t))
    );
  };

  const handleEscalateTxToInvestigation = (tx: MonitoredTransaction) => {
    handleCreateInvestigation({
      title: `Escalated Suspicious Transaction: ${tx.description}`,
      targetCustomerId: tx.customerId,
      targetCustomerName: tx.customerName,
      priority: tx.riskScore >= 75 ? 'critical' : 'high',
      leadInvestigator: 'Sarah Chen',
      initialEvidence: `Triggered from monitored transaction ${tx.id}. Amount: ${tx.currency} ${tx.amount}. Risk Score: ${tx.riskScore}/100.`,
      flaggedAmount: tx.amount,
      currency: tx.currency,
    });
    handleSelectTab('investigations');
  };

  const handleEscalateAlertToInvestigation = (alert: FraudAlert) => {
    handleCreateInvestigation({
      title: `AML Dossier: ${alert.triggerReason.slice(0, 40)}...`,
      targetCustomerId: alert.customerId,
      targetCustomerName: alert.customerName,
      linkedAlertId: alert.alertId,
      priority: alert.riskScore >= 75 ? 'critical' : 'high',
      leadInvestigator: 'Sarah Chen',
      initialEvidence: `Alert ${alert.alertId} flagged at ${alert.merchant} for $${alert.amount}. Trigger: ${alert.triggerReason}.`,
      flaggedAmount: alert.amount,
      currency: alert.currency,
    });
    handleSelectTab('investigations');
  };

  const tabList = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard, badge: null },
    { id: 'transactions' as const, label: 'Transactions', icon: Receipt, badge: monitoredTxs.length },
    { id: 'fraud' as const, label: 'Fraud Alerts', icon: AlertTriangle, badge: fraudAlerts.filter((f) => f.status === 'flagged').length },
    { id: 'investigations' as const, label: 'Investigations', icon: FolderKanban, badge: investigations.filter((i) => i.status !== 'resolved').length },
    { id: 'cases' as const, label: 'Service Cases', icon: Inbox, badge: cases.filter((c) => c.status === 'open' || c.status === 'investigating').length },
    { id: 'customers' as const, label: 'Customers', icon: Users, badge: null },
    { id: 'statements' as const, label: 'Statement Processing', icon: FileSpreadsheet, badge: statementMetrics.length },
    { id: 'analytics' as const, label: 'Operational Analytics', icon: BarChart3, badge: null },
    { id: 'knowledge' as const, label: 'Knowledge Assistant', icon: Sparkles, badge: 'RAG' },
  ];

  return (
    <div className="space-y-6 text-left">
      {/* 9 Tab Navigation Bar */}
      <div className="border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          {tabList.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-purple-100/80 text-purple-800 border border-purple-200 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-700' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-purple-200 text-purple-900'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Selected Page */}
      {activeTab === 'overview' && (
        <EmployeeOverviewPage
          cases={cases}
          fraudAlerts={fraudAlerts}
          statementMetrics={statementMetrics}
          investigations={investigations}
          onNavigateTab={handleSelectTab}
          onUpdateAlertStatus={onUpdateAlertStatus}
          onUpdateCaseStatus={onUpdateCaseStatus}
        />
      )}

      {activeTab === 'transactions' && (
        <TransactionMonitoringPage
          transactions={monitoredTxs}
          onUpdateStatus={handleUpdateTxStatus}
          onEscalateToInvestigation={handleEscalateTxToInvestigation}
        />
      )}

      {activeTab === 'fraud' && (
        <FraudAlertsPage
          alerts={fraudAlerts}
          onUpdateAlertStatus={onUpdateAlertStatus}
          onEscalateAlert={handleEscalateAlertToInvestigation}
        />
      )}

      {activeTab === 'investigations' && (
        <InvestigationsPage
          investigations={investigations}
          customers={customers}
          onCreateInvestigation={handleCreateInvestigation}
          onUpdateInvestigation={handleUpdateInvestigation}
          onAddEvidenceNote={handleAddEvidenceNote}
        />
      )}

      {activeTab === 'cases' && (
        <ServiceCasesPage
          cases={cases}
          onUpdateCaseStatus={onUpdateCaseStatus}
          onUpdateCaseDetails={onUpdateCaseDetails}
          onCreateCase={onCreateCase}
        />
      )}

      {activeTab === 'customers' && (
        <CustomersOpsPage customers={customers} />
      )}

      {activeTab === 'statements' && (
        <StatementProcessingPage metrics={statementMetrics} />
      )}

      {activeTab === 'analytics' && (
        <OperationalAnalyticsPage analytics={analytics} />
      )}

      {activeTab === 'knowledge' && (
        <KnowledgeAssistantPage />
      )}
    </div>
  );
};
