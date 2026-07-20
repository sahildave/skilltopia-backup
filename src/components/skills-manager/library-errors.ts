export function isPermissionError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('forbidden') ||
    lower.includes('not allowed') ||
    lower.includes('denied') ||
    lower.includes('scope') ||
    lower.includes('permission')
  )
}
