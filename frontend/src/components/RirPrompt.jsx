// The per-exercise effort prompt (fitbod-experience.md B5.2): one quiet question after
// an exercise's last work set — "how many reps were left?" — answered with one tap and
// never a modal, because Tier-0 logging stays instant. The answer lands in the effort
// fields the app already reads (the last work set's rir/rpe, via the parent's onRate),
// where the fatigue model weights it and the effort stats count it; the marker on the
// entry (entry.rirPrompt) is what stops it asking twice.
import React from 'react'
import { t } from '../lib/i18n.js'
import { isWarmupRow } from '../lib/workout-model.js'

export const RIR_CHOICES = [0, 1, 2, 3, 4]

/* All planned work done and at least one work set to speak for: the moment the prompt
   belongs to. Warm-ups never count toward "finished". */
export function exerciseFinished(entry) {
  const work = (entry?.sets || []).filter(s => !isWarmupRow(s))
  return work.length > 0 && work.every(s => s.done)
}

export default function RirPrompt({ entry, onRate }) {
  if (!entry || typeof onRate !== 'function') return null
  if (!exerciseFinished(entry)) return null
  const rated = entry.rirPrompt
  return <div className="rirprompt" role="group" aria-label={t('Reps in reserve')}>
    <span className="rirprompt-q">{rated != null ? t('Reps left · {0}', rated >= 4 ? '4+' : rated) : t('How many reps were left?')}</span>
    <span className="rirprompt-chips">
      {RIR_CHOICES.map(v => <button key={v} type="button"
        className={'chip' + (rated === v ? ' on' : '')}
        aria-pressed={rated === v}
        onClick={() => onRate(v)}>{v >= 4 ? '4+' : v}</button>)}
    </span>
  </div>
}
