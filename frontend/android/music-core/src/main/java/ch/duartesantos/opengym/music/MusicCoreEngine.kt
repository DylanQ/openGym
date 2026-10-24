package ch.duartesantos.opengym.music

/**
 * The MusicCore engine seam — the Kotlin mirror of the JS contract in
 * frontend/src/lib/music-core.js.
 *
 * This interface occupies exactly the seat BitChord's PlayerConnection.kt occupies
 * in BitChord: everything the UI may ask of playback, and the state it may observe,
 * with the Media3 MediaController on the far side. The engine phase implements this
 * interface over a MediaController bound to the grafted PlaybackService, porting
 * PlayerConnection's listener-to-state mapping (including its rule that position is
 * only polled while playing and in the foreground — over this bridge, position is
 * emitted throttled to ~1/s).
 *
 * SPIKE STATE: the only implementation is [UnportedMusicCoreEngine]. Nothing here is
 * copied from BitChord yet; when the port lands, files taken from BitChord keep its
 * copyright notices and carry change notices per GPLv3 §5 (see README.md).
 */

/** A track as it crosses the bridge — the minimal shape of BitChord's Song. */
data class MusicTrack(
    val videoId: String,
    val title: String,
    val artist: String,
    val durationMs: Long? = null,
    val artworkUrl: String? = null,
    val albumName: String? = null,
)

/**
 * Playback state, mirroring BitChord's PlayerState (PlayerConnection.kt) field for
 * field, with position flattened to [positionMs] and [playlistId] added so the
 * activity→playlist bindings can recognise their own queue.
 */
data class MusicState(
    val track: MusicTrack? = null,
    val isPlaying: Boolean = false,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    /** Buffering, including our own stream-URL resolution. */
    val isLoading: Boolean = false,
    val error: String? = null,
    /** "off" | "all" | "one" (Media3's REPEAT_MODE_* at the seam). */
    val repeatMode: String = "off",
    val queue: List<MusicTrack> = emptyList(),
    val queueIndex: Int = 0,
    val hasPrevious: Boolean = false,
    val hasNext: Boolean = false,
    val isQualityUpgraded: Boolean = false,
    /** The playlist the current queue came from, when it came from one. */
    val playlistId: String? = null,
)

/** A playlist in the music library. */
data class MusicPlaylist(
    val id: String,
    val name: String,
    val trackCount: Int = 0,
)

/**
 * A resolved stream. Playback normally resolves internally — a queued item's URI is
 * a `bitchord://watch?v=…` placeholder the service resolves at play time — so this
 * exists for diagnostics and for naming the stage that failed in a sourceError.
 */
data class ResolvedStream(
    val videoId: String,
    val url: String,
    val container: String?,
    val quality: String?,
    /** Which resolver stage produced it: "innertubex" | "newpipe" | "probe". */
    val stage: String,
)

/** Engine → UI events. The plugin forwards each of these via notifyListeners. */
interface MusicCoreEvents {
    fun onTrackChange(state: MusicState)
    fun onPlaybackState(state: MusicState)
    fun onQueueChange(state: MusicState)
    fun onPosition(positionMs: Long, durationMs: Long)
    fun onSourceError(videoId: String?, stage: String, message: String)
    fun onQualityChange(state: MusicState)
}

/** Thrown by every engine method until the BitChord port lands. */
class EngineNotPortedException : Exception("BitChord engine not ported yet")

interface MusicCoreEngine {
    var events: MusicCoreEvents?

    // Search & resolution (BitChord :shared — YtMusicRepository, StreamResolver)
    fun search(query: String, limit: Int): List<MusicTrack>
    fun resolveStream(videoId: String): ResolvedStream

    // Transport & queue (PlayerConnection's MediaController surface)
    fun play(track: MusicTrack)
    fun playFromSearch(query: String)
    fun enqueue(track: MusicTrack, next: Boolean)
    fun setQueue(tracks: List<MusicTrack>, startIndex: Int)
    fun pause()
    fun resume()
    fun togglePlay()
    fun next()
    fun previous()
    fun seekTo(positionMs: Long)
    fun setRepeatMode(mode: String)
    fun setShuffle(enabled: Boolean)
    fun state(): MusicState

    // Library playlists (BitChord :app data layer)
    fun listPlaylists(): List<MusicPlaylist>
    fun createPlaylist(name: String): MusicPlaylist
    fun playlistTracks(playlistId: String): List<MusicTrack>
    fun addToPlaylist(playlistId: String, track: MusicTrack)
    fun removeFromPlaylist(playlistId: String, videoId: String)
    fun renamePlaylist(playlistId: String, name: String)
    fun deletePlaylist(playlistId: String)
    fun playPlaylist(playlistId: String, startIndex: Int)
}

/**
 * The spike's engine: present enough for the seam to be real (the plugin registers,
 * getEngineInfo answers honestly), incapable of everything else. Replaced — not
 * extended — by the ported engine in the engine phase.
 */
object UnportedMusicCoreEngine : MusicCoreEngine {
    override var events: MusicCoreEvents? = null

    private fun unported(): Nothing = throw EngineNotPortedException()

    override fun search(query: String, limit: Int): List<MusicTrack> = unported()
    override fun resolveStream(videoId: String): ResolvedStream = unported()
    override fun play(track: MusicTrack): Unit = unported()
    override fun playFromSearch(query: String): Unit = unported()
    override fun enqueue(track: MusicTrack, next: Boolean): Unit = unported()
    override fun setQueue(tracks: List<MusicTrack>, startIndex: Int): Unit = unported()
    override fun pause(): Unit = unported()
    override fun resume(): Unit = unported()
    override fun togglePlay(): Unit = unported()
    override fun next(): Unit = unported()
    override fun previous(): Unit = unported()
    override fun seekTo(positionMs: Long): Unit = unported()
    override fun setRepeatMode(mode: String): Unit = unported()
    override fun setShuffle(enabled: Boolean): Unit = unported()
    override fun state(): MusicState = unported()
    override fun listPlaylists(): List<MusicPlaylist> = unported()
    override fun createPlaylist(name: String): MusicPlaylist = unported()
    override fun playlistTracks(playlistId: String): List<MusicTrack> = unported()
    override fun addToPlaylist(playlistId: String, track: MusicTrack): Unit = unported()
    override fun removeFromPlaylist(playlistId: String, videoId: String): Unit = unported()
    override fun renamePlaylist(playlistId: String, name: String): Unit = unported()
    override fun deletePlaylist(playlistId: String): Unit = unported()
    override fun playPlaylist(playlistId: String, startIndex: Int): Unit = unported()
}
