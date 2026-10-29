// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BudgetTracker } from '@/components/dashboard/BudgetTracker';
import { EventPlanProvider } from '@/context/EventPlanContext';

describe('BudgetTracker Accessibility & Inline Editing Inputs (A11Y-001)', () => {
  it('renders all four aria-label attributes on inline editing inputs when editing an item', () => {
    render(
      <EventPlanProvider persistToLocalStorage={false}>
        <BudgetTracker />
      </EventPlanProvider>
    );

    // Find the first Edit button
    const editButtons = screen.getAllByTitle('Edit line item');
    expect(editButtons.length).toBeGreaterThan(0);

    // Click edit on the first item
    fireEvent.click(editButtons[0]);

    // Verify all four aria-label attributes exist and are accessible
    const nameInput = screen.getByLabelText('Item name');
    const categoryInput = screen.getByLabelText('Item category');
    const estimatedCostInput = screen.getByLabelText('Estimated cost');
    const actualCostInput = screen.getByLabelText('Actual cost');

    expect(nameInput).toBeDefined();
    expect(categoryInput).toBeDefined();
    expect(estimatedCostInput).toBeDefined();
    expect(actualCostInput).toBeDefined();

    expect(nameInput.getAttribute('aria-label')).toBe('Item name');
    expect(categoryInput.getAttribute('aria-label')).toBe('Item category');
    expect(estimatedCostInput.getAttribute('aria-label')).toBe('Estimated cost');
    expect(actualCostInput.getAttribute('aria-label')).toBe('Actual cost');
  });

  it('saves edits when pressing Enter inside an inline editing input', () => {
    render(
      <EventPlanProvider persistToLocalStorage={false}>
        <BudgetTracker />
      </EventPlanProvider>
    );

    const editButtons = screen.getAllByTitle('Edit line item');
    fireEvent.click(editButtons[0]);

    const nameInput = screen.getByLabelText('Item name');
    fireEvent.change(nameInput, { target: { value: 'Updated Palace Decor' } });
    fireEvent.keyDown(nameInput, { key: 'Enter' });

    // Inline edit row should close and updated name should be present in the table
    expect(screen.getByText('Updated Palace Decor')).toBeDefined();
    expect(screen.queryByLabelText('Item name')).toBeNull();
  });

  it('cancels edits when pressing Escape inside an inline editing input', () => {
    render(
      <EventPlanProvider persistToLocalStorage={false}>
        <BudgetTracker />
      </EventPlanProvider>
    );

    const editButtons = screen.getAllByTitle('Edit line item');
    fireEvent.click(editButtons[0]);

    const nameInput = screen.getByLabelText('Item name');
    fireEvent.change(nameInput, { target: { value: 'Cancelled Edit Name' } });
    fireEvent.keyDown(nameInput, { key: 'Escape' });

    // Inline edit row should close without saving the cancelled text
    expect(screen.queryByText('Cancelled Edit Name')).toBeNull();
    expect(screen.queryByLabelText('Item name')).toBeNull();
  });
});
