import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { MockBudgetItem } from '@/lib/mock-data';
import { Layers, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface BudgetTrackerProps {
  items: MockBudgetItem[];
  totalCap: number;
  currency: string;
}

export function BudgetTracker({ items, totalCap, currency }: BudgetTrackerProps) {
  const projectedTotal = items.reduce((sum, item) => sum + item.estimatedCost, 0);
  const committedTotal = items
    .filter((item) => item.status === 'committed' || item.status === 'paid')
    .reduce((sum, item) => sum + item.actualCost, 0);
  const remainingBuffer = totalCap - projectedTotal;

  const getStatusBadge = (status: MockBudgetItem['status']) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success">Paid</Badge>;
      case 'committed':
        return <Badge variant="default">Committed</Badge>;
      case 'quoted':
        return <Badge variant="secondary">Quoted</Badge>;
      case 'projected':
      default:
        return <Badge variant="outline">Projected</Badge>;
    }
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

      {/* Line Item Table */}
      <Card className="shadow-sm border-border overflow-hidden">
        <CardHeader className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold">Budget Breakdown</CardTitle>
              <CardDescription>
                Deterministic integer arithmetic guarantees zero floating-point precision drift.
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border self-start sm:self-auto">
              Planning Estimates Only
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[38%]">Line Item & Notes</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Estimated</TableHead>
                <TableHead className="text-right">Actual / Quoted</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
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
                  <TableCell className="text-center">{getStatusBadge(item.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
