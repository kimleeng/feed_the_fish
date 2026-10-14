# Feed the fish

An untimed, cozy browser game inspired by feeding fish at Tivoli Gardens in Copenhagen. The garden has an ivory Moorish facade, a Chinese-style pavilion, green ironwork, and benches facing the lake. A red round-globe pellet machine stands on the path beside the dock: click a 5 kr game coin, watch the chrome handle spin, and hold out a hand for ten throws. The money counter records pretend spending during this visit; the game has no payment service.

There is no countdown or game-over screen. Throw a little food, watch the pond, and refill whenever you like. Unused throws carry over when you buy another serving. Points credit the amount fish and the secret turtle actually eat, and the food-share meter shows the fish's share of all eaten pellets. Your best kindness score is saved in this browser.

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

The machine holds **25 servings**, each worth ten throws. Its visible pellet level drops once per purchase, when the dispenser opens, in both the garden and the close-up dialog. The dialog also shows the remaining servings. When stock falls below five, a garden employee walks in from the left with a feed sack. Purchases can continue during the walk; the employee waits for any paid serving to finish, opens the lid, pours fresh pellets into the globe, closes it, and leaves. The level rises throughout the pour and stock returns to 25 after closing. New purchases wait while the machine is open, and an empty machine never takes a coin. Food already in your hand remains available to throw. Restocking costs no extra coins, pauses with the pond, and can repeat throughout a long visit. A new visit resets stock to 25 and sends the employee offstage.

## Animal movement

The pond has 46 fish and 15 birds across six field-guide profiles, plus one secret musk turtle. Every animal inherits a common baseline and overrides movement speed, vision, bite size, chewing time, and turn rate.

- Golden carp make slow, smooth glides.
- Common carp meander in soft curves.
- Young carp move together in small, darting shoals.
- Mallards paddle with a gentle side-to-side rhythm.
- Gulls swim in wide loops and watch for pellets arriving at the water.
- Little coots alternate quiet paddle strokes with slower drifts near the edge.

Every species has eight directional views and two swimming poses per view. Birds float low in the water, bob gently, and leave little wakes; they watch airborne food but can only catch it near the surface. Fish turn toward their swimming direction beneath a translucent layer of the pond's reflections and moving glints, so their shapes remain visible through the water.

Animals steer around nearby bodies and gently separate when they touch. Collision circles are smaller than the artwork: their diameters are 28% of the fish's sprite size, 36% of the turtle's, and 40% of a bird's. Fins, tails, and feathers can overlap, while body centers keep some space, including around food. Smaller animals yield more to larger ones. Fish and the turtle avoid one another underwater; birds avoid other birds above them. Collision bodies stay inside the shoreline, and pause freezes collision handling along with movement.

The musk turtle is a quiet homage to a pet: a domed olive-brown shell, short webbed feet, and pale stripes along its head. It ambles at about 5.4 pixels per second and approaches nearby food at 18 pixels per second. Like fish, it ignores airborne pellets and can eat food after it sinks. Each small bite brings its head above the reflections for five seconds, with a gentle rise, a little ripple, and a slow dip back underwater. Its shell stays submerged. Turtle meals earn ordinary kindness points without increasing the different-fish count; lucky bonuses still belong to the first fish to eat a lucky pellet.

