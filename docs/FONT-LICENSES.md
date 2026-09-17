# Fonts shipped in public/fonts

| file | family | weight | upstream | license |
|---|---|---|---|---|
| `archivo-black-400.woff2` | Archivo Black | 400 | https://github.com/Omnibus-Type/ArchivoBlack | SIL Open Font License 1.1 |
| `space-mono-400.woff2` | Space Mono | 400 | https://github.com/googlefonts/spacemono | SIL Open Font License 1.1 |
| `space-mono-700.woff2` | Space Mono | 700 | https://github.com/googlefonts/spacemono | SIL Open Font License 1.1 |
| `inter-var.woff2` | Inter | 100-900 (variable) | https://github.com/rsms/inter | SIL Open Font License 1.1 |

All three families are SIL OFL 1.1, which permits self-hosting and redistribution as long as the
license travels with the font and the fonts are not sold on their own. Full texts:
https://raw.githubusercontent.com/google/fonts/main/ofl/archivoblack/OFL.txt
https://raw.githubusercontent.com/google/fonts/main/ofl/spacemono/OFL.txt
https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt

Copyright 2017 The Archivo Black Project Authors.
Copyright 2016 The Space Mono Project Authors.
Copyright 2020 The Inter Project Authors.

They are self-hosted, not linked from fonts.googleapis.com, because `server/app.js` declares no
`font-src` in its CSP and therefore falls back to `default-src 'self'`.

## Provenance

The four files are the `latin` subsets served by `fonts.gstatic.com`, pinned by SHA-256 in
`config/public-assets.sha256.json`:

| file | bytes | sha256 |
|---|--:|---|
| `archivo-black-400.woff2` | 18604 | `25f33e61cf995abd6be62931cf03bf427286259177b43618cc410ee0157cfd30` |
| `space-mono-400.woff2` | 16520 | `fb4a81a2d0a893e5c38c394a7e716a1cef0b24610a0af49c96f6d529bd66bf2b` |
| `space-mono-700.woff2` | 16724 | `2d46bd159b53f55c41167a4f1540a074649464194fd1e416f5b4694a6c0f282c` |
| `inter-var.woff2` | 48256 | `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62` |
