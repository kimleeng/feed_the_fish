# Feed the fish in Godot

This is a native Godot 4.6 project alongside the existing Phaser game. Open the repository-root `project.godot` and press **F5**. The renderer uses GL Compatibility to support modest desktop GPUs. A fresh checkout needs only Godot; runtime code is GDScript and the gameplay data is checked in.

If the repository already contains browser dependencies/builds, run `npm run godot:prepare` first. This puts `.gdignore` markers in generated directories so Godot does not scan them. The source artwork under `public/art` is shared directly, avoiding a second copy of the atlases.

## Run and controls

With Godot on PATH, `npm run godot` plays and `npm run godot:editor` opens the editor. Set `GODOT_BIN` to the executable's full path if it is not on PATH. macOS's standard `/Applications/Godot.app` is also detected. These commands use Node; opening `project.godot` directly does not.

- Click/tap the water to aim. Space throws toward the last water pointer position. The **Throw pellets** button aims near the middle.
- Use the red garden machine or **Pellet machine** to buy ten throws for one pretend 5 kr coin.
- **Assist** reveals introductory text, guidance, food share, and the six-species field guide. Opening the guide suspends the pond; the vending dialog leaves it running.
- **Debug** reveals boost meters, the submerged turtle, and a scrolling table of live animal/food/weather metrics. It works independently of Assist.
- **Sound** opts into the original quiet synthesized score and action cues. Sound starts off.
- Tab/Shift+Tab navigate native controls; Enter/Space activate focused buttons; Escape closes a dialog. Backgrounding the application suspends the pond and audio. A paid vending cycle finishes independently, matching the browser.
- **Begin a new visit** resets the current pond, spending and score while preserving preferences and the best score.

Preferences and best scores live in Godot's `user://preferences.cfg`, separately from browser storage. Tests and review scripts restore that file after their run. The developer review tools save only ignored outputs under `godot/test-results`.

## Gameplay and animation

The pond keeps 46 fish, 15 birds, and the secret musk turtle. Flight remains a 50% per-bird/per-handful decision within species distance bands (gull 100–520, duck 180–360, coot 150–260), subject to remaining pellet time. Throw travel times and continuous parabolic flight follow the browser version. Feeding history, the 20-second recent-meal window, two-second 40% chase boosts, and 15/30-second hungry/fed recharge rates are retained.

The model runs at 60 physics steps per second. Drawing interpolates position, heading, altitude, and animation phase at display rate, so visual smoothness does not alter gameplay pace. Small subdivided meshes articulate tails, paddles, wings and the throwing hand between the existing registered poses. Wing timing remains continuous through takeoff, cruise and landing. Stable atlas anchors preserve body size, foot contact and release locations; only surfaced fish lips appear above the pond reflection.

The interface uses native Controls, fonts, focus and transitions. Compact desktop mode fits the pond and actions into the window; portrait uses a taller, centered playfield. The optional longer Assist and Debug views scroll. The music is generated in a bounded audio buffer rather than loading a large audio track.

## Source map and shared tuning

| File | Responsibility |
| --- | --- |
| `scripts/main.gd` | Scene wiring, input transforms, fixed-step clock, focus/guide pause |
| `scripts/pond_simulation.gd` | Animals, pellets, throws, flights, feeding, collisions, vending |
| `scripts/simulation_energy.gd` | Reusable feeding history and hunger-dependent boosts |
| `scripts/ambience.gd` | Seeded weather, garden visitors and employee restocking |
| `scripts/pond_renderer.gd` | Native pond layers, animation and effects |
| `scripts/art_library.gd`, `renderer_sprite.gd` | TexturePacker metadata, anchored textures and articulated meshes |
| `scripts/interface.gd`, `ui_machine.gd` | Responsive HUD, dialogs, preferences and vending animation |
| `scripts/pond_audio.gd`, `ambience_music.gd` | Opt-in synthesis, cues and pause/resume |
| `data/gameplay.json` | Browser-derived species, placements, pins and tuning |

After changing browser species/art/timing definitions, run `npm run godot:sync` and review the generated JSON diff. `node --experimental-strip-types godot/tools/sync_browser_data.mjs --check` detects stale data. Species, pin and gait data are read from that file; rules implemented in both languages should be updated together and checked with both suites.

## Validation

```bash
npm run godot:test
npm test
npm run build
npm run godot:review
```

The native suites exercise simulation rules, seeded ambience, the full restock sequence, audio synthesis and lifecycle, plus the real scene's buttons, purchase/feeding flow, pause, touch deduplication, Debug, restart, and 360/390/768/1280px layouts. The launcher imports resources first and fails on GDScript errors even when Godot returns a zero process code.

`godot:review` requires a graphical display and captures actual rendered desktop/phone pond, vending, feeding, restocking, guide and Debug screens. `godot --path . --script godot/tests/review_animation.gd` captures enlarged wing and surfaced-fish poses, plus all eight bird headings. On a display-less Linux runner, use Xvfb with software OpenGL; `--headless` alone uses a dummy renderer and cannot provide visual evidence. A final local play session remains useful for hardware-specific input feel, sound and frame pacing.

`godot --path . --script godot/tests/profile_native.gd` reports isolated simulation and presentation script timings, render calls and texture memory. It advances one fixed simulation step per rendered sample. Compare this with `godot --path . --print-fps` during normal play on your GPU; software-rendered cloud frame rates are not a local hardware benchmark.

## Desktop exports

Install the matching Godot export templates through **Editor → Manage Export Templates**, then use **Project → Export**. Presets for Linux x86-64, Windows x86-64 and macOS are checked in. These bundle the shared atlas JSON, gameplay data and font license and exclude browser sources, dependencies and test/review output.

For example, create `builds/linux`, run `npm run godot:prepare`, and then:

```bash
godot --headless --path . --export-release Linux builds/linux/feed-the-fish.x86_64
```

Keep the executable and its `.pck` file together. Windows and macOS presets require their matching templates and have not been runtime-tested on those operating systems. macOS exports are unsigned development builds; signing/notarization can be configured for distribution. The Linux build can be exercised locally with `--headless --quit-after 120` as a startup smoke check.

Fonts are Liberation Sans/Serif under the SIL Open Font License; see `assets/fonts/LICENSE.txt`. The port reuses the repository's original artwork and generates animation between its existing poses at runtime.
