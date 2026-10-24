// The Nutrition settings page (registered as PAGES.nutrition): targets and the section's
// data tools — starter library, and the exports that bridge back to Pip's food logs
// (nutrition-spec.md §4.1). The calorie target is nullable BY DESIGN: the user never
// settled one, so the field starts empty and empty means "not tracked", never a default.
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { importStarterFoodsIn } from '../lib/nutrition.js'
import { dailyCsv, foodLogCsv, foodsJson } from '../lib/nutrition-export.js'
import { todayISO } from '../lib/format.js'
import { NumberField, Row, Section } from '../components/ui.jsx'
import { exportTextFile } from './nutrition-ui.jsx'

export default function NutritionSettingsPage() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const targets = S.nutritionTargets || { proteinG: 180, calories: null }
  const foods = S.foods || []
  const foodLog = S.foodLog || []

  const setTargets = patch => update(s => { s.nutritionTargets = { ...(s.nutritionTargets || { proteinG: 180, calories: null }), ...patch } })

  const starter = () => {
    let added = 0
    update(s => { added = importStarterFoodsIn(s) })
    toast(added ? t('Added {0} starter foods', added) : t('Starter foods are already in your library'))
  }
  const exportAs = async (text, filename, ok) => {
    try { await exportTextFile(text, filename); toast(ok) }
    catch (e) { toast(t('Export failed')) }
  }

  return <>
    <Section title={t('Targets')} footer={t('Protein is the number the section steers by. The calorie target stays empty until you set one — no invented default.')}>
      <Row icon="target" iconTint="var(--protein)" title={t('Protein target')}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <NumberField className="input" value={targets.proteinG ?? 180} onChange={v => setTargets({ proteinG: v ?? 180 })} style={{ width: 90 }} />
          <span className="muted">{t('g / day')}</span>
        </span>
      </Row>
      <Row icon="flame" iconTint="var(--orange)" title={t('Calorie target')} subtitle={targets.calories == null ? t('Not set') : ''}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <NumberField className="input" nullable value={targets.calories ?? null} onChange={v => setTargets({ calories: v })} placeholder="–" style={{ width: 90 }} />
          <span className="muted">kcal</span>
        </span>
      </Row>
    </Section>

    <Section title={t('Library')}>
      <Row icon="clipboard" iconTint="var(--teal)" title={t('Saved foods')} value={String(foods.length)} accessory="chevron" onClick={() => nav('/nutrition/foods')} />
      <Row icon="plusCircle" iconTint="var(--green)" title={t('Starter foods')}
        subtitle={t('The staples from your notes — protein powder, Carbmaster milk and the rest.')}
        accessory="chevron" onClick={starter} />
    </Section>

    <Section title={t('Export')} footer={t('The food-log CSV is the bridge back to Pip’s food logs: one row per entry, with the source column kept. Dates are ISO; empty cells mean the label never said.')}
    >
      <Row icon="share" iconTint="var(--blue)" title={t('Food log (CSV)')} value={t('{0} entries', foodLog.length)} accessory="chevron"
        onClick={() => exportAs(foodLogCsv(foodLog), 'opengym-food-log.csv', t('Food log exported'))} />
      <Row icon="chart" iconTint="var(--blue)" title={t('Daily totals (CSV)')} accessory="chevron"
        onClick={() => exportAs(dailyCsv(foodLog, todayISO(), 30), 'opengym-nutrition-days.csv', t('Daily totals exported'))} />
      <Row icon="share" iconTint="var(--blue)" title={t('Saved foods (JSON)')} accessory="chevron"
        onClick={() => exportAs(foodsJson(foods), 'opengym-foods.json', t('Foods exported'))} />
    </Section>
  </>
}
