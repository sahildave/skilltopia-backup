export function isPlaceholderValue(value: unknown): boolean;

export function validateUpdaterReleaseConfig(tauriConfig: {
  bundle?: {
    createUpdaterArtifacts?: boolean;
  };
  plugins?: {
    updater?: {
      active?: boolean;
      endpoints?: unknown;
      pubkey?: unknown;
    };
  };
}): string[];
