import { resolve } from 'node:path'
import { assertSeedSize, seedSizeBytes } from './seed-utils.mjs'

const seedPath = resolve('src/data/skills-seed.ts')
const sizeBytes = await seedSizeBytes(seedPath)
assertSeedSize(sizeBytes, seedPath)
console.log(`Seed size: ${sizeBytes} bytes (max 256000)`)
