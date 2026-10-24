// The Training Profile hub (fitbod-experience.md B2/B3): the answers the wizard asked,
// kept editable, plus the two things that feed the generator directly — your gyms and
// your standing word on individual exercises. Everything here writes the same fields
// the First Entry writes; there is one profile, seen from two doors.
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Section, Row, Switch, Segmented, Button, TextField } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { useStore } from '../store/useStore.js'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { profileOf } from '../lib/profile.js'
import { GOAL_OPTIONS, EXPERIENCE_OPTIONS, SPLIT_OPTIONS, CARDIO_OPTIONS } from '../lib/profile-ui.js'
import { gymsOf, activeGym, saveGyms, switchGym, newGym, planetFitnessGym, PLANET_FITNESS_EQUIPMENT } from '../lib/gyms.js'
import { ALL_EQUIPMENT } from '../lib/equipment.js'
import { EXIDX, exOr } from '../lib/exercises.js'
import { prefOf, setPref, swapSuggestion } from '../lib/ex-pref.js'
import { myGymIds } from '../lib/my-gym.js'

const DURATIONS = [15, 30, 45, 60, 90]

function ChipRow({ options, value, onChange }) {
  return <div className="chiprow wrap">
    {options.map(o => <button key={String(o.value)} type="button"
      className={'chip' + (value === o.value ? ' on' : '')}
      aria-pressed={value === o.value}
      onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div>
}

const PREF_OPTIONS = [
  { value: 'more', label: t('More') }, { value: 'normal', label: t('Normal') },
  { value: 'less', label: t('Less') }, { value: 'never', label: t('Never') },
]

/* Standing word on exercises: everything you've already taken a position on, your gym's
   own lifts, and whatever the search finds — each with the same four-way control the
   exercise page carries. Swap suggestions sit on top: three swaps away is a pattern,
   and the suggestion is a question, never an edit made behind your back. */
function ManageExercises({ S }) {
  const update = useStore(s => s.update)
  const [q, setQ] = useState('')
  const now = Date.now()
  const suggestions = useMemo(() => Object.keys(S.swapStats || {})
    .filter(id => swapSuggestion(S, id, now)), [S]) // eslint-disable-line react-hooks/exhaustive-deps
  const listed = useMemo(() => {
    const ids = new Set([...Object.keys(S.exPref || {}), ...myGymIds(S), ...(S.favEx || [])])
    let pool = [...ids].map(id => exOr(id)).filter(Boolean)
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      pool = Object.values(EXIDX).filter(e => exerciseNameFor(e).toLowerCase().includes(needle)).slice(0, 30)
    }
    return pool.sort((a, b) => exerciseNameFor(a).localeCompare(exerciseNameFor(b)))
  }, [S, q])

  return <>
    {suggestions.length > 0 && <Section title={t('You keep swapping these out')}>
      {suggestions.map(id => <div className="lrow" key={id}>
        <span className="lrow-m"><span className="lrow-t">{exerciseNameFor(exOr(id))}</span>
          <span className="lrow-s">{t('Swapped away three times in a month. Prefer it less often?')}</span></span>
        <Button size="sm" onClick={() => update(s => setPref(s, id, 'less'))}>{t('Prefer less')}</Button>
      </div>)}
    </Section>}
    <Section title={t('Exercise preferences')}
      footer={t('More and less tilt the generator; Never keeps an exercise out of composed workouts entirely. Nothing here touches your routines.')}>
      <div style={{ padding: '10px 14px' }}>
        <TextField value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search exercises')} aria-label={t('Search exercises')} />
      </div>
      {listed.map(ex => <div className="lrow" key={ex.id}>
        <span className="lrow-m"><span className="lrow-t">{exerciseNameFor(ex)}</span></span>
        <Segmented options={PREF_OPTIONS} value={prefOf(S, ex.id)}
          onChange={v => update(s => setPref(s, ex.id, v))} />
      </div>)}
      {listed.length === 0 && <div className="lrow"><span className="lrow-m"><span className="lrow-s">{t('Nothing here yet — search an exercise to set its standing.')}</span></span></div>}
    </Section>
  </>
}

export function TrainingProfilePage() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const nav = useNavigate()
  const profile = profileOf(S)
  const set = patch => update(s => { s.profile = { ...profileOf(s), ...patch } })
  const gym = activeGym(S)

  return <div>
    <Section title={t('Goal')}>
      <div style={{ padding: '12px 14px' }}>
        <ChipRow options={GOAL_OPTIONS} value={profile.goal} onChange={v => set({ goal: v })} />
      </div>
    </Section>
    <Section title={t('Experience')}>
      <div style={{ padding: '12px 14px' }}>
        <ChipRow options={EXPERIENCE_OPTIONS} value={profile.experience} onChange={v => set({ experience: v })} />
      </div>
    </Section>
    <Section title={t('Split')}>
      <div style={{ padding: '12px 14px' }}>
        <ChipRow options={SPLIT_OPTIONS} value={profile.split} onChange={v => set({ split: v })} />
      </div>
    </Section>
    <Section title={t('Schedule')}>
      <Row title={t('Days per week')} accessory="none">
        <Segmented options={[2, 3, 4, 5, 6].map(n => ({ value: n, label: String(n) }))}
          value={profile.daysPerWeek} onChange={v => set({ daysPerWeek: v })} />
      </Row>
      <div style={{ padding: '12px 14px' }}>
        <div className="dim small" style={{ marginBottom: 8 }}>{t('Session length')}</div>
        <ChipRow options={DURATIONS.map(n => ({ value: n, label: t('{0} min', n) }))}
          value={profile.durationMin} onChange={v => set({ durationMin: v })} />
      </div>
    </Section>
    <Section title={t('Session shape')}>
      <Row title={t('Warm-up sets')} subtitle={t('Ramp rows ahead of the first work set on heavier lifts.')}
        accessory="none">
        <Switch checked={!!profile.warmupSets} onChange={v => set({ warmupSets: v })} aria-label={t('Warm-up sets')} />
      </Row>
      <Row title={t('Supersets')} subtitle={t('Pair the last two accessories back to back.')}
        accessory="none">
        <Switch checked={!!profile.supersets} onChange={v => set({ supersets: v })} aria-label={t('Supersets')} />
      </Row>
      <Row title={t('Cardio')} accessory="none">
        <Segmented options={CARDIO_OPTIONS} value={profile.cardio} onChange={v => set({ cardio: v })} />
      </Row>
    </Section>
    <Section title={t('Places')}>
      <Row icon="dumbbell" iconTint="var(--accent)" title={t('Gyms')}
        value={gym ? gym.name : t('No gym set')} accessory="chevron"
        onClick={() => nav('/settings/gyms')} />
      <Row icon="sunrise" iconTint="var(--yellow)" title={t('Redo setup')}
        subtitle={t('Walk the First Entry again. Your log is untouched.')} accessory="chevron"
        onClick={() => nav('/first-entry')} />
    </Section>
    <ManageExercises S={S} />
  </div>
}

