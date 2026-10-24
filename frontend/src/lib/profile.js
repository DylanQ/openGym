// The training profile (fitbod-experience.md B2): the answers the First Entry wizard asks —
// goal, experience, split, schedule, session shape — kept in one store object, editable
// afterwards in Settings → Training Profile. Everything the generator (lib/generate.js) and
// the weekly targets (lib/targets.js) decide reads from here, so the wizard, the hub and
// the composer can never disagree about what Dylan asked for.
//
// Dylan's own install never fills the wizard in: his profile is derived from the My Gym
// seed he already carries (profileOf), the way every older profile reads its defaults off
// DEF. A profile somebody actually saved always wins over the derivation.
import { myGymSeeded } from './my-gym.js'

export const GOALS = ['recomp', 'build-muscle', 'get-lean', 'get-stronger', 'powerlifting', 'general']
export const EXPERIENCES = ['beginner', 'intermediate', 'advanced']
export const SPLIT_IDS = ['ppl', 'upper-lower', 'full-body', 'fresh']
export const CARDIO_PLACEMENTS = ['none', 'start', 'end']

// The goal table (B4): the rep range a goal trains in, the rests it takes (seconds,
// compound / isolation), and its weekly working-set targets per muscle — a range whose
// middle lib/targets.js scales by frequency and experience. Recomp is this fork's own
// preset (B2.1): Build Muscle's rep ranges with Get Lean's session shape — Fitbod has no
// recomp goal; the row is ours, written from Dylan's stated aim (build muscle, lose fat).
export const GOAL_TABLE = {
  recomp: { reps: [8, 12], restCompound: 120, restIsolation: 75, setsLarge: [12, 16], setsSmall: [8, 12] },
  'build-muscle': { reps: [8, 12], restCompound: 120, restIsolation: 75, setsLarge: [12, 16], setsSmall: [8, 12] },
  'get-lean': { reps: [10, 15], restCompound: 75, restIsolation: 45, setsLarge: [10, 14], setsSmall: [8, 12] },
  'get-stronger': { reps: [4, 6], restCompound: 180, restIsolation: 90, setsLarge: [8, 12], setsSmall: [6, 10] },
  powerlifting: { reps: [3, 5], restCompound: 240, restIsolation: 120, setsLarge: [8, 12], setsSmall: [6, 8] },
  general: { reps: [8, 12], restCompound: 90, restIsolation: 60, setsLarge: [8, 10], setsSmall: [8, 10] },
}
export const goalRow = goal => GOAL_TABLE[goal] || GOAL_TABLE.general

// Muscles whose weekly targets come from the "large" row (B4 Step 4). Delts, arms and
// calves are the spec's named small muscles; everything not listed large reads small.
export const LARGE_MUSCLES = new Set(['chest', 'upper-back', 'quadriceps', 'hamstring', 'gluteal'])
export const isLargeMuscle = slug => LARGE_MUSCLES.has(slug)

// The split skeletons (B2.4): each day is a name and the primary muscles it trains. The
// generator scores candidates against these lists; rotation is by history (the day after
// the one the last session most resembled), not by weekday — Dylan trains every other
// day, not on fixed days, so the calendar does not get a vote.
export const SPLITS = {
  ppl: {
    name: 'Push / Pull / Legs',
    days: [
      { key: 'push', name: 'Push Day', muscles: ['chest', 'deltoids', 'triceps'] },
      { key: 'pull', name: 'Pull Day', muscles: ['upper-back', 'trapezius', 'biceps', 'forearm'] },
      { key: 'legs', name: 'Leg Day', muscles: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors', 'lower-back'] },
    ],
  },
  'upper-lower': {
    name: 'Upper / Lower',
    days: [
      { key: 'upper', name: 'Upper Day', muscles: ['chest', 'upper-back', 'deltoids', 'trapezius', 'biceps', 'triceps', 'forearm', 'serratus'] },
      { key: 'lower', name: 'Lower Day', muscles: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors', 'lower-back', 'hip-flexors'] },
    ],
  },
  'full-body': {
    name: 'Full Body',
    days: [
      { key: 'full', name: 'Full Body', muscles: ['chest', 'upper-back', 'quadriceps', 'hamstring', 'gluteal', 'deltoids', 'biceps', 'triceps', 'calves'] },
    ],
  },
  fresh: { name: 'Fresh Muscle Groups', days: [] },
}
export const splitDays = profile => SPLITS[profile?.split]?.days || SPLITS.ppl.days

export const DEFAULT_PROFILE = {
  goal: 'build-muscle', experience: 'intermediate', split: 'ppl',
  daysPerWeek: 3, days: [], previewTime: null,
  durationMin: 60, warmupSets: true, supersets: false, cardio: 'none',
}

// Dylan's answers, from his own log and his standing calls (B2): recomp, intermediate
// (two years consistent, 1.5–2 off, rebuilding), PPL skeleton with a fresh override,
// 3–4 sessions a week on an every-other-day rhythm — the goal itself is set to 3, the
// forgiving knob (B8). Warm-ups on, supersets off, no programmed cardio.
export const DYLAN_PROFILE = {
  goal: 'recomp', experience: 'intermediate', split: 'ppl',
  daysPerWeek: 3, days: [], previewTime: null,
  durationMin: 60, warmupSets: true, supersets: false, cardio: 'none',
}

/** The profile in force: the saved one, else Dylan's where his seed marks the install. */
export function profileOf(S) {
  const saved = S?.profile && typeof S.profile === 'object' ? S.profile : null
  return { ...DEFAULT_PROFILE, ...(saved || (myGymSeeded(S) ? DYLAN_PROFILE : {})) }
}

/** Anything that proves setup already happened — a log, a plan, a seeded weight. */
export const hasSetupSignals = S => !!(
  S?.workouts?.length || S?.routines?.length || S?.customEx?.length || S?.favEx?.length ||
  Object.keys(S?.exWeights || {}).length
)

/**
 * Whether the First Entry wizard should be offered at all. Dylan's install is
 * grandfathered (B2 acceptance): seeded or already training, he gets the Profile hub,
 * never the wizard. A genuinely fresh state — nothing logged, nothing planned — is the
 * only one that sees it, and finishing (or any first log) retires it for good.
 * Kept for compatibility; the intro gate below is the one the app actually uses.
 */
export const needsOnboarding = S => S?.onboarded !== true && !hasSetupSignals(S)

/**
 * Whether the First Entry intro wizard is still owed. UX overhaul (Oct 2026, Dylan's
 * field feedback): the intro is for EVERYONE, once — seeded, derived and already-training
 * states included. Derivation pre-fills the wizard (profileOf, the active gym, the last
 * weigh-in) so the walk is confirm-or-fix, never a cold interrogation, but nothing
 * derives the walk away. Only finishing or explicitly skipping retires it, tracked by
 * the dedicated `introSeen` flag — never by onboarded or by setup signals.
 */
export const needsIntro = S => S?.introSeen !== true

/** Minutes a session may run, mods (today only) over the profile's standing choice. */
export const durationOf = (profile, mods) =>
  (Number(mods?.durationMin) > 0 ? Number(mods.durationMin) : null) || profile?.durationMin || 60
