# MusicCore — BitChord engine graft (Android module)

The native half of the openGym × BitChord integration. BitChord
(github.com/kushagrasinghx/BitChord, GPLv3) is being pulled apart and built into
this app (AGPLv3) natively — the combination GPLv3 §13 provides for. The research
and licence analysis live in the goal files (`bitchord-integration.md`); the spike
record lives in the goal's `hidden_files/bitchord-spike-notes.md`.

## What is here now (spike skeleton, 2026-10-23)

- `MusicCorePlugin.kt` — the Capacitor plugin (`@CapacitorPlugin(name = "MusicCore")`),
  registered in the app's `MainActivity`. Method names/payloads are the contract
  pinned by `frontend/src/lib/music-core.js` and its tests.
- `MusicCoreEngine.kt` — the engine seam: an interface that sits exactly where
  BitChord's `PlayerConnection.kt` sits, mirroring its `PlayerState`. The only
  implementation is `UnportedMusicCoreEngine`, which throws
  `EngineNotPortedException` from everything; the plugin turns that into a typed
  `ENGINE_NOT_PORTED` rejection and `getEngineInfo` answers `ported: false`.

No BitChord code has been copied yet, and `PlaybackService` has deliberately not
been ported. The seam is the deliverable of the spike.

## What lands here in the engine phase

1. BitChord's `:shared` KMP module (extraction: InnerTubeX → NewPipeExtractor →
   probe; YtMusicRepository; addon + JS-module sources) as a sibling module,
   consumed by this one.
2. BitChord's `:app` data layer (settings, source registry) and `playback` package
   (PlaybackService, queue, cache) under this module, amputated of PartySync,
   Cast, Wear, widgets, the download manager and the ONNX `smart/` features.
3. A `MusicCoreEngine` implementation backed by a Media3 `MediaController` bound
   to the grafted PlaybackService — PlayerConnection's role, re-implemented
   against this seam.
4. Build graft: JitPack repositories, the `stripNewPipeExtractorUtils` jar task,
   the vendored FFmpeg decoder + `jniLibs`, ABI splits; the app manifest gains the
   media session service and foreground-service-media-playback permission.
5. App-wide build changes the engine forces: **minSdk 24 → 26**,
   **compileSdk 36 → 37** (InnerTubeX's AAR requirement).

## Licence obligations (GPLv3 × AGPLv3)

- Every file copied from BitChord keeps its copyright notices; modified files
  carry prominent change notices (GPLv3 §5). Keep a `CHANGES-BITCHORD.md` beside
  the grafted code stating what was taken, from which upstream commit, and what
  was cut.
- The combined APK is copyleft as a whole: it ships only with its corresponding
  source (build from the public fork, tag releases, link the source in-app).
- GPLv3 and AGPLv3 texts and BitChord/NewPipeExtractor attributions ship in the
  app's About → Licences screen.
- BitChord-derived code stays out of the self-hosted server flavour (AGPL §13
  network clause).
