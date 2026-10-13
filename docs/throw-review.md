# Right-handed throwing review

The previous animation translated and rotated one palm-up cutout for all three motions. Its central, almost vertical sleeve and fixed wrist pose made the arm direction difficult to read.

The new hand rests on the right side of the dock. A long right forearm approaches the wrist from the lower right. Separate release drawings change the palm and finger articulation while motion keyframes supply the windup and follow-through. The grip pivots keep the pellet release attached to the hand; all three throws release at the same world position. The sleeve end continues below the game viewport.

| Motion | Chance | Behavior |
| --- | --- | --- |
| Quick toss | 60% | A short cup-and-flick motion, palm opening upward; release at 0.11 seconds, return to rest at 0.40 seconds. |
| Overhand | 30% | Raises the loaded right hand, turns it toward the pond, and releases with the back of the hand visible; higher pellet arc. |
| Spread | 10% | A short sideways wrist motion and open fanned fingers; four pellets land in a wider fan centered on the selected point. |

The twelve named stages reuse four individual drawings: cupped hand, open quick release, pronated overhand release, and spread release. This keeps finger proportions and wrist joins consistent when several stages share a hand pose. The 2% lucky chance, palm indicator, fish-only +50 bonus, queued throws, and pause behavior continue to use the same throw events.

## Anatomy review

Check the collecting hand and every throwing drawing for **four fingers and one thumb**. Open views should show index, middle, ring, and a shorter little finger. Curled fingers should have four distinct pads or knuckle paths. Palm-up and pronated views must remain the same right hand with a natural wrist connection. The palm indicator must sit over the loaded hand and disappear when food releases.

The draft sheet exposed a missing finger in the quick release and an extra finger in a spread pose. Those draft sprites are excluded from the game; the final atlas packages individually reviewed cutouts.

```bash
npm run review:hands
```

This renders `hand-details.png` and `right-arm-poses.png` from the actual multi-texture atlas. Automated checks cover all twelve stage names, PNG dimensions, source bounds, and accidental crop overlap. Reusing an identical crop for another motion stage is intentional. Image dimensions cannot establish correct finger anatomy, so review the contact sheets visually.

Browser checks sample the real rendered quick, overhand, and spread motions, require their separate release stages, verify the arm is not mirrored and the trimmed sleeve ends stay below the canvas, and exercise the lucky hand cue and fish bonus. Simulation tests verify the weighted mix, queued release timing, higher overhand arc, wider spread fan, and shoreline containment.

Verified on 13 October 2026: all four source drawings and twelve rendered stages were visually checked for four fingers and one thumb, as was the existing collecting hand. The hand-atlas review, TypeScript/production build, all 20 simulation tests, and all seven browser scenarios passed in both development and production. Final desktop and phone screenshots were reviewed for the right-arm direction and the lucky cue.
