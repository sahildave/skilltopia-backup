const PLACEHOLDER_VALUES = new Set([
  'YOUR_UPDATER_PUBLIC_KEY_HERE',
  'YOUR_PUBLIC_KEY_FROM_STEP_1',
  'YOUR_USERNAME',
  'YOUR_REPO',
  '<owner>',
  '<repo>',
]);

export function isPlaceholderValue(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();
  return (
    PLACEHOLDER_VALUES.has(normalized) ||
    normalized.includes('YOUR_') ||
    normalized.includes('<owner>') ||
    normalized.includes('<repo>')
  );
}

export function isValidUpdaterPubkey(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();
  if (
    !normalized ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    normalized.includes('~')
  ) {
    return false;
  }

  return /^[A-Za-z0-9+/]+=*$/.test(normalized) && normalized.length >= 40;
}

export function validateUpdaterReleaseConfig(tauriConfig) {
  const updaterConfig = tauriConfig.plugins?.updater;
  const errors = [];

  if (!updaterConfig) {
    errors.push('Updater plugin config is missing from tauri.conf.json.');
    return errors;
  }

  if (!updaterConfig.pubkey || isPlaceholderValue(updaterConfig.pubkey)) {
    errors.push('Updater public key is missing or still uses a placeholder value.');
  } else if (!isValidUpdaterPubkey(updaterConfig.pubkey)) {
    errors.push(
      'Updater public key must be the minisign public key string, not a file path or invalid value.',
    );
  }

  const endpoints = Array.isArray(updaterConfig.endpoints) ? updaterConfig.endpoints : [];
  if (endpoints.length === 0) {
    errors.push('Updater release endpoint is missing.');
  }

  for (const endpoint of endpoints) {
    if (typeof endpoint !== 'string' || isPlaceholderValue(endpoint)) {
      errors.push('Updater release endpoint still uses a placeholder value.');
      continue;
    }

    if (!endpoint.endsWith('/releases/latest/download/latest.json')) {
      errors.push(
        `Updater release endpoint must point at releases/latest/download/latest.json: ${endpoint}`,
      );
    }
  }

  if (tauriConfig.bundle?.createUpdaterArtifacts && updaterConfig.active !== true) {
    errors.push('Updater must be active when updater artifacts are enabled for release.');
  }

  if (updaterConfig.active === true && errors.length > 0) {
    errors.push('Disable the updater until a real public key and endpoint are configured.');
  }

  return errors;
}
