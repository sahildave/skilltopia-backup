import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_EMPTY_SCAN, MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import { useInstalledScanStore } from './installed-scan-store';

const platformMock = vi.hoisted(() => ({
  hasLocalLibrary: true,
  getInstalledScan: vi.fn(),
  scanInstalled: vi.fn(),
}));

vi.mock('@platform', () => ({
  platform: {
    get hasLocalLibrary() {
      return platformMock.hasLocalLibrary;
    },
    getInstalledScan: (...args: unknown[]) => platformMock.getInstalledScan(...args),
    scanInstalled: (...args: unknown[]) => platformMock.scanInstalled(...args),
  },
}));

describe('installed-scan-store', () => {
  beforeEach(() => {
    platformMock.hasLocalLibrary = true;
    platformMock.getInstalledScan.mockReset();
    platformMock.scanInstalled.mockReset();
    useInstalledScanStore.setState({
      snapshot: null,
      error: null,
      refreshing: false,
    });
  });

  it('hydrates from the cached snapshot without calling scanInstalled', async () => {
    platformMock.getInstalledScan.mockResolvedValue(MOCK_INSTALLED_SCAN);

    await useInstalledScanStore.getState().hydrate();

    expect(platformMock.getInstalledScan).toHaveBeenCalledOnce();
    expect(platformMock.scanInstalled).not.toHaveBeenCalled();
    expect(useInstalledScanStore.getState().snapshot).toEqual(MOCK_INSTALLED_SCAN);
    expect(useInstalledScanStore.getState().refreshing).toBe(false);
  });

  it('keeps the prior snapshot visible while a rescan is in flight', async () => {
    useInstalledScanStore.setState({ snapshot: MOCK_INSTALLED_SCAN });

    let resolveScan: (value: typeof MOCK_EMPTY_SCAN) => void = () => undefined;
    platformMock.scanInstalled.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveScan = resolve;
        }),
    );

    const pending = useInstalledScanStore.getState().rescan();
    expect(useInstalledScanStore.getState().refreshing).toBe(true);
    expect(useInstalledScanStore.getState().snapshot).toEqual(MOCK_INSTALLED_SCAN);

    resolveScan(MOCK_EMPTY_SCAN);
    await pending;

    expect(useInstalledScanStore.getState().snapshot).toEqual(MOCK_EMPTY_SCAN);
    expect(useInstalledScanStore.getState().refreshing).toBe(false);
  });

  it('replaces one shared snapshot on each rescan', async () => {
    platformMock.scanInstalled
      .mockResolvedValueOnce(MOCK_INSTALLED_SCAN)
      .mockResolvedValueOnce(MOCK_EMPTY_SCAN);

    await useInstalledScanStore.getState().rescan();
    expect(useInstalledScanStore.getState().snapshot?.scannedAt).toBe(
      MOCK_INSTALLED_SCAN.scannedAt,
    );

    await useInstalledScanStore.getState().rescan();
    expect(useInstalledScanStore.getState().snapshot).toEqual(MOCK_EMPTY_SCAN);
    expect(platformMock.scanInstalled).toHaveBeenCalledTimes(2);
  });
});
