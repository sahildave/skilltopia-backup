import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';

// Brand icons render an SVG <title> for their product name, which duplicates the
// visible label next to them. Keep those out of text queries.
configure({ defaultIgnore: 'script, style, title' });

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

// Mock matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Tauri APIs for tests
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {
    // Mock unlisten function
  }),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}));

// Mock typed Tauri bindings (tauri-specta generated)
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    greet: vi.fn().mockResolvedValue('Hello, test!'),
    loadPreferences: vi.fn().mockResolvedValue({ status: 'ok', data: { theme: 'system' } }),
    savePreferences: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    sendNativeNotification: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    saveEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    loadEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    cleanupOldRecoveryFiles: vi.fn().mockResolvedValue({ status: 'ok', data: 0 }),
    fetchSkillsLeaderboard: vi.fn().mockResolvedValue({ status: 'ok', data: [] }),
    searchSkills: vi.fn().mockResolvedValue({ status: 'ok', data: [] }),
    fetchSkillDetail: vi.fn().mockResolvedValue({
      status: 'ok',
      data: {
        skillId: '',
        pageSnapshot: null,
        pageScrapedAt: null,
        repository: null,
        source: null,
        installCount: null,
        sourceUrl: null,
        installSeries: [],
        enrichment: null,
        related: [],
      },
    }),
    fetchSkillAudits: vi.fn().mockResolvedValue({
      status: 'ok',
      data: { skillId: '', audits: null, source: 'cache', auditsFetchedAt: null },
    }),
  },
  unwrapResult: vi.fn((result: { status: string; data?: unknown }) => {
    if (result.status === 'ok') return result.data;
    throw result;
  }),
}));
