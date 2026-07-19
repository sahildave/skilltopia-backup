import { describe, expect, it } from 'vitest'
import {
  parseSkillDetailQuery,
  parseSkillsLeaderboardQuery,
  parseSkillsSearchQuery,
} from './query.js'

describe('parseSkillsLeaderboardQuery', () => {
  it('accepts allowed params and builds a cleaned query', () => {
    const result = parseSkillsLeaderboardQuery(
      new URLSearchParams({
        view: 'trending',
        page: '1',
        per_page: '50',
      })
    )

    expect(result).toEqual({
      ok: true,
      query: expect.any(URLSearchParams),
    })
    if (!result.ok) return
    expect(result.query.toString()).toBe('view=trending&page=1&per_page=50')
  })

  it('rejects unknown keys with 400', () => {
    const result = parseSkillsLeaderboardQuery(
      new URLSearchParams({ view: 'all-time', foo: 'bar' })
    )

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        error: 'invalid_query',
        message: 'Unknown query parameter: foo',
      },
    })
  })

  it('rejects invalid view values', () => {
    const result = parseSkillsLeaderboardQuery(
      new URLSearchParams({ view: 'weekly' })
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(400)
    expect(result.body.error).toBe('invalid_query')
  })

  it('rejects per_page outside 1–500', () => {
    expect(
      parseSkillsLeaderboardQuery(new URLSearchParams({ per_page: '0' })).ok
    ).toBe(false)
    expect(
      parseSkillsLeaderboardQuery(new URLSearchParams({ per_page: '501' })).ok
    ).toBe(false)
    expect(
      parseSkillsLeaderboardQuery(new URLSearchParams({ per_page: '9999' })).ok
    ).toBe(false)
  })

  it('rejects negative page', () => {
    const result = parseSkillsLeaderboardQuery(
      new URLSearchParams({ page: '-1' })
    )
    expect(result.ok).toBe(false)
  })

  it('allows empty params', () => {
    const result = parseSkillsLeaderboardQuery(new URLSearchParams())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.query.toString()).toBe('')
  })
})

describe('parseSkillsSearchQuery', () => {
  it('accepts q, limit, and optional owner', () => {
    const result = parseSkillsSearchQuery(
      new URLSearchParams({
        q: 'react',
        limit: '50',
        owner: 'vercel',
      })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.query.get('q')).toBe('react')
    expect(result.query.get('limit')).toBe('50')
    expect(result.query.get('owner')).toBe('vercel')
  })

  it('rejects unknown keys with 400', () => {
    const result = parseSkillsSearchQuery(
      new URLSearchParams({ q: 'react', extra: '1' })
    )

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        error: 'invalid_query',
        message: 'Unknown query parameter: extra',
      },
    })
  })

  it('rejects q shorter than 2 characters', () => {
    const result = parseSkillsSearchQuery(new URLSearchParams({ q: 'a' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(400)
  })

  it('rejects missing q', () => {
    const result = parseSkillsSearchQuery(new URLSearchParams({ limit: '10' }))
    expect(result.ok).toBe(false)
  })

  it('rejects limit outside 1–200', () => {
    expect(
      parseSkillsSearchQuery(new URLSearchParams({ q: 'ab', limit: '0' })).ok
    ).toBe(false)
    expect(
      parseSkillsSearchQuery(new URLSearchParams({ q: 'ab', limit: '201' })).ok
    ).toBe(false)
  })
})

describe('parseSkillDetailQuery', () => {
  it('accepts and cleans a skill id', () => {
    const twoPart = parseSkillDetailQuery(
      new URLSearchParams({ skill_id: 'owner/my-skill' })
    )
    expect(twoPart.ok).toBe(true)
    if (!twoPart.ok) return
    expect(twoPart.query.toString()).toBe('skill_id=owner%2Fmy-skill')

    const threePart = parseSkillDetailQuery(
      new URLSearchParams({ skill_id: 'vercel-labs/skills/find-skills' })
    )
    expect(threePart.ok).toBe(true)
    if (!threePart.ok) return
    expect(threePart.query.get('skill_id')).toBe(
      'vercel-labs/skills/find-skills'
    )
  })

  it('rejects missing, malformed, and unknown detail params', () => {
    expect(parseSkillDetailQuery(new URLSearchParams()).ok).toBe(false)
    expect(
      parseSkillDetailQuery(new URLSearchParams({ skill_id: 'my-skill' })).ok
    ).toBe(false)
    expect(
      parseSkillDetailQuery(
        new URLSearchParams({ skill_id: 'owner/skill', extra: '1' })
      ).ok
    ).toBe(false)
  })
})
