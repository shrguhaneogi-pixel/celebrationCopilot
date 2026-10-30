// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/page';
import {
  PlanExportModal,
  generatePlanSummaryText,
  generateVendorManifestMarkdown,
} from '@/components/dashboard/PlanExportModal';
import { EventPlanProvider } from '@/context/EventPlanContext';
import { EventPlan } from '@/domain/event-plan.schema';

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

const TEST_PLAN: EventPlan = {
  id: 'evt-test-999',
  version: 2,
  title: 'Royal Anniversary Gala',
  eventType: 'Anniversary',
  eventDate: '2026-11-20',
  timezone: 'Asia/Kolkata',
  location: 'Udaipur Palace Grounds',
  guestCount: 250,
  currency: 'INR',
  totalCap: 1500000,
  items: [
    {
      id: 'item-1',
      name: 'Palace Courtyard Venue',
      category: 'venue',
      estimatedCost: 600000,
      actualCost: 550000,
      status: 'committed',
      notes: 'Includes lighting',
    },
    {
      id: 'item-2',
      name: 'Royal Catering Buffet',
      category: 'catering',
      estimatedCost: 400000,
      actualCost: 420000,
      status: 'quoted',
    },
  ],
  milestones: [
    {
      id: 'ms-1',
      title: 'Sign Venue Contract',
      offsetDays: -90,
      dueDate: '2026-08-22',
      category: 'venue',
      completed: true,
    },
    {
      id: 'ms-2',
      title: 'Food Tasting Session',
      offsetDays: -45,
      dueDate: '2026-10-06',
      category: 'catering',
      completed: false,
    },
  ],
  vendors: [
    {
      id: 'v-1',
      name: 'Maharaja Royal Caterers',
      category: 'catering',
      priority: 'high',
      status: 'quoted',
      suggestedQuestions: [
        'Can you accommodate vegan dietary preferences?',
        'What is your staff-to-guest ratio?',
      ],
    },
    {
      id: 'v-2',
      name: 'Palace String Quartet',
      category: 'entertainment',
      priority: 'medium',
      status: 'not_started',
      suggestedQuestions: [],
    },
  ],
};

