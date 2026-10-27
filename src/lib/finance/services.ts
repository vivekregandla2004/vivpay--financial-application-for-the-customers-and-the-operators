/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnalysisResult } from './types.ts';
import { parseStatementFile } from './parser.ts';
import { normalizeTransactions } from './normalize.ts';
import {
  computeMonthlySummaries,
  detectRecurringSubscriptions,
  computeBehavioralMetrics,
  buildChartDatasets,
  generateAutomatedInsights,
} from './analytics.ts';
import { computeFinancialHealthScore } from './intelligence/health.ts';

/**
 * Primary client-side entry point for parsing and end-to-end analysis of bank and payment statements.
 *
 * Supports .xlsx, .xls, and .csv files up to 25 MB.
 * Automatically inspects workbook sheets, detects bank provider, recovers layouts,
 * normalizes transactions, computes monthly summaries, recurring subscriptions,
 * behavioral metrics, chart datasets, automated insights, and financial health score.
 */
export async function analyzeFile(file: File): Promise<AnalysisResult> {
  if (!file) {
    throw new Error('No statement file provided for analysis.');
  }

  // 1. Parse workbook or CSV
  const parseResult = await parseStatementFile(file);

  // 2. Normalize transactions & deduplicate
  const { transactions, duplicateCount, suspectedDuplicateCount, lowConfidenceCategoryCount } =
    normalizeTransactions(
      parseResult.rawTransactions,
      parseResult.fileName,
      parseResult.selectedSheet
    );

  // Update diagnostics with deduplication and categorization metrics
  const diagnostics = {
    ...parseResult.diagnostics,
    duplicateCount,
    suspectedDuplicateCount,
    lowConfidenceCategoryCount,
  };

  // 3. Compute Monthly Summaries
  const monthlySummaries = computeMonthlySummaries(transactions);

  // 4. Detect Recurring Subscriptions & SIPs
  const recurringCandidates = detectRecurringSubscriptions(transactions);

  // 5. Compute Behavioral Metrics
  const metrics = computeBehavioralMetrics(transactions, monthlySummaries);

  // 6. Build Chart Datasets
  const charts = buildChartDatasets(transactions, monthlySummaries);

  // 7. Generate Automated Data-Driven Insights
  const insights = generateAutomatedInsights(
    monthlySummaries,
    charts.categoryBreakdown,
    recurringCandidates,
    metrics
  );

  // 8. Compute Financial Health and Risk Score
  const health = computeFinancialHealthScore(transactions, monthlySummaries, metrics, recurringCandidates);

  return {
    success: true,
    provider: parseResult.provider,
    selectedSheet: parseResult.selectedSheet,
    sheetDiagnostics: parseResult.allSheetScores,
    transactions,
    diagnostics,
    monthlySummaries,
    recurringCandidates,
    metrics,
    charts,
    insights,
    health,
    currency: 'INR',
  };
}

export * from './types.ts';
export * from './parser.ts';
export * from './normalize.ts';
export * from './analytics.ts';
export * from './intelligence/health.ts';
