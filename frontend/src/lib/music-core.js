// MusicCore — the JS side of the BitChord music graft.
//
// BitChord's playback engine is being ported into this app natively (GPLv3 engine in an
// AGPLv3 fork; the combination is the one GPLv3 §13 exists for). It lives behind a custom
// Capacitor plugin named "MusicCore" (android/music-core), which sits exactly where
// BitChord's own PlayerConnection sits: the plugin owns the MediaController/session
// client, the web UI owns nothing but this contract.
//
// Until the engine port lands, the native side answers getEngineInfo with
// { engine: 'bitchord', ported: false } and rejects everything else with
// ENGINE_NOT_PORTED; on the web, on iOS and in APKs from before the plugin existed the
// plugin is simply absent. All three cases are the same thing to callers here:
// MusicUnavailableError (code 'UNAVAILABLE'). The UI feature-detects with
// isMusicAvailable() and hides itself — it never shows a dead music button.
//
// Track objects cross the bridge in the minimal shape BitChord's own party protocol
// uses: { videoId, title, artist, durationMs, artworkUrl }. Nothing richer (queue
// tiers, source keys, download paths) ever leaves the native side.

import { MOBILE } from './mobile.js'

/**
 * A track as it crosses the bridge.
 * @typedef {object} MusicTrack
 * @property {string} videoId        YouTube video id (or a source track key)
 * @property {string} title
 * @property {string} artist
 * @property {number} [durationMs]   0/omitted when the row that produced it didn't say
 * @property {string} [artworkUrl]
 * @property {string} [albumName]
 */

/**
 * A playlist in the music library.
 * @typedef {object} MusicPlaylist
 * @property {string} id
 * @property {string} name
 * @property {number} trackCount
 */

/**
 * Playback state, mirroring BitChord's PlayerState (PlayerConnection.kt) field for
 * field, minus the Compose-only position object: position arrives as positionMs here
 * and as throttled 'position' events while playing.
 * @typedef {object} MusicState
 * @property {MusicTrack|null} track
 * @property {boolean} isPlaying
 * @property {number} positionMs
 * @property {number} durationMs
 * @property {boolean} isLoading     Buffering, including stream-URL resolution
 * @property {string|null} error
 * @property {'off'|'all'|'one'} repeatMode
 * @property {MusicTrack[]} queue
 * @property {number} queueIndex
 * @property {boolean} hasPrevious
 * @property {boolean} hasNext
 * @property {boolean} isQualityUpgraded
 * @property {string|null} playlistId  Playlist the current queue came from, if any
 */

/**
 * A resolved stream, as resolveStream reports it. Playback normally resolves
 * internally (the item's URI is a bitchord:// placeholder the service resolves at
 * play time); this exists for diagnostics and for the source-error surface.
 * @typedef {object} ResolvedStream
 * @property {string} videoId
 * @property {string} url
 * @property {string|null} container   e.g. 'webm', 'm4a', 'hls'
 * @property {string|null} quality     e.g. '251kbps opus', when the resolver states it
 * @property {'innertubex'|'newpipe'|'probe'} stage  Resolver stage that produced it
 */

/** Every event the plugin emits. State events carry a full MusicState. */
export const MUSIC_EVENTS = [
  'trackChange', // MusicState — the current track changed
  'playbackState', // MusicState — play/pause/loading/error flipped
  'queueChange', // MusicState — queue contents or index changed
  'position', // { positionMs, durationMs } — throttled to ~1/s while playing
  'sourceError', // { videoId, stage, message } — extraction failed at a resolver stage
  'qualityChange', // MusicState — a quality upgrade/revert landed on the current track
]

export const EMPTY_MUSIC_STATE = Object.freeze({
  track: null, isPlaying: false, positionMs: 0, durationMs: 0, isLoading: false,
  error: null, repeatMode: 'off', queue: [], queueIndex: 0,
  hasPrevious: false, hasNext: false, isQualityUpgraded: false, playlistId: null,
})

/** Music can't be used here: wrong platform, plugin absent, or engine not ported yet. */
export class MusicUnavailableError extends Error {
  constructor(message = 'Music is not available in this build.') {
    super(message)
    this.name = 'MusicUnavailableError'
    this.code = 'UNAVAILABLE'
  }
}

let pluginP = null
function musicPlugin() {
  return pluginP || (pluginP = (async () => {
    if (!MOBILE) return null
    const { Capacitor, registerPlugin } = await import('@capacitor/core')
    if (Capacitor.getPlatform() !== 'android') return null
    return registerPlugin('MusicCore')
  })().catch(() => null))
}

