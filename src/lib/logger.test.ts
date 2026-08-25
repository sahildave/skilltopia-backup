import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  afterEach(() => {
    logger.setSink(null);
  });

  it('forwards structured entries to a configured runtime sink', () => {
    const sink = vi.fn();
    const error = new Error('folder picker failed');
    logger.setSink(sink);

    logger.error('Failed to choose coding folder', { error });

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'Failed to choose coding folder',
        context: { error },
      }),
    );
  });
});
