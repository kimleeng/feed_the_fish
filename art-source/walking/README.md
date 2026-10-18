# Four-key illustrated walking trial

Each `*-keys.png` is the four complete source drawings in a 2 × 2 grid:
near contact, far passing, far contact, near passing. The `*-cycle.png` files
contain the selected whole drawings in playback order, four columns of 512-pixel
cells, with a 450-pixel reference height and sole baseline at y=498. The four
fixed drawings are retained in these cycles. Faces, limbs, and hands are painted
as part of each full person.

The matching JSON records each pose's phase, supporting leg and measured brown
shoe position. Cycle distance is the sum of the two supporting-shoe sweeps between
opposite contact drawings. Do not increase cadence independently of this distance:
shorter drawn steps produce a quicker rhythm at the same travel speed.

Check the swinging foot as well as the planted shoe when selecting poses. The
yellow child's cycle now has 13 poses: an extra bent-leg drawing was removed
because it pulled the foot back under the body after it had already extended.
Sorting only by the planted shoe had concealed that reversal. Retain the measured
phases of the valid drawings so the preceding pose receives the removed pose's
time, instead of shortening the overall cycle.

Run `node scripts/build-walking-atlas.mjs` from the project root to uniformly
scale each complete cycle to 300 pixels tall, write the shipping PNGs in
`public/art`, and rebuild the atlas and `src/walking-gait.ts`. This requires the
installed Playwright Chromium or `/usr/bin/chromium`. Original walking PNGs are
preserved. Run `node scripts/review-walking.mjs http://127.0.0.1:5173` against a
running game for sheets, movement samples, and looping GIFs (requires FFmpeg).

This is a trial. The adult's near stance still has a sparse interval after its
passing drawing, covering about 13 game pixels at height 158. The child's largest
interval covers about 6 pixels at height 109. Numeric checks establish consistency
at the authored poses, not smooth foot contact between them. Review motion before
expanding the approach to the rest of the cast.
