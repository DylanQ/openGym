# CHANGES-BITCHORD — what was taken from BitChord, and what was changed

This fork (openGym, AGPLv3) incorporates code from **BitChord**
(github.com/kushagrasinghx/BitChord, GPLv3), combined under GPLv3 §13 as
the licence of each provides. This file is the change record GPLv3 §5
calls for: it states what was taken, from which upstream commit, and what
was modified. It is updated at every graft step.

- **Upstream:** BitChord `main` @ `edc1e6f36febf71a118e649411d2fc21b70ead45` (2026-10-17)
- **Licences:** BitChord GPLv3; InnerTubeX GPLv3; NewPipeExtractor GPLv3;
  QuickJS-KT Apache-2.0; QuickJS (C engine) MIT; FFmpeg decoder sources
  Apache-2.0 (AOSP/androidx, vendored by BitChord from androidx/media
  1.11.0, native half built by BitChord from librempeg).

## Step: build graft (2026-10-24)

Scope: build wiring only. No BitChord code is *executed* by the app yet —
the MusicCore engine behind the seam in `frontend/android/music-core/` is
still the unported skeleton; nothing in this step changes app behaviour.

### Copied unmodified

Every file below is a byte-for-byte copy of the upstream file at the
commit above; none has been edited. (Cuts and edits, when the playback
port makes them, will be listed per-file in later sections of this
document.)

117 files:

- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/data/listentogether/JamInvite.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/data/listentogether/JamInvite.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/data/listentogether/PartyModels.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/data/listentogether/PartyModels.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/data/listentogether/PartyQueueReading.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/data/listentogether/PartyQueueReading.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/data/listentogether/ServerClock.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/data/listentogether/ServerClock.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/data/model/Models.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/data/model/Models.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/data/model/PlaylistOrder.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/data/model/PlaylistOrder.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/data/model/SpotifyMatch.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/data/model/SpotifyMatch.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/data/settings/AutomixPerformanceMode.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/data/settings/AutomixPerformanceMode.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/data/settings/TrackAnalysisState.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/data/settings/TrackAnalysisState.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/playback/EqualizerCurve.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/playback/EqualizerCurve.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/playback/EqualizerPreset.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/playback/EqualizerPreset.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/playback/PeakLimiter.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/playback/PeakLimiter.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/playback/smart/AnalysisLog.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/playback/smart/AnalysisLog.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/playback/smart/AutomixAnalysisSource.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/playback/smart/AutomixAnalysisSource.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/playback/smart/TrackAnalysis.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/playback/smart/TrackAnalysis.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/playback/smart/TransitionPlanner.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/playback/smart/TransitionPlanner.kt`
- `frontend/android/music-shared/src/commonMain/kotlin/com/music/bitchord/playback/smart/TransitionPolicy.kt` ← BitChord `shared/src/commonMain/kotlin/com/music/bitchord/playback/smart/TransitionPolicy.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/auth/DataSyncId.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/auth/DataSyncId.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/DebugLog.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/DebugLog.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/Http.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/Http.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/LikeState.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/LikeState.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/LocaleTags.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/LocaleTags.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/MonotonicClock.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/MonotonicClock.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/NerdStats.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/NerdStats.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/TrackLog.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/TrackLog.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/YtMusicRepository.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/YtMusicRepository.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/canvas/CanvasArtwork.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/canvas/CanvasArtwork.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/canvas/SpotifyCanvasQuery.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/canvas/SpotifyCanvasQuery.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/discord/DiscordApplication.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/discord/DiscordApplication.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/InnerTubeXResolver.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/InnerTubeXResolver.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/Innertube.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/Innertube.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/InnertubeParser.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/InnertubeParser.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/PlayerClient.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/PlayerClient.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/StreamResolver.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/StreamResolver.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/potoken/JavaScriptUtil.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/potoken/JavaScriptUtil.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/potoken/PoTokenException.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/potoken/PoTokenException.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/potoken/PoTokenGenerator.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/potoken/PoTokenGenerator.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/potoken/PoTokenPage.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/potoken/PoTokenPage.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/potoken/PoTokenResult.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/potoken/PoTokenResult.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/BackgroundVocals.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/BackgroundVocals.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/BetterLyrics.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/BetterLyrics.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/BiniLyrics.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/BiniLyrics.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/EnhancedLrc.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/EnhancedLrc.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/Genius.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/Genius.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/KuGou.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/KuGou.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LrcLib.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LrcLib.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LrcRed.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LrcRed.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LrcWriter.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LrcWriter.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricAlignments.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricAlignments.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricGaps.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricGaps.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricLine.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricLine.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricSections.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricSections.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsHttp.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsHttp.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsPlus.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsPlus.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsQuery.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsQuery.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsRepository.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsRepository.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsSource.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsSource.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsTranslation.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsTranslation.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/Megalobiz.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/Megalobiz.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/Musixmatch.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/Musixmatch.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/PaxSenix.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/PaxSenix.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/ProviderLyrics.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/ProviderLyrics.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/SimpMusicLyrics.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/SimpMusicLyrics.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/SyllableRuns.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/SyllableRuns.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/TranslationLanguages.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/TranslationLanguages.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/TtmlLyrics.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/TtmlLyrics.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/Unison.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/Unison.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/YouTubeLyrics.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/YouTubeLyrics.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/model/ArtistCredits.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/model/ArtistCredits.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/model/SearchHistoryEntity.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/model/SearchHistoryEntity.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/presence/Presence.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/presence/Presence.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/settings/LibraryEnums.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/settings/LibraryEnums.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/settings/PlayerEnums.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/settings/PlayerEnums.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/sources/SourceTrackKeys.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/sources/SourceTrackKeys.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/sources/StreamFormat.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/sources/StreamFormat.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/sources/TrackMatcher.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/sources/TrackMatcher.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/spotify/SpotifyImporter.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/spotify/SpotifyImporter.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/spotify/SpotifyLibrary.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/spotify/SpotifyLibrary.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/webdav/WebDavAuth.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/webdav/WebDavAuth.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/ContextRegistry.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/ContextRegistry.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/QueueBuilder.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/QueueBuilder.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/QueueSections.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/QueueSections.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/QueueTimeline.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/QueueTimeline.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/QueueWindow.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/QueueWindow.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/TransitionFilter.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/TransitionFilter.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/AnalysisStore.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/AnalysisStore.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/BeatTracker.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/BeatTracker.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/MelSpectrogram.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/MelSpectrogram.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/NativeAnalysisLibrary.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/NativeAnalysisLibrary.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/TrackFeatures.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/TrackFeatures.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/VocalTracker.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/music/bitchord/playback/smart/VocalTracker.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/DiscordWebSocket.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/DiscordWebSocket.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/HeartBeat.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/HeartBeat.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/Identify.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/Identify.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/Payload.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/Payload.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/Ready.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/Ready.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/Resume.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/Resume.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/op/OpCode.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/op/OpCode.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/op/OpCodesSerializer.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/op/OpCodesSerializer.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/presence/Activity.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/presence/Activity.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/presence/Assets.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/presence/Assets.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/presence/Metadata.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/presence/Metadata.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/presence/Presence.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/presence/Presence.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/presence/Timestamps.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/gateway/entities/presence/Timestamps.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/rpc/ArtworkCache.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/rpc/ArtworkCache.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/rpc/ExternalAssets.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/rpc/ExternalAssets.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/rpc/KizzyRPC.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/rpc/KizzyRPC.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/rpc/RpcImage.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/rpc/RpcImage.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/rpc/UserInfo.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/rpc/UserInfo.kt`
- `frontend/android/music-shared/src/jvmSharedMain/kotlin/com/my/kizzy/utils/Ext.kt` ← BitChord `shared/src/jvmSharedMain/kotlin/com/my/kizzy/utils/Ext.kt`
- `frontend/android/music-core/src/main/java/androidx/media3/decoder/ffmpeg/FfmpegAudioDecoder.java` ← BitChord `app/src/main/java/androidx/media3/decoder/ffmpeg/FfmpegAudioDecoder.java`
- `frontend/android/music-core/src/main/java/androidx/media3/decoder/ffmpeg/FfmpegAudioRenderer.java` ← BitChord `app/src/main/java/androidx/media3/decoder/ffmpeg/FfmpegAudioRenderer.java`
- `frontend/android/music-core/src/main/java/androidx/media3/decoder/ffmpeg/FfmpegDecoderException.java` ← BitChord `app/src/main/java/androidx/media3/decoder/ffmpeg/FfmpegDecoderException.java`
- `frontend/android/music-core/src/main/java/androidx/media3/decoder/ffmpeg/FfmpegLibrary.java` ← BitChord `app/src/main/java/androidx/media3/decoder/ffmpeg/FfmpegLibrary.java`
- `frontend/android/music-core/src/main/jniLibs/arm64-v8a/libffmpegJNI.so` ← BitChord `app/src/main/jniLibs/arm64-v8a/libffmpegJNI.so`
- `frontend/android/music-core/src/main/jniLibs/armeabi-v7a/libffmpegJNI.so` ← BitChord `app/src/main/jniLibs/armeabi-v7a/libffmpegJNI.so`
- `frontend/android/music-core/src/main/jniLibs/x86_64/libffmpegJNI.so` ← BitChord `app/src/main/jniLibs/x86_64/libffmpegJNI.so`

### Written for the graft (not BitChord code)

- `frontend/android/music-shared/build.gradle` — Groovy adaptation of
  BitChord's `shared/build.gradle.kts`: same plugins (Kotlin
  Multiplatform 2.3.20, Android library, serialization), same source-set
  shape (jvmSharedMain between commonMain and the android target), same
  dependency pins. The upstream `jvm()` desktop target and the test
  source sets were not grafted.
- `frontend/android/music-shared/src/androidMain/AndroidManifest.xml` —
  empty library manifest (upstream ships none; the KMP android target
  needs one to exist).
- `frontend/android/music-core/build.gradle` — gained a port of
  BitChord's `stripNewPipeExtractorUtils` task (their
  `app/build.gradle.kts`), the stripped-NewPipeJar runtime wiring with
  upstream's hand-declared transitive list, and dependencies on
  `:music-shared`, Media3 1.11.0 and QuickJS-KT 1.0.14.
- App-wide build changes the graft forces (also upstream's): minSdk
  24 → 26 and compileSdk 36 → 37 in `frontend/android/variables.gradle`
  (targetSdk stays 36), and per-ABI splits in
  `frontend/android/app/build.gradle` (armeabi-v7a, arm64-v8a, x86_64 +
  universal APK), matching BitChord's split set.
- JitPack repository declarations (InnerTubeX / NewPipeExtractor are
  JitPack-only), added centrally in `frontend/android/build.gradle`,
  where BitChord declares it in its settings file.
- Root buildscript changes forced by this project's toolchain (AGP
  8.13.0, where upstream runs 8.10.1), in
  `frontend/android/build.gradle`:
  - the Kotlin Gradle plugin 2.3.20 and the serialization plugin 2.3.20
    sit on the ROOT buildscript classpath as well as on the music
    modules' own buildscripts. With KGP split across two classloader
    realms, AGP registers the `org.jetbrains.kotlin.platform.type`
    attribute as a String while KGP registers it as its enum, and the
    KMP module fails to configure ("Cannot have two attributes with the
    same name but different types"). One realm, one schema.
  - a central `compileSdkMinor = 0` pin for every classic Android
    module (registered in `allprojects` + `afterEvaluate`, which runs
    before AGP's own variant creation). AGP 8.13 addresses SDK
    platforms as major.minor, and Google ships no plain `android-37`
    platform — only `android-37.0` — so an unpinned `compileSdk 37`
    fails with "Failed to find target with hash string 'android-37'".
    `:music-shared` pins the same in its own android block.
- Dependency adaptations inside the grafted modules:
  - `:music-shared` declares InnerTubeX as its Android artifact
    (`innertubex-android`) rather than upstream's KMP root coordinate
    (`innertubex`), whose android variant is an available-at redirect.
    Same code, same package; the direct artifact keeps AGP's
    aar-metadata view on a real AAR.
  - `:music-core` additionally declares `org.checkerframework:
    checker-qual:3.43.0` and `androidx.annotation:annotation:1.6.0`.
    The vendored FFmpeg sources need both at compile time; Media3
    keeps checker-qual compile-only in its own decoder module and
    carries androidx.annotation only on its runtime variant, so
    neither reaches this module's compile classpath on its own.
    (Upstream gets both transitively through the phone app's wider
    graph, e.g. Guava and appcompat.)
