// Mobile build only, first launch. Local-only (Oct 2026): there is no server to
// connect to any more, so the old "keep everything here, or connect to a
// self-hosted openGym server" choice is a single statement — everything stays on
// this phone. The ConnectSheet / CfAccessSheet pairing sheets are gone with it;
// see lib/remote.js and lib/cf-access.js, kept as dead code for a follow-up
// deletion pass (they are never imported from a rendered surface any more).
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function MobileOnboarding() {
  const { chooseLocalMode } = useStore()
  const head = <>
    <div style={{ fontSize: 54, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="dumbbell" /></div>
    <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 4px' }}>openGym</h1>
  </>
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }
  return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 34 }}>{t('Your workouts live on this phone — no account, no cloud.')}</div>
      <Button variant="primary" icon="lock" onClick={() => chooseLocalMode()}>{t('Use on this device')}</Button>
      <div className="dim small" style={{ marginTop: 26, lineHeight: 1.5 }}>
        {t('Export a backup in Settings → Data & backup to move your data anywhere.')}
      </div>
    </div>
  )
}
