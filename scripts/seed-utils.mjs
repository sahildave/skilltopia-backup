import { stat } from 'node:fs/promises';

export const SEED_MAX_BYTES = 250 * 1024;

export async function seedSizeBytes(filePath) {
  return (await stat(filePath)).size;
}

export function assertSeedSize(sizeBytes, filePath = 'seed artifact') {
  if (sizeBytes > SEED_MAX_BYTES) {
    throw new Error(`${filePath} is ${sizeBytes} bytes; the maximum is ${SEED_MAX_BYTES} bytes`);
  }
}
