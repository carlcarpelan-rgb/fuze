#!/bin/sh
# node lanes: labrun.sh "laser green" 3 500
cd "$(dirname "$0")/.."
for idea in $1; do for seed in $(seq 1 $2); do
  node gen/labgen.js $idea $((seed * 7 + 3)) $3 > gen/out/lab_${idea}_${seed}.json
done; done
