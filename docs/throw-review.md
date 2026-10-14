# Dock-character throwing review

A full-body person now stands on the wooden feeding platform, replacing the foreground forearm. The character faces the water, keeps both shoes planted, and holds a pellet pouch in the other hand. Separate windup, release, follow-through, and recovery drawings use the same throwing arm throughout.

| Motion | Chance | Release / full duration | Behavior |
| --- | --- | --- | --- |
| Quick toss | 60% | 0.26 / 0.84 seconds | Hand drops toward the hip, then opens forward for a short underhand flick. |
| Overhand | 30% | 0.44 / 1.08 seconds | Elbow bends with the loaded hand above the shoulder, followed by a high open-hand release and a higher pellet arc. |
| Spread | 10% | 0.32 / 0.96 seconds | A low reach opens into a sideways sweep; four pellets fan across the selected patch. |

The atlas has twelve actual full-body cuts. Frames align around the two shoe centers and share a sole baseline, so extending the arm does not translate or rotate the entire character. The standing height is 145 game pixels, slightly smaller than the nearer visitors. The contact shadow sits on the dock boards.

`dock-thrower-pins.json` annotates the throwing hand in each source drawing. Packaging converts those points into atlas coordinates and the release offsets used by the simulation. Each pellet stores its own origin and launch height; its arc starts at the corresponding release hand. Birds can only intercept it when its height falls near the surface.

The 2% lucky chance, hand indicator, fish-only +50 bonus, throw queue, and pause behavior use the existing throw events. The collecting hand in the machine dialog retains its separate artwork.

## Reproduce the review

```bash
node scripts/build-art-atlas.mjs thrower
npm run review:art
```

Inspect `thrower-frames.png` for complete shoes, the pouch staying in the other hand, arm continuity, and windup/release/follow-through direction. `thrower-hand-pins.png` overlays the annotated hand positions on the actual cuts. Review overlays do not alter the source PNG.

Browser checks sample all three rendered motions, require the windup/release/follow-through stages, verify the character stays on the dock with a fixed sole baseline, and compare pellet origins to the transformed atlas hand pins. Desktop and phone checks exercise lucky indicators, bonuses, queued input, and restart. Simulation checks cover the weighted mix, release timing, independent per-motion origins, higher overhand arcs, the spread fan, and shoreline containment.

Reviewed on 14 October 2026 alongside the corrected visitor gait and assembled desktop and phone scenes. All 29 simulation/observer tests, the TypeScript/production build, art validation, and all eight browser scenarios passed in development and production. The previous foreground-arm source files and their review command remain available as archived artwork.
