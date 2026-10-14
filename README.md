# Feed the fish

An untimed, cozy browser game inspired by feeding fish at Tivoli Gardens in Copenhagen. The garden has an ivory Moorish facade, a Chinese-style pavilion, green ironwork, and benches facing the lake. A red round-globe pellet machine stands on the path beside the dock: click a 5 kr game coin, watch the chrome handle spin, and hold out a hand for ten throws. The money counter records pretend spending during this visit; the game has no payment service.

There is no countdown or game-over screen. Throw a little food, watch the pond, and refill whenever you like. Unused throws carry over when you buy another serving. Points credit the amount fish actually eat, and the food-share meter shows how much went to fish versus birds. Your best kindness score is saved in this browser.

## Develop

Requires Node.js 22.12+ (Node 24 is prepared in the cloud environment) and npm. No backend or API keys are required.

```bash
npm ci
npm run dev
```

Click or tap the water, press **Space**, or use **Throw pellets**. A person on the dock throws food from their hand toward your chosen point. Birds see the pellets while airborne and may intercept them near the surface; fish only react after they land on the water. Floating food is available to birds for a short time, while fish can still eat it after it sinks.

The dock character keeps their feet planted and a pellet pouch in the other hand. Three full-body motions use a quick underhand toss (60%), a raised overhand throw (30%), and a sideways spread throw (10%). Each has a separate windup, open-hand release, and follow-through before returning to rest. Food releases from the actual drawn hand, at a different height for each motion. The quick toss has a short flick; the overhand throw sends pellets on a higher arc; the spread throw fans four pellets across a wider patch centered on your aim. Targets remain inside the pond. Rapid clicks reserve throws in a queue, so every animation plays. Pause freezes the character's pose and queued releases.

Each throw has an independent 2% chance of containing one lucky pellet. A gold star and **LUCKY PELLET** label appear over the palm before a lucky throw, and the golden pellet glints as it travels. The first fish to nibble that pellet earns **+50 bonus points**, golden ripples, a small star celebration, and an optional soft chime. The bonus is awarded once per pellet, even when fish share it. Birds can eat lucky pellets but earn no bonus. The score includes ordinary feeding points and lucky bonuses; the food-share meter still measures food amounts.

Click or tap the **red machine beside the dock** for another ten throws. The **Pellet machine** button provides the same interaction for keyboard users. **P** and the pause button pause the pond. The field guide pauses while open. Sound is optional. **Begin a new visit** clears the current food, spending, and score and returns to the machine; the best saved score remains.

## Animal movement

The pond has 46 fish and 15 birds across six profiles. Every animal inherits a common baseline and overrides movement speed, vision, bite size, chewing time, and turn rate.

- Golden carp make slow, smooth glides.
- Common carp meander in soft curves.
- Young carp move together in small, darting shoals.
- Mallards paddle with a gentle side-to-side rhythm.
- Gulls swim in wide loops and watch for pellets arriving at the water.
- Little coots alternate quiet paddle strokes with slower drifts near the edge.

Every species has eight directional views and two swimming poses per view. Birds float low in the water, bob gently, and leave little wakes; they watch airborne food but can only catch it near the surface. Fish turn toward their swimming direction beneath a translucent layer of the pond's reflections and moving glints, so their shapes remain visible through the water.

Animals steer around nearby bodies and gently separate when they touch. Collision circles are smaller than the artwork: their diameters are 28% of the fish's sprite size and 40% of a bird's. Fins, tails, and feathers can overlap, while body centers keep some space, including around food. Smaller animals yield more to larger ones. Fish avoid other fish and birds avoid other birds; submerged fish can swim beneath a bird. Collision bodies stay inside the shoreline, and pause freezes collision handling along with movement.

## Garden visitors

Kids and adults walk across the near garden path in either direction. Many turn toward the pond for a brief look, while a few linger. Baseline stopping chances are 70% for adults and 90% for kids; of those who stop, 16% of adults and 52% of kids choose a long watch. Brief stops last 4–11 seconds for adults and 6–15 seconds for kids; longer watches last 25–60 seconds and 40–90 seconds respectively.