/* ---------- Gyms ---------- */

function GymEditor({ gym, onSave, onDelete, onCancel }) {
  const [name, setName] = useState(gym.name)
  const [equipment, setEquipment] = useState(gym.equipment || [])
  const [dbText, setDbText] = useState((gym.dbWeights || []).join(', '))
  const [q, setQ] = useState('')
  const toggle = eq => setEquipment(cur => cur.includes(eq) ? cur.filter(x => x !== eq) : [...cur, eq])
  const shown = ALL_EQUIPMENT.filter(eq => !q.trim() || eq.includes(q.trim().toLowerCase()))
  const save = () => {
    const dbWeights = [...new Set(dbText.split(/[,\s]+/).map(Number).filter(n => Number.isFinite(n) && n > 0))].sort((a, b) => a - b)
    onSave({ ...gym, name: name.trim() || gym.name, equipment, dbWeights })
  }
  return <div className="card" style={{ marginTop: 12 }}>
    <TextField value={name} onChange={e => setName(e.target.value)} placeholder={t('Gym name')} aria-label={t('Gym name')} />
    <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
      <Button size="sm" icon="check" onClick={() => setEquipment([...PLANET_FITNESS_EQUIPMENT])}>{t('Planet Fitness preset')}</Button>
      <Button size="sm" onClick={() => setEquipment([])}>{t('Clear')}</Button>
    </div>
    <div style={{ marginTop: 12 }}>
      <TextField value={q} onChange={e => setQ(e.target.value)} placeholder={t('Filter equipment')} aria-label={t('Filter equipment')} />
      <div className="chiprow wrap" style={{ marginTop: 8 }}>
        {shown.map(eq => <button key={eq} type="button"
          className={'chip' + (equipment.includes(eq) ? ' on' : '')}
          aria-pressed={equipment.includes(eq)} onClick={() => toggle(eq)}>{eq}</button>)}
      </div>
    </div>
    <div style={{ marginTop: 12 }}>
      <div className="dim small" style={{ marginBottom: 6 }}>{t('Dumbbells you own here, in your unit — comma separated. Leave empty if the rack is a standard one.')}</div>
      <TextField value={dbText} onChange={e => setDbText(e.target.value)} placeholder="5, 10, 15, 20, 25" aria-label={t('Dumbbell inventory')} />
    </div>
    <div className="row" style={{ marginTop: 14, gap: 8 }}>
      <Button variant="primary" onClick={save}>{t('Save gym')}</Button>
      <Button onClick={onCancel}>{t('Cancel')}</Button>
      {onDelete && <Button className="danger" onClick={onDelete}>{t('Delete')}</Button>}
    </div>
  </div>
}

