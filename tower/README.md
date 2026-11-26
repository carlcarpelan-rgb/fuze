# Fuze Tower (prototype)

A first playable build of the follow-up to Fuze: a push-the-walls puzzle with stealth, set in a tower taken over on Christmas Eve.
Design notes live in the design document; this folder holds the code.

Eight hand-drawn floors, each introducing one thing:

| Floor | Name | New |
|---|---|---|
| 1 | Parking level | Reach the lift, push a crate |
| 2 | Night shift | A guard who walks when you walk |
| 3 | Cover | Push a crate into a guard's line of sight |
| 4 | From behind | Knock a guard out by walking into him from behind |
| 5 | Tripwire | Push a crate into a laser beam |
| 6 | Broken glass | Glass costs 3 s of fuse; a pushed crate crushes it |
| 7 | Long way up | A spare fuse refills the fuse |
| 8 | Christmas party | Guard, laser and a bomb as the goal |

```sh
node tower/solve.js   # solve every floor within its fuse, write tower/levels/solutions.json
node tower/build.js   # build tower/dist/index.html
node tower/test.js    # play every solution in Chrome through the real game
```

The build reuses Fuze's drawing helpers, engine frame, sound, input, music and platform code from `src/` unchanged.
