// The servings flow (nutrition-spec.md §2): how much of a food was eaten, with the totals
// scaling live as the stepper moves. Reached with either a saved food (state.foodId —
// logging it snapshots it, §3.2) or an unsaved draft from the scan-confirm screen
// (state.draft — logging files the food into the library and the entry in one update).
// Servings are exact: fractions in 0.25 steps or any typed decimal, totals rounded only
// where shown.
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { addEntryFromFoodIn, addFoodIn } from '../lib/nutrition.js'
import { scalePerServing } from '../lib/nutrition-math.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { ScaledSummary, ServingsStepper, SrcStamp } from './nutrition-ui.jsx'

export default function NutritionServings() {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const { foodId = null, draft = null, day = todayISO() } = loc.state || {}
  const food = foodId ? (S.foods || []).find(f => f.id === foodId) : null
  const shown = food || draft
  const [servings, setServings] = useState(1)
  const [time, setTime] = useState(() => {
    const d = new Date()
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  })
  const scaled = useMemo(() => scalePerServing(shown?.perServing, servings), [shown, servings])

  if (!shown) return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back="/nutrition" onClick={() => nav('/nutrition')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1 }}><h1 style={{ fontSize: 28 }}>{t('Log food')}</h1></div>
    </div>
    <div className="muted" style={{ textAlign: 'center', marginTop: 26 }}>{t('That food is no longer in your library.')}</div>
  </div>

  const at = (() => {
    const [h, m] = time.split(':').map(Number)
    const d = new Date(day + 'T12:00:00')
    d.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 0, 0, 0)
    return d.getTime()
  })()

  const log = () => {
    let entry = null
    update(s => {
      let id = foodId
      if (!id && draft) {
        const made = addFoodIn(s, { ...draft })
        id = made?.id || null
      }
      if (id) entry = addEntryFromFoodIn(s, id, servings, { d: day, t: at })
    })
    if (entry) toast(t('Logged'))
    nav('/nutrition', { state: { day }, replace: true })
  }

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back={foodId ? '/nutrition/foods' : '/nutrition/confirm'} onClick={() => nav(-1)} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 28 }}>{t('How much?')}</h1>
        <div className="sub">{day === todayISO() ? t('Today') : day}</div>
      </div>
    </div>

    <div className="card" style={{ padding: 16 }}>
      <div className="nutri-food-head">
        <span className="nutri-food-name">{shown.name}</span>
        <SrcStamp src={shown.src} />
      </div>
      <div className="muted small">
        {[shown.brand, shown.servingSizeText].filter(Boolean).join(' · ') || t('Per serving')}
      </div>
      <div className="nutri-servings-row">
        <span className="sect-t" style={{ margin: 0 }}>{t('Servings')}</span>
        <ServingsStepper servings={servings} onChange={setServings} />
      </div>
      {shown.servingsPerContainer > 0 && (
        <Button variant="plain" onClick={() => setServings(shown.servingsPerContainer)}>
          {t('Whole container')} ({shown.servingsPerContainer})
        </Button>
      )}
      <div className="nutri-scaled"><ScaledSummary scaled={scaled} /></div>
      <div className="nutri-servings-row">
        <span className="sect-t" style={{ margin: 0 }}>{t('Ate it at')}</span>
        <input className="field nutri-time" type="time" value={time} onChange={e => setTime(e.target.value)} />
      </div>
    </div>

    <div className="nutri-actions" style={{ marginTop: 16 }}>
      <Button variant="primary" onClick={log}>{t('Log it')}</Button>
    </div>
  </div>
}
