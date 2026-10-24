// Label scan (nutrition-spec.md §1.2, §1.4): photo → OCR → parser → the confirm screen.
// Two routes, one file: /nutrition/scan picks the photo and reads it; /nutrition/confirm
// is the mandatory stop where the parsed panel is checked against the pinned photo before
// anything can be saved — that confirmation is what promotes scan data to src: 'label'.
//
// On the web there is no OCR (the plugin is app-only), so the flow jumps straight to the
// confirm form as manual entry with the photo pinned and a note saying so. In the app, an
// OCR failure lands on the same fork: retake, or enter manually — both exits always offered.
import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { MOBILE } from '../lib/mobile.js'
import { recognizeLabelPhoto } from '../lib/label-ocr.js'
import { parseLabel } from '../lib/label-parse.js'
import { addFoodIn } from '../lib/nutrition.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { PerServingForm, blankFoodDraft, readFileDataUrl } from './nutrition-ui.jsx'

const NOTE_WORDS = {
  'calorie-cross-check': 'These numbers do not quite add up against the calories — worth a second look.',
  'sodiumMg-in-grams': 'Sodium was printed in grams and converted to milligrams.',
}

export default function NutritionScan() {
  const nav = useNavigate()
  const loc = useLocation()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [photo, setPhoto] = useState(null)
  const day = loc.state?.day || todayISO()

  const manual = parsed => nav('/nutrition/confirm', { state: { parsed, photo, day, webNote: !MOBILE }, replace: true })

  const onFile = async ev => {
    const file = ev.target.files && ev.target.files[0]
    ev.target.value = ''
    if (!file) return
    setBusy(true)
    setFailed(false)
    let dataUrl = null
    try { dataUrl = await readFileDataUrl(file) } catch (e) { /* the form works without the pin */ }
    setPhoto(dataUrl)
    if (!MOBILE) { setBusy(false); nav('/nutrition/confirm', { state: { parsed: null, photo: dataUrl, day, webNote: true }, replace: true }); return }
    try {
      const ocr = await recognizeLabelPhoto(file)
      const parsed = parseLabel(ocr || {})
      if (!parsed.perServing.calories && !parsed.perServing.proteinG) { setFailed(true); return }
      nav('/nutrition/confirm', { state: { parsed, photo: dataUrl, day }, replace: true })
    } catch (e) {
      setFailed(true)
    } finally { setBusy(false) }
  }

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back="/nutrition" onClick={() => nav('/nutrition')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 28 }}>{t('Scan a label')}</h1>
        <div className="sub">{t('Photo of the Nutrition Facts panel')}</div>
      </div>
    </div>

    {photo && <img className="nutri-photo" src={photo} alt={t('Label photo')} />}

    {busy
      ? <div className="muted" style={{ textAlign: 'center', marginTop: 30 }}>{t('Reading the label…')}</div>
      : failed
        ? <>
          <div className="card" style={{ padding: 16, marginTop: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("Couldn't read that")}</div>
            <div className="muted small" style={{ lineHeight: 1.5 }}>
              {t('A flatter label that fills the frame reads best. Or skip the photo and type the numbers — nothing is saved until you confirm them.')}
            </div>
          </div>
          <div className="nutri-actions" style={{ marginTop: 14 }}>
            <Button variant="tinted" icon="camera" onClick={() => fileRef.current?.click()}>{t('Retake photo')}</Button>
            <Button variant="tinted" icon="pencil" onClick={() => manual(null)}>{t('Enter manually')}</Button>
          </div>
        </>
        : <>
          <div className="muted" style={{ textAlign: 'center', marginTop: 22, lineHeight: 1.6 }}>
            {MOBILE
              ? t('Take a photo of the Nutrition Facts panel, or pick one you already took. The numbers are read on this phone — nothing is uploaded.')
              : t('Scanning is app-only. Pick the photo anyway: it stays pinned above the form while you type the numbers yourself.')}
          </div>
          <div className="nutri-actions" style={{ marginTop: 16 }}>
            <Button variant="primary" icon="camera" onClick={() => fileRef.current?.click()}>{t('Choose photo')}</Button>
          </div>
        </>}

    <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
  </div>
}

/* ------------------------------------------------------------- confirm -- */

// The mandatory stop (§1.4). The parsed panel as an editable mini-label, the source photo
// pinned above it, 'check' fields highlighted amber. Save stays disabled until calories
// and protein are both present. Two exits: log it (the servings flow, which also files
// the food into the library) or save to the library only.
export function NutritionScanConfirm() {
  const nav = useNavigate()
  const loc = useLocation()
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const { parsed = null, photo = null, day = todayISO(), webNote = false } = loc.state || {}
  const [draft, setDraft] = useState(() => {
    const base = blankFoodDraft('label')
    if (parsed) {
      base.servingSizeText = parsed.servingSizeText || ''
      base.servingsPerContainer = parsed.servingsPerContainer
      base.servingWeightG = parsed.servingWeightG
      base.perServing = { ...parsed.perServing }
    }
    return base
  })
  const confidence = parsed?.confidence || {}
  const notes = (parsed?.notes || []).filter(n => NOTE_WORDS[n])
  const ready = draft.name.trim() && draft.perServing.calories !== null && draft.perServing.proteinG !== null

  const saveToLibrary = () => {
    let food = null
    update(s => { food = addFoodIn(s, { ...draft }) })
    if (food) { toast(t('Saved to your library')); nav('/nutrition/foods', { replace: true }) }
  }
  const logIt = () => nav('/nutrition/servings', { state: { draft, day } })

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back="/nutrition" onClick={() => nav('/nutrition')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 28 }}>{t('Check the label')}</h1>
        <div className="sub">{t('Against the photo — nothing is saved until you confirm')}</div>
      </div>
    </div>

    {photo && <img className="nutri-photo" src={photo} alt={t('Label photo')} />}
    {webNote && <div className="muted small" style={{ margin: '8px 2px' }}>{t('Scanning is app-only, so these boxes start empty — the photo stays pinned while you type.')}</div>}
    {notes.map(n => <div key={n} className="nutri-note">{t(NOTE_WORDS[n])}</div>)}
    {Object.values(confidence).some(c => c === 'check') && !notes.length &&
      <div className="nutri-note">{t('The fields outlined in amber were hard to read — give those an extra look.')}</div>}

    <PerServingForm value={draft} onChange={setDraft} confidence={confidence} />

    <div className="nutri-actions" style={{ marginTop: 16 }}>
      <Button variant="primary" onClick={logIt} disabled={!ready}>{t('Log it')}</Button>
      <Button variant="tinted" onClick={saveToLibrary} disabled={!ready}>{t('Save to library only')}</Button>
    </div>
    {!ready && <div className="muted small" style={{ textAlign: 'center' }}>{t('Needs a name, calories and protein before it can be saved.')}</div>}
  </div>
}
