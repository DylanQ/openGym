package ch.duartesantos.opengym.music

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

/**
 * MusicCore — the Capacitor bridge in front of the grafted BitChord engine.
 *
 * Method names and payload shapes are the contract pinned by
 * frontend/src/lib/music-core.js and its tests; the two sides change together or
 * not at all. Every engine call funnels through [runEngine] so the spike state
 * (engine present as a seam, absent as an implementation) surfaces to JS as one
 * typed rejection: code ENGINE_NOT_PORTED, which music-core.js maps to its
 * MusicUnavailableError.
 */
@CapacitorPlugin(name = "MusicCore")
class MusicCorePlugin : Plugin() {

    // The engine phase swaps this for the ported engine (MediaController-backed).
    private var engine: MusicCoreEngine = UnportedMusicCoreEngine

    override fun load() {
        engine.events = BridgeEvents()
    }

    // ── Diagnostics ──────────────────────────────────────────────────────────

    @PluginMethod
    fun getEngineInfo(call: PluginCall) {
        call.resolve(
            JSObject()
                .put("engine", "bitchord")
                .put("ported", engine !== UnportedMusicCoreEngine),
        )
    }

    // ── Search & resolution ──────────────────────────────────────────────────

    @PluginMethod
    fun search(call: PluginCall) = runEngine(call) { e ->
        val results = JSArray()
        e.search(call.getString("query").orEmpty(), call.getInt("limit") ?: 25)
            .forEach { results.put(trackToJS(it)) }
        JSObject().put("results", results)
    }

    @PluginMethod
    fun resolveStream(call: PluginCall) = runEngine(call) { e ->
        val stream = e.resolveStream(call.getString("videoId").orEmpty())
        JSObject()
            .put("videoId", stream.videoId)
            .put("url", stream.url)
            .put("container", stream.container ?: JSONObject.NULL)
            .put("quality", stream.quality ?: JSONObject.NULL)
            .put("stage", stream.stage)
    }

    // ── Transport & queue ────────────────────────────────────────────────────

    @PluginMethod
    fun play(call: PluginCall) = runEngine(call) { e ->
        e.play(trackFrom(call.getObject("track")))
        JSObject()
    }

    @PluginMethod
    fun playFromSearch(call: PluginCall) = runEngine(call) { e ->
        e.playFromSearch(call.getString("query").orEmpty())
        JSObject()
    }

    @PluginMethod
    fun enqueue(call: PluginCall) = runEngine(call) { e ->
        e.enqueue(trackFrom(call.getObject("track")), call.getBoolean("next") == true)
        JSObject()
    }

    @PluginMethod
    fun setQueue(call: PluginCall) = runEngine(call) { e ->
        val array = call.getArray("tracks") ?: throw IllegalArgumentException("tracks is required")
        val tracks = (0 until array.length()).map { trackFrom(array.getJSONObject(it)) }
        e.setQueue(tracks, call.getInt("startIndex") ?: 0)
        JSObject()
    }

    @PluginMethod
    fun pause(call: PluginCall) = runEngine(call) { e -> e.pause(); JSObject() }

    @PluginMethod
    fun resume(call: PluginCall) = runEngine(call) { e -> e.resume(); JSObject() }

    @PluginMethod
    fun togglePlay(call: PluginCall) = runEngine(call) { e -> e.togglePlay(); JSObject() }

    @PluginMethod
    fun next(call: PluginCall) = runEngine(call) { e -> e.next(); JSObject() }

    @PluginMethod
    fun previous(call: PluginCall) = runEngine(call) { e -> e.previous(); JSObject() }

    @PluginMethod
    fun seek(call: PluginCall) = runEngine(call) { e ->
        e.seekTo((call.getInt("positionMs") ?: 0).toLong())
        JSObject()
    }

    @PluginMethod
    fun setRepeatMode(call: PluginCall) = runEngine(call) { e ->
        e.setRepeatMode(call.getString("mode") ?: "off")
        JSObject()
    }

    @PluginMethod
    fun setShuffle(call: PluginCall) = runEngine(call) { e ->
        e.setShuffle(call.getBoolean("enabled") == true)
        JSObject()
    }

    @PluginMethod
    fun getState(call: PluginCall) = runEngine(call) { e -> stateToJS(e.state()) }

    // ── Playlists ────────────────────────────────────────────────────────────

    @PluginMethod
    fun listPlaylists(call: PluginCall) = runEngine(call) { e ->
        val playlists = JSArray()
        e.listPlaylists().forEach { playlists.put(playlistToJS(it)) }
        JSObject().put("playlists", playlists)
    }

    @PluginMethod
    fun createPlaylist(call: PluginCall) = runEngine(call) { e ->
        JSObject().put("playlist", playlistToJS(e.createPlaylist(call.getString("name").orEmpty())))
    }

