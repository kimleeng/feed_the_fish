# Dock-character throwing review

A full-body person now stands on the wooden feeding platform, replacing the foreground forearm. The character faces the water, keeps both shoes planted, and holds a pellet pouch in the other hand. Separate windup, release, follow-through, and recovery drawings use the same throwing arm throughout.

| Motion | Chance | Release / full duration | Behavior |
| --- | --- | --- | --- |
| Quick toss | 60% | 0.26 / 0.84 seconds | Hand drops toward the hip, then opens forward for a short underhand flick. |
| Overhand | 30% | 0.44 / 1.08 seconds | Elbow bends with the loaded hand above the shoulder, followed by a high open-hand release and a higher pellet arc. |
| Spread | 10% | 0.32 / 0.96 seconds | A low reach opens into a sideways sweep; four pellets fan across the selected patch. |

The animation atlas has 24 actual full-body cuts: twelve original poses and twelve intermediate anticipation, drive, settling, and return poses. Frames align around the two shoe centers and share a sole baseline, so extending the arm does not translate or rotate the entire character. Standing height is calibrated to 145 game pixels across both source sheets, slightly smaller than the nearer visitors. The contact shadow sits on the dock boards. The original release times and full durations are preserved.

`dock-thrower-pins.json` and `animation-pins.json` annotate the throwing hand in every source drawing. Packaging converts those points into atlas coordinates and the offsets used by the simulation. Each pellet stores its own origin and launch height; its arc starts at the corresponding release hand. A throw aimed right mirrors the character and its hand coordinates around the dock position. The character keeps that direction until an opposite throw starts; queued input does not turn an active throw early, and a center throw preserves the preceding direction. Birds can only intercept pellets when their height falls near the surface.

The 2% lucky chance, hand indicator, fish-only +50 bonus, throw queue, and pause behavior use the existing throw events. The collecting hand in the machine dialog retains its separate artwork.

## Reproduce the review

```bash
node scripts/build-art-atlas.mjs thrower
node scripts/build-animation-atlases.mjs
npm run review:art
```

Inspect `dock-thrower-cycles.png` for the complete sequence, planted shoes, arm continuity, and character scale. `thrower-frames.png` and `thrower-hand-pins.png` retain the original-pose review. Review overlays do not alter the source PNG.

Browser checks sample all three rendered motions, require the windup/release/follow-through stages, verify the character stays on the dock with a fixed sole baseline, and compare pellet origins to the transformed atlas hand pins. Desktop and phone checks exercise lucky indicators, bonuses, queued input, and restart. Simulation checks cover the weighted mix, release timing, independent per-motion origins, higher overhand arcs, the spread fan, and shoreline containment.

Reviewed on 14 October 2026 alongside the corrected visitor gait and assembled desktop and phone scenes. All 29 simulation/observer tests, the TypeScript/production build, art validation, and all eight browser scenarios passed in development and production. The previous foreground-arm source files and their review command remain available as archived artwork.