export function GymsPage() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [editing, setEditing] = useState(null)
  const gyms = gymsOf(S)
  const active = activeGym(S)
  const save = gym => update(s => {
    const list = gymsOf(s)
    const next = list.some(g => g.id === gym.id) ? list.map(g => g.id === gym.id ? gym : g) : [...list, gym]
    saveGyms(s, next)
    setEditing(null)
  })
  const remove = gym => update(s => {
    saveGyms(s, gymsOf(s).filter(g => g.id !== gym.id))
    setEditing(null)
  })

  return <div>
    <Section title={t('Your gyms')}
      footer={t('The active gym is a hard filter: composed workouts and the exercise picker only offer what that room actually has. Switching gyms shelves today’s composed entry — Undo brings it back.')}>
      {gyms.map(g => <Row key={g.id} icon="dumbbell" iconTint="var(--accent)"
        title={g.name} subtitle={t('{0} kinds of equipment', g.equipment.length)}
        value={active?.id === g.id ? t('Active') : undefined} accessory="none">
        {active?.id !== g.id && <Button size="sm" onClick={() => update(s => switchGym(s, g.id))}>{t('Set active')}</Button>}
        <Button size="sm" onClick={() => setEditing(editing === g.id ? null : g.id)}>{t('Edit')}</Button>
      </Row>)}
      {gyms.length === 0 && <div className="lrow"><span className="lrow-m"><span className="lrow-s">{t('No gyms yet. Add the room you train in and its equipment becomes the filter.')}</span></span></div>}
    </Section>
    {gyms.map(g => editing === g.id && <GymEditor key={g.id} gym={g}
      onSave={save} onDelete={gyms.length > 1 ? () => remove(g) : null} onCancel={() => setEditing(null)} />)}
    {editing === 'new'
      ? <GymEditor gym={newGym('', [])} onSave={save} onCancel={() => setEditing(null)} />
      : <Section><Row icon="plusCircle" iconTint="var(--green)" title={t('Add a gym')} accessory="chevron"
          onClick={() => setEditing('new')} /></Section>}
    <div style={{ marginTop: 16 }}>
      <Button size="sm" icon="check" onClick={() => update(s => saveGyms(s, [planetFitnessGym(), ...gymsOf(s).filter(g => g.id !== planetFitnessGym().id)]))}>
        {t('Reset Planet Fitness to the preset')}
      </Button>
      <span className="dim small" style={{ marginInlineStart: 8 }}><Icon name="info" /> {t('The preset is machines, cables, a Smith machine and dumbbells — no barbells, no racks.')}</span>
    </div>
  </div>
}
