# Fuze

A browser puzzle game inspired by Nintendo's Game & Watch title Bomb Sweeper (1987).
Push walls to clear a path to the bomb before the fuse burns down.

- 120 levels in 10 worlds: 100 symmetric mazes and 20 scrolling boss levels
- Bolted iron blocks (world 2), holes in the floor (world 3) and sliding ice blocks (world 6)
- A fewest-pushes record per level with a medal, stars for time left, and an arcade mode with three tries
- All graphics and sound are generated in code, with no image or audio files

The finished game is a single self-contained file, `dist/index.html`. Open it in any modern browser.

## Layout

| Path | Contents |
|---|---|
| `src/rules.js` | Game rules, shared by the game and the level generator |
| `src/art.js` | Themes and drawing code for blocks, the player and bombs |
| `src/game.js` | Engine: state, animation and rendering |
| `src/ui.js` | Menus, HUD, sound, controls and saving |
| `src/platform.js` | CrazyGames SDK: gameplay events, saving, ads, mute |
| `src/music.js` | Procedural music, one key and groove per world |
| `src/template.html` | Page HTML and CSS |
| `gen/gen3.js` | Maze generator with an optimal solver |
| `gen/boss.js` | Boss level generator |
| `gen/merge3.js` | Assembles the levels into `gen/levels.json` and sets fuse times |
| `gen/verify3.js` | Replays every solution against the rules and checks records and symmetry |
| `build.js` | Builds `dist/index.html` |

## Build

```sh
node build.js              # dist/index.html, for any website
node build.js crazygames   # dist/crazygames/index.html, loads the CrazyGames SDK
```

Fonts are embedded from `src/fonts` (SIL Open Font License), so the game makes no requests to other servers.
`src/platform.js` talks to the CrazyGames SDK when it is present and falls back to plain browser storage otherwise.

## Store material

`store/` holds the CrazyGames upload (`fuze-crazygames.zip`), the three covers, the two preview videos and the listing text (`LISTING.md`).
`node capture.js covers` and `node capture.js video` render them again from the game itself.

## Regenerate the levels

```sh
cd gen
node gen3.js run 0 2 & node gen3.js run 1 2   # mazes, two processes (about an hour)
node boss.js                                  # boss levels
node merge3.js                                # writes levels.json and solutions.json
node verify3.js                               # check
cd .. && node build.js
```

## Test scripts

`shot.js`, `keytest.js`, `holdtest.js`, `medaltest.js`, `sdktest.js` and `feat.js` drive the game in Chrome through Playwright and save screenshots to `shots/`.
