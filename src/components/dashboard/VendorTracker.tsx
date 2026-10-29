'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VendorTask, VendorPriority, VendorStatus } from '@/domain/event-plan.schema';
import { MockVendorItem } from '@/lib/mock-data';
import { useEventPlan } from '@/context/EventPlanContext';
import { Check, Copy, HelpCircle, Briefcase, Plus, Trash2, AlertCircle } from 'lucide-react';

interface VendorTrackerProps {
  vendors?: (VendorTask | MockVendorItem)[];
}

const STATUS_OPTIONS: { value: VendorStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'booked', label: 'Booked' },
];

const PRIORITY_OPTIONS: { value: VendorPriority; label: string }[] = [
  { value: 'high', label: 'High Priority' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function VendorTracker({ vendors: propVendors }: VendorTrackerProps) {
  let contextPlan: ReturnType<typeof useEventPlan>['plan'] | undefined;
  let dispatchMutation: ReturnType<typeof useEventPlan>['dispatchMutation'] | undefined;

  try {
    const context = useEventPlan();
    contextPlan = context.plan;
    dispatchMutation = context.dispatchMutation;
  } catch {
    // Fallback if rendered outside context
  }

  const vendors = contextPlan ? contextPlan.vendors : (propVendors || []);

  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // Add Vendor State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPriority, setNewPriority] = useState<VendorPriority>('medium');
  const [newQuestions, setNewQuestions] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const handleCopyQuestion = (question: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(question);
      setCopiedIndex(key);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleStatusChange = (vendorId: string, status: VendorStatus) => {
    if (!dispatchMutation) return;
    dispatchMutation({
      type: 'UPDATE_VENDOR',
      vendorId,
      status,
    });
  };

  const handlePriorityChange = (vendorId: string, priority: VendorPriority) => {
    if (!dispatchMutation) return;
    dispatchMutation({
      type: 'UPDATE_VENDOR',
      vendorId,
      priority,
    });
  };

  const handleDeleteVendor = (vendorId: string) => {
    if (!dispatchMutation) return;
    dispatchMutation({
      type: 'REMOVE_VENDOR',
      vendorId,
    });
  };

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchMutation) return;

    if (!newName.trim() || !newCategory.trim()) {
      setAddError('Vendor name and category are required.');
      return;
    }

    const questionsList = newQuestions
      .split('\n')
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .slice(0, 10);

    const res = dispatchMutation({
      type: 'ADD_VENDOR',
      name: newName.trim(),
      category: newCategory.trim(),
      priority: newPriority,
      suggestedQuestions: questionsList,
    });

    if (!res.success) {
      setAddError(res.error || 'Failed to add vendor.');
      return;
    }

    setNewName('');
    setNewCategory('');
    setNewPriority('medium');
    setNewQuestions('');
    setAddError(null);
    setShowAddForm(false);
  };

  const getPriorityBadge = (priority: VendorTask['priority']) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium</Badge>;
      case 'low':
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  const getStatusBadge = (status: VendorTask['status']) => {
    switch (status) {
      case 'booked':
        return <Badge variant="success">Booked</Badge>;
      case 'quoted':
        return <Badge variant="default">Quoted</Badge>;
      case 'contacted':
        return <Badge variant="secondary">Contacted</Badge>;
      case 'not_started':
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              Prioritized Vendor Checklist
            </CardTitle>
            <CardDescription>
              Categorized vendor commitments with curated interview cheat sheets.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border">
              Simulated Suggestions
            </span>
            {dispatchMutation && (
              <Button
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
                className="h-8 text-xs cursor-pointer inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Vendor</span>
              </Button>
            )}
          </div>
        </div>

        {/* Add Vendor Form */}
        {showAddForm && (
          <form onSubmit={handleCreateVendor} className="mt-4 p-3 bg-muted/30 rounded-lg border border-border space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label htmlFor="new-vendor-name" className="font-semibold block mb-1">
                  Vendor Name *
                </label>
                <Input
                  id="new-vendor-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Royal Florists"
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div>
                <label htmlFor="new-vendor-category" className="font-semibold block mb-1">
                  Category *
                </label>
                <Input
                  id="new-vendor-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Floral & Decor"
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div>
                <label htmlFor="new-vendor-priority" className="font-semibold block mb-1">
                  Priority
                </label>
                <select
                  id="new-vendor-priority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as VendorPriority)}
                  className="h-8 text-xs bg-background border border-border rounded-md px-2 w-full text-foreground"
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>
            </div>

            <div className="text-xs">
              <label htmlFor="new-vendor-questions" className="font-semibold block mb-1">
                Suggested Questions (one per line, max 10)
              </label>
              <textarea
                id="new-vendor-questions"
                rows={2}
                value={newQuestions}
                onChange={(e) => setNewQuestions(e.target.value)}
                placeholder="What is your cancellation policy?&#10;Is delivery and setup included?"
                className="w-full text-xs p-2 rounded-md border border-border bg-background text-foreground"
              />
            </div>

            {addError && (
              <div role="alert" className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{addError}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" className="h-7 text-xs px-3 cursor-pointer">
                Save Vendor
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(false)}
                className="h-7 text-xs px-3 cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vendors.length === 0 ? (
            <p className="text-xs text-muted-foreground col-span-2 text-center py-4">No vendor tasks listed yet.</p>
          ) : (
            vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{vendor.name}</h4>
                    <p className="text-xs text-muted-foreground">{vendor.category}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {dispatchMutation ? (
                      <>
                        <select
                          value={vendor.priority}
                          onChange={(e) => handlePriorityChange(vendor.id, e.target.value as VendorPriority)}
                          className="text-[11px] h-6 px-1.5 rounded border border-border bg-background text-foreground cursor-pointer font-medium"
                          title="Change priority"
                          aria-label={`Change priority for ${vendor.name}`}
                        >
                          {PRIORITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={vendor.status}
                          onChange={(e) => handleStatusChange(vendor.id, e.target.value as VendorStatus)}
                          className="text-[11px] h-6 px-1.5 rounded border border-border bg-background text-foreground cursor-pointer font-semibold"
                          title="Change booking status"
                          aria-label={`Change booking status for ${vendor.name}`}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteVendor(vendor.id)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Delete vendor"
                          aria-label={`Delete ${vendor.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {getPriorityBadge(vendor.priority)}
                        {getStatusBadge(vendor.status)}
                      </>
                    )}
                  </div>
                </div>

                {vendor.suggestedQuestions.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-primary" />
                      Key Questions for Consultation:
                    </p>
                    <ul className="space-y-1.5">
                      {vendor.suggestedQuestions.map((q, qIndex) => {
                        const copyKey = `${vendor.id}-${qIndex}`;
                        const isCopied = copiedIndex === copyKey;

                        return (
                          <li
                            key={qIndex}
                            className="text-xs text-foreground bg-muted/30 p-2 rounded border border-border/60 flex items-center justify-between gap-2"
                          >
                            <span className="leading-snug">{q}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                              onClick={() => handleCopyQuestion(q, copyKey)}
                              title="Copy question to clipboard"
                              aria-label="Copy question to clipboard"
                            >
                              {isCopied ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