export function resetMusicCore() { pluginP = null }

async function pluginOrThrow() {
  const plugin = await musicPlugin()
  if (!plugin) throw new MusicUnavailableError('Music lives in the Android app.')
  return plugin
}

function isUnported(e) {
  return e?.code === 'ENGINE_NOT_PORTED' || /not implemented/i.test(e?.message || '')
}

// One funnel for every engine call, so "not ported / not implemented" always surfaces
// as the same typed error whatever the native side's exact wording.
async function callEngine(method, args) {
  const plugin = await pluginOrThrow()
  try {
    return await plugin[method](args)
  } catch (e) {
    if (isUnported(e)) {
      throw new MusicUnavailableError('The music engine is not built into this APK yet.')
    }
    throw e
  }
}

function assertTrack(track) {
  if (!track || typeof track.videoId !== 'string' || !track.videoId) {
    throw new TypeError('A track needs a videoId.')
  }
  return track
}

function assertName(name, what) {
  if (typeof name !== 'string' || !name.trim()) throw new TypeError(`${what} needs a name.`)
  return name
}

/** True only in an Android build whose native engine has actually been ported in. */
export async function isMusicAvailable() {
  try {
    const info = await getEngineInfo()
    return info?.ported === true
  } catch {
    return false
  }
}

/** Diagnostics: which engine the native side carries, and whether the port landed. */
export async function getEngineInfo() {
  const plugin = await pluginOrThrow()
  try {
    return await plugin.getEngineInfo()
  } catch (e) {
    if (isUnported(e)) throw new MusicUnavailableError('The music engine is not built into this APK yet.')
    throw e
  }
}

/** Search YouTube Music via the engine's repository. Returns MusicTrack rows. */
export async function searchMusic(query, limit = 25) {
  if (typeof query !== 'string' || !query.trim()) throw new TypeError('A search needs a query.')
  const { results } = await callEngine('search', { query, limit })
  return Array.isArray(results) ? results : []
}

/** Resolve one video id to a playable stream (diagnostics; playback resolves itself). */
export async function resolveStream(videoId) {
  if (typeof videoId !== 'string' || !videoId) throw new TypeError('resolveStream needs a videoId.')
  return callEngine('resolveStream', { videoId })
}

/** Replace the queue with this one track and play it. */
export async function playTrack(track) {
  return callEngine('play', { track: assertTrack(track) })
}

/** The assistant-style entry: search and play the top hit (MEDIA_PLAY_FROM_SEARCH's twin). */
export async function playFromSearch(query) {
  if (typeof query !== 'string' || !query.trim()) throw new TypeError('playFromSearch needs a query.')
  return callEngine('playFromSearch', { query })
}

/** Add a track to the queue — at the end, or next when { next: true }. */
export async function enqueueTrack(track, { next = false } = {}) {
  return callEngine('enqueue', { track: assertTrack(track), next: !!next })
}

/** Replace the queue with these tracks and start at startIndex. */
export async function setQueue(tracks, startIndex = 0) {
  if (!Array.isArray(tracks) || !tracks.length) throw new TypeError('setQueue needs at least one track.')
  tracks.forEach(assertTrack)
  return callEngine('setQueue', { tracks, startIndex })
}

export async function pauseMusic() { return callEngine('pause') }
export async function resumeMusic() { return callEngine('resume') }
export async function togglePlay() { return callEngine('togglePlay') }
export async function nextTrack() { return callEngine('next') }
export async function previousTrack() { return callEngine('previous') }

export async function seekTo(positionMs) {
  const ms = Math.max(0, Math.floor(Number(positionMs) || 0))
  return callEngine('seek', { positionMs: ms })
}

const REPEAT_MODES = ['off', 'all', 'one']
export async function setRepeatMode(mode) {
  if (!REPEAT_MODES.includes(mode)) throw new TypeError(`Repeat mode must be one of ${REPEAT_MODES.join(', ')}.`)
  return callEngine('setRepeatMode', { mode })
}

export async function setShuffle(enabled) {
  return callEngine('setShuffle', { enabled: !!enabled })
}

/** The full current state (a MusicState). Throws MusicUnavailableError when unusable. */
export async function getMusicState() {
  return callEngine('getState')
}

// ── Playlists ────────────────────────────────────────────────────────────────

export async function listPlaylists() {
  const { playlists } = await callEngine('listPlaylists')
  return Array.isArray(playlists) ? playlists : []
}

export async function createPlaylist(name) {
  const { playlist } = await callEngine('createPlaylist', { name: assertName(name, 'A playlist') })
  return playlist
}

