// Nutrition history (nutrition-spec.md §6): the week rollup — protein average and
// target-hit days, as facts, never a streak that punishes a missed day — and the recent
// days list. Tapping a day opens it on the Nutrition home.
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { daySummaries, weekRollup } from '../lib/nutrition.js'
import { fmtMacro } from '../lib/nutrition-math.js'
import Icon from '../components/Icon.jsx'
import { Section } from '../components/ui.jsx'
import { SrcStamp } from './nutrition-ui.jsx'

export default function NutritionHistory() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const foodLog = S.foodLog || []
  const targets = S.nutritionTargets || { proteinG: 180, calories: null }
  const roll = weekRollup(foodLog, targets.proteinG, todayISO(), 7)
  const days = daySummaries(foodLog, todayISO(), 14)

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back="/nutrition" onClick={() => nav('/nutrition')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 28 }}>{t('History')}</h1>
        <div className="sub">{t('The last two weeks of eating')}</div>
      </div>
    </div>

    <div className="card nutri-week">
      <div className="nutri-week-col">
        <span className="nutri-big">{roll.avgProtein !== null ? fmtMacro('proteinG', roll.avgProtein) : '–'}</span>
        <span className="muted small">{t('avg protein / day (g)')}</span>
      </div>
      <div className="nutri-week-col">
        <span className="nutri-big">{roll.hitDays}<span className="muted"> / {roll.loggedDays || 7}</span></span>
        <span className="muted small">{t('days at {0} g+', targets.proteinG ?? 180)}</span>
      </div>
      <div className="nutri-week-col">
        <span className="nutri-big">{roll.loggedDays}</span>
        <span className="muted small">{t('days logged this week')}</span>
      </div>
    </div>

    {days.length === 0
      ? <div className="muted" style={{ textAlign: 'center', marginTop: 26 }}>{t('Nothing logged yet')}</div>
      : <Section title={t('Recent days')}>
        {days.map(d => (
          <button key={d.d} className="nutri-entry" onClick={() => nav('/nutrition', { state: { day: d.d } })}>
            <span className="nutri-entry-main">
              <span className="nutri-entry-name">{d.d === todayISO() ? t('Today') : fmtDate(d.d)}</span>
              <span className="muted small">
                {t('{0} entries', d.entries)} · {fmtMacro('calories', d.totals.calories) ?? '–'} kcal
                {d.bySrc.estimate ? ' · ' + t('{0} g of the protein was estimated', Math.round(d.bySrc.estimate.proteinG)) : ''}
              </span>
            </span>
            <span className="nutri-day-protein">
              {fmtMacro('proteinG', d.totals.proteinG) ?? '–'} g
              {targets.proteinG && d.totals.proteinG >= targets.proteinG && <Icon name="check" />}
            </span>
          </button>
        ))}
      </Section>}

    <div className="muted small" style={{ marginTop: 14, lineHeight: 1.5 }}>
      {t('Days with estimated numbers keep their stamp:')}
      {' '}<SrcStamp src="estimate" />
    </div>
  </div>
}
