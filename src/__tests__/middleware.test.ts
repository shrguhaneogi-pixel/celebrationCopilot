import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

import { updateSession } from '@/lib/supabase/middleware';

describe('Supabase Middleware - Local Guest Mode & Route Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('passes through when Supabase environment variables are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const req = new NextRequest(new URL('http://localhost:3000/'));
    const res = await updateSession(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows unauthenticated access to root path / in local-first guest mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');

    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const req = new NextRequest(new URL('http://localhost:3000/'));
    const res = await updateSession(req);

    // Root path / should NOT be redirected to /login
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('redirects unauthenticated users from /dashboard to /login', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');

    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const req = new NextRequest(new URL('http://localhost:3000/dashboard'));
    const res = await updateSession(req);

    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
    expect(res.status).toBe(307);
  });

  it('redirects unauthenticated users from /settings to /login', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');

    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const req = new NextRequest(new URL('http://localhost:3000/settings'));
    const res = await updateSession(req);

    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
    expect(res.status).toBe(307);
  });

  it('redirects authenticated users from /login to /', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');

    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'mock-user-123', email: 'test@example.com' } },
      error: null,
    });

    const req = new NextRequest(new URL('http://localhost:3000/login'));
    const res = await updateSession(req);

    expect(res.headers.get('location')).toBe('http://localhost:3000/');
    expect(res.status).toBe(307);
  });

  it('redirects unauthenticated users from nested /dashboard/* subpaths to /login', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');

    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const req = new NextRequest(new URL('http://localhost:3000/dashboard/metrics'));
    const res = await updateSession(req);

    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
    expect(res.status).toBe(307);
  });

  it('redirects unauthenticated users from nested /settings/* subpaths to /login', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');

    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const req = new NextRequest(new URL('http://localhost:3000/settings/profile'));
    const res = await updateSession(req);

    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
    expect(res.status).toBe(307);
  });

  it('does not protect non-nested prefix matches like /dashboard-preview', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');

    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const req = new NextRequest(new URL('http://localhost:3000/dashboard-preview'));
    const res = await updateSession(req);

    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });
});
