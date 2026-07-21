/**
 * Shared in-app toast notifications (sonner).
 *
 * Intentionally does not import `@/lib/tauri-bindings` — shared UI (including
 * web) reaches this module via the command context. Native OS notifications
 * belong behind a desktop-only path, not this shared helper.
 */

import { toast } from 'sonner';
import { logger } from './logger';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationOptions {
  /** Type of notification (affects styling) */
  type?: NotificationType;
  /**
   * Legacy flag; ignored. Shared notify always uses in-app toasts so the web
   * module graph never pulls Tauri. Desktop-native notify can be added via
   * `@platform` later if needed.
   */
  native?: boolean;
  /** Duration in milliseconds for toasts (0 = no auto-dismiss) */
  duration?: number;
}

/**
 * Send an in-app toast notification.
 *
 * @param title - Main notification title
 * @param message - Optional message body
 * @param options - Notification configuration
 *
 * @example
 * ```typescript
 * // Simple toast
 * notify('Success!', 'File saved successfully')
 *
 * // Error toast
 * notify('Error', 'Failed to save file', { type: 'error' })
 * ```
 */
export async function notify(
  title: string,
  message?: string,
  options: NotificationOptions = {},
): Promise<void> {
  const { type = 'info', duration } = options;

  try {
    logger.debug('Sending toast notification', { title, message, type });

    const toastContent = message ? `${title}: ${message}` : title;
    const toastOptions = duration !== undefined ? { duration } : {};

    switch (type) {
      case 'success':
        toast.success(toastContent, toastOptions);
        break;
      case 'error':
        toast.error(toastContent, toastOptions);
        break;
      case 'warning':
        toast.warning(toastContent, toastOptions);
        break;
      case 'info':
      default:
        toast.info(toastContent, toastOptions);
        break;
    }
  } catch (error) {
    logger.error('Failed to send notification', { title, message, error });
  }
}

/**
 * Convenience functions for common notification types
 */
export const notifications = {
  /** Show success notification */
  success: (title: string, message?: string, native?: boolean) =>
    notify(title, message, { type: 'success', native }),

  /** Show error notification */
  error: (title: string, message?: string, native?: boolean) =>
    notify(title, message, { type: 'error', native }),

  /** Show info notification */
  info: (title: string, message?: string, native?: boolean) =>
    notify(title, message, { type: 'info', native }),

  /** Show warning notification */
  warning: (title: string, message?: string, native?: boolean) =>
    notify(title, message, { type: 'warning', native }),
};

// Export individual convenience functions
export const { success, error, info, warning } = notifications;
