// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import MobileOnboarding from './MobileOnboarding.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Local-only (Oct 2026): the account page is one statement — no sign-in, no sync,
// no server rows — and first launch is one button. A stale account in the store
// changes nothing on either surface.
const mocks = vi.hoisted(() => {
  const state = { S: null, user: null, coachLocal: null, chooseLocalMode: vi.fn() }
  state.snapshot = () => ({
    S: state.S,
    user: state.user,
    sync: null,
    coachLocal: state.coachLocal,
    config: null,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
    resetDemo: vi.fn(), resetEverything: vi.fn(), setUser: vi.fn(), pullState: vi.fn(), pushState: vi.fn(),
    chooseLocalMode: (...a) => state.chooseLocalMode(...a),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' }, workouts: [] }, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(() => Promise.resolve({ ok: true })), webauthnOK: () => true, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
}))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn() }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('../lib/coach-api.js', () => ({ forgetCoach: vi.fn(() => Promise.resolve({ ok: true })) }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(), menuSheet: vi.fn(),
}))

globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'none',
    gifSize: 'full', workouts: [], routines: [], exWeights: {},
  }
  mocks.user = null
  mocks.coachLocal = null
  mocks.chooseLocalMode.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('Settings — Account, local-only', () => {
  it('is one local-only statement, with no sign-in, sync or server row', () => {
    act(() => root.render(<Settings page="account" />))
    const text = host.textContent
    expect(text).toContain('Your data lives on this device')
    for (const gone of ['Sign in', 'Sign out', 'Connect to my server', 'Sync now', 'Passkey', 'Pair the mobile app', 'Delete my account', 'Guest mode']) {
      expect(text, `must not show ${gone}`).not.toContain(gone)
    }
  })

  it('a stale account in the store changes nothing on the page', () => {
    mocks.user = { id: 'u1', name: 'Ana' }
    act(() => root.render(<Settings page="account" />))
    const text = host.textContent
    expect(text).toContain('Your data lives on this device')
    expect(text).not.toContain('Ana')
    expect(text).not.toContain('Sign out')
  })
})

describe('MobileOnboarding, local-only', () => {
  it('offers only "Use on this device", and it calls chooseLocalMode', () => {
    act(() => root.render(<MobileOnboarding />))
    const text = host.textContent
    expect(text).toContain('Use on this device')
    expect(text).not.toContain('Connect to my server')
    expect(text).not.toContain('Connection settings')
    const btn = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Use on this device'))
    act(() => { btn.click() })
    expect(mocks.chooseLocalMode).toHaveBeenCalledTimes(1)
  })
})
