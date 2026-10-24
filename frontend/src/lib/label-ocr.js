// Reading a Nutrition Facts photo (nutrition-spec.md §1.1–§1.2). This module is the ONLY
// place that knows about the OCR plugin: it takes a picked photo and returns
// { text, blocks } — the shape lib/label-parse.js consumes — so the OCR engine can be
// swapped (another vendor, a thin in-repo ML Kit wrapper) without touching the parser.
//
// Plugin: @capacitor-mlkit/text-recognition (Capawesome family — the same family and major
// line as the shipped @capacitor-mlkit/barcode-scanning). It wraps Google ML Kit Text
// Recognition v2 with the bundled Latin model: fully on-device, offline, no account, no
// upload. Dynamic-imported exactly like lib/scan.js, so it never lands in the web bundle;
// the whole flow is MOBILE-gated and the web build goes straight to manual entry.
//
// Capture mirrors scan.js#importCodeFromImage: a File from
// <input type="file" accept="image/*" capture="environment"> is bounced through the
// @capacitor/filesystem cache dir to get the real file:// path processImage wants, then
// the temp file is deleted in a finally.
//
// NATIVE STATUS: the plugin is a package.json dependency, but this VM builds the APK
// through an offline Maven pipeline, so the plugin's Android library may not be in the
// sideload build yet. recognizeLabelPhoto throws 'unavailable' when the plugin cannot be
// loaded or used, and the scan view turns that into "enter it manually" — the manual
// path is complete without OCR, by design (§5).

import { MOBILE } from './mobile.js'

/**
 * OCR one label photo → { text, blocks } in ML Kit's shape (blocks → lines → elements,
 * each element { text, boundingBox }). Throws Error('app-only') off mobile,
 * Error('unavailable') when the plugin/native side cannot run, Error('permission-denied')
 * if the photo could not be written/read.
 */
export async function recognizeLabelPhoto(file) {
  if (!file) return null
  if (!MOBILE) throw new Error('app-only')
  let plugin
  try {
    plugin = await import('@capacitor-mlkit/text-recognition')
  } catch (e) {
    throw new Error('unavailable')
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem')

  const base64 = await fileToBase64(file)
  const name = `label-ocr-${Date.now()}.${extOf(file.name)}`
  let uri = null
  try {
    const w = await Filesystem.writeFile({ path: name, directory: Directory.Cache, data: base64 })
    uri = w.uri
    const result = await plugin.TextRecognition.processImage({
      path: uri,
      script: plugin.Script?.Latin,
    })
    return { text: result?.text || '', blocks: result?.blocks || [] }
  } catch (e) {
    if (e instanceof Error && e.message === 'unavailable') throw e
    throw new Error('unavailable')
  } finally {
    // Best effort — a leftover temp photo in the cache dir is harmless, but tidy up anyway.
    try { await Filesystem.deleteFile({ path: name, directory: Directory.Cache }) } catch (e) { /* */ }
  }
}

// A File/Blob → bare base64 (no data: prefix), which Filesystem.writeFile expects.
// (Same helper as lib/scan.js — kept local rather than exported from there.)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(r.error || new Error('read failed'))
    r.onload = () => {
      const s = String(r.result || '')
      const comma = s.indexOf(',')
      resolve(comma === -1 ? s : s.slice(comma + 1))
    }
    r.readAsDataURL(file)
  })
}

function extOf(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '')
  return m ? m[1].toLowerCase() : 'jpg'
}
