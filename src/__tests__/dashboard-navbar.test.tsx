// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

import DashboardPage from '@/app/page';

describe('Dashboard Navbar Local Guest Mode & Auth Status (ALIGN-001)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.restoreAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it('renders "Local Mode • v1" badge and accessible "Sign In" link for unauthenticated guests', () => {
    render(<DashboardPage />);

    // Version badge should show Local Mode
    expect(screen.getByText(/Local Mode • v1/i)).toBeDefined();

    // Sign In button/link should be rendered with href to /login
    const signInLink = screen.getByRole('button', { name: /Sign In/i });
    expect(signInLink).toBeDefined();
    expect(signInLink.getAttribute('href')).toBe('/login');
    expect(signInLink.getAttribute('aria-label')).toBe('Sign In');

    // Sign Out should not be rendered
    expect(screen.queryByRole('button', { name: /Sign Out/i })).toBeNull();
  });

  it('activates the Sign In link when Space key is pressed', () => {
    render(<DashboardPage />);

    const signInLink = screen.getByRole('button', { name: /Sign In/i });
    const clickSpy = vi.spyOn(signInLink, 'click').mockImplementation(() => {});

    fireEvent.keyDown(signInLink, { key: ' ' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('renders "Cloud Synced • v1" badge, user email, and "Sign Out" button for authenticated users', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'usr-123', email: 'priya@example.com' } },
      error: null,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Cloud Synced • v1/i)).toBeDefined();
    });

    expect(screen.getByText('priya@example.com')).toBeDefined();
    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    expect(signOutBtn).toBeDefined();
    expect(screen.queryByRole('button', { name: /Sign In/i })).toBeNull();
  });
});
