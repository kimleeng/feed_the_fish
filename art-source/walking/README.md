# Full-stride motion trial

The blue-jacket adult and yellow-jumper child have 48 complete walking frames.
Both contacts include a trailing leg behind the hips. The other eleven walking
designs keep their existing drawings and pacing.

Each `*-poses.png` contains 24 illustrated source poses in six columns. Its JSON
records the common cell, height, ground, body anchor, and measured brown-shoe
centers. The source poses are not evenly spaced in their physical step, so they
must not simply receive equal holds.

`scripts/resample-walking.mjs` tracks each planted shoe through its stance and
times the source poses from its backward sweep. `scripts/interpolate-walking.py`
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
poses at 260 pixels tall. Runtime movement follows the measured stride distance:
the adult completes a cycle in two seconds and the child in 1.8 seconds at their
normal pace. Both copies use the same travel speed in `/?walkCompare=1`.

This is a motion pass. Painted detail can still vary between the source drawings.
Verify the actual pixels of the trailing shoe at both contacts,
the swinging foot through the loop, and every displayed frame at 30/60/120 fps.
Frame coverage and annotated shoe positions alone do not establish natural motion.

The user's [walk-cycle body reference](https://1.bp.blogspot.com/-EhqNikTSBpY/TaY7f_MJY2I/AAAAAAAAA7U/H99z084fOTM/s1600/RW_modified_walk_lesson_07.jpg)
is the guide for reviewing contact, down, passing, and up: weight drops just after
contact, then the body rises after passing. Keep that body rhythm and opposing
arm swing in mind when refining the source poses.
