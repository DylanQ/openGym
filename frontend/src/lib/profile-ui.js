// The training profile's vocabularies as picker options (lib/profile.js holds the
// ids; the words live here so the wizard and the hub can never offer different lists).
import { t } from './i18n.js'
import { GOALS, EXPERIENCES, SPLIT_IDS, SPLITS, CARDIO_PLACEMENTS } from './profile.js'

export const GOAL_OPTIONS = GOALS.map(g => ({
  value: g,
  label: {
    recomp: t('Recomp — build muscle, lose fat'), 'build-muscle': t('Build Muscle'),
    'get-lean': t('Get Lean'), 'get-stronger': t('Get Stronger'),
    powerlifting: t('Powerlifting'), general: t('General Fitness'),
  }[g],
}))
export const EXPERIENCE_OPTIONS = EXPERIENCES.map(e => ({
  value: e,
  label: { beginner: t('Beginner'), intermediate: t('Intermediate'), advanced: t('Advanced') }[e],
}))
export const SPLIT_OPTIONS = SPLIT_IDS.map(id => ({ value: id, label: SPLITS[id].name }))
export const CARDIO_OPTIONS = CARDIO_PLACEMENTS.map(c => ({
  value: c,
  label: { none: t('None'), start: t('Start of session'), end: t('End of session') }[c],
}))
