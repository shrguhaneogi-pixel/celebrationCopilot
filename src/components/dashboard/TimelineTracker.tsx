import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MockMilestone } from '@/lib/mock-data';
import { CheckCircle2, Clock, CalendarClock } from 'lucide-react';

interface TimelineTrackerProps {
  milestones: MockMilestone[];
  eventDate: string;
}

export function TimelineTracker({ milestones, eventDate }: TimelineTrackerProps) {
  const completedCount = milestones.filter((m) => m.completed).length;
  const progressPercent = Math.round((completedCount / milestones.length) * 100);

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              Adaptive Milestone Timeline
            </CardTitle>
            <CardDescription>
              All target deadlines are automatically computed from the celebration date ({eventDate}).
            </CardDescription>
          </div>
          <Badge variant="outline" className="self-start sm:self-auto font-mono text-xs">
            {completedCount}/{milestones.length} Completed ({progressPercent}%)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <div className="space-y-3">
          {milestones.map((ms) => {
            const isEventDay = ms.offsetDays === 0;
            const offsetLabel = isEventDay ? 'Event Day' : `${ms.offsetDays}d`;

            return (
              <div
                key={ms.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border transition-colors ${
                  ms.completed
                    ? 'bg-muted/40 border-border/80'
                    : 'bg-card border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  <span
                    className={`inline-flex items-center justify-center font-mono text-xs font-bold px-2 py-1 rounded min-w-[54px] border ${
                      isEventDay
                        ? 'bg-primary text-primary-foreground border-primary'
                        : ms.completed
                        ? 'bg-muted text-muted-foreground border-border'
                        : 'bg-primary/10 text-primary border-primary/20'
                    }`}
                  >
                    {offsetLabel}
                  </span>

                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        ms.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                      }`}
                    >
                      {ms.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>Due: {ms.dueDate}</span>
                      <span>•</span>
                      <span className="capitalize">{ms.category}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {ms.completed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                      Upcoming
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
