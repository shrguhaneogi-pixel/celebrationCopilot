'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Download,
  Printer,
  Copy,
  Check,
  FileText,
  X,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  CheckCircle2,
  Clock,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EventPlan } from '@/domain/event-plan.schema';
import { calculateTotals } from '@/domain/planning-engine';
import { useEventPlan } from '@/context/EventPlanContext';
import { formatCurrency } from '@/lib/utils';

export interface PlanExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: EventPlan;
}

/**
 * Generates an executive plain-text event summary containing:
 * Title, Date, Location, Budget Cap, Remaining Budget, and Milestone Count.
 */
export function generatePlanSummaryText(plan: EventPlan, remainingBudget: number): string {
  const formattedCap = formatCurrency(plan.totalCap, plan.currency);
  const formattedRemaining = formatCurrency(remainingBudget, plan.currency);

  return [
    `# Executive Event Summary: ${plan.title}`,
    `Title: ${plan.title}`,
    `Date: ${plan.eventDate || 'TBD'}`,
    `Location: ${plan.location || 'TBD'}`,
    `Budget Cap: ${formattedCap}`,
    `Remaining Budget: ${formattedRemaining}`,
    `Milestone Count: ${plan.milestones.length}`,
  ].join('\n');
}

/**
 * Generates a clean markdown summary of vendors, their statuses, priorities,
 * and suggested interview questions.
 */
export function generateVendorManifestMarkdown(plan: EventPlan): string {
  const lines: string[] = [
    `# Vendor Manifest & Interview Guide: ${plan.title}`,
    `Date: ${plan.eventDate || 'TBD'}`,
    `Location: ${plan.location || 'TBD'}`,
    `Total Vendors: ${plan.vendors.length}`,
    '',
    '## Vendor Checklist & Interview Questions',
  ];

  if (plan.vendors.length === 0) {
    lines.push('', 'No vendors currently assigned.');
  } else {
    plan.vendors.forEach((vendor, index) => {
      lines.push('');
      lines.push(`### ${index + 1}. ${vendor.name} (${vendor.category})`);
      lines.push(`- **Status:** ${vendor.status}`);
      lines.push(`- **Priority:** ${vendor.priority}`);
      lines.push('- **Interview Questions:**');
      if (vendor.suggestedQuestions && vendor.suggestedQuestions.length > 0) {
        vendor.suggestedQuestions.forEach((q) => {
          lines.push(`  - ${q}`);
        });
      } else {
        lines.push('  - No interview questions listed.');
      }
    });
  }

  return lines.join('\n');
}

