# Full-stride motion trial

The blue-jacket adult and yellow-jumper child have 48 complete walking frames.
Both contacts include a trailing leg behind the hips. The other eleven walking
designs keep their existing drawings and pacing.

Each `*-poses.png` contains 24 illustrated source poses in six columns. Its JSON
records the common cell, height, ground, body anchor, and measured brown-shoe
centers. Row order is the authored pose sequence: 0–23 and back to 0. Do not drop
drawings because a tracked shoe repeats a position; the knee or other leg can
still be moving, and foot tracking is ambiguous when the shoes overlap.

`scripts/resample-walking.mjs` preserves all 24 source poses on even-numbered
output frames and inserts one in-between on each odd frame. The two contacts
are at phases 0 and .5; the passing poses are at .25 and .75. Shoe measurements
calibrate ground distance and markers, rather than selecting or timing poses.
`scripts/interpolate-walking.py`
estimates dense motion between adjacent drawings, including the last-to-first
pair, and generates 48 equally spaced phases. Each output warps one complete
source drawing with its alpha, using the nearer endpoint to limit distortion.
It never crossfades two silhouettes: that produced translucent duplicate limbs
when the old block interpolator lost track of a crossing leg or arm.

The motion field extends into transparent space and is integrated in small steps
to keep moving contours continuous. Color is sampled with premultiplied alpha.
FFmpeg only packs the resulting complete RGBA drawings into PNG sheets.

The result is `*-cycle.png`, six columns of 512-pixel cells, with one shared
450-pixel reference height and ground at y=498. `*-keys.png` extracts the two
contacts and two passing phases for review. The main JSON records the 48 phases,
supporting shoe, both shoe centers, body anchor, and the four key events.
Its `sequence` records which adjacent source poses produced each output frame,
including the 23-to-0 in-between at the loop boundary.
The painted shoe and body markers follow the chosen drawing's motion field;
the supporting-shoe ground marker records the intended constant-speed stance.
These are distinct measurements, especially when one shoe is hidden by the other.

Rebuild from the project root with Python 3, Chromium, and FFmpeg installed.
The Python packages are only needed to rebuild these assets; running or building
the game still uses its existing npm dependencies.

```bash
python3 -m pip install -r scripts/walking-requirements.txt
node scripts/resample-walking.mjs observer-adult-0
node scripts/resample-walking.mjs observer-kid-0
node scripts/build-walking-atlas.mjs
```

The atlas builder applies one shared scale to each cycle and ships complete PNG
poses at 260 pixels tall. Complete drawings register at the lowest painted sole;
the atlas ground marker uses that same baseline, including poses whose painted
bottom differs slightly from the source guide. Runtime movement follows the measured stride distance:
the adult completes a cycle in two seconds and the child in 1.8 seconds at their
normal pace. Both copies use the same travel speed in `/?walkCompare=1`.

This is a motion pass. Painted detail can still vary between the source drawings.
Verify the actual pixels of the trailing shoe at both contacts,
the swinging foot through the loop, and every displayed frame at 30/60/120 fps.
Browser checks compare the pixels of all 24 authored drawings with their even
output frames. Frame-number coverage and annotated shoe positions alone do not
establish that the illustrated sequence is complete or that motion is natural.

The user's [walk-cycle body reference](https://1.bp.blogspot.com/-EhqNikTSBpY/TaY7f_MJY2I/AAAAAAAAA7U/H99z084fOTM/s1600/RW_modified_walk_lesson_07.jpg)
is the guide for reviewing contact, down, passing, and up: weight drops just after
contact, then the body rises after passing. Keep that body rhythm and opposing
arm swing in mind when refining the source poses.
