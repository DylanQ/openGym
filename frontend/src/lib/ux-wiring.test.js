// UX overhaul (Oct 2026) — cross-surface wiring: a fact edited in one surface must
// be visible where another surface consumes it. These are propagation tests, not
// render tests: the same store object goes in one side and comes out the other.
import { describe, expect, it } from 'vitest'
import { composeSession } from './generate.js'
import { stateForGym, activeGym, saveGyms, planetFitnessGym } from './gyms.js'
import { exAvailable, activeProfile } from './equipment.js'
import { dumbbellsOf } from './dumbbells.js'
import { EXIDX } from './exercises.js'
import { isWarmupRow } from './workout-model.js'

const NOW = Date.parse('2026-10-23T12:00:00')
const DATE = '2026-10-23'

const dylan = (over = {}) => ({
  unit: 'lb', workouts: [], routines: [], customEx: [], favEx: ['0576', '1030', '0334', '0201', '2267', '0599', '1459', '0417'],
  exWeights: {
    '0576': { w: 65, d: '2026-10-23' }, '1030': { w: 55, d: '2026-10-23' },
    '0334': { w: 15, d: '2026-10-23' }, '0201': { w: 80, d: '2026-10-23' },
    '2267': { w: 65, d: '2026-10-23' }, '0599': { w: 60, d: '2026-10-23' },
    '1459': { w: 20, d: '2026-10-23' },
  },
  exNotes: {}, equipProfiles: [], activeEquipId: null, equipFilterOn: false, dumbbells: {},
  bodyweight: [], profile: null, onboarded: true, introSeen: true, gyms: [], activeGymId: null,
  exPref: {}, swapStats: {}, recoveryOverride: {}, weekStart: 1,
  ...over,
})
const workRows = e => e.sets.filter(s => !isWarmupRow(s))

describe('wiring: Training Profile edits reach the generator', () => {
  it('a goal change re-ranges the composed session', () => {
    const recomp = composeSession(dylan({ profile: { goal: 'recomp', experience: 'intermediate', split: 'ppl', daysPerWeek: 3, durationMin: 60, warmupSets: true, supersets: false, cardio: 'none' } }), { date: DATE, now: NOW })
    const stronger = composeSession(dylan({ profile: { goal: 'get-stronger', experience: 'intermediate', split: 'ppl', daysPerWeek: 3, durationMin: 60, warmupSets: true, supersets: false, cardio: 'none' } }), { date: DATE, now: NOW })
    const press = plan => plan.entries.find(e => e.id === '0576')
    expect(press(recomp), 'seed press composed under recomp').toBeTruthy()
    expect(press(stronger), 'seed press composed under get-stronger').toBeTruthy()
    const reps = plan => Math.max(...workRows(press(plan)).map(s => s.r))
    expect(reps(stronger)).toBeLessThan(reps(recomp))
  })

  it('a working-weight edit re-calibrates the composed session', () => {
    const plan = composeSession(dylan({ exWeights: { '0576': { w: 70, d: '2026-10-23' } } }), { date: DATE, now: NOW })
    const press = plan.entries.find(e => e.id === '0576')
    expect(press).toBeTruthy()
    expect(Math.max(...workRows(press).map(s => s.w))).toBe(70)
  })
})

describe('wiring: gym edits reach the picker and the session', () => {
  it('removing cable from the gym removes cable lifts from the filtered view', () => {
    const s = dylan()
    saveGyms(s, [{ ...planetFitnessGym(), equipment: planetFitnessGym().equipment.filter(e => e !== 'cable') }])
    const view = stateForGym(s, activeGym(s))
    expect(exAvailable(view, EXIDX['0201'])).toBe(false)   // Cable Pushdown, was available
    expect(exAvailable(view, EXIDX['0576'])).toBe(true)    // Machine Chest Press stays
    // The Library reads the mirrored profile, not the gym object — it must agree.
    expect(activeProfile(s).equipment).not.toContain('cable')
  })

  it('a gym dumbbell list becomes the list every surface steps over', () => {
    const s = dylan()
    saveGyms(s, [{ ...planetFitnessGym(), dbWeights: [5, 10, 15, 20] }])
    expect(dumbbellsOf(s)).toEqual([5, 10, 15, 20])
    const view = stateForGym(s, activeGym(s))
    expect(dumbbellsOf(view)).toEqual([5, 10, 15, 20])
  })

  it('editing the gym inventory (the sheet path) lands on the gym, not a stale standing list', () => {
    const s = dylan()
    saveGyms(s, [{ ...planetFitnessGym(), dbWeights: [5, 10] }])
    // What DumbbellInventorySheet.save does with an active gym: saveGyms, not standing.
    saveGyms(s, [{ ...planetFitnessGym(), dbWeights: [5, 10, 25] }])
    expect(activeGym(s).dbWeights).toEqual([5, 10, 25])
    expect(dumbbellsOf(s)).toEqual([5, 10, 25])
  })
})
