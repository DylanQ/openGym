import { describe, it, expect } from 'vitest'
import { EXIDX } from './exercises.js'
import {
  MY_GYM_SEED, MY_GYM_IDS, MY_GYM_NOTES, kneeStatus, kneeStatusOf,
  recentIds, myGymIds, myGymSeeded, applyMyGymSeed,
} from './my-gym.js'

// The seed ids were resolved against the renamed catalogue by hand (2026-10-23). Pinning each
// id to the display name it was picked for means a dataset refresh that renumbers exercises
// fails here, loudly, instead of quietly seeding somebody else's lifts into Dylan's gym.
const EXPECTED_NAMES = {
  '0576': 'Machine Chest Press',
  '1030': 'Machine Pec Deck Fly',
  '0334': 'Dumbbell Lateral Raise',
  '0201': 'Cable Pushdown',
  '2267': 'Machine Seated Leg Press',
  '0599': 'Machine Seated Leg Curl',
  '1459': 'Dumbbell Romanian Deadlift',
  '0417': 'Dumbbell Standing Calf Raise',
}

describe('my gym seed', () => {
  it('resolves every seed id to the exercise it names', () => {
    for (const e of MY_GYM_SEED) {
      expect(EXIDX[e.id], `seed id ${e.id}`).toBeTruthy()
      expect(EXIDX[e.id].n).toBe(EXPECTED_NAMES[e.id])
    }
    expect(new Set(MY_GYM_IDS).size).toBe(MY_GYM_IDS.length)
  })

  it('applies favourites, working weights, notes and starter routines', () => {
    const s = { unit: 'lb', favEx: [], exWeights: {}, exNotes: {}, routines: [], workouts: [] }
    applyMyGymSeed(s)
    expect(s.favEx).toEqual(MY_GYM_IDS)
    // His logged working weights, in the profile's own unit.
    expect(s.exWeights['1030']).toEqual({ w: 55, d: '2026-10-23' })
    expect(s.exWeights['0576'].w).toBe(65)
    expect(s.exWeights['0201'].w).toBe(80)
    expect(s.exWeights['0334'].w).toBe(15)
    expect(s.exWeights['2267'].w).toBe(65)
    expect(s.exWeights['0599'].w).toBe(60)
    expect(s.exWeights['1459'].w).toBe(20)
    // Calf raises carry no seeded weight — his log has none, so none is invented.
    expect(s.exWeights['0417']).toBeUndefined()
    expect(s.exNotes['2267']).toBe(MY_GYM_NOTES['2267'])
    const push = s.routines.find(r => r.name === 'Push Day')
    const legs = s.routines.find(r => r.name === 'Leg Day')
    expect(push.ex.map(e => e.id)).toEqual(['0576', '1030', '0334', '0201'])
    expect(push.ex.find(e => e.id === '0201').weight).toBe(80)
    expect(legs.ex.map(e => e.id)).toEqual(['2267', '0599', '1459', '0417'])
    expect(legs.ex.find(e => e.id === '0417').weight).toBe(0)
    expect(myGymSeeded(s)).toBe(true)
  })

  it('converts the seeded weights into a kg profile', () => {
    const s = { unit: 'kg', favEx: [], exWeights: {}, exNotes: {}, routines: [] }
    applyMyGymSeed(s)
    // lib/units.js plate rounding: 55 lb -> 25 kg, 80 lb -> 36.25 kg.
    expect(s.exWeights['1030'].w).toBe(25)
    expect(s.exWeights['0201'].w).toBe(36.25)
  })

  it('never overwrites a weight, note or routine that is already there', () => {
    const s = {
      unit: 'lb', favEx: ['9999'],
      exWeights: { '1030': { w: 70, d: '2026-10-20' } },
      exNotes: { '2267': 'seat pin 7' },
      routines: [{ id: 'r1', name: 'Push Day', emoji: 'barbell', ex: [] }],
    }
    applyMyGymSeed(s)
    expect(s.exWeights['1030']).toEqual({ w: 70, d: '2026-10-20' })
    expect(s.exNotes['2267']).toBe('seat pin 7')
    expect(s.favEx).toContain('9999')
    expect(s.routines.filter(r => r.name === 'Push Day')).toHaveLength(1)
    // A second run changes nothing at all.
    const once = JSON.parse(JSON.stringify(s))
    applyMyGymSeed(s)
    expect(s).toEqual(once)
  })
})

describe('knee flags', () => {
  it('flags the heavy knee-load families as caution', () => {
    expect(kneeStatusOf('2267')).toBe('caution')            // Machine Seated Leg Press
    expect(kneeStatus(EXIDX['0739'])).toBe('caution')       // Sled 45° Leg Press
    expect(kneeStatus({ n: 'Barbell Squat', cat: 'strength' })).toBe('caution')
    expect(kneeStatus({ n: 'Machine Leg Extension', cat: 'strength' })).toBe('caution')
    expect(kneeStatus({ n: 'Dumbbell Walking Lunge', cat: 'strength' })).toBe('caution')
  })

  it('flags his knee-friendly leg work as safe', () => {
    expect(kneeStatusOf('0599')).toBe('safe')               // Machine Seated Leg Curl
    expect(kneeStatusOf('1459')).toBe('safe')               // Dumbbell Romanian Deadlift
    expect(kneeStatusOf('0417')).toBe('safe')               // Dumbbell Standing Calf Raise
  })

  it('leaves everything else unflagged — stretches included', () => {
    expect(kneeStatusOf('0576')).toBeNull()                 // chest press: not leg work
    expect(kneeStatus({ n: 'Lunge Stretch', cat: 'stretching' })).toBeNull()
    expect(kneeStatus({ n: 'Standing Calf Raise Stretch', cat: 'strength' })).toBeNull()
    expect(kneeStatus(null)).toBeNull()
    expect(kneeStatusOf('does-not-exist')).toBeNull()
  })

  it('reads the dataset name too, so the rename cannot change a flag', () => {
    const ex = EXIDX['2267']
    expect(kneeStatus({ ...ex, n: 'Some Future Rename' })).toBe('caution')
  })
})

describe('my gym scope', () => {
  it('orders seed, then favourites, then recents — each exercise once', () => {
    const S = {
      favEx: ['9999', '0576'],
      workouts: [
        { d: '2026-10-20', entries: [{ id: '8888' }, { id: '0576' }] },
        { d: '2026-10-22', entries: [{ id: '7777' }, { id: '8888' }] },
      ],
    }
    expect(recentIds(S)).toEqual(['7777', '8888', '0576'])
    const ids = myGymIds(S)
    expect(ids.slice(0, MY_GYM_IDS.length)).toEqual(MY_GYM_IDS)
    expect(ids[MY_GYM_IDS.length]).toBe('9999')
    expect(ids.slice(MY_GYM_IDS.length + 1)).toEqual(['7777', '8888'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('tolerates a profile with nothing in it', () => {
    expect(myGymIds({})).toEqual(MY_GYM_IDS)
    expect(recentIds(null)).toEqual([])
    expect(myGymSeeded({})).toBe(false)
  })
})