export async function getPlaylist(playlistId) {
  if (!playlistId) throw new TypeError('getPlaylist needs a playlistId.')
  return callEngine('getPlaylist', { playlistId })
}

export async function addToPlaylist(playlistId, track) {
  if (!playlistId) throw new TypeError('addToPlaylist needs a playlistId.')
  return callEngine('addToPlaylist', { playlistId, track: assertTrack(track) })
}

export async function removeFromPlaylist(playlistId, videoId) {
  if (!playlistId || !videoId) throw new TypeError('removeFromPlaylist needs a playlistId and a videoId.')
  return callEngine('removeFromPlaylist', { playlistId, videoId })
}

export async function renamePlaylist(playlistId, name) {
  if (!playlistId) throw new TypeError('renamePlaylist needs a playlistId.')
  return callEngine('renamePlaylist', { playlistId, name: assertName(name, 'A playlist') })
}

export async function deletePlaylist(playlistId) {
  if (!playlistId) throw new TypeError('deletePlaylist needs a playlistId.')
  return callEngine('deletePlaylist', { playlistId })
}

export async function playPlaylist(playlistId, startIndex = 0) {
  if (!playlistId) throw new TypeError('playPlaylist needs a playlistId.')
  return callEngine('playPlaylist', { playlistId, startIndex })
}

// ── Events ───────────────────────────────────────────────────────────────────

/**
 * Subscribe to a MUSIC_EVENTS event. Resolves to the listener handle ({ remove() }).
 * State events deliver a MusicState; 'position' and 'sourceError' deliver their own
 * small payloads (see MUSIC_EVENTS).
 */
export async function addMusicListener(eventName, listener) {
  if (!MUSIC_EVENTS.includes(eventName)) {
    throw new TypeError(`Unknown music event "${eventName}". Expected one of ${MUSIC_EVENTS.join(', ')}.`)
  }
  if (typeof listener !== 'function') throw new TypeError('A listener must be a function.')
  const plugin = await pluginOrThrow()
  return plugin.addListener(eventName, listener)
}

// ── Activity → playlist bindings (the seam Today's plan start fires) ───────
//
// sheets.jsx calls onTodayPlanStart({ dayKey, gymId, date }) the moment a planned
// workout actually starts. The music pillar's half of that seam lives here: given the
// app's musicBindings map ({ activityKey: binding }) and that activity payload,
// resolve and fire the binding. A binding is { playlistId, autoPlay, askFirst,
// resume }: askFirst (or autoPlay off) never plays uninvited — the caller shows a
// one-tap chip instead. resume keeps a same-playlist queue playing rather than
// restarting it. Unbound activities resolve to null and change nothing, and firing
// never throws: starting a workout must never wait on, or fail because of, music.

/** The binding keys an activity answers to, most specific first. */
export function musicBindingKeys(activity) {
  if (!activity?.dayKey) return []
  const keys = []
  if (activity.gymId) keys.push(`${activity.dayKey}@${activity.gymId}`)
  keys.push(activity.dayKey)
  return keys
}

/** The binding for this activity, or null when the activity is unbound. */
export function resolveMusicBinding(bindings, activity) {
  if (!bindings || typeof bindings !== 'object') return null
  for (const key of musicBindingKeys(activity)) {
    const binding = bindings[key]
    if (binding?.playlistId) return { key, ...binding }
  }
  return null
}

const defaultCore = { playPlaylist, getMusicState, resumeMusic }

/**
 * Fire the binding for a started activity. Returns a small report instead of
 * throwing: { fired: true, playlistId } | { fired: false, reason } where reason is
 * 'no-binding' | 'ask-first' | 'unavailable' | 'error'.
 */
export async function fireMusicBinding(bindings, activity, core = defaultCore) {
  const binding = resolveMusicBinding(bindings, activity)
  if (!binding) return { fired: false, reason: 'no-binding' }
  if (binding.askFirst || binding.autoPlay === false) {
    return { fired: false, reason: 'ask-first', playlistId: binding.playlistId }
  }
  try {
    if (binding.resume) {
      const state = await core.getMusicState().catch(() => null)
      if (state?.playlistId === binding.playlistId && state.track) {
        await core.resumeMusic()
        return { fired: true, playlistId: binding.playlistId, resumed: true }
      }
    }
    await core.playPlaylist(binding.playlistId, 0)
    return { fired: true, playlistId: binding.playlistId }
  } catch (e) {
    return { fired: false, reason: e instanceof MusicUnavailableError ? 'unavailable' : 'error', playlistId: binding.playlistId }
  }
}
