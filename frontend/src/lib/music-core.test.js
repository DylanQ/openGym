// The MusicCore contract: what the web UI may ask the grafted BitChord engine, and how
// "no engine here" must look. The native side is a skeleton until the port lands, so
// these tests pin the bridge surface — method names, payloads, validation, and the
// typed MusicUnavailableError — against a recording fake of the Capacitor plugin,
// the same way channel.test.js pins the Channel plugin.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const TRACK = { videoId: 'dQw4w9WgXcQ', title: 'Song', artist: 'Singer', durationMs: 213000 }

const h = vi.hoisted(() => {
  vi.stubEnv('VITE_MOBILE', '1')
  return {
    platform: 'android',
    ported: true, // getEngineInfo's answer; false = skeleton native side
    missing: false, // plugin not implemented at all (APK from before the plugin)
    mobile: true, // VITE_MOBILE on/off
    calls: [], // [{ method, args }]
    listeners: {}, // eventName -> listener
  }
})

function notImplemented() {
  const e = new Error('"MusicCore" plugin is not implemented on android')
  e.code = 'UNIMPLEMENTED'
  return e
}

function notPorted() {
  const e = new Error('BitChord engine not ported yet')
  e.code = 'ENGINE_NOT_PORTED'
  return e
}

// Canned native answers, keyed by bridge method.
function answerFor(method, args) {
  switch (method) {
    case 'getEngineInfo': return { engine: 'bitchord', ported: h.ported }
    case 'search': return { results: [TRACK] }
    case 'resolveStream':
      return { videoId: args.videoId, url: 'https://stream.example/x', container: 'webm', quality: 'opus', stage: 'innertubex' }
    case 'getState':
      return {
        track: TRACK, isPlaying: true, positionMs: 5000, durationMs: 213000,
        isLoading: false, error: null, repeatMode: 'off', queue: [TRACK], queueIndex: 0,
        hasPrevious: false, hasNext: false, isQualityUpgraded: false, playlistId: null,
      }
    case 'listPlaylists': return { playlists: [{ id: 'pl1', name: 'Push Day', trackCount: 12 }] }
    case 'createPlaylist': return { playlist: { id: 'pl9', name: args.name, trackCount: 0 } }
    case 'getPlaylist': return { playlist: { id: args.playlistId, name: 'Push Day', trackCount: 1 }, tracks: [TRACK] }
    default: return {}
  }
}

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => h.platform },
  registerPlugin: () => new Proxy({}, {
    get: (_, prop) => {
      if (prop === 'then') return undefined
      if (prop === 'addListener') {
        return async (eventName, listener) => {
          if (h.missing) throw notImplemented()
          h.calls.push({ method: 'addListener', args: { eventName } })
          h.listeners[eventName] = listener
          return { remove: async () => { delete h.listeners[eventName] } }
        }
      }
      return async (args) => {
        h.calls.push({ method: prop, args })
        if (h.missing) throw notImplemented()
        if (prop !== 'getEngineInfo' && !h.ported) throw notPorted()
        return answerFor(prop, args || {})
      }
    },
  }),
}))

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_MOBILE', h.mobile ? '1' : '')
  h.platform = 'android'
  h.ported = true
  h.missing = false
  h.calls = []
  h.listeners = {}
})

const load = () => import('./music-core.js')

// Warm the module graph once: the first import pays the transform cost of
// mobile.js's dependency tree, which can exceed a single test's timeout cold.
beforeAll(async () => { await load() }, 30000)
const called = (method) => h.calls.filter(c => c.method === method)

describe('availability', () => {
  it('is available when the ported engine answers', async () => {
    const m = await load()
    expect(await m.isMusicAvailable()).toBe(true)
    expect(await m.getEngineInfo()).toEqual({ engine: 'bitchord', ported: true })
  })

  it('is unavailable while the native side is a skeleton', async () => {
    h.ported = false
    const m = await load()
    expect(await m.isMusicAvailable()).toBe(false)
    await expect(m.playTrack(TRACK)).rejects.toBeInstanceOf(m.MusicUnavailableError)
  })

  it('is unavailable in an APK from before the plugin existed', async () => {
    h.missing = true
    const m = await load()
    expect(await m.isMusicAvailable()).toBe(false)
    await expect(m.searchMusic('x')).rejects.toMatchObject({ code: 'UNAVAILABLE' })
  })

  it('is unavailable off Android', async () => {
    h.platform = 'ios'
    const m = await load()
    expect(await m.isMusicAvailable()).toBe(false)
    expect(called('getEngineInfo')).toHaveLength(0)
  })

  it('is unavailable in the web build', async () => {
    h.mobile = false
    vi.stubEnv('VITE_MOBILE', '')
    const m = await load()
    expect(await m.isMusicAvailable()).toBe(false)
    h.mobile = true
  })
})

