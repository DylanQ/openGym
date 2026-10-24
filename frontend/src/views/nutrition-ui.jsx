// Shared pieces of the Nutrition views (nutrition-spec.md §6): the provenance stamp, the
// editable mini-label form the confirm screen and the food editor share, and the servings
// stepper. Kept with the views (not components/) — like CheckIn's sheets, these belong to
// this section alone.
import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { MOBILE } from '../lib/mobile.js'
import { fmtMacro, parseServings, stepServings } from '../lib/nutrition-math.js'
import { PER_SERVING_FIELDS } from '../lib/nutrition.js'
import { Button, NumberField, TextField } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

/**
 * The provenance stamp (§5): verified label numbers and estimates are visually different
 * everywhere they appear, in every theme — the word is the message, not just the colour.
 * Manual entries carry no stamp: they are the unmarked default (Dylan's own numbers).
 */
export function SrcStamp({ src }) {
  if (src === 'label') return <span className="stamp stamp-verified">{t('Verified label')}</span>
  if (src === 'estimate') return <span className="stamp stamp-estimate">{t('Estimate')}</span>
  if (src === 'import') return <span className="stamp stamp-import">{t('Imported')}</span>
  return null
}

// The mini-label's macro rows, in label order: [field, label, unit].
export const MACRO_ROWS = [
  ['calories', 'Calories', ''],
  ['fatG', 'Total fat', 'g'],
  ['saturatedFatG', 'Saturated fat', 'g'],
  ['cholesterolMg', 'Cholesterol', 'mg'],
  ['sodiumMg', 'Sodium', 'mg'],
  ['carbsG', 'Total carbohydrate', 'g'],
  ['fiberG', 'Dietary fiber', 'g'],
  ['sugarsG', 'Total sugars', 'g'],
  ['addedSugarsG', 'Added sugars', 'g'],
  ['proteinG', 'Protein', 'g'],
]

/**
 * The editable per-serving panel (§1.4), styled as the label it mirrors. `confidence`
 * (from lib/label-parse.js) marks 'check' fields with the amber class — the only fields
 * that draw the eye — and 'missing' fields show an empty input. Every field is nullable:
 * clearing one means "the label didn't say", never zero.
 */
export function PerServingForm({ value, onChange, confidence = {} }) {
  const set = (field, v) => onChange({ ...value, perServing: { ...value.perServing, [field]: v } })
  const cls = f => 'nutri-field' + (confidence[f] === 'check' ? ' check' : '')
  return <div className="nutri-label">
    <label className="sect-t">{t('Food name')}</label>
    <TextField value={value.name || ''} onChange={e => onChange({ ...value, name: e.target.value })}
      placeholder={t('e.g. Protein powder')} style={{ marginBottom: 12 }} />
    <label className="sect-t">{t('Brand')}</label>
    <TextField value={value.brand || ''} onChange={e => onChange({ ...value, brand: e.target.value })}
      placeholder={t('Optional')} style={{ marginBottom: 12 }} />
    <div className="nutri-grid">
      <div className={cls('servingSizeText')}>
        <label className="sect-t">{t('Serving size')}</label>
        <TextField value={value.servingSizeText || ''}
          onChange={e => onChange({ ...value, servingSizeText: e.target.value })}
          placeholder={t('e.g. 1 scoop (31g)')} />
      </div>
      <div className={cls('servingsPerContainer')}>
        <label className="sect-t">{t('Servings per container')}</label>
        <NumberField nullable value={value.servingsPerContainer ?? null}
          onChange={v => onChange({ ...value, servingsPerContainer: v })} placeholder="–" />
      </div>
      {MACRO_ROWS.map(([field, label, unit]) => (
        <div key={field} className={cls(field)}>
          <label className="sect-t">{t(label)}{unit ? ` (${unit})` : ''}</label>
          <NumberField nullable value={value.perServing?.[field] ?? null}
            onChange={v => set(field, v)} placeholder="–" />
        </div>
      ))}
    </div>
  </div>
}

/** Per-serving defaults for a blank form (quick add / estimate start from a subset). */
export const blankFoodDraft = (src = 'manual') => ({
  name: '', brand: '', servingSizeText: '', servingsPerContainer: null, servingWeightG: null,
  perServing: Object.fromEntries(PER_SERVING_FIELDS.map(f => [f, null])), src,
})

/**
 * Servings stepper (§2): quarter-step buttons around a free-type field — '1.5', '0.33'
 * and '1/2' all parse (lib/nutrition-math.js); an unparseable draft is simply not
 * committed, never coerced.
 */
export function ServingsStepper({ servings, onChange }) {
  const [draft, setDraft] = useState(null)
  const commit = text => {
    setDraft(text)
    const v = parseServings(text)
    if (v !== null) onChange(v)
  }
  return <div className="nutri-stepper">
    <button className="iconbtn" aria-label={t('Fewer servings')} onClick={() => onChange(stepServings(servings, -1))}><Icon name="minus" /></button>
    <input className="num nutri-servings" inputMode="decimal" aria-label={t('Servings')}
      value={draft ?? String(servings)} onChange={e => commit(e.target.value)} onBlur={() => setDraft(null)} />
    <button className="iconbtn" aria-label={t('More servings')} onClick={() => onChange(stepServings(servings, 1))}><Icon name="plus" /></button>
  </div>
}

/** Scaled totals line for the servings screen: '390 kcal · 75 g protein · …'. */
export function ScaledSummary({ scaled }) {
  const parts = []
  const cal = fmtMacro('calories', scaled.calories)
  if (cal !== null) parts.push(`${cal} kcal`)
  const pro = fmtMacro('proteinG', scaled.proteinG)
  if (pro !== null) parts.push(`${pro} g ${t('protein')}`)
  const carbs = fmtMacro('carbsG', scaled.carbsG)
  if (carbs !== null) parts.push(`${carbs} g ${t('carbs')}`)
  const fat = fmtMacro('fatG', scaled.fatG)
  if (fat !== null) parts.push(`${fat} g ${t('fat')}`)
  return <span>{parts.join(' · ') || '–'}</span>
}

/** Hand a text export to the share sheet (app) or a browser download (web), like the
 *  other exports do (Settings → Data). A failure is the caller's toast. */
export async function exportTextFile(text, filename) {
  if (MOBILE) {
    const { shareExport } = await import('../lib/mobile.js')
    await shareExport(text, filename)
    return
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Read a picked file as text (foods import). */
export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(r.error || new Error('read failed'))
    r.onload = () => resolve(String(r.result || ''))
    r.readAsText(file)
  })
}

/** Read a picked photo as a data URL (the confirm screen pins it above the form). */
export function readFileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(r.error || new Error('read failed'))
    r.onload = () => resolve(String(r.result || ''))
    r.readAsDataURL(file)
  })
}

export { Button }
