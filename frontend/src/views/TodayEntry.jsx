// Today's Entry (fitbod-experience.md B4/B6): the composed workout, shown before it
// starts — the day's muscles with their share, every exercise's sets × reps × weight
// with the reason it was prescribed, and the recovery it is built on. Everything on
// the card is editable; regenerating shelves the old composition behind Undo (this
// fork's divergence from Fitbod's wipe). Start locks the workout — and Start is where
// the activity → playlist binding will fire when the music pillar lands (the hook is
// marked in sheets.jsx startTodayPlan).
import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Stepper } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import BodyMap from '../components/BodyMap.jsx'
import { Thumb } from '../components/Media.jsx'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { composeSession, planStale, planTotals, swapPlanEntry, adjustPlanEntry, entryForExercise } from '../lib/generate.js'
import { freshnessOf, fatigueMapOf, freshnessBand } from '../lib/freshness.js'
import { gymsOf, activeGym, switchGym } from '../lib/gyms.js'
import { recordSwap } from '../lib/ex-pref.js'
import { exOr } from '../lib/exercises.js'
import { MUSCLE_NAME } from '../lib/muscles.js'
import { SPLITS } from '../lib/profile.js'
import { isWarmupRow } from '../lib/workout-model.js'
import { menuSheet, exercisePicker, startTodayPlan } from '../sheets.jsx'

const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function EntryCard({ S, entry, index }) {
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const ex = exOr(entry.id)
  if (!ex) return null
  const unit = S.unit || 'lb'
  const work = (entry.sets || []).filter(s => !isWarmupRow(s))
  const warm = (entry.sets || []).length - work.length
  const top = work[0] || {}
  const patch = delta => update(s => { if (s.todayPlan) s.todayPlan = adjustPlanEntry(s.todayPlan, index, unit, delta) })
  const swap = () => update(s => {
    if (!s.todayPlan) return
    const next = swapPlanEntry(s, s.todayPlan, index, { now: Date.now() })
    if (!next) { toast(t('No other exercise for this muscle in this gym')); return }
    recordSwap(s, entry.id, next.entries[index].id, Date.now())
    s.todayPlan = next
  })
  const remove = () => update(s => {
    if (!s.todayPlan) return
    s.todayPlan = { ...s.todayPlan, entries: s.todayPlan.entries.filter((_, i) => i !== index) }
  })
  const f = entry.flags || {}
  return <div className="card today-card">
    <div className="today-card-head">
      <Thumb ex={ex} />
      <div className="today-card-names">
        <div className={'exname ' + exerciseNameClass(ex)}>{exerciseNameFor(ex)}</div>
        <div className="dim small">{MUSCLE_NAME[entry.muscle] || entry.muscle} · {cap(ex.eq || '')}</div>
      </div>
      <button type="button" className="iconbtn" aria-label={t('Swap exercise')} onClick={swap}><Icon name="swap" /></button>
      <button type="button" className="iconbtn" aria-label={t('Remove')} onClick={remove}><Icon name="xmark" /></button>
    </div>
    <div className="mono today-rx">
      {t('{0} sets · {1} reps · {2} {3}', work.length, top.r ?? entry.target?.reps ?? 0, fmtNum(top.w ?? entry.target?.weight ?? 0), unit)}
      {warm > 0 && t(' · +{0} warm-up', warm)}
      {entry.target?.restSec > 0 && t(' · {0}s rest', entry.target.restSec)}
    </div>
    {entry.why && <div className="today-why">{t(...entry.why)}</div>}
    <div className="today-stamps">
      {f.knee === 'caution' && <span className="stamp stamp-caution">{t('Knee caution')}</span>}
      {f.knee === 'safe' && <span className="stamp stamp-safe">{t('Knee-safe')}</span>}
      {f.seeded && <span className="tag seed">{t('FROM YOUR LOG')}</span>}
      {f.calibration && <span className="stamp">{t('CALIBRATION')}</span>}
      {f.reentry != null && <span className="stamp">{t('RE-ENTRY · 90%')}</span>}
      {f.proving && <span className="stamp">{t('PROVING SET')}</span>}
      {f.plateau && <span className="stamp">{t('PLATEAU')}</span>}
    </div>
    <div className="today-steppers">
      <Stepper label={t('Sets')} ariaLabel={t('Sets')} value={work.length} step={1} min={1} max={10} decimal={false}
        onChange={v => patch({ setsDelta: v - work.length })} />
      <Stepper label={t('Reps')} ariaLabel={t('Reps')} value={top.r ?? 0} step={1} min={1} max={50} decimal={false}
        onChange={v => patch({ repsDelta: v - (top.r ?? 0) })} />
      <Stepper label={t('Weight')} ariaLabel={t('Weight')} value={top.w ?? 0} step={1} min={0}
        onChange={v => patch({ weightDelta: Math.sign(v - (top.w ?? 0)) })} />
    </div>
  </div>
}

