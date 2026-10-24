// The week at a glance (fitbod-experience.md B7): sets landed against the goal's
// weekly targets — 1.0 to a primary muscle, 0.5 to a secondary, warm-ups never — and
// the streak as punched slots, the Ledger way: a week is kept by showing up the days
// the profile promises, and the record is derived from history alone.
import React from 'react'
import { useStore } from '../store/useStore.js'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { MUSCLE_NAME } from '../lib/muscles.js'
import { targetsProgress, weekStreak, weekWorkoutCount } from '../lib/targets.js'
import { profileOf } from '../lib/profile.js'
import { plateauOf } from '../lib/progression-polish.js'
import { myGymIds } from '../lib/my-gym.js'
import { exOr } from '../lib/exercises.js'
import { todayISO } from '../lib/format.js'

const SEGMENTS = 10

export default function WeekTargets() {
  const S = useStore(s => s.S)
  const iso = todayISO()
  const rows = targetsProgress(S, iso).filter(r => r.target > 0)
  const streak = weekStreak(S, iso)
  const profile = profileOf(S)
  const done = weekWorkoutCount(S, iso)
  const plateaus = myGymIds(S).map(id => ({ id, p: plateauOf(S, id) })).filter(x => x.p)

  return <div className="card weektargets">
    <div className="row weektargets-head">
      <span className="sect-t" style={{ margin: 0 }}>{t('This week')}</span>
      <span className="weekstreak" aria-label={t('Week streak {0}', streak)}>
        <span className="weekstreak-slots" aria-hidden="true">
          {Array.from({ length: Math.min(12, Math.max(4, streak)) }, (_, i) =>
            <span key={i} className={'slot' + (i < streak ? ' punched' : '')} />)}
        </span>
        <span className="mono">{t('STREAK {0}', streak)}</span>
      </span>
    </div>
    <div className="dim small">{t('{0} of {1} days in', done, profile.daysPerWeek)}</div>
    <div className="weekrows">
      {rows.map(r => {
        const filled = Math.round(r.pct * SEGMENTS)
        return <div className="weekrow" key={r.slug}>
          <span className="weekrow-name">{MUSCLE_NAME[r.slug] || r.slug}</span>
          <span className="weekrow-bar" aria-hidden="true">
            {Array.from({ length: SEGMENTS }, (_, i) => <span key={i} className={'segcell' + (i < filled ? ' on' : '')} />)}
          </span>
          <span className="mono weekrow-nums">{r.done % 1 ? r.done.toFixed(1) : r.done}/{r.target}</span>
        </div>
      })}
    </div>
    {plateaus.map(({ id, p }) => <div className="exnote" key={id}>
      {t('Plateau — {0}: the top set has not moved in {1} sessions. Same load until it does, then the proving set decides.', exerciseNameFor(exOr(id)), p.sessions)}
    </div>)}
  </div>
}
