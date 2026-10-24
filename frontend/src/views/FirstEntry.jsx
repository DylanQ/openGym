// The First Entry (fitbod-experience.md B2): setup as a short walk — goal, experience,
// gym, split, schedule, shape, body, calibration — ending with the first composed
// workout, not a settings page. Nothing is written until the walk is done, so backing
// out costs nothing; anyone can redo it from the Training Profile without touching a
// single logged set.
//
// UX overhaul (Oct 2026): the walk is for EVERYONE, once (profile.js needsIntro).
// Every step pre-fills from what the app already knows — the derived profile, the
// active gym, the last weigh-in, the logged working weights — so for a seeded install
// the walk is confirm-or-fix, and it ends in the generated-workout reveal. Skipping
// retires it exactly like finishing; nothing re-derives it away.
//
// The calibration step is this fork's deliberate divergence from Fitbod: nobody's
// first prescribed weight should be a formula's guess when they already know their
// lifts — so the walk asks, prefilled with whatever the log already carries.
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, NumberField } from '../components/ui.jsx'
import { useStore } from '../store/useStore.js'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { DEFAULT_PROFILE, profileOf } from '../lib/profile.js'
import { GOAL_OPTIONS, EXPERIENCE_OPTIONS, SPLIT_OPTIONS, CARDIO_OPTIONS } from '../lib/profile-ui.js'
import { planetFitnessGym, newGym, saveGyms, switchGym, activeGym, PLANET_FITNESS_EQUIPMENT, BODYWEIGHT_EQUIPMENT, HOME_GYM_ID } from '../lib/gyms.js'
import { ALL_EQUIPMENT } from '../lib/equipment.js'
import { MY_GYM_SEED } from '../lib/my-gym.js'
import { exOr } from '../lib/exercises.js'
import { todayISO } from '../lib/format.js'

const STEPS = ['goal', 'experience', 'gym', 'split', 'schedule', 'shape', 'body', 'calibration']
const DURATIONS = [15, 30, 45, 60, 90]