For now, the turtle's underwater body stays visible like the fish. Set `SHOW_TURTLE_UNDERWATER` to `false` in `src/turtle.ts` when it should be hidden between meals; only its surfaced head will then appear after eating. This changes visibility only, so feeding and collisions work in either mode. It stays out of the field guide, and pause and a new visit freeze/reset its peek along with the rest of the pond.

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
- `public/art/turtle-swimmer.png` and `turtle-swimmer.json`: musk turtle atlas with sixteen swimming cuts and eight separate raised heads. `turtle-swimmer-pins.json` aligns the heads with the swimming artwork.
- `public/art/machine.png`: original round-globe, red-body pellet dispenser, with an animated chrome crank overlaid in the UI.
- `public/art/scene-machine.png` and `scene-machine.json`: separate garden machine on an iron pedestal, grounded on the path and clickable without throwing pellets.
- `public/art/machine-empty.png` and `scene-machine-empty.png`: registered empty-globe counterparts of the original machine artwork; `scene-machine-empty.json` includes the hinged lid cut.
- `public/art/pellet-stock.png` and `pellet-stock.json`: 25 complete pellet-pile illustrations, one per remaining serving, shared by the garden and dialog. Each drawing retains whole pellets and rests on the same baseline. Empty hides the pile; restocking advances through the drawings in reverse. Regenerate atlas metadata with `node scripts/build-pellet-stock-atlas.mjs` without changing the source PNG.
- `public/art/garden-employee.png` and `garden-employee.json`: four walking poses and four restocking poses, with a shared hip/sole alignment. `garden-employee-pins.json` locates the feed sack opening for the falling pellets.
- `public/art/garden-observers.png` and `garden-observers.json`: transparent visitor atlas with 30 trimmed walking and watching cuts, hip/sole anchors, and measured stride ratios.
- `public/art/dock-thrower.png` and `dock-thrower.json`: twelve full-body throw stages aligned at the planted feet.
- `public/art/dock-thrower-pins.json`: source-image hand annotations used to generate atlas hand pins and release offsets.
- `public/art/hand.png`: original hand used for collecting pellets at the machine.
- `public/art/right-hand-*.png`, `right-arm-throws.json`, and `throw-hand.png`: retained artwork from the earlier foreground-arm version.
- `src/vending.ts`: coin price, servings of ten throws, and the guarded dispenser cycle.
- `src/restocking.ts`: the 25-serving machine's employee arrival, wait, refill, and departure; `src/employee-art.ts` and `employee-pins.ts` align walking distance, planted work poses, and the pouring sack.
- `src/simulation.ts`: arcing flights, air/water reactions, movement patterns, food competition, and chewing.
- `src/game.ts`: rendering, dock-character motion, and landing ripples.
- `src/appearance.ts`: directional frame names and stable heading selection while turning.
- `src/turtle.ts` and `turtle-pins.ts`: underwater visibility, feeding peek timing, and generated head offsets.
- `src/throws.ts`: weighted throw choices, full-body pose timing, per-motion release origins, and lucky-pellet chance and bonus.
- `src/thrower-art.ts` and `thrower-pins.ts`: dock placement, character height, and calibrated release positions.
- `src/observers.ts`: visitor routes, age-dependent watching time, and variable foot traffic.
- `src/observer-art.ts` and `observer-gait.ts`: visitor pose selection, height relative to the benches, and distance per walking cycle.

Sprites use nearest-neighbor scaling. The original side-view animal sheet is retained as an art source; the game and field guide use the new swimming atlases. Explicit trimmed rectangles and a shared frame size preserve transparent padding around every pose. The supplied vending-machine reference page was blocked by the cloud network policy, so the machine art uses the described classic round-globe form. Repository wiki notes were unavailable during initial setup.

For the image audit and decisions, see [the art review](docs/art-review.md) and [the throw review](docs/throw-review.md). Generate contact sheets of all actual fish, visitor, and dock-character crops and six full-detail garden regions with:

```bash
npm run review:art
```

The review command rejects missing poses, out-of-bounds cuts, overlapping rectangles, and PNG/atlas size mismatches before saving images under ignored `test-results/art-review`. It also checks body anchors and foot baselines and renders the dock character's hand pins over a separate review sheet. When replacing generated source art, `node scripts/build-art-atlas.mjs fish`, `turtle`, `machine`, `observers`, `thrower`, or `employee` reads alpha to rebuild frame metadata without altering PNG pixels. Observer packaging regenerates `src/observer-gait.ts`; thrower packaging reads the hand annotations and regenerates `src/thrower-pins.ts`; turtle packaging reads the head annotations and regenerates `src/turtle-pins.ts`; employee packaging uses the sack opening and foot contacts to regenerate `src/employee-pins.ts`. Inspect every resulting pose before committing the art; bounds checks cannot judge anatomy or perspective.

`npm run review:hands` and `node scripts/build-art-atlas.mjs hand` remain available for reviewing and packaging the archived foreground-arm artwork.
