import { CaseComplaint } from '@/types';
import { DashboardSummary } from '@/lib/api-client';

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportDocketsToCsv(
  cases: CaseComplaint[],
  customFilename?: string
): { success: boolean; count: number; filename: string } {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = customFilename || `casepulse-dockets-${dateStr}.csv`;

  const headers = [
    'Docket ID',
    'Bureau',
    'Target Institution',
    'AISHE Code',
    'Violation Category',
    'Severity',
    'Investigation Status',
    'SLA Status',
    'SLA Due Date',
    'Days Open',
    'Assigned Officer',
    'Officer Email',
    'Filing Date',
    'Docket Title',
    'Evidence Artifacts Count',
    'Cross-Bureau Flag',
  ];

  const rows = cases.map((c) => [
    escapeCsvField(c.id),
    escapeCsvField(c.bureauId),
    escapeCsvField(c.institutionName),
    escapeCsvField(c.aisheCode),
    escapeCsvField(c.category),
    escapeCsvField(c.severity),
    escapeCsvField(c.status),
    escapeCsvField(c.isOverdue ? 'OVERDUE' : 'ON TRACK'),
    escapeCsvField(c.slaDueDate ? c.slaDueDate.split('T')[0] : ''),
    escapeCsvField(c.daysOpen ?? ''),
    escapeCsvField(c.assignedOfficer?.name ?? ''),
    escapeCsvField(c.assignedOfficer?.email ?? ''),
    escapeCsvField(c.filingDate ? c.filingDate.split('T')[0] : ''),
    escapeCsvField(c.title),
    escapeCsvField(c.evidenceFilesCount ?? 0),
    escapeCsvField(c.crossBureauFlag ? 'YES' : 'NO'),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, count: cases.length, filename };
}

export function exportAnalyticsToCsv(
  summary: DashboardSummary,
  categoryBreakdown?: { category: string; count: number }[],
  customFilename?: string
): { success: boolean; filename: string } {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = customFilename || `casepulse-analytics-summary-${dateStr}.csv`;

  const lines: string[] = [
    'METRIC,VALUE,NOTES',
    `Total Registered Cases,${summary.totalCases},All bureaus combined`,
    `Pending Active Investigations,${summary.pendingCases},In progress or under triage`,
    `Overdue SLA Breaches,${summary.overdueCases},Mandated timeline exceeded`,
    `Critical Severity Cases,${summary.criticalCases},Highest enforcement priority`,
    `Cross-Bureau Overlaps Flagged,${summary.flaggedOverlapsCount},Multi-agency collisions`,
    `Unresolved Overlaps,${summary.unresolvedOverlapsCount},Awaiting joint review`,
    `Joint Inquiries Active,${summary.jointInquiriesActive},Coordinated enforcement desks`,
    `Data Source,${escapeCsvField(summary.dataSource)},Authoritative PostgreSQL register`,
  ];

  if (categoryBreakdown && categoryBreakdown.length > 0) {
    lines.push('');
    lines.push('VIOLATION CATEGORY,INCIDENT COUNT');
    categoryBreakdown.forEach((cat) => {
      lines.push(`${escapeCsvField(cat.category)},${cat.count}`);
    });
  }

  const csvContent = lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, filename };
}

export function exportIntelligenceBundleJson(
  data: unknown,
  customFilename?: string
): { success: boolean; filename: string } {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = customFilename || `casepulse-intelligence-export-${dateStr}.json`;

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, filename };
}

export function triggerPrintDossier(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}
