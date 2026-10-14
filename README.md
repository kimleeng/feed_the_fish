# Feed the fish

An untimed, cozy browser game inspired by feeding fish at Tivoli Gardens in Copenhagen. The garden has an ivory Moorish facade, a Chinese-style pavilion, green ironwork, and benches facing the lake. A red round-globe pellet machine stands on the path beside the dock: click a 5 kr game coin, watch the chrome handle spin, and hold out a hand for twenty throws. The money counter records pretend spending during this visit; the game has no payment service.

There is no countdown or game-over screen. Throw a little food, watch the pond, and refill whenever you like. Unused throws carry over when you buy another serving. Points credit the amount fish actually eat, and the food-share meter shows how much went to fish versus birds. Your best kindness score is saved in this browser.

## Develop

Requires Node.js 22.12+ (Node 24 is prepared in the cloud environment) and npm. No backend or API keys are required.

```bash
npm ci
npm run dev
```

Click or tap the water, press **Space**, or use **Throw pellets**. Every throw travels in an arc from the same dock position toward your chosen point. Birds see the pellets while airborne and may intercept them; fish only react after they land on the water. Floating food is available to birds for a short time, while fish can still eat it after it sinks.

The right forearm enters from the lower right. Three motions use a quick underhand toss (60%), a raised overhand throw (30%), and a sideways spread throw (10%). The hand opens into a different release pose for each motion, with four fingers and one thumb. Every motion releases from the same point on the right side of the dock and follows through before returning to rest. The quick toss has a short flick; the overhand throw sends pellets on a higher arc; the spread throw fans four pellets across a wider patch centered on your aim. Targets remain inside the pond. Rapid clicks reserve throws in a queue, so every hand animation plays. Pause also freezes the throwing hand and queued releases.

Each throw has an independent 2% chance of containing one lucky pellet. A gold star and **LUCKY PELLET** label appear over the palm before a lucky throw, and the golden pellet glints as it travels. The first fish to nibble that pellet earns **+50 bonus points**, golden ripples, a small star celebration, and an optional soft chime. The bonus is awarded once per pellet, even when fish share it. Birds can eat lucky pellets but earn no bonus. The score includes ordinary feeding points and lucky bonuses; the food-share meter still measures food amounts.

Click or tap the **red machine beside the dock** for another twenty throws. The **Pellet machine** button provides the same interaction for keyboard users. **P** and the pause button pause the pond. The field guide pauses while open. Sound is optional. **Begin a new visit** clears the current food, spending, and score and returns to the machine; the best saved score remains.

## Animal movement

The pond has 46 fish and 15 birds across six profiles. Every animal inherits a common baseline and overrides movement speed, vision, bite size, chewing time, and turn rate.

- Golden carp make slow, smooth glides.
- Common carp meander in soft curves.
- Young carp move together in small, darting shoals.
- Mallards paddle with a gentle side-to-side rhythm.
- Gulls swim in wide loops and watch for pellets arriving at the water.
- Little coots alternate quiet paddle strokes with slower drifts near the edge.

Every species has eight directional views and two swimming poses per view. Birds float low in the water, bob gently, and leave little wakes; they watch airborne food but can only catch it near the surface. Fish turn toward their swimming direction beneath a translucent layer of the pond's reflections and moving glints, so their shapes remain visible through the water.

## Garden visitors

Kids and adults walk across the near garden path in either direction. Many turn toward the pond for a brief look, while a few linger. Baseline stopping chances are 70% for adults and 90% for kids; of those who stop, 16% of adults and 52% of kids choose a long watch. Brief stops last 4–11 seconds for adults and 6–15 seconds for kids; longer watches last 25–60 seconds and 40–90 seconds respectively.

Actual pellet releases and food eaten by fish or birds gently increase interest, making a stop a little more likely and slowing the remaining watching time. Interest starts decreasing after each visitor's own 5–10 second threshold without a throw. Nibbles increase interest in proportion to food eaten, and boosts are capped so regular feeding cannot keep anyone indefinitely. Queued clicks, unsuccessful throws, and refills do not count as visible throws. Kids remain more likely to watch for longer in both active and quiet periods.

Uneven arrivals keep about three visitors visible on average, usually two to four. Busy periods reduce the chance of another arrival, making more than eight unusual; ten is the absolute limit. Visitors reserve separate watching places on dry paving and resume their original route afterward. Pause and the field guide freeze their movement and watching time, and a new visit starts with a fresh small crowd. Foot traffic has its own random stream so it does not affect fish behavior or lucky throws.

