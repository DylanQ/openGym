// @vitest-environment happy-dom

/* Local-only (Oct 2026): device-link is gone with the server, so boot no longer
   strips ?link= off the address or holds it for a redeem sheet. A bookmarked
   link carrying one is left exactly as it is — the code is dead text now. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn() }) } }))

import { api } from '../lib/api.js'
import { useStore } from './useStore.js'

const bootLocal = async () => {
  api.mockImplementation(async () => { throw new Error('unexpected call') })
  await useStore.getState().boot()
}

beforeEach(() => { localStorage.clear(); api.mockReset(); useStore.setState({ user: null, ready: false, config: null, linkCode: null }) })
afterEach(() => { history.replaceState({}, '', '/'); useStore.setState({ user: null, ready: false, config: null, linkCode: null }) })

describe('boot with a device-link code, local-only', () => {
  it('leaves ?link= on the address, holds nothing, and makes no request', async () => {
    history.replaceState({}, '', '/gym/?link=K7WQ-2MZP-4HXA&utm=x#/home')
    await bootLocal()
    expect(useStore.getState().linkCode).toBeNull()
    expect(window.location.search).toBe('?link=K7WQ-2MZP-4HXA&utm=x')
    expect(window.location.pathname).toBe('/gym/')
    expect(window.location.hash).toBe('#/home')
    expect(useStore.getState().ready).toBe(true)
    expect(api).not.toHaveBeenCalled()
  })

  it('leaves the address and the store alone without one', async () => {
    history.replaceState({}, '', '/?utm=x')
    await bootLocal()
    expect(useStore.getState().linkCode).toBeNull()
    expect(window.location.search).toBe('?utm=x')
  })
})