describe('search and resolve', () => {
  it('search passes the query and limit through and returns the rows', async () => {
    const m = await load()
    expect(await m.searchMusic('heavy metal', 10)).toEqual([TRACK])
    expect(called('search')[0].args).toEqual({ query: 'heavy metal', limit: 10 })
  })

  it('search refuses an empty query before touching the bridge', async () => {
    const m = await load()
    await expect(m.searchMusic('  ')).rejects.toBeInstanceOf(TypeError)
    expect(called('search')).toHaveLength(0)
  })

  it('resolveStream reports the resolver stage that produced the URL', async () => {
    const m = await load()
    const stream = await m.resolveStream(TRACK.videoId)
    expect(stream.stage).toBe('innertubex')
    expect(called('resolveStream')[0].args).toEqual({ videoId: TRACK.videoId })
  })
})

describe('transport and queue', () => {
  it('play sends the track verbatim', async () => {
    const m = await load()
    await m.playTrack(TRACK)
    expect(called('play')[0].args).toEqual({ track: TRACK })
  })

  it('play refuses a track without a videoId', async () => {
    const m = await load()
    await expect(m.playTrack({ title: 'No id' })).rejects.toBeInstanceOf(TypeError)
    expect(called('play')).toHaveLength(0)
  })

  it('enqueue carries the play-next flag', async () => {
    const m = await load()
    await m.enqueueTrack(TRACK, { next: true })
    expect(called('enqueue')[0].args).toEqual({ track: TRACK, next: true })
  })

  it('setQueue sends the tracks and the start index, and refuses an empty queue', async () => {
    const m = await load()
    await m.setQueue([TRACK, TRACK], 1)
    expect(called('setQueue')[0].args).toEqual({ tracks: [TRACK, TRACK], startIndex: 1 })
    await expect(m.setQueue([])).rejects.toBeInstanceOf(TypeError)
  })

  it('transport methods map to their bridge names', async () => {
    const m = await load()
    await m.pauseMusic(); await m.resumeMusic(); await m.togglePlay()
    await m.nextTrack(); await m.previousTrack()
    expect(h.calls.map(c => c.method)).toEqual(['pause', 'resume', 'togglePlay', 'next', 'previous'])
  })

  it('seek clamps to a non-negative whole millisecond', async () => {
    const m = await load()
    await m.seekTo(-50)
    await m.seekTo(1234.9)
    expect(called('seek').map(c => c.args)).toEqual([{ positionMs: 0 }, { positionMs: 1234 }])
  })

  it('repeat mode is one of off/all/one', async () => {
    const m = await load()
    await m.setRepeatMode('all')
    expect(called('setRepeatMode')[0].args).toEqual({ mode: 'all' })
    await expect(m.setRepeatMode('sometimes')).rejects.toBeInstanceOf(TypeError)
  })

  it('getState returns the native state untouched', async () => {
    const m = await load()
    const state = await m.getMusicState()
    expect(state.track).toEqual(TRACK)
    expect(state.isPlaying).toBe(true)
  })
})

describe('playlists', () => {
  it('CRUD maps to the bridge with ids and payloads intact', async () => {
    const m = await load()
    expect(await m.listPlaylists()).toEqual([{ id: 'pl1', name: 'Push Day', trackCount: 12 }])
    expect(await m.createPlaylist('Leg Day')).toEqual({ id: 'pl9', name: 'Leg Day', trackCount: 0 })
    await m.addToPlaylist('pl1', TRACK)
    await m.removeFromPlaylist('pl1', TRACK.videoId)
    await m.renamePlaylist('pl1', 'Push Day II')
    await m.deletePlaylist('pl1')
    await m.playPlaylist('pl1', 3)
    expect(called('addToPlaylist')[0].args).toEqual({ playlistId: 'pl1', track: TRACK })
    expect(called('removeFromPlaylist')[0].args).toEqual({ playlistId: 'pl1', videoId: TRACK.videoId })
    expect(called('renamePlaylist')[0].args).toEqual({ playlistId: 'pl1', name: 'Push Day II' })
    expect(called('deletePlaylist')[0].args).toEqual({ playlistId: 'pl1' })
    expect(called('playPlaylist')[0].args).toEqual({ playlistId: 'pl1', startIndex: 3 })
  })

  it('a playlist needs a name', async () => {
    const m = await load()
    await expect(m.createPlaylist(' ')).rejects.toBeInstanceOf(TypeError)
    expect(called('createPlaylist')).toHaveLength(0)
  })
})

