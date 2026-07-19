import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebouncedValue } from './use-debounced-value'
import { skillsShQueryKeys } from '@/services/skills-sh'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 300))
    expect(result.current).toBe('hello')
  })

  it('updates only after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'ab' })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('ab')
  })
})

describe('skillsShQueryKeys', () => {
  it('builds stable leaderboard keys', () => {
    expect(skillsShQueryKeys.leaderboard('all-time', 500)).toEqual([
      'skills-sh',
      'leaderboard',
      'all-time',
      500,
    ])
  })

  it('builds stable search keys', () => {
    expect(skillsShQueryKeys.search('react', 50)).toEqual([
      'skills-sh',
      'search',
      'react',
      50,
    ])
  })
})