export default function TodayEntry() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const nav = useNavigate()
  const date = todayISO()
  const plan = S.todayPlan

  // Compose on arrival and whenever the day, the gym, the profile or the log moves on.
  useEffect(() => {
    if (!planStale(S, S.todayPlan, date)) return
    update(s => {
      if (!planStale(s, s.todayPlan, date)) return
      if (s.todayPlan) s.todayPlanPrev = s.todayPlan
      s.todayPlan = composeSession(s, { date, now: Date.now() })
    })
  }, [S, date, update])

  if (!plan) return <div className="card"><span className="dim">{t('Composing today’s entry…')}</span></div>

  const totals = planTotals(plan)
  const fresh = freshnessOf(S, Date.now())
  const fatigue = fatigueMapOf(S, Date.now())
  const gym = activeGym(S)
  const recompose = mods => update(s => {
    if (s.todayPlan) s.todayPlanPrev = s.todayPlan
    s.todayPlan = composeSession(s, { date, now: Date.now(), mods })
  })
  const undo = () => update(s => { if (s.todayPlanPrev) { s.todayPlan = s.todayPlanPrev; s.todayPlanPrev = null } })

  const gymMenu = () => menuSheet({
    title: t('Train at'),
    items: gymsOf(S).map(g => ({
      icon: 'dumbbell', label: g.name, on: gym?.id === g.id,
      sub: gym?.id === g.id ? undefined : t('Switching shelves today’s entry — Undo brings it back'),
      onClick: () => update(s => switchGym(s, g.id)),
    })),
  })
  const shapeMenu = () => menuSheet({
    title: t('Today only'),
    items: [
      ...[30, 45, 60, 90].map(n => ({
        icon: 'timer', label: t('{0} minutes', n),
        onClick: () => recompose({ ...(plan.mods || {}), durationMin: n }),
      })),
      ...Object.values(SPLITS).flatMap(sp => (sp.days || []).map(d => ({
        icon: 'calendar', label: t('Compose {0}', d.name),
        onClick: () => recompose({ ...(plan.mods || {}), focus: d.key }),
      }))),
      { icon: 'sunrise', label: t('Freshest muscles'), onClick: () => recompose({ ...(plan.mods || {}), focus: 'fresh' }) },
    ],
  })
  const addExercise = () => exercisePicker(pick => update(s => {
    if (!s.todayPlan) return
    const built = entryForExercise(s, s.todayPlan, pick.id, { now: Date.now() })
    if (built) s.todayPlan = { ...s.todayPlan, entries: [...s.todayPlan.entries, built] }
  }), { title: t('Add to today’s entry') })

  return <section className="todayentry" aria-label={t('Today’s Entry')}>
    <div className="today-head">
      <div>
        <div className="eyebrow">{t('TODAY’S ENTRY')}</div>
        <h2 className="today-title">{plan.dayName}</h2>
      </div>
      <Button size="sm" icon="slider" onClick={() => nav('/settings/profile')}>{t('Setup')}</Button>
    </div>
    <div className="chiprow today-chips">
      <button type="button" className="chip" onClick={gymMenu}>{gym ? gym.name : t('No gym')} ▾</button>
      <button type="button" className="chip" onClick={shapeMenu}>{t('Today only')} ▾</button>
      {plan.mods?.durationMin && <span className="chip on">{t('{0} min today', plan.mods.durationMin)}</span>}
    </div>
    <div className="mono today-meta">
      {t('~{0} min · {1} exercises · {2} sets', totals.estMin, plan.entries.length, totals.workSets)}
      {gym && t(' · {0}', gym.name)}
    </div>
    <div className="chiprow wrap today-muscles">
      {totals.shares.map(sh => <span className="chip" key={sh.slug}>
        {MUSCLE_NAME[sh.slug] || sh.slug} {sh.pct}%
      </span>)}
    </div>

    {plan.lowRecovery && <div className="card today-note">
      <span>{t('This day’s muscles are still recovering.')}</span>
      {plan.suggestedDayKey && <Button size="sm" onClick={() => recompose({ ...(plan.mods || {}), focus: plan.suggestedDayKey })}>
        {t('Compose the fresher day instead')}</Button>}
    </div>}

    {plan.entries.map((entry, i) => <EntryCard key={entry.id + '-' + i} S={S} entry={entry} index={i} />)}

    {plan.entries.length === 0 && <div className="card">
      <p>{t('Nothing could be composed for this gym and day — the room’s equipment has no lift for the muscles on deck. Widen the gym’s equipment, or compose a bodyweight day.')}</p>
      <div className="row" style={{ gap: 8 }}>
        <Button onClick={() => nav('/settings/gyms')}>{t('Edit gym')}</Button>
        <Button onClick={() => recompose({ ...(plan.mods || {}), focus: 'fresh' })}>{t('Compose freshest muscles')}</Button>
      </div>
    </div>}

    <button type="button" className="today-add" onClick={addExercise}>+ {t('Add exercise')}</button>

    <div className="card today-recovery">
      <div className="sect-t">{t('Recovery')}</div>
      <BodyMap load={fatigue} />
      <div className="today-bars">
        {plan.entries.map(e => e.muscle).filter((v, i, a) => a.indexOf(v) === i).map(slug => {
          const pct = fresh[slug] ?? 100
          const band = freshnessBand(pct)
          return <div className="today-bar" key={slug}>
            <span className="today-bar-name">{MUSCLE_NAME[slug] || slug}</span>
            <span className="today-bar-track"><span className={'today-bar-fill ' + band} style={{ width: pct + '%' }} /></span>
            <span className="mono">{pct}%</span>
          </div>
        })}
      </div>
      <div className="dim small today-legend">
        <span><i className="dot fresh" />{t('Fresh ≥ 70%')}</span>
        <span><i className="dot recovering" />{t('Recovering 40–69%')}</span>
        <span><i className="dot fatigued" />{t('Fatigued < 40%')}</span>
      </div>
    </div>

    <div className="row today-actions">
      <Button icon="repeat" onClick={() => recompose(plan.mods)}>{t('Regenerate')}</Button>
      {S.todayPlanPrev && <Button icon="undo" onClick={undo}>{t('Undo')}</Button>}
      <Button variant="primary" icon="play" disabled={plan.entries.length === 0}
        onClick={() => startTodayPlan()}>{t('Start workout')}</Button>
    </div>
  </section>
}
