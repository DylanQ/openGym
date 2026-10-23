import { describe, it, expect } from 'vitest'
import { CATALOGUE, EXDB, EXIDX, matchExercise, matchesExerciseSearch, searchExercises } from './exercises.js'
import { exerciseNameFor } from './i18n-core.js'
import NAME_MAP from './exercise-name-map.json' with { type: 'json' }

// This fork renames the catalogue for display: the dataset's "lever seated leg press" reads
// "Machine Seated Leg Press" everywhere a name is shown, while the dataset's own spelling is
// kept as `nOrig` so searches (and habits) formed against it keep working. Stored data holds
// exercise ids only, so nothing here rewrites state — EXDB stays exactly as generated.
describe('exercise name map', () => {
  it('shows the mapped name wherever a catalogue name is displayed', () => {
    const ex = EXIDX['2267']
    expect(ex.n).toBe('Machine Seated Leg Press')
    expect(exerciseNameFor(ex)).toBe('Machine Seated Leg Press')
  })

  it('applies the map across the whole catalogue', () => {
    for (const ex of CATALOGUE) expect(ex.n).toBe(NAME_MAP[ex.id])
  })

  it('keeps the dataset name alongside as nOrig, and leaves EXDB pristine', () => {
    expect(EXIDX['2267'].nOrig).toBe('lever seated leg press')
    const raw = EXDB.find(e => e.id === '2267')
    expect(raw.n).toBe('lever seated leg press')
    expect(raw.nOrig).toBeUndefined()
  })

  it('still finds an exercise by its old dataset name', () => {
    const ex = EXIDX['2267']
    expect(matchExercise(ex, 'lever seated leg press')).toBe(true)
    expect(matchesExerciseSearch(ex, 'lever seated leg press')).toBe(true)
    const found = searchExercises(CATALOGUE, 'lever seated leg press')
    expect(found.map(e => e.id)).toContain('2267')
  })

  it('finds an exercise by its new name, ahead of its numbered variants', () => {
    const found = searchExercises(CATALOGUE, 'Machine Seated Leg Press')
    const ids = found.map(e => e.id)
    expect(ids).toContain('2267')
    expect(ids.indexOf('2267')).toBeLessThan(ids.indexOf('3385'))
  })
})