describe('PlanExportModal & Dashboard Integration (ALIGN-002)', () => {
  let mockWriteText: ReturnType<typeof vi.fn>;
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockPrint: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    // Mock clipboard
    mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    // Mock URL object methods
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-export-url');
    mockRevokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      value: mockCreateObjectURL,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      value: mockRevokeObjectURL,
      writable: true,
      configurable: true,
    });

    // Mock window.print
    mockPrint = vi.fn(() => {});
    Object.defineProperty(window, 'print', {
      value: mockPrint,
      writable: true,
      configurable: true,
    });

    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navbar Integration & Modal Opening', () => {
    it('renders "Export Plan" button in the navbar with accessible name', () => {
      render(<DashboardPage />);
      const exportBtn = screen.getByRole('button', { name: /Export Plan/i });
      expect(exportBtn).toBeDefined();
      expect(exportBtn.getAttribute('aria-label')).toBe('Export Plan');
    });

    it('opens the export modal upon clicking "Export Plan" button', () => {
      render(<DashboardPage />);

      // Modal dialog should not be in document initially
      expect(screen.queryByRole('dialog')).toBeNull();

      const exportBtn = screen.getByRole('button', { name: /Export Plan/i });
      fireEvent.click(exportBtn);

      // Modal dialog should now be visible
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(screen.getByRole('heading', { name: /Export & Share Event Plan/i })).toBeDefined();
    });

    it('opens the modal when Enter key is pressed on the "Export Plan" button', () => {
      render(<DashboardPage />);

      const exportBtn = screen.getByRole('button', { name: /Export Plan/i });
      fireEvent.keyDown(exportBtn, { key: 'Enter' });

      expect(screen.getByRole('dialog')).toBeDefined();
    });

    it('opens the modal when Space key is pressed on the "Export Plan" button', () => {
      render(<DashboardPage />);

      const exportBtn = screen.getByRole('button', { name: /Export Plan/i });
      fireEvent.keyDown(exportBtn, { key: ' ' });

      expect(screen.getByRole('dialog')).toBeDefined();
    });
  });

  describe('Modal Dismissal & Focus Management', () => {
    it('dismisses the modal when close button is clicked', () => {
      render(<DashboardPage />);

      fireEvent.click(screen.getByRole('button', { name: /Export Plan/i }));
      expect(screen.getByRole('dialog')).toBeDefined();

      const closeBtn = screen.getByRole('button', { name: /Close export dialog/i });
      fireEvent.click(closeBtn);

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('dismisses the modal when Escape key is pressed', () => {
      render(<DashboardPage />);

      fireEvent.click(screen.getByRole('button', { name: /Export Plan/i }));
      expect(screen.getByRole('dialog')).toBeDefined();

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('dismisses the modal when clicking the backdrop overlay', () => {
      render(<DashboardPage />);

      fireEvent.click(screen.getByRole('button', { name: /Export Plan/i }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();

      // Click on the backdrop (dialog wrapper itself)
      fireEvent.click(dialog);

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('restores focus to the opener button after closing the modal', async () => {
      render(<DashboardPage />);

      const exportBtn = screen.getByRole('button', { name: /Export Plan/i });
      exportBtn.focus();
      expect(document.activeElement).toBe(exportBtn);

      fireEvent.click(exportBtn);
      expect(screen.getByRole('dialog')).toBeDefined();

      const closeBtn = screen.getByRole('button', { name: /Close export dialog/i });
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(document.activeElement).toBe(exportBtn);
      });
    });
  });

  describe('Download JSON Feature', () => {
    it('generates a formatted JSON blob and triggers download with correct filename', () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      render(
        <EventPlanProvider persistToLocalStorage={false}>
          <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
        </EventPlanProvider>
      );

      const downloadBtn = screen.getByRole('button', { name: /Download JSON/i });
      fireEvent.click(downloadBtn);

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      const createdBlob = mockCreateObjectURL.mock.calls[0][0];
      expect(createdBlob).toBeInstanceOf(Blob);
      if (!(createdBlob instanceof Blob)) throw new Error('Expected Blob');
      expect(createdBlob.type).toBe('application/json');

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-export-url');

      clickSpy.mockRestore();
    });

    it('formats filename with canonical slug pattern celebration-plan-[title].json', () => {
      let capturedDownloadName = '';
      const setAttributeSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'setAttribute')
        .mockImplementation((name, val) => {
          if (name === 'download') capturedDownloadName = val;
        });

      // Also track direct property assignment
      const originalDownloadDesc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'download');
      Object.defineProperty(HTMLAnchorElement.prototype, 'download', {
        set(val: string) {
          capturedDownloadName = val;
        },
        configurable: true,
      });

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
      );

      const downloadBtn = screen.getByRole('button', { name: /Download JSON/i });
      fireEvent.click(downloadBtn);

      expect(capturedDownloadName).toBe('celebration-plan-royal-anniversary-gala.json');

      clickSpy.mockRestore();
      setAttributeSpy.mockRestore();
      if (originalDownloadDesc) {
        Object.defineProperty(HTMLAnchorElement.prototype, 'download', originalDownloadDesc);
      }
    });
  });

  describe('Copy Vendor Manifest Feature', () => {
    it('copies plain-text markdown of vendors and questions to clipboard with feedback', async () => {
      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
      );

      const copyManifestBtn = screen.getByRole('button', { name: /Copy Vendor Manifest/i });
      fireEvent.click(copyManifestBtn);

      expect(mockWriteText).toHaveBeenCalledTimes(1);
      const rawManifest = mockWriteText.mock.calls[0][0];
      expect(typeof rawManifest).toBe('string');
      const copiedText = typeof rawManifest === 'string' ? rawManifest : '';

      // Verify content
      expect(copiedText).toContain('# Vendor Manifest & Interview Guide: Royal Anniversary Gala');
      expect(copiedText).toContain('Maharaja Royal Caterers');
      expect(copiedText).toContain('Palace String Quartet');
      expect(copiedText).toContain('Can you accommodate vegan dietary preferences?');

      // Visual confirmation feedback
      await waitFor(() => {
        expect(screen.getByText(/Copied Manifest!/i)).toBeDefined();
      });
    });
  });

  describe('Copy Plan Summary Feature', () => {
    it('copies executive summary text with title, date, location, cap, remaining budget, and milestone count', async () => {
      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
      );

      const copySummaryBtn = screen.getByRole('button', { name: /Copy Plan Summary/i });
      fireEvent.click(copySummaryBtn);

      expect(mockWriteText).toHaveBeenCalledTimes(1);
      const rawSummary = mockWriteText.mock.calls[0][0];
      expect(typeof rawSummary).toBe('string');
      const copiedText = typeof rawSummary === 'string' ? rawSummary : '';

      // Verify required fields
      expect(copiedText).toContain('Royal Anniversary Gala');
      expect(copiedText).toContain('2026-11-20');
      expect(copiedText).toContain('Udaipur Palace Grounds');
      expect(copiedText).toContain('Budget Cap:');
      expect(copiedText).toContain('Remaining Budget:');
      expect(copiedText).toContain('Milestone Count: 2');

      // Visual confirmation feedback
      await waitFor(() => {
        expect(screen.getByText(/Copied Summary!/i)).toBeDefined();
      });
    });
  });

  describe('Print / PDF View Feature', () => {
    it('invokes window.print() when "Print / Save PDF" button is clicked', () => {
      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
      );

      const printBtn = screen.getByRole('button', { name: /Print or Save as PDF/i });
      fireEvent.click(printBtn);

      expect(mockPrint).toHaveBeenCalledTimes(1);
    });

    it('renders clean printable sections for details, budget, timeline, and vendors', () => {
      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
      );

      // Event details
      expect(screen.getByText('Royal Anniversary Gala')).toBeDefined();
      expect(screen.getByText('Udaipur Palace Grounds')).toBeDefined();
      expect(screen.getByText('250 guests')).toBeDefined();

      // Budget section & table
      expect(screen.getByText(/Budget Breakdown & Totals/i)).toBeDefined();
      expect(screen.getByText('Palace Courtyard Venue')).toBeDefined();
      expect(screen.getByText('Royal Catering Buffet')).toBeDefined();

      // Timeline section & table
      expect(screen.getByText(/Timeline & Milestones/i)).toBeDefined();
      expect(screen.getByText('Sign Venue Contract')).toBeDefined();
      expect(screen.getByText('Food Tasting Session')).toBeDefined();

      // Vendor checklist section
      expect(screen.getByText(/Vendor Manifest & Interview Guide/i)).toBeDefined();
      expect(screen.getByText('Maharaja Royal Caterers')).toBeDefined();
      expect(screen.getByText('Palace String Quartet')).toBeDefined();
    });
  });

  describe('WCAG 2.1 AA & Accessibility Standards', () => {
    it('modal dialog has proper aria attributes and labelling', () => {
      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('export-modal-title');
      expect(dialog.getAttribute('aria-describedby')).toBe('export-modal-description');

      const titleEl = document.getElementById('export-modal-title');
      expect(titleEl).not.toBeNull();
      expect(titleEl?.textContent).toContain('Export & Share Event Plan');

      const descEl = document.getElementById('export-modal-description');
      expect(descEl).not.toBeNull();
    });

    it('all interactive buttons have valid accessible names', () => {
      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((btn) => {
        const name = btn.getAttribute('aria-label') || btn.textContent?.trim();
        expect(name).toBeTruthy();
        expect(name?.length).toBeGreaterThan(0);
      });
    });

    it('traps Tab navigation within the modal', () => {
      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
      );

      const dialog = screen.getByRole('dialog');
      const focusableButtons = screen.getAllByRole('button');
      const firstFocusable = focusableButtons[0];
      const lastFocusable = focusableButtons[focusableButtons.length - 1];

      // Tab on last element should cycle to first
      lastFocusable.focus();
      expect(document.activeElement).toBe(lastFocusable);

      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(firstFocusable);

      // Shift+Tab on first element should cycle to last
      firstFocusable.focus();
      expect(document.activeElement).toBe(firstFocusable);

      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(lastFocusable);
    });
  });

  describe('Pure Generator Helpers Edge Cases', () => {
    it('generatePlanSummaryText handles null date, empty location, and 0 milestones', () => {
      const minimalPlan: EventPlan = {
        ...TEST_PLAN,
        eventDate: null,
        location: '',
        milestones: [],
      };

      const summary = generatePlanSummaryText(minimalPlan, 50000);
      expect(summary).toContain('Date: TBD');
      expect(summary).toContain('Location: TBD');
      expect(summary).toContain('Milestone Count: 0');
      expect(summary).toContain('Remaining Budget:');
    });

    it('generateVendorManifestMarkdown handles empty vendors array gracefully', () => {
      const emptyVendorPlan: EventPlan = {
        ...TEST_PLAN,
        vendors: [],
      };

      const markdown = generateVendorManifestMarkdown(emptyVendorPlan);
      expect(markdown).toContain('Total Vendors: 0');
      expect(markdown).toContain('No vendors currently assigned.');
    });

    it('generateVendorManifestMarkdown handles vendors without interview questions', () => {
      const vendorWithoutQuestions: EventPlan = {
        ...TEST_PLAN,
        vendors: [
          {
            id: 'v-none',
            name: 'Solo Decorator',
            category: 'decor',
            priority: 'low',
            status: 'not_started',
            suggestedQuestions: [],
          },
        ],
      };

      const markdown = generateVendorManifestMarkdown(vendorWithoutQuestions);
      expect(markdown).toContain('Solo Decorator (decor)');
      expect(markdown).toContain('- No interview questions listed.');
    });
  });

  describe('Adversarial & Edge Cases (ALIGN-002 Invariants)', () => {
    it('calculates metrics strictly from propPlan when rendered inside EventPlanProvider with custom plan', () => {
      // Custom plan with distinct budget numbers
      const customPlan: EventPlan = {
        ...TEST_PLAN,
        id: 'evt-custom-isolated',
        totalCap: 500000,
        currency: 'INR',
        items: [
          {
            id: 'item-custom-1',
            name: 'Boutique DJ',
            category: 'entertainment',
            estimatedCost: 100000,
            actualCost: 100000,
            status: 'committed',
          },
        ],
      };

      render(
        <EventPlanProvider persistToLocalStorage={false}>
          <PlanExportModal isOpen={true} onClose={() => {}} plan={customPlan} />
        </EventPlanProvider>
      );

      // Remaining buffer: 500,000 - 100,000 = 400,000 INR
      expect(screen.getByText(/Remaining Buffer:/i)).toBeDefined();
      expect(screen.getByText('Boutique DJ')).toBeDefined();
      // Should NOT reflect the default mock plan cap ($15,000)
      expect(screen.queryByText(/15,000/)).toBeNull();
    });

    it('falls back to document.execCommand when navigator.clipboard.writeText rejects', async () => {
      const execCommandSpy = vi.fn().mockReturnValue(true);
      Object.defineProperty(document, 'execCommand', {
        value: execCommandSpy,
        writable: true,
        configurable: true,
      });

      // Cause writeText to reject
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard permission denied'));

      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
      );

      const copyManifestBtn = screen.getByRole('button', { name: /Copy Vendor Manifest/i });
      fireEvent.click(copyManifestBtn);

      await waitFor(() => {
        expect(execCommandSpy).toHaveBeenCalledWith('copy');
        expect(screen.getByText(/Copied Manifest!/i)).toBeDefined();
      });
    });

    it('falls back to document.execCommand when navigator.clipboard is completely undefined', async () => {
      const execCommandSpy = vi.fn().mockReturnValue(true);
      Object.defineProperty(document, 'execCommand', {
        value: execCommandSpy,
        writable: true,
        configurable: true,
      });

      const originalClipboard = navigator.clipboard;
      // @ts-expect-error simulating legacy non-secure context
      delete navigator.clipboard;

      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
      );

      const copySummaryBtn = screen.getByRole('button', { name: /Copy Plan Summary/i });
      fireEvent.click(copySummaryBtn);

      await waitFor(() => {
        expect(execCommandSpy).toHaveBeenCalledWith('copy');
        expect(screen.getByText(/Copied Summary!/i)).toBeDefined();
      });

      // Restore clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });

    it('wraps focus to last element when Shift+Tab is pressed with focus on dialog container', () => {
      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={TEST_PLAN} />
      );

      const dialog = screen.getByRole('dialog');
      // Set activeElement to the dialog itself (not a focusable button)
      dialog.focus();

      const buttons = screen.getAllByRole('button');
      const lastButton = buttons[buttons.length - 1];

      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(lastButton);
    });

    it('formats filename with special characters, emojis, and spaces cleanly', () => {
      let capturedDownloadName = '';
      const originalDownloadDesc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'download');
      Object.defineProperty(HTMLAnchorElement.prototype, 'download', {
        set(val: string) {
          capturedDownloadName = val;
        },
        configurable: true,
      });

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      const emojiPlan: EventPlan = {
        ...TEST_PLAN,
        title: '🎉 Gala & Dance!',
      };

      render(
        <PlanExportModal isOpen={true} onClose={() => {}} plan={emojiPlan} />
      );

      fireEvent.click(screen.getByRole('button', { name: /Download JSON/i }));
      expect(capturedDownloadName).toBe('celebration-plan-🎉-gala-&-dance!.json');

      clickSpy.mockRestore();
      if (originalDownloadDesc) {
        Object.defineProperty(HTMLAnchorElement.prototype, 'download', originalDownloadDesc);
      }
    });
  });
});
