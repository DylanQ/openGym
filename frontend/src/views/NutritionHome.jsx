// Nutrition home (nutrition-spec.md §6): one day of eating — the protein bar against the
// target, the day's totals with the verified/estimate split always visible, and the entry
// list. The + actions are Scan label · Saved food · Quick add · Estimate. An empty day
// says "Nothing logged yet" and offers the actions — it is a statement, not an accusation.
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate, isoOf, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import {
  addEntryIn, dayTotals, entriesForDay, proteinRemaining, removeEntryIn, updateEntryIn,
} from '../lib/nutrition.js'
import { fmtMacro, scalePerServing } from '../lib/nutrition-math.js'
import { MOBILE } from '../lib/mobile.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField, Section, TextField } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { PerServingForm, ServingsStepper, SrcStamp, blankFoodDraft } from './nutrition-ui.jsx'

const shiftDay = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return isoOf(x) }
const timeOf = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// The verified/estimate split (§3.4): label counts as verified, the rest names itself.
const SRC_WORD = { label: 'verified', manual: 'manual', estimate: 'est.', import: 'imported' }
const FIELD_WORD = { calories: 'calories', proteinG: 'protein', carbsG: 'carbs', fatG: 'fat', sodiumMg: 'sodium' }
function splitLine(bySrc) {
  const parts = Object.entries(bySrc || {})
    .filter(([, v]) => v.proteinG > 0)
    .map(([src, v]) => `${Math.round(v.proteinG)} ${t(SRC_WORD[src] || src)}`)
  return parts.length > 1 ? parts.join(' · ') : null
}

export default function NutritionHome() {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const [day, setDay] = useState(() => loc.state?.day || todayISO())
  const foodLog = S.foodLog || []
  const targets = S.nutritionTargets || { proteinG: 180, calories: null }
  const totals = dayTotals(foodLog, day)
  const entries = entriesForDay(foodLog, day)
  const remaining = proteinRemaining(targets, totals)
  const pct = targets.proteinG ? Math.min(100, (totals.proteinG / targets.proteinG) * 100) : 0
  const isToday = day === todayISO()
  const split = splitLine(totals.bySrc)

  return <div className="narrow">
    <div className="hdr">
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 28 }}>{t('Nutrition')}</h1>
        <div className="sub">{t('What you ate, and where the numbers came from')}</div>
      </div>
      <button className="iconbtn" onClick={() => nav('/nutrition/history')} aria-label={t('History')}><Icon name="history" /></button>
      <button className="iconbtn" onClick={() => nav('/settings/nutrition')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>

    <div className="nutri-daynav">
      <button className="iconbtn" onClick={() => setDay(d => shiftDay(d, -1))} aria-label={t('Previous day')}><Icon name="chevronLeft" /></button>
      <button className="nutri-daylabel" onClick={() => setDay(todayISO())}>{isToday ? t('Today') : fmtDate(day)}</button>
      <button className="iconbtn" onClick={() => setDay(d => shiftDay(d, 1))} aria-label={t('Next day')}><Icon name="chevronRight" /></button>
    </div>

    <div className="card nutri-protein">
      <div className="nutri-protein-nums">
        <span className="nutri-big">{fmtMacro('proteinG', totals.proteinG) ?? '0'}</span>
        <span className="muted"> / {targets.proteinG ?? '–'} g {t('protein')}</span>
        {remaining !== null && <span className="nutri-left">{remaining > 0 ? t('{0} g left', Math.round(remaining)) : t('Target hit')}</span>}
      </div>
      <div className="nutri-bar"><div style={{ width: pct + '%' }} /></div>
      {split && <div className="muted small" style={{ marginTop: 6 }}>{split}</div>}
      <div className="nutri-totals">
        <span>{fmtMacro('calories', totals.calories) ?? '0'} kcal</span>
        <span>{fmtMacro('carbsG', totals.carbsG) ?? '–'} g {t('carbs')}</span>
        <span>{fmtMacro('fatG', totals.fatG) ?? '–'} g {t('fat')}</span>
        <span>{fmtMacro('sodiumMg', totals.sodiumMg) ?? '–'} mg {t('sodium')}</span>
      </div>
      {totals.partial.length > 0 && <div className="muted small" style={{ marginTop: 6 }}>
        {t('Some entries are missing {0} — not counted in the total.', totals.partial.map(f => t(FIELD_WORD[f] || f)).join(', '))}
      </div>}
    </div>

    <div className="nutri-actions">
      <Button variant="tinted" icon="camera" onClick={() => nav('/nutrition/scan', { state: { day } })}>{t('Scan label')}</Button>
      <Button variant="tinted" icon="clipboard" onClick={() => nav('/nutrition/foods', { state: { day } })}>{t('Saved food')}</Button>
      <Button variant="tinted" icon="plus" onClick={() => openQuickAdd(day, 'manual')}>{t('Quick add')}</Button>
      <Button variant="tinted" icon="plus" onClick={() => openQuickAdd(day, 'estimate')}>{t('Estimate')}</Button>
    </div>
    {!MOBILE && <div className="muted small" style={{ margin: '0 2px 10px' }}>{t('Label scanning is app-only — on the web, a scan opens manual entry with the photo pinned.')}</div>}

    {entries.length === 0
      ? <div className="muted" style={{ textAlign: 'center', marginTop: 26, lineHeight: 1.5 }}>{t('Nothing logged yet')}</div>
      : <Section title={fmtDate(day)}>
        {entries.map(e => {
          const scaled = scalePerServing(e.perServing, e.servings)
          return (
            <button key={e.id} className="nutri-entry" onClick={() => openEditEntry(e)}>
              <span className="nutri-entry-main">
                <span className="nutri-entry-name">{e.name}</span>
                <span className="muted small">{timeOf(e.t)} · {e.servings} × · {fmtMacro('calories', scaled.calories) ?? '–'} kcal · {fmtMacro('proteinG', scaled.proteinG) ?? '–'} g {t('protein')}</span>
              </span>
              <SrcStamp src={e.src} />
            </button>
          )
        })}
      </Section>}
  </div>
}

