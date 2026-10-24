// Whether the Coach is here, once that is known. Local-only (Oct 2026): there is
// no server Coach any more, so the answer is just the phone's own mode — a legacy
// stored 'server' mode is not available, and setup offers the phone's own key.
// (A cold start straight on #/coach used to wait on a boot /api/config answer;
// with no user that fetch never happens now, and `fresh` below is true at once.)
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { coachAvailable } from './coach.js'
import { DEMO } from './demo.js'
import { MOBILE } from './mobile.js'

/** `{ known, ok }`: `ok` the Coach is available; `known` the answer is final for this session. */
export function useCoachGate() {
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const coachMode = useStore(s => s.coachLocal?.mode)
  const ready = useStore(s => s.ready)
  const ok = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode })
  const fresh = !user || !!(config && 'coach' in config)
  const [asked, setAsked] = useState(false)
  useEffect(() => {
    if (!ready || ok || fresh || asked) return
    let gone = false
    Promise.resolve(useStore.getState().refreshConfig?.()).catch(() => {}).finally(() => { if (!gone) setAsked(true) })
    return () => { gone = true }
  }, [ready, ok, fresh, asked])
  return { known: ok || (ready && (fresh || asked)), ok }
}
