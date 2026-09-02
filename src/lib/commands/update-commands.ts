import type { AppCommand } from './types';
import { requestManualUpdateCheck } from '@/platform/updates';

export const updateCommands: AppCommand[] = [
  {
    id: 'update.check-for-updates',
    labelKey: 'update.commands.checkForUpdates.label',
    descriptionKey: 'update.commands.checkForUpdates.description',
    group: 'updates',
    keywords: ['update', 'upgrade', 'version', 'release'],
    // The same seam the native menu item uses: open the dialog, then check, so
    // the palette entry ends on a visible answer rather than a silent no-op.
    execute: () => requestManualUpdateCheck(),
  },
];
