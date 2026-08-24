import { providerRegistry } from '@/providers';
import { describe, expect, it } from 'vitest';
import { PROVIDER_ICONS } from './provider-icons';

describe('PROVIDER_ICONS', () => {
  it('maps only ids that exist in the provider registry', () => {
    const known = new Set(providerRegistry.providers.map((provider) => provider.id));
    expect(Object.keys(PROVIDER_ICONS).filter((id) => !known.has(id))).toEqual([]);
  });

  it('resolves each mapped id to a renderable icon', () => {
    for (const icon of Object.values(PROVIDER_ICONS)) {
      expect(icon).toBeTruthy();
    }
  });
});
