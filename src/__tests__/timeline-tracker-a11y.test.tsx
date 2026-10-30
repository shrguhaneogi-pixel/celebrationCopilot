// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineTracker } from '@/components/dashboard/TimelineTracker';
import { EventPlanProvider } from '@/context/EventPlanContext';
import { EventPlan } from '@/domain/event-plan.schema';

const mockTestPlan: EventPlan = {
  id: 'test-timeline-plan',
  version: 1,
  title: 'Golden Jubilee Gala',
  eventType: 'Anniversary',
  eventDate: '2026-11-20',
  timezone: 'Asia/Kolkata',
  location: 'Royal Palace Banquet',
  guestCount: 200,
  currency: 'INR',
  totalCap: 600000,
  items: [],
  milestones: [
    {
      id: 'ms-1',
      title: 'Finalize Guest Invitations',
      offsetDays: -45,
      completed: false,
      category: 'planning',
      dueDate: '2026-10-06',
    },
    {
      id: 'ms-2',
      title: 'Book Royal Palace Ballroom',
      offsetDays: -60,
      completed: true,
      category: 'venue',
      dueDate: '2026-09-21',
    },
    {
      id: 'ms-3',
      title: 'Tasting & Menu Sign-off',
      offsetDays: -30,
      completed: false,
      category: 'catering',
      dueDate: '2026-10-21',
    },
  ],
  vendors: [],
};

