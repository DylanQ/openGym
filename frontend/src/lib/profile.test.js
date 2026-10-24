// The training profile (fitbod-experience.md B2): Dylan's install derives its answers
// from the My Gym seed it already carries; a fresh one gets the plain defaults; a saved
// profile always wins. And the wizard is offered only where nothing has happened yet.
import { describe, expect, it } from 'vitest'
import { profileOf, needsOnboarding, DYLAN_PROFILE, DEFAULT_PROFILE } from './profile.js'

const seeded = { exWeights: { '0576': { w: 65, d: '2026-10-23' } }, workouts: [], routines: [], favEx: [], customEx: [] }

describe('profileOf', () => {
  it('derives Dylan’s profile on a seeded install that never saved one', () => {
    const p = profileOf(seeded)
    expect(p.goal).toBe('recomp')
    expect(p.experience).toBe('intermediate')
    expect(p.split).toBe('ppl')
    expect(p.daysPerWeek).toBe(3)
    expect(p.durationMin).toBe(60)
    expect(DYLAN_PROFILE.cardio).toBe('none')
  })

  it('gives a fresh install the plain defaults', () => {
    const p = profileOf({ workouts: [], routines: [] })
    expect(p).toEqual(DEFAULT_PROFILE)
  })

  it('lets a saved profile win over the derivation, field by field', () => {
    const p = profileOf({ ...seeded, profile: { goal: 'get-stronger', durationMin: 45 } })
    expect(p.goal).toBe('get-stronger')
    expect(p.durationMin).toBe(45)
    expect(p.split).toBe('ppl')   // untouched fields still derive
  })
})

describe('needsOnboarding', () => {
  it('offers the wizard only to a genuinely fresh state', () => {
    expect(needsOnboarding({ workouts: [], routines: [], favEx: [], customEx: [], exWeights: {} })).toBe(true)
  })
  it('grandfathers Dylan’s install: seeded weights retire the wizard', () => {
    expect(needsOnboarding(seeded)).toBe(false)
  })
  it('grandfathers anyone who has logged, planned or finished setup', () => {
    expect(needsOnboarding({ workouts: [{ id: 'w' }] })).toBe(false)
    expect(needsOnboarding({ routines: [{ id: 'r' }] })).toBe(false)
    expect(needsOnboarding({ onboarded: true })).toBe(false)
  })
})
