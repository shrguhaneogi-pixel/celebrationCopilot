import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MockVendorItem } from '@/lib/mock-data';
import { Check, Copy, HelpCircle, Briefcase } from 'lucide-react';

interface VendorTrackerProps {
  vendors: MockVendorItem[];
}

export function VendorTracker({ vendors }: VendorTrackerProps) {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const handleCopyQuestion = (question: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(question);
      setCopiedIndex(key);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const getPriorityBadge = (priority: MockVendorItem['priority']) => {
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

  const getStatusBadge = (status: MockVendorItem['status']) => {
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
          <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border self-start sm:self-auto">
            Simulated Suggestions
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vendors.map((vendor) => (
            <div
              key={vendor.id}
              className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{vendor.name}</h4>
                  <p className="text-xs text-muted-foreground">{vendor.category}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {getPriorityBadge(vendor.priority)}
                  {getStatusBadge(vendor.status)}
                </div>
              </div>

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
                          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopyQuestion(q, copyKey)}
                          title="Copy question to clipboard"
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