describe('TimelineTracker WCAG 2.1 AA Select & Filter Labeling (A11Y-002)', () => {
  it('renders accessible name on the category filter select dropdown', () => {
    render(
      <EventPlanProvider initialPlan={mockTestPlan} persistToLocalStorage={false}>
        <TimelineTracker />
      </EventPlanProvider>
    );

    const filterSelect = screen.getByRole('combobox', {
      name: /Filter milestones by category/i,
    });
    expect(filterSelect).toBeDefined();
    expect(filterSelect).toBeInstanceOf(HTMLSelectElement);
    expect(filterSelect.getAttribute('aria-label')).toBe('Filter milestones by category');

    // Confirm default value is 'all'
    if (filterSelect instanceof HTMLSelectElement) {
      expect(filterSelect.value).toBe('all');
    }
  });

  it('renders accessible names on all select and input controls in the Add Milestone form', () => {
    render(
      <EventPlanProvider initialPlan={mockTestPlan} persistToLocalStorage={false}>
        <TimelineTracker />
      </EventPlanProvider>
    );

    // Open Add Milestone form
    const addBtn = screen.getByRole('button', { name: /Add Milestone/i });
    fireEvent.click(addBtn);

    // Verify Title input accessibility
    const titleInput = screen.getByRole('textbox', { name: /Milestone Title/i });
    expect(titleInput).toBeDefined();
    expect(titleInput.getAttribute('id')).toBe('new-milestone-title');

    // Verify Offset Days input accessibility
    const offsetInput = screen.getByRole('spinbutton', { name: /Offset Days/i });
    expect(offsetInput).toBeDefined();
    expect(offsetInput.getAttribute('id')).toBe('new-milestone-offset');

    // Verify Category select accessibility
    const categorySelect = screen.getByRole('combobox', { name: /^Category$/i });
    expect(categorySelect).toBeDefined();
    expect(categorySelect).toBeInstanceOf(HTMLSelectElement);
    expect(categorySelect.getAttribute('id')).toBe('new-milestone-category');
    expect(categorySelect.getAttribute('aria-label')).toBe('Category');

    // Form can be submitted with safe category selection
    fireEvent.change(titleInput, { target: { value: 'Confirm Audio Setup' } });
    fireEvent.change(offsetInput, { target: { value: '-14' } });
    fireEvent.change(categorySelect, { target: { value: 'entertainment' } });

    const saveBtn = screen.getByRole('button', { name: /Save Milestone/i });
    fireEvent.click(saveBtn);

    // New milestone should be rendered in the document
    expect(screen.getByText('Confirm Audio Setup')).toBeDefined();
  });

  it('provides descriptive accessible labels on milestone completion and delete buttons identifying the specific milestone', () => {
    render(
      <EventPlanProvider initialPlan={mockTestPlan} persistToLocalStorage={false}>
        <TimelineTracker />
      </EventPlanProvider>
    );

    // Incomplete milestone ms-1
    const toggleButtonMs1 = screen.getByRole('button', {
      name: 'Mark "Finalize Guest Invitations" as completed',
    });
    expect(toggleButtonMs1).toBeDefined();
    expect(toggleButtonMs1.getAttribute('aria-pressed')).toBe('false');

    // Completed milestone ms-2
    const toggleButtonMs2 = screen.getByRole('button', {
      name: 'Mark "Book Royal Palace Ballroom" as completed',
    });
    expect(toggleButtonMs2).toBeDefined();
    expect(toggleButtonMs2.getAttribute('aria-pressed')).toBe('true');

    // Delete buttons with specific milestone titles
    const deleteButtonMs1 = screen.getByRole('button', {
      name: 'Delete milestone "Finalize Guest Invitations"',
    });
    expect(deleteButtonMs1).toBeDefined();

    const deleteButtonMs2 = screen.getByRole('button', {
      name: 'Delete milestone "Book Royal Palace Ballroom"',
    });
    expect(deleteButtonMs2).toBeDefined();

    // Toggle completion on ms-1
    fireEvent.click(toggleButtonMs1);
    expect(toggleButtonMs1.getAttribute('aria-pressed')).toBe('true');

    // Toggle completion back on ms-1
    fireEvent.click(toggleButtonMs1);
    expect(toggleButtonMs1.getAttribute('aria-pressed')).toBe('false');

    // Delete ms-2
    fireEvent.click(deleteButtonMs2);
    expect(screen.queryByText('Book Royal Palace Ballroom')).toBeNull();
  });

  it('correctly filters milestones by category and announces empty state when none match', () => {
    render(
      <EventPlanProvider initialPlan={mockTestPlan} persistToLocalStorage={false}>
        <TimelineTracker />
      </EventPlanProvider>
    );

    // Initially all 3 milestones are present
    expect(screen.getByText('Finalize Guest Invitations')).toBeDefined();
    expect(screen.getByText('Book Royal Palace Ballroom')).toBeDefined();
    expect(screen.getByText('Tasting & Menu Sign-off')).toBeDefined();

    const filterSelect = screen.getByRole('combobox', {
      name: /Filter milestones by category/i,
    });

    // Filter to 'venue'
    fireEvent.change(filterSelect, { target: { value: 'venue' } });

    expect(screen.getByText('Book Royal Palace Ballroom')).toBeDefined();
    expect(screen.queryByText('Finalize Guest Invitations')).toBeNull();
    expect(screen.queryByText('Tasting & Menu Sign-off')).toBeNull();

    // Filter to category with no milestones ('media')
    fireEvent.change(filterSelect, { target: { value: 'media' } });
    expect(screen.getByText('No milestones found in this category.')).toBeDefined();
    expect(screen.queryByText('Book Royal Palace Ballroom')).toBeNull();

    // Reset filter to 'all'
    fireEvent.change(filterSelect, { target: { value: 'all' } });
    expect(screen.getByText('Finalize Guest Invitations')).toBeDefined();
    expect(screen.getByText('Book Royal Palace Ballroom')).toBeDefined();
    expect(screen.getByText('Tasting & Menu Sign-off')).toBeDefined();
  });

  it('renders safely outside context and allows filtering prop milestones', () => {
    render(
      <TimelineTracker
        milestones={mockTestPlan.milestones}
        eventDate={mockTestPlan.eventDate}
      />
    );

    const filterSelect = screen.getByRole('combobox', {
      name: /Filter milestones by category/i,
    });
    expect(filterSelect).toBeDefined();

    // Filter to 'catering'
    fireEvent.change(filterSelect, { target: { value: 'catering' } });
    expect(screen.getByText('Tasting & Menu Sign-off')).toBeDefined();
    expect(screen.queryByText('Book Royal Palace Ballroom')).toBeNull();

    // Completed / Upcoming badges rendered instead of interactive buttons
    expect(screen.queryByRole('button', { name: /Mark.*complete/i })).toBeNull();
  });

  it('verifies all <select> elements in TimelineTracker have accessible names and explicit labels', () => {
    const { container } = render(
      <EventPlanProvider initialPlan={mockTestPlan} persistToLocalStorage={false}>
        <TimelineTracker />
      </EventPlanProvider>
    );

    // Open add milestone form so both selects are present in the DOM
    fireEvent.click(screen.getByRole('button', { name: /Add Milestone/i }));

    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(2);

    selects.forEach((select) => {
      // Must have aria-label or accessible name
      const ariaLabel = select.getAttribute('aria-label');
      const id = select.getAttribute('id');
      expect(ariaLabel).toBeTruthy();
      expect(id).toBeTruthy();

      // Explicit label association check
      if (id) {
        const matchingLabel = container.querySelector(`label[for="${id}"]`);
        expect(matchingLabel).not.toBeNull();
      }
    });
  });

  it('verifies explicit <label htmlFor> associations and keyboard form submission', () => {
    render(
      <EventPlanProvider initialPlan={mockTestPlan} persistToLocalStorage={false}>
        <TimelineTracker />
      </EventPlanProvider>
    );

    // Open Add Milestone form
    fireEvent.click(screen.getByRole('button', { name: /Add Milestone/i }));

    // Verify label associations using getByLabelText
    const titleInput = screen.getByLabelText(/Milestone Title \*/i);
    const offsetInput = screen.getByLabelText(/Offset Days/i);
    const categorySelect = screen.getByLabelText(/^Category$/i);

    expect(titleInput).toBeDefined();
    expect(offsetInput).toBeDefined();
    expect(categorySelect).toBeDefined();

    // Verify screen-reader label for category filter
    const filterSelect = screen.getByLabelText(/Filter milestones by category/i);
    expect(filterSelect).toBeDefined();

    // Fill form and submit via form submit event (mimics Enter key in form)
    fireEvent.change(titleInput, { target: { value: 'Keyboard Navigable Milestone' } });
    fireEvent.change(offsetInput, { target: { value: '-7' } });
    fireEvent.change(categorySelect, { target: { value: 'execution' } });

    const form = titleInput.closest('form');
    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
    }

    // Verify submitted milestone appears
    expect(screen.getByText('Keyboard Navigable Milestone')).toBeDefined();
  });

  it('announces form validation errors with role="alert" when required inputs are missing or invalid', () => {
    render(
      <EventPlanProvider initialPlan={mockTestPlan} persistToLocalStorage={false}>
        <TimelineTracker />
      </EventPlanProvider>
    );

    // Open Add Milestone form
    fireEvent.click(screen.getByRole('button', { name: /Add Milestone/i }));

    // Try submitting without title or offset
    fireEvent.click(screen.getByRole('button', { name: /Save Milestone/i }));

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('Title and relative offset days are required.');
  });
});
