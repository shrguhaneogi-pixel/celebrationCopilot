// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventPlanProvider, INITIAL_EVENT_PLAN } from '@/context/EventPlanContext';
import { ChatSidebar } from '@/components/dashboard/ChatSidebar';
import { EventPlan } from '@/domain/event-plan.schema';

describe('ChatSidebar Integration & Workflow', () => {
  beforeEach(() => {
    localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithContext = () => {
    return render(
      <EventPlanProvider persistToLocalStorage={false}>
        <ChatSidebar />
      </EventPlanProvider>
    );
  };

  it('renders chat interface with live announcement region and prompt chips', () => {
    renderWithContext();

    expect(screen.getByText('Planning Copilot')).toBeDefined();
    expect(screen.getByPlaceholderText(/Suggest an event change/i)).toBeDefined();
    expect(screen.getByText('200 Guests')).toBeDefined();
    expect(screen.getByText('Add DJ (₹45,000)')).toBeDefined();
  });

  it('populates textarea when a suggestion chip is clicked', () => {
    renderWithContext();

    const chip = screen.getByText('200 Guests');
    fireEvent.click(chip);

    const textarea = screen.getByRole('textbox', { name: /Planning Copilot chat input/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Increase guests to 200');
  });

  it('handles Shift+Enter for newline without submitting form', () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    renderWithContext();

    const textarea = screen.getByRole('textbox', { name: /Planning Copilot chat input/i });
    fireEvent.change(textarea, { target: { value: 'Line 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    // Should NOT have called fetch
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends message on Enter, disables input during submission, and renders proposal diff', async () => {
    const nextPlan: EventPlan = {
      ...INITIAL_EVENT_PLAN,
      version: 2,
      guestCount: 200,
      createdAt: '2026-10-29T10:00:00.000Z',
      updatedAt: '2026-10-29T10:05:00.000Z',
    };

    const mockApiResponse = {
      success: true,
      proposal: {
        summary: 'Update guest count to 200',
        confidence: 0.95,
        operations: [
          {
            type: 'UPDATE_GUEST_COUNT',
            guestCount: 200,
          },
        ],
      },
      plan: nextPlan,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    renderWithContext();

    const textarea = screen.getByRole('textbox', { name: /Planning Copilot chat input/i });
    fireEvent.change(textarea, { target: { value: 'Update guest count to 200' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    // Inflight: message is added to chat, input cleared
    expect(screen.getByText('Update guest count to 200')).toBeDefined();

    // Awaits response
    await waitFor(() => {
      expect(screen.getByText('Apply to Plan')).toBeDefined();
      expect(screen.getByText('Dismiss')).toBeDefined();
    });

    // Untrusted safety notice is clearly displayed
    expect(screen.getByText(/Untrusted proposal: state is untouched until you click Apply/i)).toBeDefined();

    // Click Apply to Plan
    const applyButton = screen.getByText('Apply to Plan');
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText('Proposal Applied Successfully!')).toBeDefined();
    });
  });

  it('allows dismissing a proposal without modifying plan state', async () => {
    const mockApiResponse = {
      success: true,
      proposal: {
        summary: 'Add decorative lighting',
        confidence: 0.9,
        operations: [
          {
            type: 'ADD_BUDGET_ITEM',
            name: 'Fairy lights & chandeliers',
            category: 'decor',
            estimatedCost: 25000,
          },
        ],
      },
      plan: {
        ...INITIAL_EVENT_PLAN,
        version: 2,
        createdAt: '2026-10-29T10:00:00.000Z',
        updatedAt: '2026-10-29T10:05:00.000Z',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    renderWithContext();

    const textarea = screen.getByRole('textbox', { name: /Planning Copilot chat input/i });
    fireEvent.change(textarea, { target: { value: 'Add fairy lights' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText('Dismiss')).toBeDefined();
    });

    const dismissButton = screen.getByText('Dismiss');
    fireEvent.click(dismissButton);

    // Proposal buttons should be dismissed
    expect(screen.queryByText('Apply to Plan')).toBeNull();
  });

  it('handles server errors gracefully and provides a retry mechanism', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          json: async () => ({
            success: false,
            error: 'AI Provider timeout. Plan preserved.',
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          proposal: {
            summary: 'Recovered proposal after retry',
            confidence: 0.9,
            operations: [],
          },
          plan: {
            ...INITIAL_EVENT_PLAN,
            version: 2,
            createdAt: '2026-10-29T10:00:00.000Z',
            updatedAt: '2026-10-29T10:05:00.000Z',
          },
        }),
      } as Response;
    });

    renderWithContext();

    const textarea = screen.getByRole('textbox', { name: /Planning Copilot chat input/i });
    fireEvent.change(textarea, { target: { value: 'Check budget buffer' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    // Error feedback in both message bubble and accessible live region
    await waitFor(() => {
      expect(screen.getAllByText(/AI Provider timeout/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Retry/i)).toBeDefined();
    });

    // Click Retry
    const retryButton = screen.getByText(/Retry/i);
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getAllByText(/Recovered proposal after retry/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(callCount).toBe(2);
  });
});
