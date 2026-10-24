// @vitest-environment happy-dom

/* Local-only boot (Oct 2026) on a phone that used to be paired: the old version of
   this file covered the paired-server boot (a token refused, a stash on disconnect,
   a mirror merged with the server copy). All of that is gone with the server — the
   pairing file is ignored, the account is dropped, the device boots from its own
   mirror, and no request ever leaves the phone. The fake server at BASE stays in
   the harness only to prove it is never called.

   Real modules: store/useStore.js, lib/api.js, lib/remote.js, lib/mobile.js. Mocked: the
   Capacitor plugins (an in-memory Directory.Data), and fetch, which plays the self-hosted server
   at BASE and Capacitor's local server for any other URL. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { syncFingerprint } from '../lib/sync-changes.js'

const h = vi.hoisted(() => {
  vi.stubEnv('VITE_MOBILE', '1')   // lib/mobile.js: MOBILE = import.meta.env.VITE_MOBILE === '1'
  // `refuse`: file names whose writes fail, like a full disk.
  return { files: new Map(), server: null, calls: [], refuse: new Set() }
})

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA', Documents: 'DOCUMENTS', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    readFile: async ({ path, directory }) => {
      const k = directory + '/' + path
      if (!h.files.has(k)) throw new Error('File does not exist')
      return { data: h.files.get(k) }
    },
    writeFile: async ({ path, directory, data }) => {
      if (h.refuse.has(path)) throw new Error('No space left on device')
      h.files.set(directory + '/' + path, data)
      return { uri: 'file://' + path }
    },
  },
}))
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: { cancel: async () => {}, checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }), schedule: async () => {} },
}))
vi.mock('@capacitor/app', () => ({ App: { addListener: () => ({ remove() {} }) } }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true }, registerPlugin: () => ({}) }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast: () => {} }) } }))

const BASE = 'https://gym.example.com'
const USER = { id: 'u1', name: 'andi', admin: true }
const clone = v => JSON.parse(JSON.stringify(v))
const workout = (id, d) => ({ id, d, start: 1, entries: [] })
const routine = (id, reps) => ({ id, name: id, ex: [{ id: 'bench', sets: 2, reps }] })
const INDEX_HTML = '<!doctype html><html><head><title>openGym</title></head><body><div id="root"></div></body></html>'
const res = (status, body, type = 'application/json') => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: k => (k.toLowerCase() === 'content-type' ? type : null) },
  json: async () => JSON.parse(body),
  text: async () => body,
})
const json = (status, body) => res(status, JSON.stringify(body))

function installFetch() {
  h.calls = []
  globalThis.fetch = window.fetch = vi.fn(async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase()
    h.calls.push({ url: String(url), method, auth: init.headers?.Authorization || null, body: init.body ? JSON.parse(init.body) : null })
    if (String(url).startsWith(BASE)) return h.server(String(url).slice(BASE.length), method, init)
    // Capacitor's WebViewLocalServer: index.html and 200 for every extension-less path, any method.
    const last = String(url).split('?')[0].split('/').pop()
    return last.includes('.') ? res(404, '') : res(200, INDEX_HTML, 'text/html')
  })
}
const refusing = () => json(401, { error: 'not signed in' })
// The paired server, as api/server.js answers: a revision per document, 409 on a stale baseRev.
function serverWith(doc) {
  const srv = { doc: clone(doc), puts: [] }
  srv.handle = (path, method, init) => {
    if (path === '/api/me') return json(200, { user: USER })
    if (path === '/api/config') return json(200, { invite_only: false, allow_guest: true })
    if (path === '/api/pair/redeem') return json(200, { token: 'TOKEN-NEW', user: USER })
    if (path === '/api/data/rev') return json(200, { rev: srv.doc._rev })
    if (path === '/api/data' && method === 'GET') return json(200, { state: clone(srv.doc), rev: srv.doc._rev })
    if (path === '/api/data' && method === 'PUT') {
      const body = JSON.parse(init.body)
      srv.puts.push(body)
      if (body.baseRev != null && body.baseRev !== srv.doc._rev) return json(409, { error: 'conflict', rev: srv.doc._rev, state: clone(srv.doc) })
      srv.doc = { ...body.state, _rev: srv.doc._rev + 1 }
      delete srv.doc.active
      return json(200, { ok: true, rev: srv.doc._rev })
    }
    if (path === '/api/logout') return json(200, { ok: true })
    return json(404, { error: 'not found' })
  }
  h.server = srv.handle
  return srv
}

const readFile = name => { const v = h.files.get('DATA/' + name); return v == null ? null : JSON.parse(v) }
const serverCalls = () => h.calls.filter(c => c.url.startsWith(BASE))
const localCalls = () => h.calls.filter(c => !c.url.startsWith(BASE))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ids = xs => (xs || []).map(x => x.id)

// Server rev 5 holds w1 and the push-day routine at 10 reps; the phone is paired and in step.
const SERVER_STATE = { _ts: 1000, _rev: 5, unit: 'kg', restSec: 90, workouts: [workout('w1', '2026-09-10')], routines: [routine('push', 10)], bodyweight: [] }
let DEF
beforeAll(async () => { DEF = (await import('./useStore.js')).DEF })
// `synced`: it last agreed with the server under this version, so it knows what that copy was.
function pairedPhone({ localStorage: withLocal = true, mirror, synced = true } = {}) {
  h.files.clear()
  localStorage.clear()
  const S = { ...clone(DEF), ...clone(SERVER_STATE) }
  delete S._rev
  h.files.set('DATA/opengym-remote.json', JSON.stringify({ mode: 'remote', base: BASE, token: 'TOKEN-OLD', user: USER }))
  h.files.set('DATA/opengym-state.json', JSON.stringify(mirror || S))
  h.files.set('DATA/opengym-state-owner.json', JSON.stringify({ owner: USER.id, ts: (mirror || S)._ts }))
  if (withLocal) {
    localStorage.setItem('gym_state_v1', JSON.stringify(S))
    localStorage.setItem('gym_user', JSON.stringify(USER))
    localStorage.setItem('gym_owner', USER.id)
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 5, ts: 1000 }))
    if (synced) localStorage.setItem('gym_synced_fp', JSON.stringify(syncFingerprint(S)))
  }
}
// What an earlier version left on a phone after the boot 401: the account, but a pairing file
// that says local, and no marker or dirty flag (the fake pushes into index.html cleared them).
function zombiePhone(local) {
  h.files.clear()
  localStorage.clear()
  localStorage.setItem('gym_user', JSON.stringify(USER))
  localStorage.setItem('gym_owner', USER.id)
  localStorage.setItem('gym_guest', '1')
  localStorage.setItem('gym_state_v1', JSON.stringify(local))
  h.files.set('DATA/opengym-remote.json', JSON.stringify({ mode: 'local' }))
  h.files.set('DATA/opengym-state.json', JSON.stringify(local))
}

// Every test boots its own store; the ones before it must not write into its files. Their
// debounced mirror write and push are flushed the way a page being hidden flushes them, then
// they are signed out so no poll of theirs runs later.
let stores = []
async function freshStore() {
  vi.resetModules()
  const { useStore } = await import('./useStore.js')
  stores.push(useStore)
  return useStore
}

beforeEach(() => { installFetch(); h.refuse.clear() })
afterEach(async () => {
  window.dispatchEvent(new Event('pagehide'))
  await sleep(20)
  for (const s of stores) s.setState({ user: null, ready: false })
  stores = []
  localStorage.clear()
})

// Local-only boot (Oct 2026): the pairing file, the token, the server's copy and
// the stash-on-disconnect machinery are all gone. What boot must still do is
// boot from the device's own mirror, drop a stale account from an earlier
// version, and never call the server — whatever a leftover pairing file says.
describe('local-only boot: a stale pairing file is ignored', () => {
  it('a paired phone boots from its own copy, drops the account, and never calls the server', async () => {
    pairedPhone()
    h.server = refusing
    const useStore = await freshStore()
    await useStore.getState().boot()
    const st = useStore.getState()

    expect(serverCalls()).toHaveLength(0)
    expect(st.user).toBeNull()
    expect(st.isGuest()).toBe(true)
    expect(st.ready).toBe(true)
    expect(ids(st.S.workouts)).toEqual(['w1'])
    expect(st.needsMobileOnboarding).toBe(false)
  })

  it('a phone an earlier version already unpaired keeps its data and stays local', async () => {
    const local = { ...clone(DEF), _ts: 900, unit: 'kg', workouts: [workout('w9', '2026-09-11')], routines: [], bodyweight: [] }
    zombiePhone(local)
    h.server = refusing
    const useStore = await freshStore()
    await useStore.getState().boot()
    const st = useStore.getState()

    expect(serverCalls()).toHaveLength(0)
    expect(st.user).toBeNull()
    expect(ids(st.S.workouts)).toEqual(['w9'])
  })

  it('with localStorage gone, the mirror is the copy', async () => {
    pairedPhone({ localStorage: false })
    h.server = refusing
    const useStore = await freshStore()
    await useStore.getState().boot()
    const st = useStore.getState()

    expect(serverCalls()).toHaveLength(0)
    expect(ids(st.S.workouts)).toEqual(['w1'])
    expect(st.S.routines).toHaveLength(1)
  })

  it('pull, push and config refresh make no request without a user', async () => {
    h.files.clear(); localStorage.clear()
    const useStore = await freshStore()
    h.calls = []
    await useStore.getState().pullState()
    await useStore.getState().pushState()
    expect(await useStore.getState().refreshConfig()).toBeNull()
    expect(h.calls).toHaveLength(0)
  })
})


describe('the first-start permission steps (views/PermissionSteps.jsx)', () => {
  const firstLaunch = async () => {
    h.files.clear(); localStorage.clear()
    const useStore = await freshStore()
    await useStore.getState().boot()
    expect(useStore.getState().needsMobileOnboarding).toBe(true)
    expect(useStore.getState().permSteps).toBe(false)
    return useStore
  }

  it('are due once "Use on this device" is picked', async () => {
    const useStore = await firstLaunch()
    await useStore.getState().chooseLocalMode()
    expect(useStore.getState().needsMobileOnboarding).toBe(false)
    expect(useStore.getState().permSteps).toBe(true)
    useStore.getState().finishPermSteps()
    expect(useStore.getState().permSteps).toBe(false)
  })

  it('are due once pairing from the first-launch screen has finished', async () => {
    const useStore = await firstLaunch()
    serverWith(SERVER_STATE)
    await useStore.getState().connectToServer('gym.example.com', 'ABCD2345', vi.fn(async () => false))
    expect(useStore.getState().needsMobileOnboarding).toBe(false)
    expect(useStore.getState().permSteps).toBe(true)
  })
})