    @PluginMethod
    fun getPlaylist(call: PluginCall) = runEngine(call) { e ->
        val playlistId = call.getString("playlistId").orEmpty()
        val tracks = JSArray()
        e.playlistTracks(playlistId).forEach { tracks.put(trackToJS(it)) }
        val playlist = e.listPlaylists().firstOrNull { it.id == playlistId }
            ?: MusicPlaylist(playlistId, "", tracks.length())
        JSObject().put("playlist", playlistToJS(playlist)).put("tracks", tracks)
    }

    @PluginMethod
    fun addToPlaylist(call: PluginCall) = runEngine(call) { e ->
        e.addToPlaylist(call.getString("playlistId").orEmpty(), trackFrom(call.getObject("track")))
        JSObject()
    }

    @PluginMethod
    fun removeFromPlaylist(call: PluginCall) = runEngine(call) { e ->
        e.removeFromPlaylist(call.getString("playlistId").orEmpty(), call.getString("videoId").orEmpty())
        JSObject()
    }

    @PluginMethod
    fun renamePlaylist(call: PluginCall) = runEngine(call) { e ->
        e.renamePlaylist(call.getString("playlistId").orEmpty(), call.getString("name").orEmpty())
        JSObject()
    }

    @PluginMethod
    fun deletePlaylist(call: PluginCall) = runEngine(call) { e ->
        e.deletePlaylist(call.getString("playlistId").orEmpty())
        JSObject()
    }

    @PluginMethod
    fun playPlaylist(call: PluginCall) = runEngine(call) { e ->
        e.playPlaylist(call.getString("playlistId").orEmpty(), call.getInt("startIndex") ?: 0)
        JSObject()
    }

    // ── Plumbing ─────────────────────────────────────────────────────────────

    private fun runEngine(call: PluginCall, block: (MusicCoreEngine) -> JSObject) {
        try {
            call.resolve(block(engine))
        } catch (ex: EngineNotPortedException) {
            call.reject("BitChord engine not ported yet", "ENGINE_NOT_PORTED", ex)
        } catch (ex: Exception) {
            call.reject(ex.message ?: "Music engine error", "ENGINE_ERROR", ex)
        }
    }

    /** Engine events → plugin events (names pinned in music-core.js MUSIC_EVENTS). */
    private inner class BridgeEvents : MusicCoreEvents {
        override fun onTrackChange(state: MusicState) =
            notifyListeners("trackChange", stateToJS(state))

        override fun onPlaybackState(state: MusicState) =
            notifyListeners("playbackState", stateToJS(state))

        override fun onQueueChange(state: MusicState) =
            notifyListeners("queueChange", stateToJS(state))

        override fun onPosition(positionMs: Long, durationMs: Long) =
            notifyListeners(
                "position",
                JSObject().put("positionMs", positionMs).put("durationMs", durationMs),
            )

        override fun onSourceError(videoId: String?, stage: String, message: String) =
            notifyListeners(
                "sourceError",
                JSObject()
                    .put("videoId", videoId ?: JSONObject.NULL)
                    .put("stage", stage)
                    .put("message", message),
            )

        override fun onQualityChange(state: MusicState) =
            notifyListeners("qualityChange", stateToJS(state))
    }

    private fun trackFrom(json: JSONObject?): MusicTrack {
        if (json == null) throw IllegalArgumentException("track is required")
        return MusicTrack(
            videoId = json.optString("videoId"),
            title = json.optString("title"),
            artist = json.optString("artist"),
            durationMs = if (json.has("durationMs")) json.optLong("durationMs") else null,
            artworkUrl = json.optString("artworkUrl").ifEmpty { null },
            albumName = json.optString("albumName").ifEmpty { null },
        )
    }

    private fun trackToJS(track: MusicTrack): JSObject = JSObject()
        .put("videoId", track.videoId)
        .put("title", track.title)
        .put("artist", track.artist)
        .apply {
            track.durationMs?.let { put("durationMs", it) }
            track.artworkUrl?.let { put("artworkUrl", it) }
            track.albumName?.let { put("albumName", it) }
        }

    private fun playlistToJS(playlist: MusicPlaylist): JSObject = JSObject()
        .put("id", playlist.id)
        .put("name", playlist.name)
        .put("trackCount", playlist.trackCount)

    private fun stateToJS(state: MusicState): JSObject {
        val queue = JSArray()
        state.queue.forEach { queue.put(trackToJS(it)) }
        return JSObject()
            .put("track", state.track?.let { trackToJS(it) } ?: JSONObject.NULL)
            .put("isPlaying", state.isPlaying)
            .put("positionMs", state.positionMs)
            .put("durationMs", state.durationMs)
            .put("isLoading", state.isLoading)
            .put("error", state.error ?: JSONObject.NULL)
            .put("repeatMode", state.repeatMode)
            .put("queue", queue)
            .put("queueIndex", state.queueIndex)
            .put("hasPrevious", state.hasPrevious)
            .put("hasNext", state.hasNext)
            .put("isQualityUpgraded", state.isQualityUpgraded)
            .put("playlistId", state.playlistId ?: JSONObject.NULL)
    }
}
