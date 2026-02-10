import { ComplianceService, ComplianceReport } from './compliance-service';
import { AMLService } from './aml-service';
import { createWriteStream } from 'fs';
import { join } from 'path';

/**
 * Simple logger utility
 */
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

/**
 * Report format
 */
export type ReportFormat = 'pdf' | 'json';

/**
 * Compliance report summary
 */
export interface ComplianceReportSummary {
  reportId: string;
  generatedAt: Date;
  dateRange: { start: Date; end: Date };
  role: string;
  transactions: number;
  compliant: number;
  flagged: number;
  averageRiskScore: number;
  reports: ComplianceReport[];
}

/**
 * Compliance Report Generator
 * 
 * Generates compliance reports in PDF and JSON formats for auditors.
 * 
 * Features:
 * - Custom date range filtering
 * - PDF and JSON export
 * - Risk score aggregation
 * - Compliance status summary
 * 
 * Requirements: 17.1, 17.3, 17.4, 17.5
 */
export class ComplianceReportGenerator {
  private complianceService: ComplianceService;
  private amlService: AMLService;

  constructor(
    complianceService: ComplianceService,
    amlService: AMLService
  ) {
    this.complianceService = complianceService;
    this.amlService = amlService;
  }

  /**
   * Generate compliance report for date range
   * 
   * @param dateRange - Start and end dates
   * @param role - Auditor role
   * @param format - Report format (pdf or json)
   * @returns Report summary and file path
   */
  async generateReport(
    dateRange: { start: Date; end: Date },
    role: string,
    format: ReportFormat = 'json'
  ): Promise<{
    summary: ComplianceReportSummary;
    filePath: string;
  }> {
    try {
      logger.info('Generating compliance report', { dateRange, role, format });

      // Get compliance data from service
      const data = await this.complianceService.generateReport(dateRange, role);

      // Calculate average risk score
      const totalRiskScore = data.report.reduce((sum, r) => sum + r.riskScore, 0);
      const averageRiskScore = data.transactions > 0 
        ? totalRiskScore / data.transactions 
        : 0;

      // Create report summary
      const reportId = `compliance-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const summary: ComplianceReportSummary = {
        reportId,
        generatedAt: new Date(),
        dateRange,
        role,
        transactions: data.transactions,
        compliant: data.compliant,
        flagged: data.flagged,
        averageRiskScore: Math.round(averageRiskScore * 100) / 100,
        reports: data.report
      };

      // Export report in requested format
      let filePath: string;
      if (format === 'pdf') {
        filePath = await this.exportPDF(summary);
      } else {
        filePath = await this.exportJSON(summary);
      }

      logger.info('Compliance report generated', {
        reportId,
        transactions: summary.transactions,
        filePath
      });

      return { summary, filePath };
    } catch (error) {
      logger.error('Failed to generate compliance report', { error, dateRange, role });
      throw error;
    }
  }

  /**
   * Export report as JSON
   * 
   * @param summary - Report summary
   * @returns File path
   */
  private async exportJSON(summary: ComplianceReportSummary): Promise<string> {
    try {
      const fileName = `${summary.reportId}.json`;
      const filePath = join(process.cwd(), 'reports', fileName);

      // Ensure reports directory exists
      const fs = require('fs');
      const reportsDir = join(process.cwd(), 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      // Write JSON file
      fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));

      logger.info('Report exported as JSON', { filePath });

      return filePath;
    } catch (error) {
      logger.error('Failed to export JSON report', { error });
      throw error;
    }
  }

  /**
   * Export report as PDF
   * 
   * @param summary - Report summary
   * @returns File path
   */
  private async exportPDF(summary: ComplianceReportSummary): Promise<string> {
    try {
      const fileName = `${summary.reportId}.pdf`;
      const filePath = join(process.cwd(), 'reports', fileName);

      // In production, use a PDF generation library like pdfkit or puppeteer
      // For now, create a simple text-based PDF placeholder
      const fs = require('fs');
      const reportsDir = join(process.cwd(), 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      // Generate PDF content (simplified)
      const pdfContent = this.generatePDFContent(summary);
      fs.writeFileSync(filePath, pdfContent);

      logger.info('Report exported as PDF', { filePath });

      return filePath;
    } catch (error) {
      logger.error('Failed to export PDF report', { error });
      throw error;
    }
  }

  /**
   * Generate PDF content (simplified text format)
   * 
   * @param summary - Report summary
   * @returns PDF content string
   */
  private generatePDFContent(summary: ComplianceReportSummary): string {
    const lines = [
      '='.repeat(80),
      'COMPLIANCE REPORT',
      '='.repeat(80),
      '',
      `Report ID: ${summary.reportId}`,
      `Generated: ${summary.generatedAt.toISOString()}`,
      `Date Range: ${summary.dateRange.start.toISOString()} to ${summary.dateRange.end.toISOString()}`,
      `Role: ${summary.role}`,
      '',
      '='.repeat(80),
      'SUMMARY',
      '='.repeat(80),
      '',
      `Total Transactions: ${summary.transactions}`,
      `Compliant: ${summary.compliant} (${Math.round((summary.compliant / summary.transactions) * 100)}%)`,
      `Flagged: ${summary.flagged} (${Math.round((summary.flagged / summary.transactions) * 100)}%)`,
      `Average Risk Score: ${summary.averageRiskScore}`,
      '',
      '='.repeat(80),
      'DETAILED REPORTS',
      '='.repeat(80),
      ''
    ];

    // Add individual reports
    summary.reports.forEach((report, index) => {
      lines.push(`Transaction ${index + 1}:`);
      lines.push(`  Compliant: ${report.compliant ? 'YES' : 'NO'}`);
      lines.push(`  Risk Score: ${report.riskScore}`);
      lines.push(`  Flags: ${report.flags.join(', ') || 'None'}`);
      lines.push(`  Disclosed Fields: ${report.disclosedFields.join(', ')}`);
      lines.push(`  Hidden Fields: ${report.hiddenFields.join(', ')}`);
      lines.push('');
    });

    lines.push('='.repeat(80));
    lines.push('END OF REPORT');
    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}

/**
 * Singleton instance
 */
let reportGeneratorInstance: ComplianceReportGenerator | null = null;

/**
 * Initialize ComplianceReportGenerator singleton
 * 
 * @param complianceService - Compliance service
 * @param amlService - AML/CFT service
 * @returns ComplianceReportGenerator instance
 */
export function initializeReportGenerator(
  complianceService: ComplianceService,
  amlService: AMLService
): ComplianceReportGenerator {
  reportGeneratorInstance = new ComplianceReportGenerator(
    complianceService,
    amlService
  );
  return reportGeneratorInstance;
}

/**
 * Get ComplianceReportGenerator singleton
 * 
 * @returns ComplianceReportGenerator instance
 * @throws Error if not initialized
 */
export function getReportGenerator(): ComplianceReportGenerator {
  if (!reportGeneratorInstance) {
    throw new Error('ComplianceReportGenerator not initialized. Call initializeReportGenerator first.');
  }
  return reportGeneratorInstance;
}