Actual pellet releases and food eaten by fish or birds gently increase interest, making a stop a little more likely and slowing the remaining watching time. Interest starts decreasing after each visitor's own 5–10 second threshold without a throw. Nibbles increase interest in proportion to food eaten, and boosts are capped so regular feeding cannot keep anyone indefinitely. Queued clicks, unsuccessful throws, and refills do not count as visible throws. Kids remain more likely to watch for longer in both active and quiet periods.

Uneven arrivals keep about three visitors visible on average, usually two to four. Busy periods reduce the chance of another arrival, making more than eight unusual; ten is the absolute limit. Visitors reserve separate watching places on dry paving and resume their original route afterward. Pause and the field guide freeze their movement and watching time, and a new visit starts with a fresh small crowd. Foot traffic has its own random stream so it does not affect fish behavior or lucky throws.

The path has open cobblestone entrances at both image edges. Six shaded, detailed visitor designs (three adults and three kids) match the warm garden artwork, with four alternating walking poses, back views for watching, and grounded shadows. Poses align at the hips and soles so changing foot positions does not shift the entire body. Walking progresses with actual distance traveled, including movement toward the rail. Each design's two contact poses determine its stride length; taller adults take longer steps than kids, with individual size and path-depth variation. Adult heights are based on the existing benches.

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
- `public/art/garden-observers.png` and `garden-observers.json`: transparent visitor atlas with 30 trimmed walking and watching cuts, hip/sole anchors, and measured stride ratios.
- `public/art/dock-thrower.png` and `dock-thrower.json`: twelve full-body throw stages aligned at the planted feet.
- `public/art/dock-thrower-pins.json`: source-image hand annotations used to generate atlas hand pins and release offsets.
- `public/art/hand.png`: original hand used for collecting pellets at the machine.
- `public/art/right-hand-*.png`, `right-arm-throws.json`, and `throw-hand.png`: retained artwork from the earlier foreground-arm version.
- `src/vending.ts`: coin price, servings of ten throws, and the guarded dispenser cycle.
- `src/simulation.ts`: arcing flights, air/water reactions, movement patterns, food competition, and chewing.
- `src/game.ts`: rendering, dock-character motion, and landing ripples.
- `src/appearance.ts`: directional frame names and stable heading selection while turning.
- `src/throws.ts`: weighted throw choices, full-body pose timing, per-motion release origins, and lucky-pellet chance and bonus.
- `src/thrower-art.ts` and `thrower-pins.ts`: dock placement, character height, and calibrated release positions.
- `src/observers.ts`: visitor routes, age-dependent watching time, and variable foot traffic.
- `src/observer-art.ts` and `observer-gait.ts`: visitor pose selection, height relative to the benches, and distance per walking cycle.

Sprites use nearest-neighbor scaling. The original side-view animal sheet is retained as an art source; the game and field guide use the new swimming atlases. Explicit trimmed rectangles and a shared frame size preserve transparent padding around every pose. The supplied vending-machine reference page was blocked by the cloud network policy, so the machine art uses the described classic round-globe form. Repository wiki notes were unavailable during initial setup.

For the image audit and decisions, see [the art review](docs/art-review.md) and [the throw review](docs/throw-review.md). Generate contact sheets of all actual fish, visitor, and dock-character crops and six full-detail garden regions with:

```bash
npm run review:art
```

The review command rejects missing poses, out-of-bounds cuts, overlapping rectangles, and PNG/atlas size mismatches before saving images under ignored `test-results/art-review`. It also checks body anchors and foot baselines and renders the dock character's hand pins over a separate review sheet. When replacing generated source art, `node scripts/build-art-atlas.mjs fish`, `machine`, `observers`, or `thrower` reads alpha to rebuild frame metadata without altering PNG pixels. Observer packaging regenerates `src/observer-gait.ts`; thrower packaging reads the hand annotations and regenerates `src/thrower-pins.ts`. Inspect every resulting pose before committing the art; bounds checks cannot judge anatomy or perspective.

`npm run review:hands` and `node scripts/build-art-atlas.mjs hand` remain available for reviewing and packaging the archived foreground-arm artwork.