/* ------------------------------------------------------------- quick add / estimate -- */

// Quick add (real numbers, src 'manual') and freeform estimate (src 'estimate') share one
// sheet: name + the numbers he has. Per §5 an estimate is born an estimate and keeps its
// stamp everywhere; the sheet says so out loud.
export function openQuickAdd(day, src) {
  useUI.getState().openSheet(close => <QuickAddSheet close={close} day={day} src={src} />)
}

function QuickAddSheet({ close, day, src }) {
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const [name, setName] = useState('')
  const [servings, setServings] = useState(1)
  const [nums, setNums] = useState({ calories: null, proteinG: null, carbsG: null, fatG: null })
  const estimate = src === 'estimate'
  const save = () => {
    if (!name.trim()) { toast(t('Give it a name first')); return }
    const at = day === todayISO() ? Date.now() : new Date(day + 'T12:00:00').getTime()
    update(s => { addEntryIn(s, { name, servings, perServing: nums, src, d: day, t: at }) })
    toast(estimate ? t('Estimate logged') : t('Logged'))
    close()
  }
  const numRow = (field, label) => (
    <div className="nutri-field">
      <label className="sect-t">{label}</label>
      <NumberField nullable value={nums[field]} onChange={v => setNums(n => ({ ...n, [field]: v }))} placeholder="–" />
    </div>
  )
  return <>
    <h3>{estimate ? t('Log an estimate') : t('Quick add')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>
      {estimate ? t('Best-guess numbers. It is stamped as an estimate everywhere it appears and never counts as verified.')
        : t('Numbers you already have — a menu board, a recipe, a package you trust.')}
    </div>
    <label className="sect-t">{t('Name')}</label>
    <TextField value={name} onChange={e => setName(e.target.value)} placeholder={t('e.g. Turkey sandwich')} style={{ marginBottom: 12 }} />
    <div className="nutri-grid">
      {numRow('calories', t('Calories'))}
      {numRow('proteinG', t('Protein (g)'))}
      {numRow('carbsG', t('Carbs (g)'))}
      {numRow('fatG', t('Fat (g)'))}
    </div>
    <div className="nutri-servings-row">
      <span className="sect-t" style={{ margin: 0 }}>{t('Servings')}</span>
      <ServingsStepper servings={servings} onChange={setServings} />
    </div>
    <Button variant="primary" onClick={save} disabled={!name.trim()}>{t('Log it')}</Button>
  </>
}

/* ------------------------------------------------------------- edit an entry -- */

// Editing servings / name / note / numbers — never the src (§5). The stamp in the sheet
// header says what this entry is; there is no control that changes it.
export function openEditEntry(entry) {
  useUI.getState().openSheet(close => <EditEntrySheet close={close} entry={entry} />)
}

function EditEntrySheet({ close, entry }) {
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const [draft, setDraft] = useState(() => ({
    name: entry.name, brand: '', servingSizeText: '', servingsPerContainer: null,
    servings: entry.servings, note: entry.note || '',
    perServing: { ...entry.perServing },
  }))
  const save = () => {
    update(s => { updateEntryIn(s, entry.id, { name: draft.name, servings: draft.servings, note: draft.note, perServing: draft.perServing }) })
    toast(t('Entry updated'))
    close()
  }
  const remove = () => confirmSheet({
    title: t('Remove this entry?'), message: entry.name, confirmText: t('Remove'), danger: true,
    onConfirm: () => { update(s => { removeEntryIn(s, entry.id) }); close() },
  })
  return <>
    <h3>{t('Edit entry')}</h3>
    <div style={{ marginBottom: 12 }}><SrcStamp src={entry.src} /></div>
    <PerServingForm value={draft} onChange={setDraft} />
    <div className="nutri-servings-row">
      <span className="sect-t" style={{ margin: 0 }}>{t('Servings')}</span>
      <ServingsStepper servings={draft.servings} onChange={v => setDraft(d => ({ ...d, servings: v }))} />
    </div>
    <label className="sect-t">{t('Note')}</label>
    <TextField value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} style={{ marginBottom: 16 }} />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
    <Button variant="plain" onClick={remove} style={{ color: 'var(--red)', marginTop: 8 }}>{t('Remove entry')}</Button>
  </>
}
