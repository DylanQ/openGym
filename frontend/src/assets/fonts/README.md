# Bundled fonts — IRON LEDGER (this fork)

Both faces are SIL Open Font License 1.1; the licence texts ship beside this file
(`OFL-Archivo.txt`, `OFL-IBMPlexMono.txt`). Subset to Latin (U+0020–007E, U+00A0–00FF,
common punctuation/arrows) and converted to WOFF2 with fontTools on 2026-10-23.
The WOFF2 binaries are **inlined as data URIs in `src/index.css`** (this fork is
maintained through text-only snapshot pushes, which cannot carry binaries) — never
loaded from a CDN, so the APK works fully offline. Regenerate the exact WOFF2s from
the sources below with the subset command at the end of this file.

| Face | Source | WOFF2 size |
|---|---|---|
| Archivo, variable (wght 100–900, wdth 62–125 — Expanded via `font-stretch`) | google/fonts `ofl/archivo/Archivo[wdth,wght].ttf` | 87.7 KB |
| IBM Plex Mono Medium (500) | google/fonts `ofl/ibmplexmono/IBMPlexMono-Medium.ttf` | 9.5 KB |
| IBM Plex Mono SemiBold (600) | google/fonts `ofl/ibmplexmono/IBMPlexMono-SemiBold.ttf` | 9.6 KB |

Total ≈ 107 KB, inside the design brief's ≤300 KB font budget (§5.3).
Re-subset: `python3 -m fontTools.subset <src.ttf> --flavor=woff2 --unicodes="U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201A,U+201C-201E,U+2020-2022,U+2026,U+2039-203A,U+20AC,U+2212,U+2190-2193" --layout-features='*' --no-hinting --desubroutinize`
