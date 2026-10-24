// Gym profiles (fitbod-experience.md B3): named locations, each with its own equipment
// checklist and its own dumbbell inventory. One gym is active; its equipment is a HARD
// filter for the generator and the picker, the way Fitbod's locations gate its catalogue.
//
// Storage is S.gyms + S.activeGymId, but nothing else in the app had to learn a new
// shape: the active gym is mirrored onto the equipment-profile machinery the app already
// has (lib/equipment.js — switchGym writes the mirror), and stateForGym hands the
// generator a view of the state whose dumbbell list is the active gym's, so the owned-
// dumbbell rules in lib/dumbbells.js and lib/progression.js apply per gym unchanged.
//
// Dylan's install derives its gym the way his profile is derived (lib/profile.js): the
// My Gym seed marks it, so a Planet Fitness gym exists from the first read without a
// migration ever writing one. Editing gyms in Settings materialises the list into
// S.gyms (gymsOf's output, edited), stamped like every other synced list.
import { ACC_V } from './equipment.js'
import { uid } from './format.js'
import { myGymSeeded } from './my-gym.js'

// The standard Planet Fitness selectorized lineup, in the catalogue's own equipment
// terms (B3): the circuit machines (leverage), the sled leg press, cable stations, the
// Smith machine, the assisted pull-up/dip, dumbbells, benches and a pull-up bar, and the
// cardio row. The dumbbell inventory is deliberately NOT part of the preset — clubs vary
// and Dylan sets his own once in the gym editor; until he does, dumbbell prescriptions
// step by their plain increment, as they did before gyms existed.
export const PLANET_FITNESS_EQUIPMENT = [
  'leverage machine', 'sled machine', 'cable', 'smith machine', 'assisted',
  'dumbbell', 'body weight', 'stationary bike', 'elliptical machine',
  'bench', 'pull-up bar',
]

// The travel pattern from B3: a second location that costs no setup. Bodyweight work is
// never gated by a profile (lib/equipment.js), so this list is really about the bar.
export const BODYWEIGHT_EQUIPMENT = ['body weight', 'pull-up bar', 'bench']

export const PF_GYM_ID = 'gym-planet-fitness'
export const HOME_GYM_ID = 'gym-home-bodyweight'

export const planetFitnessGym = () => ({
  id: PF_GYM_ID, name: 'Planet Fitness', equipment: [...PLANET_FITNESS_EQUIPMENT], dbWeights: [],
})
export const homeGym = () => ({
  id: HOME_GYM_ID, name: 'Home (bodyweight)', equipment: [...BODYWEIGHT_EQUIPMENT], dbWeights: [],
})

export function newGym(name, equipment = []) {
  return { id: 'gym-' + uid(), name: name || 'Gym', equipment: [...equipment], dbWeights: [] }
}

/**
 * The gyms this profile has. A saved list wins; a seeded install that never saved one
 * reads as the Planet Fitness gym (his gym — the My Gym seed is a PF rotation), so the
 * switcher, the generator and the editor all have something concrete to show.
 */
export function gymsOf(S) {
  if (Array.isArray(S?.gyms) && S.gyms.length) return S.gyms
  return myGymSeeded(S) ? [planetFitnessGym()] : []
}

/** The active gym: the chosen one, else the first, else null (no gym = no filter). */
export function activeGym(S) {
  const gyms = gymsOf(S)
  return gyms.find(g => g.id === S?.activeGymId) || gyms[0] || null
}

/**
 * The state as the active gym sees it: the equipment filter pointed at the gym's
 * checklist and the dumbbell inventory replaced by the gym's own list (when it has one —
 * an empty inventory means "not specified here", and the standing list keeps applying,
 * never a silent empty rack). Pure: the input state is not touched.
 */
export function stateForGym(S, gym) {
  if (!S || !gym) return S
  const profile = { id: 'gym:' + gym.id, name: gym.name, equipment: [...(gym.equipment || [])], accV: ACC_V }
  const view = { ...S, equipFilterOn: true, equipProfiles: [profile], activeEquipId: profile.id }
  const db = Array.isArray(gym.dbWeights) ? gym.dbWeights.filter(w => Number(w) > 0) : []
  if (db.length) view.dumbbells = { ...(S.dumbbells || {}), [S.unit || 'kg']: { weights: [...db].sort((a, b) => a - b), _ts: gym._ts || 0 } }
  return view
}

/**
 * Make a gym active (a store mutator — call inside update()). Writes the gym's mirror
 * onto the equipment-profile fields and the dumbbell list, so the Library, the picker and
 * session building — which all read those — follow the switch without knowing gyms
 * exist. A composed plan belongs to the gym it was composed at: switching drops it
 * (B4's regeneration triggers), and the preview composes the new gym's workout.
 */
export function switchGym(s, gymId, now = Date.now()) {
  const gyms = gymsOf(s)
  const gym = gyms.find(g => g.id === gymId) || gyms[0]
  if (!gym) return
  if (!Array.isArray(s.gyms) || !s.gyms.length) s.gyms = gyms
  s.activeGymId = gym.id
  const view = stateForGym(s, gym)
  s.equipProfiles = view.equipProfiles
  s.activeEquipId = view.activeEquipId
  s.equipFilterOn = true
  if (view.dumbbells !== s.dumbbells) s.dumbbells = view.dumbbells
  if (s.todayPlan && s.todayPlan.gymId !== gym.id) { s.todayPlanPrev = s.todayPlan; s.todayPlan = null }
  void now
}

/** Save an edited gym list (a store mutator): materialise, stamp, keep the active id valid. */
export function saveGyms(s, gyms, now = Date.now()) {
  s.gyms = (gyms || []).map(g => ({ ...g, _ts: now }))
  if (s.activeGymId && !s.gyms.some(g => g.id === s.activeGymId)) s.activeGymId = s.gyms[0]?.id || null
  const gym = activeGym(s)
  if (gym) switchGym(s, gym.id, now)
}
