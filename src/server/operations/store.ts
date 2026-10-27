/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CaseRecord,
  FraudAlert,
  StatementProcessingMetric,
  InvestigationRecord,
  CustomerOpsRecord,
  MonitoredTransaction,
  OperationalAnalyticsData,
} from '../../types/operations.ts';
import {
  INITIAL_DEMO_CASES,
  INITIAL_DEMO_FRAUD_ALERTS,
  INITIAL_DEMO_STATEMENT_METRICS,
  INITIAL_DEMO_INVESTIGATIONS,
  INITIAL_DEMO_CUSTOMERS_OPS,
  INITIAL_DEMO_MONITORED_TRANSACTIONS,
  INITIAL_DEMO_OPERATIONAL_ANALYTICS,
} from '../../services/demoData.ts';

class OperationsStore {
  private cases: CaseRecord[] = [...INITIAL_DEMO_CASES];
  private fraudAlerts: FraudAlert[] = [...INITIAL_DEMO_FRAUD_ALERTS];
  private statementMetrics: StatementProcessingMetric[] = [...INITIAL_DEMO_STATEMENT_METRICS];
  private investigations: InvestigationRecord[] = [...INITIAL_DEMO_INVESTIGATIONS];
  private customers: CustomerOpsRecord[] = [...INITIAL_DEMO_CUSTOMERS_OPS];
  private monitoredTransactions: MonitoredTransaction[] = [...INITIAL_DEMO_MONITORED_TRANSACTIONS];

  // Cases
  public getCases(): CaseRecord[] {
    return [...this.cases];
  }

  public getCaseById(id: string): CaseRecord | undefined {
    return this.cases.find((c) => c.id === id);
  }

  public updateCase(id: string, updates: Partial<CaseRecord>): CaseRecord {
    const idx = this.cases.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Case with ID ${id} not found.`);
    const updated: CaseRecord = {
      ...this.cases[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.cases[idx] = updated;
    return updated;
  }

  // Fraud Alerts
  public getFraudAlerts(): FraudAlert[] {
    return [...this.fraudAlerts];
  }

  public getFraudAlertById(id: string): FraudAlert | undefined {
    return this.fraudAlerts.find((f) => f.id === id);
  }

  public updateFraudAlert(id: string, updates: Partial<FraudAlert>): FraudAlert {
    const idx = this.fraudAlerts.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error(`Fraud alert with ID ${id} not found.`);
    const updated: FraudAlert = {
      ...this.fraudAlerts[idx],
      ...updates,
    };
    this.fraudAlerts[idx] = updated;
    return updated;
  }

  // Investigations
  public getInvestigations(): InvestigationRecord[] {
    return [...this.investigations];
  }

  public getInvestigationById(id: string): InvestigationRecord | undefined {
    return this.investigations.find((inv) => inv.id === id);
  }

  public createInvestigation(data: {
    title: string;
    targetCustomerId: string;
    targetCustomerName: string;
    linkedAlertId?: string;
    priority: InvestigationRecord['priority'];
    leadInvestigator: string;
    initialEvidence?: string;
    flaggedAmount?: number;
    currency?: string;
  }): InvestigationRecord {
    const newInv: InvestigationRecord = {
      id: `inv-${Date.now()}`,
      caseNumber: `INV-2026-${String(this.investigations.length + 41).padStart(3, '0')}`,
      title: data.title.trim(),
      targetCustomerId: data.targetCustomerId,
      targetCustomerName: data.targetCustomerName,
      linkedAlertId: data.linkedAlertId,
      priority: data.priority,
      status: 'open',
      leadInvestigator: data.leadInvestigator || 'Sarah Chen',
      evidenceNotes: data.initialEvidence ? [data.initialEvidence.trim()] : [],
      flaggedAmount: data.flaggedAmount || 0,
      currency: data.currency || 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.investigations.unshift(newInv);
    return newInv;
  }

  public updateInvestigation(id: string, updates: Partial<InvestigationRecord>): InvestigationRecord {
    const idx = this.investigations.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error(`Investigation with ID ${id} not found.`);
    const updated: InvestigationRecord = {
      ...this.investigations[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.investigations[idx] = updated;
    return updated;
  }

  public addEvidenceNote(id: string, note: string): InvestigationRecord {
    const inv = this.getInvestigationById(id);
    if (!inv) throw new Error(`Investigation with ID ${id} not found.`);
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updatedNotes = [...inv.evidenceNotes, `[${timestamp}] ${note.trim()}`];
    return this.updateInvestigation(id, { evidenceNotes: updatedNotes });
  }

  // Customers (Operational Privacy Sanitized)
  public getCustomers(): CustomerOpsRecord[] {
    // Sanitized operational view: excludes passwords, tokens, full PAN, or private group data
    return [...this.customers];
  }

  public getCustomerById(id: string): CustomerOpsRecord | undefined {
    return this.customers.find((c) => c.id === id);
  }

  // Statement Processing Metrics
  public getStatementMetrics(): StatementProcessingMetric[] {
    return [...this.statementMetrics];
  }

  public recordStatementMetric(metric: Omit<StatementProcessingMetric, 'id' | 'timestamp'>): StatementProcessingMetric {
    const entry: StatementProcessingMetric = {
      ...metric,
      id: `spm-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    this.statementMetrics.unshift(entry);
    return entry;
  }

  // Monitored Transactions
  public getMonitoredTransactions(): MonitoredTransaction[] {
    return [...this.monitoredTransactions];
  }

  public updateMonitoredTransactionStatus(id: string, status: MonitoredTransaction['status']): MonitoredTransaction {
    const idx = this.monitoredTransactions.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`Transaction with ID ${id} not found.`);
    const updated: MonitoredTransaction = {
      ...this.monitoredTransactions[idx],
      status,
    };
    this.monitoredTransactions[idx] = updated;
    return updated;
  }

  // Operational Analytics
  public getAnalytics(): OperationalAnalyticsData {
    // Dynamically calculate from metrics and alerts
    const totalExtracted = this.statementMetrics.reduce((sum, s) => sum + s.extractedCount, 0);
    const totalImported = this.statementMetrics.reduce((sum, s) => sum + s.importedCount, 0);
    const totalDuplicates = this.statementMetrics.reduce((sum, s) => sum + s.duplicateCount, 0);
    const avgLatency = Math.round(
      this.statementMetrics.reduce((sum, s) => sum + s.parsingTimeMs, 0) / (this.statementMetrics.length || 1)
    );

    const clearedAlerts = this.fraudAlerts.filter((f) => f.status === 'cleared').length;
    const resolvedCases = this.cases.filter((c) => c.status === 'resolved').length;
    const triageRate = Math.round(((clearedAlerts + resolvedCases) / ((this.fraudAlerts.length + this.cases.length) || 1)) * 100);

    return {
      ...INITIAL_DEMO_OPERATIONAL_ANALYTICS,
      totalExtractedTxs: totalExtracted || INITIAL_DEMO_OPERATIONAL_ANALYTICS.totalExtractedTxs,
      totalImportedTxs: totalImported || INITIAL_DEMO_OPERATIONAL_ANALYTICS.totalImportedTxs,
      totalDuplicatesFiltered: totalDuplicates || INITIAL_DEMO_OPERATIONAL_ANALYTICS.totalDuplicatesFiltered,
      avgParsingLatencyMs: avgLatency || INITIAL_DEMO_OPERATIONAL_ANALYTICS.avgParsingLatencyMs,
      fraudTriageRate: triageRate || INITIAL_DEMO_OPERATIONAL_ANALYTICS.fraudTriageRate,
    };
  }
}

export const serverOperationsStore = new OperationsStore();