export function PlanExportModal({ isOpen, onClose, plan: propPlan }: PlanExportModalProps) {
  let contextPlan: EventPlan | undefined;
  let contextMetrics: ReturnType<typeof useEventPlan>['derivedMetrics'] | undefined;

  try {
    const context = useEventPlan();
    contextPlan = context.plan;
    contextMetrics = context.derivedMetrics;
  } catch {
    // Rendered outside context
  }

  const activePlan = propPlan || contextPlan;

  const derivedMetrics = useMemo(() => {
    if (propPlan) {
      return calculateTotals(propPlan);
    }
    if (contextMetrics) return contextMetrics;
    if (activePlan) return calculateTotals(activePlan);
    return null;
  }, [propPlan, contextMetrics, activePlan]);

  const [copiedManifest, setCopiedManifest] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const manifestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management on open/close with cleanup restoration
  useEffect(() => {
    if (isOpen) {
      const activeEl = document.activeElement;
      previousFocusRef.current = activeEl instanceof HTMLElement ? activeEl : null;

      const timer = setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          modalRef.current?.focus();
        }
      }, 20);

      return () => {
        clearTimeout(timer);
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // Clean up feedback timers on unmount
  useEffect(() => {
    return () => {
      if (manifestTimeoutRef.current) clearTimeout(manifestTimeoutRef.current);
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    };
  }, []);

  // Escape key listener to dismiss modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !activePlan || !derivedMetrics) {
    return null;
  }

  // Keyboard trap within modal - prevents focus escape
  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !modalRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !modalRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall back to document.execCommand if modern API rejects
      }
    }

    try {
      if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
      }
      return false;
    } catch {
      return false;
    }
  };

  // 1. Download JSON
  const handleDownloadJson = () => {
    try {
      const jsonStr = JSON.stringify(activePlan, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const safeTitle = activePlan.title.toLowerCase().replace(/\s+/g, '-') || 'untitled';
      const filename = `celebration-plan-${safeTitle}.json`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download JSON:', err);
    }
  };

  // 2. Print / PDF View
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // 3. Copy Vendor Manifest
  const handleCopyManifest = async () => {
    const text = generateVendorManifestMarkdown(activePlan);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedManifest(true);
      if (manifestTimeoutRef.current) clearTimeout(manifestTimeoutRef.current);
      manifestTimeoutRef.current = setTimeout(() => setCopiedManifest(false), 2500);
    }
  };

  // 4. Copy Plan Summary
  const handleCopySummary = async () => {
    const text = generatePlanSummaryText(activePlan, derivedMetrics.remainingBudget);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedSummary(true);
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
      summaryTimeoutRef.current = setTimeout(() => setCopiedSummary(false), 2500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      aria-describedby="export-modal-description"
      onClick={handleBackdropClick}
      onKeyDown={handleContainerKeyDown}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto print:p-0 print:bg-transparent print:static print:block"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden focus:outline-none print:max-h-none print:h-auto print:border-none print:shadow-none print:w-full print:max-w-none print:p-0 print:bg-white print:text-black"
      >
        {/* Modal Header (Hidden when printing) */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/40 print:hidden">
          <div className="space-y-1">
            <h2 id="export-modal-title" className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
              Export & Share Event Plan
            </h2>
            <p id="export-modal-description" className="text-xs text-muted-foreground">
              Download the canonical plan data, print a formatted PDF summary, or copy manifests.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close export dialog"
            title="Close dialog (Escape)"
            className="rounded-lg h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Action Toolbar (Hidden when printing) */}
        <div className="border-b border-border bg-card px-6 py-3.5 flex flex-wrap items-center gap-2.5 print:hidden">
          <Button
            variant="default"
            size="sm"
            onClick={handleDownloadJson}
            aria-label="Download JSON"
            className="cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Download JSON</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            aria-label="Print or Save as PDF"
            className="cursor-pointer inline-flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>Print / Save PDF</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyManifest}
            aria-label="Copy Vendor Manifest"
            className="cursor-pointer inline-flex items-center gap-1.5"
          >
            {copiedManifest ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied Manifest!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>Copy Vendor Manifest</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            aria-label="Copy Plan Summary"
            className="cursor-pointer inline-flex items-center gap-1.5"
          >
            {copiedSummary ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied Summary!</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>Copy Plan Summary</span>
              </>
            )}
          </Button>
        </div>

        {/* Printable View / Scrollable Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-0 print:overflow-visible print:block bg-background print:bg-white print:text-black">
          {/* Printable Document Container */}
          <div
            id="printable-plan"
            className="space-y-6 bg-card border border-border/80 rounded-lg p-6 shadow-xs print:border-none print:shadow-none print:p-0 print:bg-white print:text-black"
          >
            {/* Document Header */}
            <div className="border-b border-border/80 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-foreground print:text-black">
                    {activePlan.title}
                  </h1>
                  <p className="text-sm text-muted-foreground print:text-gray-600 mt-1">
                    Event Type: <span className="font-medium text-foreground print:text-black">{activePlan.eventType}</span>
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-xs font-mono font-medium print:border-gray-400">
                    Version {activePlan.version}
                  </Badge>
                  <p className="text-xs text-muted-foreground print:text-gray-500 mt-1">
                    Celebration Copilot Plan
                  </p>
                </div>
              </div>

              {/* Event Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/60">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary print:text-gray-700" aria-hidden="true" />
                  <div>
                    <p className="text-[10px] text-muted-foreground print:text-gray-500 uppercase tracking-wider font-bold">
                      Date
                    </p>
                    <p className="text-xs font-semibold text-foreground print:text-black">
                      {activePlan.eventDate || 'TBD'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary print:text-gray-700" aria-hidden="true" />
                  <div>
                    <p className="text-[10px] text-muted-foreground print:text-gray-500 uppercase tracking-wider font-bold">
                      Location
                    </p>
                    <p className="text-xs font-semibold text-foreground print:text-black">
                      {activePlan.location || 'Not specified'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary print:text-gray-700" aria-hidden="true" />
                  <div>
                    <p className="text-[10px] text-muted-foreground print:text-gray-500 uppercase tracking-wider font-bold">
                      Guest Count
                    </p>
                    <p className="text-xs font-semibold text-foreground print:text-black">
                      {activePlan.guestCount} guests
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary print:text-gray-700" aria-hidden="true" />
                  <div>
                    <p className="text-[10px] text-muted-foreground print:text-gray-500 uppercase tracking-wider font-bold">
                      Budget Cap
                    </p>
                    <p className="text-xs font-semibold text-foreground print:text-black">
                      {formatCurrency(activePlan.totalCap, activePlan.currency)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1: Financial & Budget Breakdown */}
            <section className="space-y-3 print:break-inside-avoid">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold tracking-tight text-foreground print:text-black flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary print:text-black" aria-hidden="true" />
                  Budget Breakdown & Totals
                </h3>
                <div className="text-xs font-medium text-muted-foreground print:text-gray-600">
                  Remaining Buffer:{' '}
                  <span
                    className={`font-bold ${
                      derivedMetrics.isOverBudget
                        ? 'text-destructive print:text-red-600'
                        : 'text-emerald-600 dark:text-emerald-400 print:text-emerald-700'
                    }`}
                  >
                    {formatCurrency(derivedMetrics.remainingBudget, activePlan.currency)}
                  </span>
                </div>
              </div>

              {/* Financial Metric Summary Boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg border border-border/60 print:bg-gray-50 print:border-gray-300">
                <div>
                  <p className="text-[10px] text-muted-foreground print:text-gray-500 uppercase font-medium">
                    Total Cap
                  </p>
                  <p className="text-sm font-bold text-foreground print:text-black">
                    {formatCurrency(activePlan.totalCap, activePlan.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground print:text-gray-500 uppercase font-medium">
                    Projected Spend
                  </p>
                  <p className="text-sm font-bold text-foreground print:text-black">
                    {formatCurrency(derivedMetrics.projectedTotal, activePlan.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground print:text-gray-500 uppercase font-medium">
                    Committed Spend
                  </p>
                  <p className="text-sm font-bold text-foreground print:text-black">
                    {formatCurrency(derivedMetrics.committedTotal, activePlan.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground print:text-gray-500 uppercase font-medium">
                    Allocation
                  </p>
                  <p className="text-sm font-bold text-foreground print:text-black">
                    {derivedMetrics.allocationPercent}%
                  </p>
                </div>
              </div>

              {/* Budget Items Table */}
              <div className="border border-border/80 rounded-lg overflow-hidden print:border-gray-300">
                <table className="w-full text-xs text-left" aria-label="Printable budget line items">
                  <thead className="bg-muted/60 text-muted-foreground print:bg-gray-100 print:text-gray-700 font-semibold border-b border-border/80">
                    <tr>
                      <th className="px-3 py-2">Item Name</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Estimated</th>
                      <th className="px-3 py-2 text-right">Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 print:divide-gray-200">
                    {activePlan.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                          No budget items added yet.
                        </td>
                      </tr>
                    ) : (
                      activePlan.items.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-foreground print:text-black">
                            {item.name}
                            {item.notes && (
                              <span className="block text-[10px] text-muted-foreground print:text-gray-500">
                                {item.notes}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 capitalize text-muted-foreground print:text-gray-600">
                            {item.category}
                          </td>
                          <td className="px-3 py-2 capitalize text-muted-foreground print:text-gray-600">
                            {item.status}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-foreground print:text-black">
                            {formatCurrency(item.estimatedCost, activePlan.currency)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-foreground print:text-black">
                            {formatCurrency(item.actualCost, activePlan.currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-muted/40 font-bold border-t border-border/80 print:bg-gray-100">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-foreground print:text-black">
                        Total Items: {activePlan.items.length}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-foreground print:text-black">
                        {formatCurrency(derivedMetrics.projectedTotal, activePlan.currency)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-foreground print:text-black">
                        {formatCurrency(derivedMetrics.committedTotal, activePlan.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Section 2: Timeline Milestones */}
            <section className="space-y-3 print:break-inside-avoid">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold tracking-tight text-foreground print:text-black flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary print:text-black" aria-hidden="true" />
                  Timeline & Milestones
                </h3>
                <div className="text-xs font-medium text-muted-foreground print:text-gray-600">
                  Progress: {derivedMetrics.completedMilestones} of {derivedMetrics.totalMilestones} ({derivedMetrics.timelineProgressPercent}%)
                </div>
              </div>

              <div className="border border-border/80 rounded-lg overflow-hidden print:border-gray-300">
                <table className="w-full text-xs text-left" aria-label="Printable milestone timeline">
                  <thead className="bg-muted/60 text-muted-foreground print:bg-gray-100 print:text-gray-700 font-semibold border-b border-border/80">
                    <tr>
                      <th className="px-3 py-2">Milestone</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Due Date</th>
                      <th className="px-3 py-2">Offset</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 print:divide-gray-200">
                    {activePlan.milestones.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                          No milestones added yet.
                        </td>
                      </tr>
                    ) : (
                      activePlan.milestones.map((m) => (
                        <tr key={m.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-foreground print:text-black flex items-center gap-1.5">
                            {m.completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 print:text-emerald-700 shrink-0" aria-hidden="true" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-muted-foreground print:text-gray-500 shrink-0" aria-hidden="true" />
                            )}
                            <span className={m.completed ? 'line-through text-muted-foreground print:text-gray-500' : ''}>
                              {m.title}
                            </span>
                          </td>
                          <td className="px-3 py-2 capitalize text-muted-foreground print:text-gray-600">
                            {m.category}
                          </td>
                          <td className="px-3 py-2 font-mono text-foreground print:text-black">
                            {m.dueDate || 'TBD'}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground print:text-gray-600">
                            {m.offsetDays === 0 ? 'Event Day' : `${m.offsetDays > 0 ? '+' : ''}${m.offsetDays}d`}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                m.completed
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 print:bg-transparent print:text-emerald-700'
                                  : 'bg-muted text-muted-foreground print:bg-transparent print:text-gray-600'
                              }`}
                            >
                              {m.completed ? 'Completed' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 3: Vendor Checklist & Interview Questions */}
            <section className="space-y-3 print:break-inside-avoid">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold tracking-tight text-foreground print:text-black flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary print:text-black" aria-hidden="true" />
                  Vendor Manifest & Interview Guide
                </h3>
                <div className="text-xs font-medium text-muted-foreground print:text-gray-600">
                  Total Vendors: {activePlan.vendors.length}
                </div>
              </div>

              {activePlan.vendors.length === 0 ? (
                <div className="p-4 border border-border/80 rounded-lg text-center text-xs text-muted-foreground">
                  No vendors added yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {activePlan.vendors.map((vendor) => (
                    <div
                      key={vendor.id}
                      className="border border-border/80 rounded-lg p-3 space-y-2 bg-muted/20 print:bg-white print:border-gray-300 print:break-inside-avoid"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-xs text-foreground print:text-black">
                            {vendor.name}
                          </h4>
                          <p className="text-[10px] text-muted-foreground print:text-gray-600 capitalize">
                            Category: {vendor.category}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground print:border print:border-gray-300">
                            {vendor.priority}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary print:border print:border-gray-300 print:text-black">
                            {vendor.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Suggested Questions */}
                      {vendor.suggestedQuestions && vendor.suggestedQuestions.length > 0 && (
                        <div className="pt-2 border-t border-border/50 print:border-gray-200">
                          <p className="text-[10px] font-semibold text-muted-foreground print:text-gray-700 flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" aria-hidden="true" />
                            Interview Questions:
                          </p>
                          <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-foreground/90 print:text-black">
                            {vendor.suggestedQuestions.map((q, qIndex) => (
                              <li key={qIndex} className="leading-tight">
                                {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
