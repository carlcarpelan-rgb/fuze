# Fuze: store listing

Text and settings to paste into the CrazyGames Developer Portal.

## Name

Fuze

## Short description

Push the walls, reach the bomb, beat the burning fuse. 120 hand-checked puzzle levels.

## Description

Someone has hidden bombs in the tunnels under the city, and every fuse is already lit. Push walls out of your way to reach a bomb before the spark does.

Every wall moves one square, but only if the square behind it is free, so each push can open a path or seal it for good. Plan your route, then race the clock.

- 120 levels across 10 worlds, from the sewers to the reactor
- New mechanics as you go: bolted iron blocks, holes you fill with walls, and ice blocks that slide until they hit something
- Boss levels where the maze rolls in from the side and you must push through before you are crushed
- Every level has a fewest-pushes record. Match it to earn a medal
- Undo any move, restart any time, and replay levels for three stars

## Controls

- Arrow keys or WASD: move and push
- Z or Backspace: undo
- R: restart level
- P: pause
- M: sound on or off
- Touch: swipe on the board or use the on-screen d-pad

## Settings for the submission form

| Field | Value |
|---|---|
| Genre | Puzzle |
| Tags | puzzle, logic, sokoban, maze, bomb, casual |
| Orientation | Landscape (desktop and mobile) |
| Mobile | Supported, touch controls |
| Upload | `fuze-crazygames.zip` (one `index.html`, about 260 kB) |
| Covers | `cover-1920x1080.png`, `cover-800x1200.png`, `cover-800x800.png` |
| Preview videos | `preview-1920x1080.mp4`, `preview-1080x1620.mp4` (19 s, no sound) |

## Notes for the review

- The game is a single self-contained file. It loads no fonts, images or scripts from other servers apart from the CrazyGames SDK.
- The SDK reports gameplay start and stop, saves progress through the Data module, and respects the platform mute setting.
- Midgame ads are requested only at level transitions, from the fourth level of a session onward. Gameplay continues normally if no ad is served.
- New players start directly in level 1. Returning players see the menu with their progress.
- There is no tutorial text. Every mechanic is introduced on its own level and shows itself the first time the player bumps into it.
- Escape is not used, so it never conflicts with leaving fullscreen.
