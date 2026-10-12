# Assets

Source art and sound for the game. **Not served directly** — `scripts/build-assets.ts` derives the
runtime files into `public/game/` (git-ignored) on every `pnpm dev` and `pnpm build`.

## Source

All files in this folder come unmodified from the challenge repository
[`junglegaming/game-developer-challenge`](https://github.com/junglegaming/game-developer-challenge),
`assets/` directory, commit `315891441be81ca0bff75cf3c2b0cd2f27f119cd` (2026-09-09). The only
change is line endings: the text files (`.xml`, `.json`, `.txt`) were committed with CRLF and are
stored with LF, per this repository's `.gitattributes`.

## License

The challenge repository ships no license file for these assets. They are used here only as the
challenge instructs ("use the provided assets as the visual base"). No third-party asset was added.

## What is here, and what was left out

| Kept | Used for |
|---|---|
| `spritesheet/ships_miscellaneous_sheet*.{png,xml}` | Ships, hull damage, cannonballs, explosions, fire, wreckage |
| `spritesheet/ui_sheet*.{png,json}` | HUD, menu panels, buttons, touch controls |
| `tilesheet/tiles_sheet*.png`, `tilesheets.txt` | Water and island tiles |
| `ui_scene_background.png` | Menu background |
| `sounds/*.wav` | Effects and ambience |

| Left out | Why |
|---|---|
| `png/default`, `png/retina` (individual PNGs) | Same images as the atlases; loading one atlas instead of dozens of files is the point of an atlas |
| `vector/` (`.svg`, `.swf`) | Editable source art, not used at runtime |
| `sample*.png`, `preview.png`, `logo_jungle_gaming.svg` | Reference images from the brief, not game art |

## Derived and committed

- **`public/favicon.png`** (128 × 128): the player's ship, `ship_5` of the ships atlas, turned 45°
  so it fills a square tab icon. Drawn once from the atlas on a canvas and committed as is — it
  never changes, and producing it in the build would need an image library for one sprite.

## Conversions done by the build script

- **Ships atlas: XML → Pixi JSON.** The ships atlas is a Starling/Sparrow `TextureAtlas` XML, which
  PixiJS does not load. The script converts it and drops the `.png` suffix from frame names.
- **Ships stay at 1×.** `ships_miscellaneous_sheet_retina.png` is **not** a 2× image: it is
  1024 × 512 like the 1× sheet, with the same frame coordinates (one differs by a pixel). Declaring
  it as 2× would draw every ship at half size on high-density screens, so only the 1× sheet is used.
- **Tiles: grid → atlas.** `tilesheets.txt` describes a plain grid (64 × 64, no margin). The script
  writes a JSON atlas with one frame per cell, named `tile_<row>_<col>` (zero-based), at 1× and
  2× (`tiles_sheet_retina.png` is a true 2048 × 768 image).
- **UI atlas:** already in Pixi format with `meta.scale` 1 and 2; copied with the image name
  updated.
