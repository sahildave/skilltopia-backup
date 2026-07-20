import { platform } from '@platform'

/** @deprecated Prefer `platform.listInstalled()` from `@platform`. */
export async function readGlobalSkills() {
  return platform.listInstalled()
}
