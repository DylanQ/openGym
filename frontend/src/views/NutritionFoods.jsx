// The saved-foods library (nutrition-spec.md §3.3): every food Dylan has verified, reported
// or imported, searchable and sortable. Tapping one starts the servings flow; the pencil
// opens the editor — correcting a food affects future logs only (entries are snapshots,
// §3.2, and the editor says so). Import (§4.2) lands everything as src 'import' for him to
// verify; export is the foods JSON (§4.1).
import { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import {
  importStarterFoodsIn, removeFoodIn, updateFoodIn,
} from '../lib/nutrition.js'
import { foodsJson } from '../lib/nutrition-export.js'
import { importFoodsIn, parseFoodsImport } from '../lib/nutrition-import.js'
import { fmtMacro } from '../lib/nutrition-math.js'
import Icon from '../components/Icon.jsx'
import { Button, SearchField } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { PerServingForm, SrcStamp, exportTextFile, readFileText } from './nutrition-ui.jsx'

export default function NutritionFoods() {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const fileRef = useRef(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('name')
  const day = loc.state?.day || todayISO()
  const foods = S.foods || []

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? foods.filter(f => (f.name + ' ' + (f.brand || '')).toLowerCase().includes(needle))
      : [...foods]
    if (sort === 'protein') list.sort((a, b) => (b.perServing.proteinG ?? -1) - (a.perServing.proteinG ?? -1) || a.name.localeCompare(b.name))
    else list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [foods, q, sort])

  const onImportFile = async ev => {
    const file = ev.target.files && ev.target.files[0]
    ev.target.value = ''
    if (!file) return
    try {
      const { foods: parsed, errors } = parseFoodsImport(await readFileText(file))
      let added = 0
      if (parsed.length) update(s => { added = importFoodsIn(s, parsed) })
      toast(added
        ? t('Imported {0} food(s) — stamped imported until you verify them.', added)
        : t('Nothing new to import'))
      if (errors.length) setTimeout(() => toast(errors[0]), 1200)
    } catch (e) { toast(t('That file could not be read')) }
  }

  const exportFoods = async () => {
    try { await exportTextFile(foodsJson(foods), 'opengym-foods.json'); toast(t('Foods exported')) }
    catch (e) { toast(t('Export failed')) }
  }

  const starter = () => {
    let added = 0
    update(s => { added = importStarterFoodsIn(s) })
    toast(added ? t('Added {0} starter foods', added) : t('Starter foods are already in your library'))
  }

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back="/nutrition" onClick={() => nav('/nutrition', { state: { day } })} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 28 }}>{t('Saved foods')}</h1>
        <div className="sub">{t('{0} foods', foods.length)}</div>
      </div>
      <button className="iconbtn" onClick={exportFoods} aria-label={t('Export foods')}><Icon name="share" /></button>
      <button className="iconbtn" onClick={() => fileRef.current?.click()} aria-label={t('Import foods')}><Icon name="download" /></button>
    </div>

    <SearchField value={q} onChange={setQ} placeholder={t('Search foods')} />
    <div className="nutri-sortrow">
      <span className="muted small">{t('Sort')}</span>
      <button className={sort === 'name' ? 'chip on' : 'chip'} onClick={() => setSort('name')}>{t('Name')}</button>
      <button className={sort === 'protein' ? 'chip on' : 'chip'} onClick={() => setSort('protein')}>{t('Protein')}</button>
    </div>

    {foods.length === 0
      ? <div className="muted" style={{ textAlign: 'center', marginTop: 26, lineHeight: 1.6 }}>
        {t('Scan your first label')}
        <div className="nutri-actions" style={{ marginTop: 14, justifyContent: 'center' }}>
          <Button variant="tinted" icon="camera" onClick={() => nav('/nutrition/scan', { state: { day } })}>{t('Scan label')}</Button>
          <Button variant="tinted" icon="plus" onClick={starter}>{t('Starter foods')}</Button>
        </div>
        <div className="muted small">{t('The starter library holds the staples already in your notes — protein powder, Carbmaster milk and the rest.')}</div>
      </div>
      : shown.length === 0
        ? <div className="muted" style={{ textAlign: 'center', marginTop: 26 }}>{t('No foods match that search')}</div>
        : <div>
          {shown.map(f => (
            <div key={f.id} className="nutri-foodrow">
              <button className="nutri-food-main" onClick={() => nav('/nutrition/servings', { state: { foodId: f.id, day } })}>
                <span className="nutri-entry-name">{f.name}</span>
                <span className="muted small">
                  {[f.brand, f.servingSizeText].filter(Boolean).join(' · ')}
                  {' · '}{fmtMacro('proteinG', f.perServing.proteinG) ?? '–'} g {t('protein')} · {fmtMacro('calories', f.perServing.calories) ?? '–'} kcal
                </span>
              </button>
              <SrcStamp src={f.src} />
              <button className="iconbtn" onClick={() => openFoodEditor(f)} aria-label={t('Edit')}><Icon name="pencil" /></button>
            </div>
          ))}
        </div>}

    <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={onImportFile} />
  </div>
}

/* ------------------------------------------------------------- food editor -- */

// Correct a saved food. Edits apply to future logs only (§3.2); an imported food that he
// edits becomes 'manual' — the one promotion in the system (§5), and the sheet says why.
export function openFoodEditor(food) {
  useUI.getState().openSheet(close => <FoodEditorSheet close={close} food={food} />)
}

function FoodEditorSheet({ close, food }) {
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const [draft, setDraft] = useState(() => ({
    name: food.name, brand: food.brand || '', servingSizeText: food.servingSizeText || '',
    servingsPerContainer: food.servingsPerContainer, perServing: { ...food.perServing },
  }))
  const save = () => {
    update(s => { updateFoodIn(s, food.id, draft) })
    toast(t('Food updated — past entries keep their original numbers'))
    close()
  }
  const remove = () => confirmSheet({
    title: t('Remove this food?'), message: t('Past log entries are not affected.'), confirmText: t('Remove'), danger: true,
    onConfirm: () => { update(s => { removeFoodIn(s, food.id) }); close() },
  })
  return <>
    <h3>{t('Edit food')}</h3>
    <div style={{ marginBottom: 12 }}><SrcStamp src={food.src} /></div>
    {food.src === 'import' && <div className="muted small" style={{ marginBottom: 12 }}>
      {t('Imported foods are unverified. Saving your edits marks this one manual — your numbers, checked by you.')}
    </div>}
    <PerServingForm value={draft} onChange={setDraft} />
    <Button variant="primary" onClick={save} style={{ marginTop: 16 }}>{t('Save')}</Button>
    <Button variant="plain" onClick={remove} style={{ color: 'var(--red)', marginTop: 8 }}>{t('Remove food')}</Button>
  </>
}
