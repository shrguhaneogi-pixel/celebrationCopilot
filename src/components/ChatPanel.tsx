'use client';

import React, { useState } from 'react';
import { EventPlan } from '@/lib/domain/types';
import { EventPlanProposal } from '@/lib/domain/mutations';
import { formatCurrency } from '@/lib/utils';
import { Sparkles, Send, Check, X, Bot, User, Clock, ArrowRight } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  proposal?: EventPlanProposal;
  latencyMs?: number;
}

interface ChatPanelProps {
  plan: EventPlan;
  onApplyProposal: (proposal: EventPlanProposal) => void;
}

const QUICK_PROMPTS = [
  'Add catering for a dinner buffet',
  'We need a DJ and sound equipment',
  'Suggest photography milestones',
];

export function ChatPanel({ plan, onApplyProposal }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am Celebration Copilot. Tell me what changes or additions you want for your celebration, and I will propose verified mutations for your review.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<EventPlanProposal | null>(null);

  const handleSubmit = async (promptText: string) => {
    if (!promptText.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: promptText.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const startTime = performance.now();

    try {
      const res = await fetch('/api/plan/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          currentPlan: plan,
        }),
      });

      const elapsed = Math.round(performance.now() - startTime);
      const json = await res.json();

      if (json.success && json.data) {
        const proposal: EventPlanProposal = json.data;
        setPendingProposal(proposal);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: 'assistant',
            text: proposal.explanation,
            proposal,
            latencyMs: elapsed,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: 'assistant',
            text: `⚠️ ${json.error || 'Could not generate proposal. Please try again.'}`,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: `Error connecting to planner API: ${err instanceof Error ? err.message : 'Network error'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (prop: EventPlanProposal) => {
    onApplyProposal(prop);
    setPendingProposal(null);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-900">Copilot Assistant</h3>
            <p className="text-2xs text-slate-500">Atomic mutation proposals</p>
          </div>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 text-sm ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-xl p-3.5 ${
                m.sender === 'user'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>

              {m.latencyMs !== undefined && (
                <div className="mt-2 text-2xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Generated in {m.latencyMs}ms {m.latencyMs < 2500 ? '⚡ (<2.5s goal)' : ''}
                </div>
              )}
            </div>

            {m.sender === 'user' && (
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 text-sm items-center text-slate-500 italic py-2">
            <Bot className="w-4 h-4 animate-spin text-indigo-600" />
            Analyzing event context and generating proposal...
          </div>
        )}

        {/* Pending Proposal Review Card */}
        {pendingProposal && (
          <div className="my-3 p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Review Proposed Changes ({pendingProposal.mutations.length})
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs pr-1">
              {pendingProposal.mutations.map((mut, idx) => (
                <div
                  key={idx}
                  className="bg-white p-2 rounded-lg border border-indigo-100 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-mono text-2xs uppercase px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-semibold">
                      {mut.type.replace('_', ' ')}
                    </span>
                    <span className="text-slate-800 font-medium truncate">
                      {'name' in mut ? mut.name : 'title' in mut ? mut.title : ''}
                    </span>
                  </div>

                  {'estimatedCost' in mut && typeof mut.estimatedCost === 'number' && (
                    <span className="text-emerald-700 font-semibold shrink-0">
                      +{formatCurrency(mut.estimatedCost)}
                    </span>
                  )}

                  {'offsetDays' in mut && typeof mut.offsetDays === 'number' && (
                    <span className="text-slate-500 font-mono text-2xs shrink-0">
                      {mut.offsetDays}d
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleApply(pendingProposal)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                Apply to Plan
              </button>
              <button
                onClick={() => setPendingProposal(null)}
                className="inline-flex items-center justify-center gap-1 py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs rounded-lg border border-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 bg-slate-50/75 border-t border-slate-100 flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((qp, idx) => (
          <button
            key={idx}
            disabled={isLoading}
            onClick={() => handleSubmit(qp)}
            className="text-2xs bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 px-2 py-1 rounded-md border border-slate-200 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {qp}
            <ArrowRight className="w-2.5 h-2.5 opacity-50" />
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(input);
        }}
        className="p-3 border-t border-slate-200 flex gap-2 bg-white"
      >
        <input
          type="text"
          value={input}
          disabled={isLoading}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for ideas, budget line items, vendors..."
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
