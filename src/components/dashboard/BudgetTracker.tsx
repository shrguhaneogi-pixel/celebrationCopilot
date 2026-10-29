'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { BudgetItem, BudgetItemStatus } from '@/domain/event-plan.schema';
import { MockBudgetItem } from '@/lib/mock-data';
import { useEventPlan } from '@/context/EventPlanContext';
import { Layers, ShieldCheck, CheckCircle2, Plus, Trash2, Edit2, AlertCircle, Check, X } from 'lucide-react';

interface BudgetTrackerProps {
  items?: (BudgetItem | MockBudgetItem)[];
  totalCap?: number;
  currency?: string;
}

const STATUS_CYCLE: BudgetItemStatus[] = ['projected', 'quoted', 'committed', 'paid'];

export function BudgetTracker({
  items: propItems,
  totalCap: propTotalCap,
  currency: propCurrency,
}: BudgetTrackerProps) {
  let contextPlan: ReturnType<typeof useEventPlan>['plan'] | undefined;
  let contextMetrics: ReturnType<typeof useEventPlan>['derivedMetrics'] | undefined;
  let dispatchMutation: ReturnType<typeof useEventPlan>['dispatchMutation'] | undefined;

  try {
    const context = useEventPlan();
    contextPlan = context.plan;
    contextMetrics = context.derivedMetrics;
    dispatchMutation = context.dispatchMutation;
  } catch {
    // Fallback if rendered outside context
  }

  const items = contextPlan ? contextPlan.items : (propItems || []);
  const totalCap = contextPlan ? contextPlan.totalCap : (propTotalCap || 0);
  const currency = contextPlan ? contextPlan.currency : (propCurrency || 'INR');

  const projectedTotal = contextMetrics
    ? contextMetrics.projectedTotal
    : items.reduce((sum, item) => sum + item.estimatedCost, 0);

  const committedTotal = contextMetrics
    ? contextMetrics.committedTotal
    : items
        .filter((item) => item.status === 'committed' || item.status === 'paid')
        .reduce((sum, item) => sum + item.actualCost, 0);

  const remainingBuffer = contextMetrics
    ? contextMetrics.remainingBudget
    : totalCap - projectedTotal;

  // Add Item State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newEstCost, setNewEstCost] = useState('');
  const [newActualCost, setNewActualCost] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Item State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editEstCost, setEditEstCost] = useState('');
  const [editActualCost, setEditActualCost] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const getStatusBadge = (status: BudgetItem['status'], itemId?: string) => {
    let variant: 'success' | 'default' | 'secondary' | 'outline' = 'outline';
    let label = 'Projected';

    switch (status) {
      case 'paid':
        variant = 'success';
        label = 'Paid';
        break;
      case 'committed':
        variant = 'default';
        label = 'Committed';
        break;
      case 'quoted':
        variant = 'secondary';
        label = 'Quoted';
        break;
      case 'projected':
      default:
        variant = 'outline';
        label = 'Projected';
        break;
    }

    if (dispatchMutation && itemId) {
      const handleCycleStatus = () => {
        const nextIdx = (STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length;
        const nextStatus = STATUS_CYCLE[nextIdx];
        dispatchMutation({
          type: 'UPDATE_BUDGET_ITEM',
          itemId,
          status: nextStatus,
        });
      };

      return (
        <button
          type="button"
          onClick={handleCycleStatus}
          className="cursor-pointer transition-transform active:scale-95"
          title={`Click to cycle status (Current: ${label})`}
          aria-label={`Cycle status for item (Current: ${label})`}
        >
          <Badge variant={variant}>{label} ⟳</Badge>
        </button>
      );
    }

    return <Badge variant={variant}>{label}</Badge>;
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchMutation) return;

    if (!newName.trim() || !newCategory.trim() || !newEstCost.trim()) {
      setAddError('Name, category, and estimated cost are required.');
      return;
    }

    const estCostNum = parseInt(newEstCost, 10);
    const actualCostNum = newActualCost ? parseInt(newActualCost, 10) : 0;

    if (isNaN(estCostNum) || estCostNum < 0) {
      setAddError('Estimated cost must be a non-negative integer.');
      return;
    }

    const res = dispatchMutation({
      type: 'ADD_BUDGET_ITEM',
      name: newName.trim(),
      category: newCategory.trim(),
      estimatedCost: estCostNum,
      actualCost: actualCostNum >= 0 ? actualCostNum : 0,
    });

    if (!res.success) {
      setAddError(res.error || 'Failed to add budget item.');
      return;
    }

    setNewName('');
    setNewCategory('');
    setNewEstCost('');
    setNewActualCost('');
    setAddError(null);
    setShowAddForm(false);
  };

  const handleStartEdit = (item: BudgetItem | MockBudgetItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditEstCost(String(item.estimatedCost));
    setEditActualCost(String(item.actualCost));
    setEditError(null);
  };

  const handleSaveEdit = (itemId: string) => {
    if (!dispatchMutation) return;

    const estCostNum = parseInt(editEstCost, 10);
    const actualCostNum = parseInt(editActualCost, 10);

    if (isNaN(estCostNum) || estCostNum < 0) {
      setEditError('Estimated cost must be a non-negative integer.');
      return;
    }

    const res = dispatchMutation({
      type: 'UPDATE_BUDGET_ITEM',
      itemId,
      name: editName.trim(),
      category: editCategory.trim(),
      estimatedCost: estCostNum,
      actualCost: !isNaN(actualCostNum) && actualCostNum >= 0 ? actualCostNum : 0,
    });

    if (!res.success) {
      setEditError(res.error || 'Failed to update item.');
      return;
    }

    setEditingItemId(null);
    setEditError(null);
  };

  const handleDeleteItem = (itemId: string) => {
    if (!dispatchMutation) return;
    dispatchMutation({
      type: 'REMOVE_BUDGET_ITEM',
      itemId,
    });
  };

  return (
    <div className="space-y-4">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="p-4 bg-card shadow-sm border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
              Projected Total
            </span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1">
            {formatCurrency(projectedTotal, currency)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Across {items.length} planning line items
          </span>
        </Card>

        <Card className="p-4 bg-card shadow-sm border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
              Committed / Spent
            </span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1">
            {formatCurrency(committedTotal, currency)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Locked in contracts or advance payments
          </span>
        </Card>

        <Card className="p-4 bg-card shadow-sm border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
              Remaining Buffer
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p
            className={`text-xl font-bold mt-1 ${
              remainingBuffer >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-destructive'
            }`}
          >
            {formatCurrency(remainingBuffer, currency)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            {remainingBuffer >= 0 ? 'Within budget cap' : 'Over allocated'}
          </span>
        </Card>
      </div>

      {/* Line Item Table Card */}
      <Card className="shadow-sm border-border overflow-hidden">
        <CardHeader className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold">Budget Breakdown</CardTitle>
              <CardDescription>
                Deterministic integer arithmetic guarantees zero floating-point precision drift.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border">
                Planning Estimates Only
              </span>
              {dispatchMutation && (
                <Button
                  size="sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="h-8 text-xs cursor-pointer inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </Button>
              )}
            </div>
          </div>

          {/* Add Item Form */}
          {showAddForm && (
            <form onSubmit={handleCreateItem} className="mt-4 p-3 bg-muted/30 rounded-lg border border-border space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <label htmlFor="new-item-name" className="font-semibold block mb-1">
                    Item Name *
                  </label>
                  <Input
                    id="new-item-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Wedding Cake"
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <label htmlFor="new-item-category" className="font-semibold block mb-1">
                    Category *
                  </label>
                  <Input
                    id="new-item-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g. Catering"
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <label htmlFor="new-item-est" className="font-semibold block mb-1">
                    Estimated Cost ({currency}) *
                  </label>
                  <Input
                    id="new-item-est"
                    type="number"
                    min="0"
                    value={newEstCost}
                    onChange={(e) => setNewEstCost(e.target.value)}
                    placeholder="25000"
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <label htmlFor="new-item-actual" className="font-semibold block mb-1">
                    Actual / Quoted Cost
                  </label>
                  <Input
                    id="new-item-actual"
                    type="number"
                    min="0"
                    value={newActualCost}
                    onChange={(e) => setNewActualCost(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              {addError && (
                <div role="alert" className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" className="h-7 text-xs px-3 cursor-pointer">
                  Save Item
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

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Line Item & Notes</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Estimated</TableHead>
                <TableHead className="text-right">Actual / Quoted</TableHead>
                <TableHead className="text-center">Status</TableHead>
                {dispatchMutation && <TableHead className="text-center w-[12%]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isEditing = editingItemId === item.id;

                if (isEditing) {
                  return (
                    <TableRow key={item.id} className="bg-muted/20">
                      <TableCell colSpan={dispatchMutation ? 6 : 5} className="p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Name"
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                          <div>
                            <Input
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              placeholder="Category"
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                          <div>
                            <Input
                              type="number"
                              min="0"
                              value={editEstCost}
                              onChange={(e) => setEditEstCost(e.target.value)}
                              placeholder="Estimated"
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                          <div>
                            <Input
                              type="number"
                              min="0"
                              value={editActualCost}
                              onChange={(e) => setEditActualCost(e.target.value)}
                              placeholder="Actual"
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                        </div>

                        {editError && (
                          <div role="alert" className="text-xs text-destructive mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>{editError}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(item.id)}
                            className="h-6 text-xs px-2 cursor-pointer inline-flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingItemId(null)}
                            className="h-6 text-xs px-2 cursor-pointer inline-flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <p className="text-foreground font-semibold">{item.name}</p>
                      {item.notes && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {item.notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground font-medium">
                        {item.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground font-mono">
                      {formatCurrency(item.estimatedCost, currency)}
                    </TableCell>
                    <TableCell className="text-right font-semibold font-mono text-foreground">
                      {formatCurrency(item.actualCost, currency)}
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(item.status, item.id)}</TableCell>
                    {dispatchMutation && (
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(item)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Edit line item"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item.id)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                            title="Delete line item"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
