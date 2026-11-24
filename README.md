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
| `src/template.html` | Page HTML and CSS |
| `gen/gen3.js` | Maze generator with an optimal solver |
| `gen/boss.js` | Boss level generator |
| `gen/merge3.js` | Assembles the levels into `gen/levels.json` and sets fuse times |
| `gen/verify3.js` | Replays every solution against the rules and checks records and symmetry |
| `build.js` | Builds `dist/index.html` |

## Build

```sh
node build.js
```

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

`shot.js`, `keytest.js`, `holdtest.js`, `medaltest.js` and `feat.js` drive the game in Chrome through Playwright and save screenshots to `shots/`.
