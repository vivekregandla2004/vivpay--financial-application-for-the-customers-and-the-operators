/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CaseRecord {
  id: string;
  caseNumber: string;
  title: string;
  customerName: string;
  customerId: string;
  accountNumberMasked: string;
  category: 'Dispute' | 'KYC Verification' | 'Suspected Fraud' | 'Statement Inquiry' | 'Limit Increase';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'escalated' | 'resolved' | 'closed';
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export interface FraudAlert {
  id: string;
  alertId: string;
  customerName: string;
  customerId: string;
  amount: number;
  currency: string;
  merchant: string;
  riskScore: number; // 0 - 100
  triggerReason: string;
  detectedAt: string;
  status: 'pending_review' | 'flagged' | 'cleared' | 'blocked';
  investigatorNotes?: string;
}

export interface StatementProcessingMetric {
  id: string;
  documentName: string;
  format: 'CSV' | 'XLSX' | 'PDF';
  uploadedBy: string;
  accountName: string;
  extractedCount: number;
  importedCount: number;
  duplicateCount: number;
  parsingTimeMs: number;
  status: 'completed' | 'processing' | 'failed' | 'partially_completed';
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  actorRole: 'admin' | 'employee' | 'customer';
  action: string;
  resource: string;
  ipAddress: string;
  status: 'SUCCESS' | 'DENIED' | 'FLAGGED';
}

export type UserRole = 'admin' | 'employee' | 'customer';

export interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'employee' | 'customer';
  department?: string;
  status: 'active' | 'suspended' | 'pending';
  lastActive: string;
  createdAt: string;
}

export interface InvestigationRecord {
  id: string;
  caseNumber: string;
  title: string;
  targetCustomerId: string;
  targetCustomerName: string;
  linkedAlertId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'escalated' | 'resolved';
  leadInvestigator: string;
  evidenceNotes: string[];
  flaggedAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerOpsRecord {
  id: string;
  name: string;
  email: string;
  accountNumberMasked: string;
  kycStatus: 'verified' | 'pending' | 'flagged';
  riskTier: 'low' | 'medium' | 'high';
  linkedAccountsCount: number;
  statementsCount: number;
  openCasesCount: number;
  totalBalance: number;
  currency: string;
  lastActive: string;
  createdAt: string;
}

export interface MonitoredTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  accountName: string;
  accountNumberMasked: string;
  customerName: string;
  customerId: string;
  categoryName: string;
  riskScore: number;
  riskFlag?: 'high_risk' | 'velocity_anomaly' | 'international' | 'normal';
  status: 'cleared' | 'flagged' | 'under_review';
  currency: string;
}

export interface OperationalAnalyticsData {
  ingestionSuccessRate: number;
  totalExtractedTxs: number;
  totalImportedTxs: number;
  totalDuplicatesFiltered: number;
  duplicateRejectionRate: number;
  avgParsingLatencyMs: number;
  fraudTriageRate: number;
  slaAdherenceRate: number;
  riskDistribution: { tier: string; count: number; percentage: number }[];
  categoryAnomalies: { category: string; count: number; flaggedVolume: number }[];
  backlogMetrics?: {
    totalCases: number;
    openCases: number;
    escalatedCases: number;
    resolvedCases: number;
    unassignedCases: number;
    assignedCases: number;
  };
}
