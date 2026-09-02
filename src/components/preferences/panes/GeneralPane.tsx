import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShortcutPicker } from '../ShortcutPicker';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { commands } from '@/lib/tauri-bindings';
import { logger } from '@/lib/logger';
import { useUpdateStore } from '@/platform/updates';

/**
 * The quiet home for an automatic update check that failed. Automatic checks
 * never interrupt, so this line is the only place their failure is visible;
 * a manual check reports itself in the update dialog and is skipped here.
 */
function AutomaticUpdateCheckIndicator() {
  const { t } = useTranslation();
  const state = useUpdateStore((s) => s.state);

  if (state.status !== 'failed' || state.reason === 'manual') return null;

  return (
    <p
      role="status"
      data-slot="update-check-indicator"
      className="text-muted-foreground flex items-start gap-2 text-xs"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        <span className="text-foreground font-medium">{t('update.title.failed')}</span>{' '}
        {t(`update.error.${state.error.code}`)}
      </span>
    </p>
  );
}

export function GeneralPane() {
  const { t } = useTranslation();
  // Example local state - these are NOT persisted to disk
  // To add persistent preferences:
  // 1. Add the field to AppPreferences in both Rust and TypeScript
  // 2. Use usePreferencesManager() and updatePreferences()
  const [exampleText, setExampleText] = useState('Example value');
  const [exampleToggle, setExampleToggle] = useState(true);

  // Load preferences for keyboard shortcuts
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();

  // Get the default shortcut from the backend
  const { data: defaultShortcut } = useQuery({
    queryKey: ['default-quick-pane-shortcut'],
    queryFn: async () => {
      return await commands.getDefaultQuickPaneShortcut();
    },
    staleTime: Infinity, // Never refetch - this is a constant
  });

  const handleShortcutChange = async (newShortcut: string | null) => {
    if (!preferences) return;

    // Capture old shortcut for rollback if save fails
    const oldShortcut = preferences.quick_pane_shortcut;

    logger.info('Updating quick pane shortcut', { oldShortcut, newShortcut });

    // First, try to register the new shortcut
    const result = await commands.updateQuickPaneShortcut(newShortcut);

    if (result.status === 'error') {
      logger.error('Failed to register shortcut', { error: result.error });
      toast.error(t('toast.error.shortcutFailed'), {
        description: result.error,
      });
      return;
    }

    // If registration succeeded, try to save the preference
    try {
      await savePreferences.mutateAsync({
        ...preferences,
        quick_pane_shortcut: newShortcut,
      });
    } catch {
      // Save failed - roll back the backend registration
      logger.warn('Save failed, rolling back shortcut registration', {
        oldShortcut,
        newShortcut,
      });

      const rollbackResult = await commands.updateQuickPaneShortcut(oldShortcut);

      if (rollbackResult.status === 'error') {
        logger.error('Rollback failed - backend and preferences are out of sync', {
          error: rollbackResult.error,
          attemptedShortcut: newShortcut,
          originalShortcut: oldShortcut,
        });
        toast.error(t('toast.error.shortcutRestoreFailed'), {
          description: t('toast.error.shortcutRestoreDescription'),
        });
      } else {
        logger.info('Successfully rolled back shortcut registration');
      }
    }
  };

  return (
    <div className="space-y-6">
      <AutomaticUpdateCheckIndicator />

      <SettingsSection title={t('preferences.general.keyboardShortcuts')}>
        <SettingsField
          label={t('preferences.general.quickPaneShortcut')}
          description={t('preferences.general.quickPaneShortcutDescription')}
        >
          <ShortcutPicker
            value={preferences?.quick_pane_shortcut ?? null}
            // Fallback matches DEFAULT_QUICK_PANE_SHORTCUT in src-tauri/src/lib.rs
            defaultValue={defaultShortcut ?? 'CommandOrControl+Shift+.'}
            onChange={handleShortcutChange}
            disabled={!preferences || savePreferences.isPending}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('preferences.general.exampleSettings')}>
        <SettingsField
          label={t('preferences.general.exampleText')}
          description={t('preferences.general.exampleTextDescription')}
        >
          <Input
            value={exampleText}
            onChange={(e) => setExampleText(e.target.value)}
            placeholder={t('preferences.general.exampleTextPlaceholder')}
          />
        </SettingsField>

        <SettingsField
          label={t('preferences.general.exampleToggle')}
          description={t('preferences.general.exampleToggleDescription')}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="example-toggle"
              checked={exampleToggle}
              onCheckedChange={setExampleToggle}
            />
            <Label htmlFor="example-toggle" className="text-sm">
              {exampleToggle ? t('common.enabled') : t('common.disabled')}
            </Label>
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
