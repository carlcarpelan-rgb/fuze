'use strict';
// The 24 floors of part 1. kind: push (garage, dock) or guards (lobby). Each spec is fed to its generator.
module.exports = [
  // Garage: cars
  { kind: 'push', theme: 0, seeds: 3, o: { w: 5, h: 6, cars: 3, minCars: 2, maxCars: 4, target: 2, minSeg: 2, iters: 500 } },
  { kind: 'push', theme: 0, seeds: 3, o: { w: 6, h: 6, cars: 4, minCars: 3, maxCars: 5, target: 4, minSeg: 3, iters: 900 } },
  { kind: 'push', theme: 0, seeds: 3, o: { w: 6, h: 7, cars: 5, minCars: 4, maxCars: 6, target: 6, minSeg: 5, iters: 1500 } },
  { kind: 'push', theme: 0, seeds: 3, o: { w: 6, h: 7, cars: 6, minCars: 5, maxCars: 8, minSeg: 7, iters: 2500 } },
  { kind: 'push', theme: 0, seeds: 3, o: { w: 6, h: 7, cars: 5, minCars: 4, maxCars: 7, glass: 3, target: 7, minSeg: 4, iters: 2000 } },
  { kind: 'push', theme: 0, seeds: 5, o: { w: 7, h: 8, cars: 7, minCars: 6, maxCars: 9, minSeg: 9, iters: 2500 } },
  { kind: 'push', theme: 0, seeds: 5, o: { w: 7, h: 8, cars: 7, minCars: 6, maxCars: 9, glass: 4, minSeg: 9, iters: 2500 } },
  { kind: 'push', theme: 0, seeds: 6, boss: true, o: { w: 7, h: 9, cars: 9, minCars: 8, maxCars: 11, bomb: true, by: 1, minSeg: 12, iters: 3000, cap: 30000 } },
  // Loading dock: crates, mirror-symmetric
  { kind: 'push', theme: 1, seeds: 3, o: { w: 5, h: 6, crates: 3, minCrates: 2, maxCrates: 4, sym: 1, pillars: 0, target: 3, minSeg: 2, iters: 500 } },
  { kind: 'push', theme: 1, seeds: 3, o: { w: 7, h: 6, crates: 4, minCrates: 3, maxCrates: 6, sym: 1, pillars: 2, target: 5, minSeg: 4, iters: 900 } },
  { kind: 'push', theme: 1, seeds: 3, o: { w: 7, h: 7, crates: 6, minCrates: 4, maxCrates: 8, sym: 1, pillars: 2, minSeg: 6, iters: 1200 } },
  { kind: 'push', theme: 1, seeds: 3, o: { w: 7, h: 7, crates: 6, minCrates: 4, maxCrates: 10, sym: 1, pillars: 2, minSeg: 8, iters: 1500 } },
  { kind: 'push', theme: 1, seeds: 3, o: { w: 7, h: 7, crates: 6, minCrates: 4, maxCrates: 8, sym: 1, symGlass: 1, pillars: 2, glass: 4, minSeg: 6, iters: 1500 } },
  { kind: 'push', theme: 1, seeds: 3, o: { w: 7, h: 8, crates: 8, minCrates: 6, maxCrates: 12, sym: 1, pillars: 4, minSeg: 10, iters: 1800, cap: 25000 } },
  { kind: 'push', theme: 1, seeds: 3, o: { w: 9, h: 8, crates: 8, minCrates: 6, maxCrates: 12, sym: 1, pillars: 4, minSeg: 11, iters: 1800, cap: 30000 } },
  { kind: 'push', theme: 1, seeds: 3, boss: true, o: { w: 9, h: 9, crates: 8, minCrates: 6, maxCrates: 12, sym: 1, symGlass: 1, pillars: 4, glass: 4, bomb: true, by: 1, minSeg: 12, iters: 1800, cap: 30000 } },
  // Lobby: guards
  { kind: 'guards', theme: 2, seeds: 4, o: { w: 5, h: 6, guards: 1, maxGuards: 1, kinds: ['post'], pillars: 2, wantTakedown: 1, maxSteps: 12, minDetour: 0, iters: 300 } },
  { kind: 'guards', theme: 2, seeds: 4, o: { w: 6, h: 6, guards: 1, maxGuards: 1, kinds: ['patrol'], pillars: 3, maxSteps: 16, iters: 400 } },
  { kind: 'guards', theme: 2, seeds: 4, o: { w: 6, h: 7, guards: 1, maxGuards: 2, kinds: ['patrol', 'post'], crates: 1, minCrates: 1, maxCrates: 2, pillars: 3, wantPush: 1, maxSteps: 22, iters: 500 } },
  { kind: 'guards', theme: 2, seeds: 4, o: { w: 7, h: 7, guards: 1, maxGuards: 2, kinds: ['turner', 'post'], pillars: 3, maxCrates: 1, maxSteps: 24, needMoving: 1, iters: 500 } },
  { kind: 'guards', theme: 2, seeds: 4, o: { w: 7, h: 7, guards: 2, maxGuards: 3, crates: 1, maxCrates: 2, pillars: 3, maxSteps: 30, needMoving: 1, iters: 600 } },
  { kind: 'guards', theme: 2, seeds: 4, o: { w: 7, h: 8, guards: 2, maxGuards: 3, crates: 1, maxCrates: 2, pillars: 4, wantTakedown: 1, maxSteps: 36, needMoving: 2, iters: 700 } },
  { kind: 'guards', theme: 2, seeds: 4, o: { w: 8, h: 8, guards: 3, maxGuards: 4, crates: 1, maxCrates: 3, pillars: 4, maxSteps: 42, needMoving: 2, iters: 700, cap: 80000 } },
  { kind: 'guards', theme: 2, seeds: 4, boss: true, o: { w: 8, h: 9, guards: 3, maxGuards: 4, crates: 2, maxCrates: 4, pillars: 4, bomb: true, by: 1, maxSteps: 46, needMoving: 2, iters: 700, cap: 100000 } }
];
