import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MockChatMessage } from '@/lib/mock-data';
import { formatCurrency } from '@/lib/utils';
import { Bot, Send, Sparkles, PlusCircle, Check, ArrowRight, ShieldAlert } from 'lucide-react';

interface ChatSidebarProps {
  initialMessages: MockChatMessage[];
  currency: string;
}

export function ChatSidebar({ initialMessages, currency }: ChatSidebarProps) {
  const [messages, setMessages] = useState<MockChatMessage[]>(initialMessages);
  const [inputVal, setInputVal] = useState('');
  const [appliedProposal, setAppliedProposal] = useState(false);
  const [dismissedProposal, setDismissedProposal] = useState(false);

  const handleApply = () => {
    setAppliedProposal(true);
  };

  const handleDismiss = () => {
    setDismissedProposal(true);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userMsg: MockChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: inputVal,
      timestamp: 'Just now',
    };

    const mockReply: MockChatMessage = {
      id: `reply-${Date.now()}`,
      sender: 'assistant',
      text: `[Mock Simulator] Received: "${inputVal}". In Phase 3, this prompt generates a structured ProposalSchema proposal.`,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg, mockReply]);
    setInputVal('');
  };

  const handleChipClick = (prompt: string) => {
    setInputVal(prompt);
  };

  return (
    <Card className="shadow-sm border-border flex flex-col h-full min-h-[580px] bg-card">
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
              <p className="text-[11px] text-muted-foreground">Untrusted Proposal Model</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            Mock Simulator
          </Badge>
        </div>
      </CardHeader>

      {/* Messages Feed */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 shadow-xs ${
                  isUser
                    ? 'bg-primary text-primary-foreground rounded-tr-none'
                    : 'bg-muted/50 border border-border text-foreground rounded-tl-none'
                }`}
              >
                <p className="leading-relaxed">{msg.text}</p>
                <span
                  className={`text-[10px] mt-1 block ${
                    isUser ? 'text-primary-foreground/75' : 'text-muted-foreground'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {/* Proposal Diff Card */}
              {msg.proposalDiff && !dismissedProposal && (
                <div className="w-full mt-2 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary flex items-center gap-1 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      {msg.proposalDiff.title}
                    </span>
                    <Badge variant="default" className="text-[10px] font-mono">
                      +{formatCurrency(msg.proposalDiff.costDelta, currency)}
                    </Badge>
                  </div>

                  <ul className="space-y-1 text-[11px] text-muted-foreground border-l-2 border-primary/40 pl-2">
                    {msg.proposalDiff.mutations.map((m, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <ArrowRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>

                  {appliedProposal ? (
                    <div className="p-2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-center flex items-center justify-center gap-1 text-[11px]">
                      <Check className="w-3.5 h-3.5" />
                      Proposal Staged to Plan (Mock Mode)
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1 border-t border-border/60">
                      <Button
                        size="sm"
                        className="flex-1 text-xs h-7"
                        onClick={handleApply}
                      >
                        Apply to Plan
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={handleDismiss}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-muted-foreground" />
                    Proposals do not modify state until validated and applied.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>

      {/* Quick Suggestion Chips */}
      <div className="px-4 py-2 bg-muted/30 border-t border-border flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => handleChipClick('Add live dhol players for the Baraat')}
          className="text-[11px] bg-card hover:bg-muted text-foreground border border-border px-2 py-0.5 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1"
        >
          <PlusCircle className="w-3 h-3 text-primary" />
          Baraat Dhol
        </button>
        <button
          type="button"
          onClick={() => handleChipClick('Add royal fireworks and cold pyros for Varmala')}
          className="text-[11px] bg-card hover:bg-muted text-foreground border border-border px-2 py-0.5 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1"
        >
          <PlusCircle className="w-3 h-3 text-primary" />
          Varmala Pyros
        </button>
      </div>

      {/* Input Composer */}
      <CardFooter className="p-3 border-t border-border">
        <form onSubmit={handleSend} className="w-full space-y-1.5">
          <div className="flex gap-2">
            <Input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Suggest an event change..."
              className="text-xs h-9 bg-background"
            />
            <Button type="submit" size="sm" className="h-9 px-3">
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground">
            Static Mock Mode • Generates structured simulated proposals
          </p>
        </form>
      </CardFooter>
    </Card>
  );
}