The path has open cobblestone entrances at both image edges. Six shaded, detailed visitor designs (three adults and three kids) match the warm garden artwork, with walking poses, back views for watching, and grounded shadows. Adult heights are based on the existing benches; children are shorter, and both age groups vary in height and scale slightly with depth along the path.

## Validate

```bash
npm test
npm run build
npm run test:browser
FEED_FISH_TEST_MODE=production npm run test:browser
```

Browser tests use system Chromium in the cloud. Elsewhere, set `CHROMIUM_EXECUTABLE_PATH` to your Chromium installation. They start and stop their own server on port 5173, so stop a manually started dev server first. With a server already running, `npm run check:running` verifies the machine purchase, refill, spending, and throwing in a separate browser session.

## Art and simulation

- `public/art/pond.png`: original Tivoli-inspired garden scenery, with corrected benches, paving, ironwork, and architecture reflections.
- `public/art/animals.png` and `animals.json`: transparent animal sprite sheet and explicit frame rectangles.
- `public/art/fish-swimmers.png` and `fish-swimmers.json`: golden, common, and young carp swimming atlas, with eight headings and two tail strokes each. Natural carp snouts, scales, low dorsal fins, and one attached forked tail replace the ornate goldfish shapes. Internal frame IDs remain `koi`, `carp`, and `minnow`.
- `public/art/bird-swimmers.png` and `bird-swimmers.json`: original floating mallard, gull, and coot atlas, with eight headings and two paddling poses each.
- `public/art/machine.png`: original round-globe, red-body pellet dispenser, with an animated chrome crank overlaid in the UI.
- `public/art/scene-machine.png` and `scene-machine.json`: separate garden machine on an iron pedestal, grounded on the path and clickable without throwing pellets.
- `public/art/garden-observers.png` and `garden-observers.json`: transparent visitor atlas with 24 trimmed walking and watching cuts and a shared foot baseline.
- `public/art/hand.png`: original hand used for collecting pellets at the machine.
- `public/art/right-hand-cup.png`, `right-hand-quick.png`, `right-hand-overhand.png`, and `right-hand-spread.png`: four right-hand/long-forearm cutouts for holding, quick release, pronated overhand release, and a fanned spread release.
- `public/art/right-arm-throws.json`: a multi-texture atlas with twelve named motion stages, reusing the four checked drawings with grip pivots. The earlier `throw-hand.png` is retained as an art source.
- `src/vending.ts`: coin price, twenty-throw servings, and the guarded dispenser cycle.
- `src/simulation.ts`: arcing flights, air/water reactions, movement patterns, food competition, and chewing.
- `src/game.ts`: rendering, throws, hand motion, and landing ripples.
- `src/appearance.ts`: directional frame names and stable heading selection while turning.
- `src/throws.ts`: weighted throw choices, hand motion keyframes, and lucky-pellet chance and bonus.
- `src/observers.ts`: visitor routes, age-dependent watching time, and variable foot traffic.
- `src/observer-art.ts`: visitor pose selection and height relative to the garden benches.

Sprites use nearest-neighbor scaling. The original side-view animal sheet is retained as an art source; the game and field guide use the new swimming atlases. Explicit trimmed rectangles and a shared frame size preserve transparent padding around every pose. The supplied vending-machine reference page was blocked by the cloud network policy, so the machine art uses the described classic round-globe form. Repository wiki notes were unavailable during initial setup.

For the image audit and decisions, see [the art review](docs/art-review.md). Generate a contact sheet of all 48 actual fish crops and six full-detail garden regions with:

```bash
npm run review:art
```

The review command rejects missing directions or visitor poses, out-of-bounds cuts, overlapping rectangles, and PNG/atlas size mismatches before saving images under ignored `test-results/art-review`. It also renders all 24 actual visitor cuts and checks their common foot baseline. When replacing generated source art, `node scripts/build-art-atlas.mjs fish`, `machine`, or `observers` reads alpha to rebuild frame metadata without altering PNG pixels. Inspect every resulting pose before committing the art; the bounds checks cannot judge anatomy or perspective.

Use `npm run review:hands` for close-ups of every actual throw stage and a full-forearm sheet under ignored `test-results/hand-review`. The hand review validates frame names, source bounds and dimensions; finger counts and wrist anatomy require visual inspection. `node scripts/build-art-atlas.mjs hand` packages the four individual cutouts without editing their pixels. See [the throw review](docs/throw-review.md) for the animation and anatomy checks.
