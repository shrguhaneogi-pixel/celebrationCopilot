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
});
