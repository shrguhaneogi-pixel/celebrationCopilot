// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VendorTracker } from '@/components/dashboard/VendorTracker';
import { EventHeader } from '@/components/dashboard/EventHeader';
import { EventPlanProvider } from '@/context/EventPlanContext';
import { EventPlan } from '@/domain/event-plan.schema';

const mockPlan: EventPlan = {
  id: 'test-event-1',
  version: 1,
  title: 'Annual Tech Summit',
  eventType: 'Conference',
  eventDate: '2026-12-15',
  timezone: 'Asia/Kolkata',
  location: 'Convention Center',
  guestCount: 250,
  currency: 'INR',
  totalCap: 500000,
  items: [],
  milestones: [],
  vendors: [
    {
      id: 'ven-1',
      name: 'Premier Sound & Lights',
      category: 'AV Production',
      priority: 'high',
      status: 'contacted',
      suggestedQuestions: ['What are the load-in requirements?'],
    },
  ],
};

describe('VendorTracker Safe Select & EventHeader Null Guarding (TS-001)', () => {
  it('updates vendor priority and status safely when valid values are selected', () => {
    render(
      <EventPlanProvider initialPlan={mockPlan} persistToLocalStorage={false}>
        <VendorTracker />
      </EventPlanProvider>
    );

    const prioritySelect = screen.getByRole('combobox', {
      name: /Change priority for Premier Sound & Lights/i,
    });
    expect(prioritySelect).toBeDefined();

    expect(prioritySelect).toBeInstanceOf(HTMLSelectElement);
    if (prioritySelect instanceof HTMLSelectElement) {
      // Change to medium priority
      fireEvent.change(prioritySelect, { target: { value: 'medium' } });
      expect(prioritySelect.value).toBe('medium');
    }

    const statusSelect = screen.getByRole('combobox', {
      name: /Change booking status for Premier Sound & Lights/i,
    });
    expect(statusSelect).toBeInstanceOf(HTMLSelectElement);
    if (statusSelect instanceof HTMLSelectElement) {
      // Change to booked status
      fireEvent.change(statusSelect, { target: { value: 'booked' } });
      expect(statusSelect.value).toBe('booked');
    }
  });

  it('ignores invalid select values rejected by Zod schema safeParse', () => {
    render(
      <EventPlanProvider initialPlan={mockPlan} persistToLocalStorage={false}>
        <VendorTracker />
      </EventPlanProvider>
    );

    const prioritySelect = screen.getByRole('combobox', {
      name: /Change priority for Premier Sound & Lights/i,
    });
    expect(prioritySelect).toBeInstanceOf(HTMLSelectElement);
    if (prioritySelect instanceof HTMLSelectElement) {
      // Attempt to inject an invalid priority value
      fireEvent.change(prioritySelect, { target: { value: 'ultra-critical-invalid' } });
      // State should not update to invalid value
      expect(prioritySelect.value).not.toBe('ultra-critical-invalid');
    }

    const statusSelect = screen.getByRole('combobox', {
      name: /Change booking status for Premier Sound & Lights/i,
    });
    expect(statusSelect).toBeInstanceOf(HTMLSelectElement);
    if (statusSelect instanceof HTMLSelectElement) {
      // Attempt to inject an invalid status value
      fireEvent.change(statusSelect, { target: { value: 'signed-contract-invalid' } });
      // State should not update to invalid value
      expect(statusSelect.value).not.toBe('signed-contract-invalid');
    }
  });

  it('validates priority selection safely in the Add Vendor form using safeParse', () => {
    render(
      <EventPlanProvider initialPlan={mockPlan} persistToLocalStorage={false}>
        <VendorTracker />
      </EventPlanProvider>
    );

    // Open add vendor form
    const addBtn = screen.getByRole('button', { name: /Add Vendor/i });
    fireEvent.click(addBtn);

    const newPrioritySelect = screen.getByRole('combobox', { name: /^Priority$/i });
    expect(newPrioritySelect).toBeInstanceOf(HTMLSelectElement);

    if (newPrioritySelect instanceof HTMLSelectElement) {
      expect(newPrioritySelect.value).toBe('medium');

      // Change to high priority
      fireEvent.change(newPrioritySelect, { target: { value: 'high' } });
      expect(newPrioritySelect.value).toBe('high');

      // Attempt invalid value
      fireEvent.change(newPrioritySelect, { target: { value: 'super-urgent-invalid' } });
      expect(newPrioritySelect.value).toBe('high');
    }
  });

  it('renders accessible name on VendorTracker category filter select and filters vendors', () => {
    const multiVendorPlan: EventPlan = {
      ...mockPlan,
      vendors: [
        {
          id: 'ven-1',
          name: 'Premier Sound & Lights',
          category: 'AV Production',
          priority: 'high',
          status: 'contacted',
          suggestedQuestions: ['What are the load-in requirements?'],
        },
        {
          id: 'ven-2',
          name: 'Grand Gourmet Catering',
          category: 'Catering',
          priority: 'medium',
          status: 'quoted',
          suggestedQuestions: ['Is live counter staff included?'],
        },
      ],
    };

    render(
      <EventPlanProvider initialPlan={multiVendorPlan} persistToLocalStorage={false}>
        <VendorTracker />
      </EventPlanProvider>
    );

    const filterSelect = screen.getByRole('combobox', {
      name: /Filter vendors by category/i,
    });
    expect(filterSelect).toBeDefined();
    expect(filterSelect.getAttribute('aria-label')).toBe('Filter vendors by category');

    // Both vendors initially visible
    expect(screen.getByText('Premier Sound & Lights')).toBeDefined();
    expect(screen.getByText('Grand Gourmet Catering')).toBeDefined();

    // Filter to 'Catering'
    fireEvent.change(filterSelect, { target: { value: 'Catering' } });
    expect(screen.getByText('Grand Gourmet Catering')).toBeDefined();
    expect(screen.queryByText('Premier Sound & Lights')).toBeNull();

    // Reset to 'all'
    fireEvent.change(filterSelect, { target: { value: 'all' } });
    expect(screen.getByText('Premier Sound & Lights')).toBeDefined();
    expect(screen.getByText('Grand Gourmet Catering')).toBeDefined();
  });

  it('renders EventHeader safely outside context without dispatchMutation and does not throw', () => {
    // When rendered outside EventPlanProvider (dispatchMutation is undefined)
    render(<EventHeader plan={mockPlan} />);

    expect(screen.getByText('Annual Tech Summit')).toBeDefined();
    expect(screen.getByText('Conference')).toBeDefined();
    // Edit button is not rendered when dispatchMutation / dispatchMutations is unavailable
    expect(screen.queryByRole('button', { name: /Edit event details/i })).toBeNull();
  });

  it('allows editing and saving event details safely with EventHeader inside context', () => {
    render(
      <EventPlanProvider initialPlan={mockPlan} persistToLocalStorage={false}>
        <EventHeader />
      </EventPlanProvider>
    );

    const editBtn = screen.getByRole('button', { name: /Edit event details/i });
    fireEvent.click(editBtn);

    const locationInput = screen.getByLabelText(/Location/i);
    fireEvent.change(locationInput, { target: { value: 'Grand Ballroom' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText('Grand Ballroom')).toBeDefined();
  });

  it('renders accessible name on VendorTracker search input and filters vendors by keyword', () => {
    const multiVendorPlan: EventPlan = {
      ...mockPlan,
      vendors: [
        {
          id: 'ven-1',
          name: 'Premier Sound & Lights',
          category: 'AV Production',
          priority: 'high',
          status: 'contacted',
          suggestedQuestions: ['What are the load-in requirements?'],
        },
        {
          id: 'ven-2',
          name: 'Grand Gourmet Catering',
          category: 'Catering',
          priority: 'medium',
          status: 'quoted',
          suggestedQuestions: ['Is live counter staff included?'],
        },
      ],
    };

    render(
      <EventPlanProvider initialPlan={multiVendorPlan} persistToLocalStorage={false}>
        <VendorTracker />
      </EventPlanProvider>
    );

    // Verify search input has accessible name and label
    const searchInput = screen.getByRole('searchbox', { name: /Search vendors/i });
    expect(searchInput).toBeDefined();
    expect(searchInput.getAttribute('aria-label')).toBe('Search vendors');
    expect(screen.getByLabelText(/Search vendors/i)).toBe(searchInput);

    // Search by vendor name
    fireEvent.change(searchInput, { target: { value: 'Gourmet' } });
    expect(screen.getByText('Grand Gourmet Catering')).toBeDefined();
    expect(screen.queryByText('Premier Sound & Lights')).toBeNull();

    // Search by keyword in category
    fireEvent.change(searchInput, { target: { value: 'Production' } });
    expect(screen.getByText('Premier Sound & Lights')).toBeDefined();
    expect(screen.queryByText('Grand Gourmet Catering')).toBeNull();

    // Search with no matches shows empty state
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Vendor Query' } });
    expect(screen.getByText('No vendors match your search or filter criteria.')).toBeDefined();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Premier Sound & Lights')).toBeDefined();
    expect(screen.getByText('Grand Gourmet Catering')).toBeDefined();
  });

  it('verifies all select and input elements in VendorTracker have accessible names and explicit labels', () => {
    const { container } = render(
      <EventPlanProvider initialPlan={mockPlan} persistToLocalStorage={false}>
        <VendorTracker />
      </EventPlanProvider>
    );

    // Open add vendor form
    fireEvent.click(screen.getByRole('button', { name: /Add Vendor/i }));

    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(3); // filter select, new vendor priority, vendor card priority + status

    selects.forEach((select) => {
      const ariaLabel = select.getAttribute('aria-label');
      const id = select.getAttribute('id');
      expect(ariaLabel).toBeTruthy();
      expect(id).toBeTruthy();

      // Check explicit label association
      if (id) {
        const matchingLabel = container.querySelector(`label[for="${id}"]`);
        expect(matchingLabel).not.toBeNull();
      }
    });

    // Verify search input
    const searchInput = screen.getByRole('searchbox', { name: /Search vendors/i });
    expect(searchInput).toBeDefined();

    // Verify label associations for add vendor form controls
    expect(screen.getByLabelText(/Vendor Name \*/i)).toBeDefined();
    expect(screen.getByLabelText(/Category \*/i)).toBeDefined();
    expect(screen.getByLabelText(/^Priority$/i)).toBeDefined();
    expect(screen.getByLabelText(/Suggested Questions/i)).toBeDefined();

    // Verify category filter select has associated label
    expect(screen.getByLabelText(/Filter vendors by category/i)).toBeDefined();

    // Verify copy button has descriptive accessible label
    const copyBtn = screen.getByRole('button', {
      name: 'Copy question: "What are the load-in requirements?"',
    });
    expect(copyBtn).toBeDefined();
  });
});