describe('events', () => {
  it('subscribes by name and the handle removes the listener', async () => {
    const m = await load()
    const cb = vi.fn()
    const handle = await m.addMusicListener('trackChange', cb)
    expect(h.listeners.trackChange).toBe(cb)
    await handle.remove()
    expect(h.listeners.trackChange).toBeUndefined()
  })

  it('refuses an unknown event name', async () => {
    const m = await load()
    await expect(m.addMusicListener('explosion', () => {})).rejects.toBeInstanceOf(TypeError)
  })
})

describe('activity → playlist bindings', () => {
  const bindings = {
    push: { playlistId: 'pl-push', autoPlay: true },
    'push@pf-henderson': { playlistId: 'pl-push-gym', autoPlay: true },
    legs: { playlistId: 'pl-legs', askFirst: true },
  }

  it('an unbound activity resolves to nothing', async () => {
    const m = await load()
    expect(m.resolveMusicBinding(bindings, { dayKey: 'pull' })).toBeNull()
    expect(m.resolveMusicBinding(bindings, {})).toBeNull()
    expect(m.resolveMusicBinding(null, { dayKey: 'push' })).toBeNull()
  })

  it('the gym-specific binding beats the plain day binding', async () => {
    const m = await load()
    const hit = m.resolveMusicBinding(bindings, { dayKey: 'push', gymId: 'pf-henderson' })
    expect(hit.playlistId).toBe('pl-push-gym')
    expect(m.resolveMusicBinding(bindings, { dayKey: 'push', gymId: 'home' }).playlistId).toBe('pl-push')
  })

  it('firing an auto-play binding plays its playlist', async () => {
    const m = await load()
    const core = { playPlaylist: vi.fn(async () => {}), getMusicState: vi.fn(), resumeMusic: vi.fn() }
    const report = await m.fireMusicBinding(bindings, { dayKey: 'push' }, core)
    expect(report).toEqual({ fired: true, playlistId: 'pl-push' })
    expect(core.playPlaylist).toHaveBeenCalledWith('pl-push', 0)
  })

  it('an ask-first binding never plays uninvited', async () => {
    const m = await load()
    const core = { playPlaylist: vi.fn(async () => {}), getMusicState: vi.fn(), resumeMusic: vi.fn() }
    const report = await m.fireMusicBinding(bindings, { dayKey: 'legs' }, core)
    expect(report).toEqual({ fired: false, reason: 'ask-first', playlistId: 'pl-legs' })
    expect(core.playPlaylist).not.toHaveBeenCalled()
  })

  it('a resume binding resumes a matching queue instead of restarting it', async () => {
    const m = await load()
    const core = {
      playPlaylist: vi.fn(async () => {}),
      getMusicState: vi.fn(async () => ({ playlistId: 'pl-run', track: TRACK })),
      resumeMusic: vi.fn(async () => {}),
    }
    const report = await m.fireMusicBinding(
      { run: { playlistId: 'pl-run', autoPlay: true, resume: true } },
      { dayKey: 'run' }, core,
    )
    expect(report).toEqual({ fired: true, playlistId: 'pl-run', resumed: true })
    expect(core.playPlaylist).not.toHaveBeenCalled()
  })

  it('firing never throws, even when the engine is gone', async () => {
    const m = await load()
    const core = {
      playPlaylist: vi.fn(async () => { throw new m.MusicUnavailableError() }),
      getMusicState: vi.fn(), resumeMusic: vi.fn(),
    }
    const report = await m.fireMusicBinding(bindings, { dayKey: 'push' }, core)
    expect(report).toEqual({ fired: false, reason: 'unavailable', playlistId: 'pl-push' })
  })
})
