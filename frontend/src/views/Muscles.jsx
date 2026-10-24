import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { MUSCLES, MUSCLE_NAME } from '../lib/muscles.js'
import { t } from '../lib/i18n.js'
import MuscleExplorer from '../components/MuscleExplorer.jsx'
import { exerciseDetailSheet, addToRoutineSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { useStore } from '../store/useStore.js'
import { freshnessOf, overrideOf, setRecoveryOverride, clearRecoveryOverride } from '../lib/freshness.js'

/* The manual recovery override (fitbod-experience.md B4 Step 1): life happens off the
   log — yard work, a pick-up game, a terrible night — so the number the generator
   reads can be corrected by hand. An override lives three days, then the model
   speaks again. */
function RecoveryAdjuster({ slug }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const now = Date.now()
  const pct = freshnessOf(S, now)[slug] ?? 100
  const overridden = overrideOf(S, slug, now) != null
  const stepBy = delta => update(s => setRecoveryOverride(s, slug, pct + delta, now))
  return <div className="card recovery-adj">
    <div className="row between">
      <span>{t('{0} recovered', t(MUSCLE_NAME[slug]))}</span>
      <span className="mono">{pct}%</span>
    </div>
    <div className="dim small" style={{ margin: '6px 0 10px' }}>
      {overridden
        ? t('Marked by hand — the estimate takes over again in three days, or clear it now.')
        : t('From your log. Trained it off the books — or wrecked it some other way? Mark it by hand.')}
    </div>
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <Button size="sm" onClick={() => stepBy(25)}>{t('Mark fresher')}</Button>
      <Button size="sm" onClick={() => stepBy(-25)}>{t('More fatigued')}</Button>
      {overridden && <Button size="sm" variant="ghost" onClick={() => update(s => clearRecoveryOverride(s, slug))}>{t('Clear mark')}</Button>}
    </div>
  </div>
}

// `?m=<muscle>` opens on that muscle (Stats' untrained muscles, #553), and back goes where it came from.
export default function Muscles() {
  const nav = useNavigate()
  const loc = useLocation()
  const [params] = useSearchParams()
  const m = params.get('m')
  const initial = m && MUSCLES.includes(m) ? m : null
  const back = loc.state?.from === '/stats' ? '/stats' : '/library'
  return <>
    <div className="hdr"><button className="iconbtn" data-back={back} onClick={() => nav(back)} aria-label={back === '/stats' ? t('Stats') : t('Exercises')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('Explore muscles')}</h1><div className="sub">{t('Choose a muscle to see exercises that train it.')}</div></div></div>

    <MuscleExplorer key={initial || ''} initial={initial} onDetail={exerciseDetailSheet} onPlan={addToRoutineSheet}
      renderExtra={slug => <RecoveryAdjuster slug={slug} />} />
  </>
}
