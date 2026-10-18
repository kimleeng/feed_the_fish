# Full-stride motion trial

The blue-jacket adult and yellow-jumper child have 48 complete walking frames.
Both contacts include a trailing leg behind the hips. The other eleven walking
designs keep their existing drawings and pacing.

Each `*-poses.png` contains 24 illustrated source poses in six columns. Its JSON
records the common cell, height, ground, body anchor, and measured brown-shoe
centers. The source poses are not evenly spaced in their physical step, so they
must not simply receive equal holds.

`scripts/resample-walking.mjs` tracks each planted shoe through its stance and
times the source poses from its backward sweep. FFmpeg then generates whole-image
motion in-betweens at 48 equally spaced phases. Color is premultiplied by alpha;
color and alpha use the same motion guide. Three repeated source cycles provide
neighbors on both sides of the loop, and only the middle cycle ships.

The result is `*-cycle.png`, six columns of 512-pixel cells, with one shared
450-pixel reference height and ground at y=498. `*-keys.png` extracts the two
contacts and two passing phases for review. The main JSON records the 48 phases,
supporting shoe, both shoe centers, body anchor, and the four key events.

Rebuild from the project root with installed Chromium and FFmpeg:

```bash
node scripts/resample-walking.mjs observer-adult-0
node scripts/resample-walking.mjs observer-kid-0
node scripts/build-walking-atlas.mjs
```

The atlas builder applies one shared scale to each cycle and ships complete PNG
poses at 260 pixels tall. Runtime movement follows the measured stride distance:
the adult completes a cycle in two seconds and the child in 1.8 seconds at their
normal pace. Both copies use the same travel speed in `/?walkCompare=1`.

This is a motion pass. Painted detail and optical-flow blending artifacts remain
for later cleanup. Verify the actual pixels of the trailing shoe at both contacts,
the swinging foot through the loop, and every displayed frame at 30/60/120 fps.
Frame coverage and annotated shoe positions alone do not establish natural motion.
