import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CommandContext } from './types';

const requestManualUpdateCheck = vi.fn((): Promise<void> => Promise.resolve());
vi.mock('@/platform/updates', () => ({ requestManualUpdateCheck }));

const { registerCommands, executeCommand } = await import('./registry');
const { updateCommands } = await import('./update-commands');

const context: CommandContext = { openPreferences: vi.fn(), showToast: vi.fn() };

describe('update commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerCommands(updateCommands);
  });

  it('exposes a manual check under the updates group with the update.* keys', () => {
    const command = updateCommands.find((cmd) => cmd.id === 'update.check-for-updates');
    expect(command).toBeDefined();
    expect(command?.id).toBe('update.check-for-updates');
    expect(command?.group).toBe('updates');
    expect(command?.labelKey).toBe('update.commands.checkForUpdates.label');
    expect(command?.descriptionKey).toBe('update.commands.checkForUpdates.description');
  });

  it('runs the controller-backed manual check', async () => {
    const result = await executeCommand('update.check-for-updates', context);
    expect(result.success).toBe(true);
    expect(requestManualUpdateCheck).toHaveBeenCalledTimes(1);
  });
});
