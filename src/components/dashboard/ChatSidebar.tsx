'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MockChatMessage } from '@/lib/mock-data';
import { EventPlan, EventPlanSchema } from '@/domain/event-plan.schema';
import { formatCurrency } from '@/lib/utils';
import { useEventPlan } from '@/context/EventPlanContext';
import { Bot, Send, Sparkles, PlusCircle, Check, ArrowRight, ShieldAlert, Loader2, RotateCcw } from 'lucide-react';

interface ChatSidebarProps {
  initialMessages?: MockChatMessage[];
  currency?: string;
  currentPlan?: EventPlan;
  onApplyPlan?: (newPlan: EventPlan) => void;
}

export function ChatSidebar({
  initialMessages = [],
  currency: propCurrency,
  currentPlan: propPlan,
  onApplyPlan: propOnApplyPlan,
}: ChatSidebarProps) {
  let contextPlan: ReturnType<typeof useEventPlan>['plan'] | undefined;
  let contextEventId: string | null | undefined;
  let contextIsSubmitting: boolean = false;
  let contextApplyServerProposal: ReturnType<typeof useEventPlan>['applyServerProposal'] | undefined;
  let setIsSubmitting: ((s: boolean) => void) | undefined;

  try {
    const context = useEventPlan();
    contextPlan = context.plan;
    contextEventId = context.eventId;
    contextIsSubmitting = context.isSubmitting;
    contextApplyServerProposal = context.applyServerProposal;
    setIsSubmitting = context.setIsSubmitting;
  } catch {
    // Fallback if rendered outside context
  }

  const activePlan = contextPlan || propPlan;
  const currency = activePlan ? activePlan.currency : (propCurrency || 'INR');

  const [messages, setMessages] = useState<MockChatMessage[]>(initialMessages);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stagedPlan, setStagedPlan] = useState<EventPlan | null>(null);
  const [stagedBaseVersion, setStagedBaseVersion] = useState<number | null>(null);
  const [stagedRevision, setStagedRevision] = useState<number | null>(null);
  const [appliedProposal, setAppliedProposal] = useState(false);
  const [dismissedProposal, setDismissedProposal] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleApply = () => {
    if (!stagedPlan) return;

    if (contextApplyServerProposal && stagedBaseVersion !== null) {
      const res = contextApplyServerProposal(stagedPlan, stagedBaseVersion, stagedRevision ?? undefined);
      if (res.success) {
        setAppliedProposal(true);
        setLiveAnnouncement('Proposal applied successfully to event plan.');
      } else {
        const errorMsg: MockChatMessage = {
          id: `conflict-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ ${res.error || 'Failed to apply proposal due to state conflict.'}`,
          timestamp: 'Just now',
        };
        setMessages((prev) => [...prev, errorMsg]);
        setLiveAnnouncement(res.error || 'Conflict applying proposal.');
      }
    } else if (propOnApplyPlan) {
      propOnApplyPlan(stagedPlan);
      setAppliedProposal(true);
      setLiveAnnouncement('Proposal applied successfully to event plan.');
    }
  };

  const handleDismiss = () => {
    setDismissedProposal(true);
    setStagedPlan(null);
    setStagedBaseVersion(null);
    setStagedRevision(null);
    setLiveAnnouncement('Proposal dismissed.');
  };

  const executeSend = async (promptText: string) => {
    if (!promptText.trim() || isLoading || contextIsSubmitting || !activePlan) return;

    const baseVersion = activePlan.version;
    setLastPrompt(promptText);

    const userMsg: MockChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: promptText,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsLoading(true);
    if (setIsSubmitting) setIsSubmitting(true);
    setLiveAnnouncement('Generating AI proposal...');

    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          eventId: contextEventId || undefined,
          currentPlan: activePlan,
        }),
      });

      const data = await res.json();

      if (data.success && data.proposal && data.plan) {
        // Client-side validation boundary: never trust server response blindly
        const planValidation = EventPlanSchema.safeParse(data.plan);
        if (!planValidation.success) {
          throw new Error(`Client rejected invalid plan response: ${planValidation.error.message}`);
        }

        setStagedRevision(data.revision || null);

        let costDelta = 0;
        const mutationsList: string[] = [];

        for (const op of data.proposal.operations) {
          if (op.type === 'ADD_BUDGET_ITEM') {
            costDelta += op.estimatedCost;
            mutationsList.push(`ADD_BUDGET_ITEM: ${op.name} (+${formatCurrency(op.estimatedCost, currency)})`);
          } else if (op.type === 'UPDATE_BUDGET_ITEM') {
            mutationsList.push(`UPDATE_BUDGET_ITEM: ${op.name || op.itemId}`);
          } else if (op.type === 'REMOVE_BUDGET_ITEM') {
            mutationsList.push(`REMOVE_BUDGET_ITEM: Item ${op.itemId}`);
          } else if (op.type === 'UPDATE_GUEST_COUNT') {
            mutationsList.push(`UPDATE_GUEST_COUNT: ${op.guestCount} guests`);
          } else if (op.type === 'UPDATE_TARGET_BUDGET') {
            mutationsList.push(`UPDATE_TARGET_BUDGET: ${formatCurrency(op.totalCap, currency)}`);
          } else if (op.type === 'ADD_MILESTONE') {
            mutationsList.push(`ADD_MILESTONE: ${op.title} (${op.offsetDays}d)`);
          } else if (op.type === 'UPDATE_MILESTONE') {
            mutationsList.push(`UPDATE_MILESTONE: ${op.title || op.milestoneId}`);
          } else if (op.type === 'REMOVE_MILESTONE') {
            mutationsList.push(`REMOVE_MILESTONE: Milestone ${op.milestoneId}`);
          } else if (op.type === 'ADD_VENDOR') {
            mutationsList.push(`ADD_VENDOR: ${op.name} (${op.category})`);
          } else if (op.type === 'UPDATE_VENDOR') {
            mutationsList.push(`UPDATE_VENDOR: Vendor ${op.vendorId}`);
          } else if (op.type === 'REMOVE_VENDOR') {
            mutationsList.push(`REMOVE_VENDOR: Vendor ${op.vendorId}`);
          } else if (op.type === 'SET_DETAILS') {
            mutationsList.push(`SET_DETAILS: ${op.title || op.eventDate || 'Updated details'}`);
          }
        }

        setStagedPlan(planValidation.data);
        setStagedBaseVersion(baseVersion);
        setAppliedProposal(false);
        setDismissedProposal(false);

        const replyMsg: MockChatMessage = {
          id: `reply-${Date.now()}`,
          sender: 'assistant',
          text: data.proposal.summary,
          timestamp: 'Just now',
          proposalDiff: {
            title: data.proposal.summary,
            costDelta,
            mutations: mutationsList,
          },
        };

        setMessages((prev) => [...prev, replyMsg]);
        setLiveAnnouncement(`Proposal ready for review: ${data.proposal.summary}`);
      } else {
        const errorReply: MockChatMessage = {
          id: `reply-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ ${data.error || 'Unable to apply proposal. Your plan was preserved.'}`,
          timestamp: 'Just now',
        };
        setMessages((prev) => [...prev, errorReply]);
        setLiveAnnouncement(`Error: ${data.error || 'Failed to generate proposal'}`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Network request failed';
      const errorReply: MockChatMessage = {
        id: `reply-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ ${errorMsg}. Your plan was preserved.`,
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, errorReply]);
      setLiveAnnouncement(`Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
      if (setIsSubmitting) setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSend(inputVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeSend(inputVal);
    }
  };

  const handleChipClick = (prompt: string) => {
    setInputVal(prompt);
  };

  const handleRetryLast = () => {
    if (lastPrompt) {
      executeSend(lastPrompt);
    }
  };

  const isLocked = isLoading || contextIsSubmitting;

  return (
    <Card className="shadow-sm border-border flex flex-col h-full min-h-[580px] bg-card">
      {/* Accessible Live Region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* Header */}
      <CardHeader className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                Planning Copilot
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">Deterministic Proposal Model</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            Vercel AI SDK
          </Badge>
        </div>
      </CardHeader>

      {/* Messages Feed */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isErrorMsg = msg.text.startsWith('⚠️');

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 shadow-xs ${
                  isUser
                    ? 'bg-primary text-primary-foreground rounded-tr-none'
                    : isErrorMsg
                    ? 'bg-destructive/10 border border-destructive/30 text-destructive rounded-tl-none'
                    : 'bg-muted/50 border border-border text-foreground rounded-tl-none'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <span
                  className={`text-[10px] mt-1 block ${
                    isUser
                      ? 'text-primary-foreground/75'
                      : isErrorMsg
                      ? 'text-destructive/80'
                      : 'text-muted-foreground'
                  }`}
                >
                  {msg.timestamp}
                </span>

                {isErrorMsg && lastPrompt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRetryLast}
                    disabled={isLocked}
                    aria-label="Retry message"
                    className="mt-1 h-6 px-2 text-[10px] text-destructive hover:bg-destructive/20 cursor-pointer inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Retry
                  </Button>
                )}
              </div>

              {/* Proposal Diff Card */}
              {msg.proposalDiff && !dismissedProposal && (
                <div className="w-full mt-2 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary flex items-center gap-1 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      {msg.proposalDiff.title}
                    </span>
                    {msg.proposalDiff.costDelta !== 0 && (
                      <Badge variant="default" className="text-[10px] font-mono">
                        {msg.proposalDiff.costDelta > 0 ? '+' : ''}
                        {formatCurrency(msg.proposalDiff.costDelta, currency)}
                      </Badge>
                    )}
                  </div>

                  {msg.proposalDiff.mutations.length > 0 && (
                    <ul className="space-y-1 text-[11px] text-muted-foreground border-l-2 border-primary/40 pl-2">
                      {msg.proposalDiff.mutations.map((m, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <ArrowRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {appliedProposal ? (
                    <div className="p-2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-center flex items-center justify-center gap-1 text-[11px]">
                      <Check className="w-3.5 h-3.5" />
                      Proposal Applied Successfully!
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1 border-t border-border/60">
                      <Button
                        size="sm"
                        disabled={isLocked}
                        className="flex-1 text-xs h-7 cursor-pointer"
                        onClick={handleApply}
                      >
                        Apply to Plan
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isLocked}
                        className="text-xs h-7 cursor-pointer"
                        onClick={handleDismiss}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-muted-foreground shrink-0" />
                    Untrusted proposal: state is untouched until you click Apply.
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>AI generating structured proposal...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      {/* Quick Suggestion Chips */}
      <div className="px-4 py-2 bg-muted/30 border-t border-border flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={isLocked}
          onClick={() => handleChipClick('Increase guests to 200')}
          className="text-[11px] bg-card hover:bg-muted text-foreground border border-border px-2 py-0.5 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
        >
          <PlusCircle className="w-3 h-3 text-primary" />
          200 Guests
        </button>
        <button
          type="button"
          disabled={isLocked}
          onClick={() => handleChipClick('Add live dhol players and DJ for ₹45,000')}
          className="text-[11px] bg-card hover:bg-muted text-foreground border border-border px-2 py-0.5 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
        >
          <PlusCircle className="w-3 h-3 text-primary" />
          Add DJ (₹45,000)
        </button>
        <button
          type="button"
          disabled={isLocked}
          onClick={() => handleChipClick('Increase budget cap to ₹30,00,000')}
          className="text-[11px] bg-card hover:bg-muted text-foreground border border-border px-2 py-0.5 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
        >
          <PlusCircle className="w-3 h-3 text-primary" />
          Expand Budget
        </button>
      </div>

      {/* Input Composer */}
      <CardFooter className="p-3 border-t border-border">
        <form onSubmit={handleFormSubmit} className="w-full space-y-1.5">
          <div className="flex gap-2">
            <textarea
              rows={1}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Suggest an event change (Enter to send, Shift+Enter for newline)..."
              disabled={isLocked}
              aria-label="Planning Copilot chat input"
              className="text-xs w-full resize-none p-2 rounded-md border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary disabled:opacity-50 leading-relaxed max-h-24"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isLocked || !inputVal.trim()}
              className="h-auto px-3 cursor-pointer self-end"
              aria-label="Send message"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground">
            Strict ProposalSchema validation • Deterministic math execution
          </p>
        </form>
      </CardFooter>
    </Card>
  );
}
