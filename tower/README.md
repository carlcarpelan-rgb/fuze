# Fuze Tower

The follow-up to Fuze: push, sneak and ride the lift up through a tower that has been wired to blow.
Every floor is a puzzle with a lift as the exit; every eighth floor has a bomb instead.
Design notes live in the design document; this folder holds the code.

Part 1 (this build) has 24 floors in three parts of the tower:

| Floors | Part | Puzzle |
|---|---|---|
| 1–8 | Garage | Parked cars roll only along their length, one bay per push (Rush Hour on foot). Broken windscreen glass costs fuse; a car rolled over it crushes it. |
| 9–16 | Loading Dock | Crates go one step in any direction, as in Fuze. Mirror-symmetric floors. |
| 17–24 | Lobby | Guards see the square in front of them and the squares on either side, never behind. Crates and columns block the view. Walk into a guard's back to knock him out. Patrols turn around at the end of their route or at anything in the way. |

Floors 8, 16 and 24 are bomb floors with a tighter fuse.

```sh
node tower/gen/run.js 1,2,3          # generate floors (best of a few seeds) into tower/gen/out/
node tower/gen/merge.js              # order them, set the fuse, write tower/levels/levels.json
node tower/solve.js                  # solve every floor within its fuse, write tower/levels/solutions.json
node tower/build.js                  # build tower/dist/index.html
node tower/test.js [m] [1,5]         # play every solution in Chrome (m: phone size), screenshots of floors 1 and 5
```

`tower/gen/plan.js` lists what each floor should be. The generators climb towards floors that need many separate pushes
(garage, dock) or long detours around guards (lobby), and reject floors that can be solved without the part's mechanic.
The fuse is the best possible time for a quick player times a factor that tightens through each part.

The build reuses Fuze's drawing helpers, engine frame, sound, input, music and platform code from `src/` unchanged.
