// Gym profiles (fitbod-experience.md B3): the Planet Fitness preset must actually
// contain Dylan's seeded rotation — a preset that filters out his own lifts is worse
// than no preset. The active gym is a HARD filter, and its dumbbell inventory reaches
// the owned-bell machinery through the state view.
import { describe, expect, it } from 'vitest'
import { gymsOf, activeGym, stateForGym, switchGym, planetFitnessGym, PLANET_FITNESS_EQUIPMENT } from './gyms.js'
import { eqAvailable, exAvailable } from './equipment.js'
import { EXIDX } from './exercises.js'
import { MY_GYM_SEED } from './my-gym.js'
import { ownedWeightsFor } from './dumbbells.js'

const S = (over = {}) => ({
  unit: 'lb', workouts: [], routines: [], customEx: [], favEx: [], exWeights: {},
  equipProfiles: [], activeEquipId: null, equipFilterOn: false, dumbbells: {},
  gyms: [], activeGymId: null, ...over,
})

describe('the Planet Fitness preset', () => {
  it('admits every lift in Dylan’s seeded rotation', () => {
    for (const seed of MY_GYM_SEED) {
      const ex = EXIDX[seed.id]
      expect(ex, seed.id).toBeTruthy()
      expect(eqAvailable(PLANET_FITNESS_EQUIPMENT, ex), ex.n).toBe(true)
    }
  })

  it('is the derived gym on a seeded install, and nothing on a fresh one', () => {
    expect(gymsOf(S({ exWeights: { '0576': { w: 65, d: '2026-10-23' } } }))[0].name).toBe('Planet Fitness')
    expect(gymsOf(S())).toEqual([])
    expect(activeGym(S())).toBeNull()
  })
})

describe('stateForGym', () => {
  it('hard-filters by the gym’s equipment: no barbell at Planet Fitness', () => {
    const view = stateForGym(S(), planetFitnessGym())
    const barbellPress = Object.values(EXIDX).find(e => e.eq === 'barbell' && /bench press/i.test(e.n))
    const dbPress = EXIDX['0576']
    expect(exAvailable(view, barbellPress)).toBe(false)
    expect(exAvailable(view, dbPress)).toBe(true)
  })

  it('wires the gym’s dumbbell inventory into the owned-bell machinery', () => {
    const gym = { ...planetFitnessGym(), dbWeights: [5, 10, 15, 20, 25] }
    const view = stateForGym(S(), gym)
    const dbEx = Object.values(EXIDX).find(e => e.eq === 'dumbbell')
    expect(ownedWeightsFor(view, { id: dbEx.id })).toEqual([5, 10, 15, 20, 25])
    // An empty inventory means "not specified", never an empty rack.
    const unspecified = stateForGym(S({ dumbbells: { lb: { weights: [30], _ts: 1 } } }), planetFitnessGym())
    expect(ownedWeightsFor(unspecified, { id: dbEx.id })).toEqual([30])
  })

  it('does not mutate the state it views', () => {
    const s = S()
    stateForGym(s, planetFitnessGym())
    expect(s.equipFilterOn).toBe(false)
    expect(s.equipProfiles).toEqual([])
  })
})

describe('switchGym', () => {
  it('mirrors the gym onto the equipment filter and drops another gym’s plan', () => {
    const s = S({
      exWeights: { '0576': { w: 65, d: '2026-10-23' } },
      todayPlan: { date: '2026-10-23', gymId: 'somewhere-else', entries: [] },
    })
    switchGym(s, 'gym-planet-fitness')
    expect(s.activeGymId).toBe('gym-planet-fitness')
    expect(s.equipFilterOn).toBe(true)
    expect(s.activeEquipId).toBe('gym:gym-planet-fitness')
    expect(s.todayPlan).toBeNull()
    expect(s.todayPlanPrev?.gymId).toBe('somewhere-else')
  })
})
