export const SEED_MAX_BYTES: number;
export function seedSizeBytes(filePath: string): Promise<number>;
export function assertSeedSize(sizeBytes: number, filePath?: string): void;
