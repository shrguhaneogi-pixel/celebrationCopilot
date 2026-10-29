import React from 'react';
import { Calendar, MapPin, Users, Sparkles, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { MockEventPlan } from '@/lib/mock-data';

interface EventHeaderProps {
  plan: MockEventPlan;
}

export function EventHeader({ plan }: EventHeaderProps) {
  // Compute totals deterministically for static display
  const projectedTotal = plan.items.reduce((sum, item) => sum + item.estimatedCost, 0);
  const remainingBudget = plan.totalCap - projectedTotal;
  const allocationPercent = Math.min(100, Math.round((projectedTotal / plan.totalCap) * 100));
  const isOverBudget = remainingBudget < 0;

  return (
    <Card className="p-5 md:p-6 shadow-sm border-border bg-card">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {plan.title}
            </h1>
            <Badge variant="default" className="text-xs font-medium">
              <Sparkles className="w-3 h-3 mr-1" />
              {plan.eventType}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              {plan.venue}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              {new Date(plan.eventDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              {plan.guestCount} Guests
            </span>
          </div>
        </div>

        <div className="flex md:flex-col items-baseline md:items-end justify-between md:justify-center border-t md:border-t-0 border-border pt-3 md:pt-0">
          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Target Budget Ceiling
          </span>
          <span className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
            {formatCurrency(plan.totalCap, plan.currency)}
          </span>
        </div>
      </div>

      {/* Budget Allocation Progress */}
      <div className="pt-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Allocated Planning Budget:{' '}
            <strong className="text-foreground font-semibold">
              {formatCurrency(projectedTotal, plan.currency)} ({allocationPercent}%)
            </strong>
          </span>
          {isOverBudget ? (
            <span className="text-destructive font-semibold inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Budget Exceeded by {formatCurrency(Math.abs(remainingBudget), plan.currency)}
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Remaining Buffer: {formatCurrency(remainingBudget, plan.currency)}
            </span>
          )}
        </div>

        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border/50">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isOverBudget ? 'bg-destructive' : 'bg-primary'
            }`}
            style={{ width: `${allocationPercent}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
