// Recovery as a percentage (fitbod-experience.md B4 Step 1): the lingua franca the
// generator scores with and the preview shows. lib/recovery.js speaks fatigue —
// effective hard sets, RIR-weighted, decayed over its own windows — and this adapter is
// the whole translation: recovered = 100 × (1 − fatigue), clamped. The model underneath
// stays the app's own; only the reading changes, and the reading shows its inputs on the
// Muscles view rather than hiding them (B0: auditable numbers).
//
// Manual overrides live beside it: the unlogged-hike case (a long hike is a leg session
// no log knows about). An override is a percentage and an expiry, written from the
// Muscles view; the adapter honours it until it lapses, then the model speaks again.
import { fatigueOf } from './recovery.js'
import { MUSCLES } from './muscles.js'
import { convertWeight } from './units.js'

export const OVERRIDE_TTL_MS = 72 * 60 * 60 * 1000   // three days: long enough to cover the soreness, short enough to forget itself

export const recoveredPctOf = fatigue => Math.max(0, Math.min(100, Math.round(100 * (1 - (Number(fatigue) || 0)))))

/** The last logged bodyweight in kg, for the fatigue model's bodyweight loads. */
function bodyweightKgOf(S) {
  const last = (S?.bodyweight || []).filter(b => Number(b?.w) > 0).slice(-1)[0]
  return last ? convertWeight(Number(last.w), S?.unit || 'kg', 'kg') : undefined
}

/** Raw fatigue per muscle slug (0..1), straight from the model. */
export const fatigueMapOf = (S, now = Date.now()) =>
  fatigueOf(S?.workouts || [], now, { unit: S?.unit || 'kg', bodyweightKg: bodyweightKgOf(S) })

/** The live override for one muscle, or null when there is none or it has lapsed. */
export function overrideOf(S, slug, now = Date.now()) {
  const o = S?.recoveryOverride?.[slug]
  if (!o || !(Number(o.expires) > now) || !Number.isFinite(Number(o.pct))) return null
  return Math.max(0, Math.min(100, Math.round(Number(o.pct))))
}

/**
 * Recovered % per muscle slug (0–100, every drawable muscle present), overrides applied.
 * This is the single reading the generator, the preview's recovery panel and the Muscles
 * adjusters all share, so the three can never show different numbers for the same day.
 */
export function freshnessOf(S, now = Date.now()) {
  const fat = fatigueMapOf(S, now)
  const out = {}
  for (const slug of MUSCLES) {
    const o = overrideOf(S, slug, now)
    out[slug] = o != null ? o : recoveredPctOf(fat[slug])
  }
  return out
}

/** The legend the preview and the Muscles view share: fresh / recovering / fatigued. */
export const freshnessBand = pct => (pct >= 70 ? 'fresh' : pct >= 40 ? 'recovering' : 'fatigued')

/** Write a manual override (a store mutator): this muscle reads `pct` until the TTL lapses. */
export function setRecoveryOverride(s, slug, pct, now = Date.now()) {
  s.recoveryOverride = { ...(s.recoveryOverride || {}) }
  s.recoveryOverride[slug] = { pct: Math.max(0, Math.min(100, Math.round(Number(pct) || 0))), expires: now + OVERRIDE_TTL_MS }
}

/** Clear one muscle's override (a store mutator) — the model speaks for it again. */
export function clearRecoveryOverride(s, slug) {
  if (!s.recoveryOverride) return
  const next = { ...s.recoveryOverride }
  delete next[slug]
  s.recoveryOverride = next
}