function Chips({ options, value, onChange }) {
  return <div className="chiprow wrap">
    {options.map(o => <button key={String(o.value)} type="button"
      className={'chip' + (value === o.value ? ' on' : '')}
      aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div>
}

export default function FirstEntry() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  // Prefill everything from what the app already knows (the derived profile, the
  // active gym, the last weigh-in): the walk confirms, it never interrogates cold.
  const known = profileOf(S)
  const knownGym = activeGym(S)
  const lastW = Array.isArray(S.bodyweight) && S.bodyweight.length ? S.bodyweight[S.bodyweight.length - 1]?.w ?? null : null
  // The wizard's standing fresh default is recomp (the fork's house goal); a saved
  // profile always wins. Seeded states derive recomp anyway, so this matches
  // profileOf everywhere except a fresh install, where the old default is kept.
  const [goal, setGoal] = useState(S?.profile?.goal || 'recomp')
  const [experience, setExperience] = useState(known.experience)
  const [gymName, setGymName] = useState(knownGym ? knownGym.name : 'Planet Fitness')
  const [equipment, setEquipment] = useState(knownGym ? [...(knownGym.equipment || [])] : [...PLANET_FITNESS_EQUIPMENT])
  const [bodyweightOnly, setBodyweightOnly] = useState(knownGym?.id === HOME_GYM_ID)
  const [split, setSplit] = useState(known.split)
  const [days, setDays] = useState(known.daysPerWeek)
  const [durationMin, setDurationMin] = useState(known.durationMin)
  const [warmupSets, setWarmupSets] = useState(known.warmupSets)
  const [supersets, setSupersets] = useState(known.supersets)
  const [cardio, setCardio] = useState(known.cardio)
  const [bodyW, setBodyW] = useState(lastW)
  const [cal, setCal] = useState(() => Object.fromEntries(
    MY_GYM_SEED.map(seed => [seed.id, S.exWeights?.[seed.id]?.w ?? null])))

  const key = STEPS[step]
  const last = step === STEPS.length - 1

  const skip = () => {
    update(s => { s.introSeen = true; s.onboarded = true })
    nav('/workout', { replace: true })
  }

  const finish = () => {
    update(s => {
      s.profile = { goal, experience, split, daysPerWeek: days, durationMin, warmupSets, supersets, cardio }
      s.onboarded = true
      s.introSeen = true
      const gym = bodyweightOnly
        ? { ...newGym(gymName.trim() || 'Home', [...BODYWEIGHT_EQUIPMENT]) }
        : (gymName.trim() === 'Planet Fitness' && equipment.join() === PLANET_FITNESS_EQUIPMENT.join()
          ? planetFitnessGym()
          : newGym(gymName.trim() || 'My gym', equipment))
      saveGyms(s, [gym])
      switchGym(s, gym.id)
      // The body step's field is labelled in the state's unit (S.unit), and the
      // weigh-in sheet stores the typed number as-is — so the wizard does the same.
      // (An earlier version converted to kg here, writing a number the rest of the
      // app then read as lb/kg and mis-trended.)
      if (bodyW != null && bodyW > 0) {
        const d = todayISO()
        s.bodyweight = [...(s.bodyweight || []).filter(b => b.d !== d), { d, w: bodyW }]
      }
      for (const [id, w] of Object.entries(cal)) {
        if (w != null && w > 0) s.exWeights = { ...(s.exWeights || {}), [id]: { w, d: todayISO() } }
      }
    })
    nav('/workout', { replace: true })
  }

  return <div className="view wizard">
    <div className="wizard-progress" aria-hidden="true">
      {STEPS.map((s, i) => <span key={s} className={'slot' + (i < step ? ' punched' : i === step ? ' now' : '')} />)}
    </div>

    {key === 'goal' && <section>
      <h1 className="wizard-t">{t('What are we training for?')}</h1>
      <p className="dim">{t('The goal sets the rep ranges, the rest and the weekly set targets. You can change it any time — the log keeps its own counsel.')}</p>
      <Chips options={GOAL_OPTIONS} value={goal} onChange={setGoal} />
    </section>}

    {key === 'experience' && <section>
      <h1 className="wizard-t">{t('How long have you been at this?')}</h1>
      <p className="dim">{t('Honest answers only — this weights exercise selection, not your worth. Rebuilding after time away counts as intermediate: the strength comes back faster than it was built.')}</p>
      <Chips options={EXPERIENCE_OPTIONS} value={experience} onChange={setExperience} />
    </section>}

    {key === 'gym' && <section>
      <h1 className="wizard-t">{t('Where do you train?')}</h1>
      <p className="dim">{t('The gym is a hard filter — composed workouts only offer what the room actually has.')}</p>
      <input className="input" value={gymName} onChange={e => setGymName(e.target.value)} aria-label={t('Gym name')} />
      <div className="chiprow wrap" style={{ marginTop: 10 }}>
        <button type="button" className={'chip' + (!bodyweightOnly && equipment.join() === PLANET_FITNESS_EQUIPMENT.join() ? ' on' : '')}
          onClick={() => { setBodyweightOnly(false); setEquipment([...PLANET_FITNESS_EQUIPMENT]); setGymName('Planet Fitness') }}>{t('Planet Fitness preset')}</button>
        <button type="button" className={'chip' + (bodyweightOnly ? ' on' : '')}
          aria-pressed={bodyweightOnly}
          onClick={() => setBodyweightOnly(b => !b)}>{t('Bodyweight only')}</button>
      </div>
      {!bodyweightOnly && <div className="chiprow wrap" style={{ marginTop: 10 }}>
        {ALL_EQUIPMENT.map(eq => <button key={eq} type="button"
          className={'chip' + (equipment.includes(eq) ? ' on' : '')}
          aria-pressed={equipment.includes(eq)}
          onClick={() => setEquipment(cur => cur.includes(eq) ? cur.filter(x => x !== eq) : [...cur, eq])}>{eq}</button>)}
      </div>}
    </section>}

    {key === 'split' && <section>
      <h1 className="wizard-t">{t('How do the days divide?')}</h1>
      <p className="dim">{t('The split is the rotation the generator walks. Fresh means no fixed days — it composes from whatever has recovered.')}</p>
      <Chips options={SPLIT_OPTIONS} value={split} onChange={setSplit} />
    </section>}

    {key === 'schedule' && <section>
      <h1 className="wizard-t">{t('How many days a week?')}</h1>
      <p className="dim">{t('Every other day is three to four — the streak counts a week as kept at this number.')}</p>
      <Chips options={[2, 3, 4, 5, 6].map(n => ({ value: n, label: String(n) }))} value={days} onChange={setDays} />
    </section>}

    {key === 'shape' && <section>
      <h1 className="wizard-t">{t('What does a session look like?')}</h1>
      <div className="dim" style={{ marginBottom: 6 }}>{t('Session length')}</div>
      <Chips options={DURATIONS.map(n => ({ value: n, label: t('{0} min', n) }))} value={durationMin} onChange={setDurationMin} />
      <div className="dim" style={{ margin: '14px 0 6px' }}>{t('Warm-up sets')}</div>
      <Chips options={[{ value: true, label: t('On') }, { value: false, label: t('Off') }]} value={warmupSets} onChange={setWarmupSets} />
      <div className="dim" style={{ margin: '14px 0 6px' }}>{t('Supersets')}</div>
      <Chips options={[{ value: true, label: t('On') }, { value: false, label: t('Off') }]} value={supersets} onChange={setSupersets} />
      <div className="dim" style={{ margin: '14px 0 6px' }}>{t('Cardio')}</div>
      <Chips options={CARDIO_OPTIONS} value={cardio} onChange={setCardio} />
    </section>}

    {key === 'body' && <section>
      <h1 className="wizard-t">{t('The body, briefly')}</h1>
      <p className="dim">{t('Optional, and only used for load math and the bodyweight trend. Skip it and nothing breaks.')}</p>
      <label className="wizard-field">{t('Body weight ({0})', S.unit || 'lb')}
        <NumberField value={bodyW} nullable onChange={setBodyW} aria-label={t('Body weight')} />
      </label>
    </section>}

    {key === 'calibration' && <section>
      <h1 className="wizard-t">{t('Calibrate the machine')}</h1>
      <p className="dim">{t('Optional — and the step most apps skip. Tell it what you already lift and the first composed workout starts from your numbers, not a formula. Anything you leave blank starts as an estimate and calibrates from your first logged sets.')}</p>
      {MY_GYM_SEED.map(seed => <label className="wizard-field" key={seed.id}>
        {exerciseNameFor(exOr(seed.id))}
        <NumberField value={cal[seed.id]} nullable
          onChange={v => setCal(c => ({ ...c, [seed.id]: v }))}
          aria-label={exerciseNameFor(exOr(seed.id))} />
        <span className="dim small">{S.unit || 'lb'}</span>
      </label>)}
    </section>}

    <div className="row wizard-nav">
      {step > 0 && <Button onClick={() => setStep(step - 1)}>{t('Back')}</Button>}
      {!last && <Button variant="primary" onClick={() => setStep(step + 1)}>{t('Continue')}</Button>}
      {last && <Button variant="primary" onClick={finish}>{t('Compose my first workout')}</Button>}
      <Button onClick={skip}>{t('Skip setup')}</Button>
    </div>
  </div>
}
