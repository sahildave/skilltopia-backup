export function parseAgentsSource(
  sourceText: string,
  fileName?: string
): unknown[]
export function buildRegistry(
  providers: unknown[],
  commit: string
): {
  source: {
    repositoryUrl: string
    commit: string
    license: 'MIT'
    attribution: string
    agentsTsPath: string
  }
  providers: unknown[]
}
