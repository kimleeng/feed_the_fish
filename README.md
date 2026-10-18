# Feed the fish

An untimed, cozy browser game inspired by feeding fish at Tivoli Gardens in Copenhagen. The garden has an ivory Moorish facade, a Chinese-style pavilion, green ironwork, and benches facing the lake. A red round-globe pellet machine stands on the path beside the dock: click a 5 kr game coin, watch the chrome handle spin, and hold out a hand for ten throws. The money counter records pretend spending during this visit; the game has no payment service.

There is no countdown or game-over screen. Throw a little food, watch the pond, and refill whenever you like. Unused throws carry over when you buy another serving. Points credit the amount fish and the secret turtle actually eat, and the food-share meter shows the fish's share of all eaten pellets. Your best kindness score is saved in this browser.

The pond opens directly with a compact hand counter, score, and feeding controls. **Assist mode** is off by default: the introduction, instructions, tips, food-share details, and field guide appear only when enabled. This lets players discover the wind and animal personalities by watching. The setting is saved in this browser when storage is available. Purchase price, serving size, and machine status remain visible in either mode.

## Develop

Requires Node.js 22.12+ (Node 24 is prepared in the cloud environment) and npm. No backend or API keys are required.

```bash
npm ci
npm run dev
```

Click or tap the water, press **Space**, or use **Throw pellets**. A person on the dock throws food from their hand toward your chosen point. Birds see the pellets while airborne and may intercept them near the surface; fish only react after they land on the water. Floating food is available to birds for a short time, while fish can still eat it after it sinks.

The dock character keeps their feet planted and a pellet pouch in the other hand. Three full-body motions use a quick underhand toss (60%), a raised overhand throw (30%), and a sideways spread throw (10%). Each moves through anticipation, windup, drive, open-hand release, follow-through, and recovery drawings before returning to rest. Food releases from the actual drawn hand, at a different height for each motion. The quick toss has a short flick; the overhand throw sends pellets on a higher arc; the spread throw fans four pellets across a wider patch centered on your aim. Wind bends the airborne paths and shifts their landing points, keeping targets inside the pond. Rapid clicks reserve throws in a queue, so every animation plays. Each queued throw records its own left or right direction. The character turns when that throw starts and keeps looking that way afterward, including with an empty hand; a throw directly ahead retains the previous direction. The hand indicator and pellet origin mirror with the character.

Each throw has an independent 2% chance of containing one lucky pellet. A gold star and **LUCKY PELLET** label appear over the palm before a lucky throw, and the golden pellet glints as it travels. The first fish to nibble that pellet earns **+50 bonus points**, golden ripples, a small star celebration, and an optional soft chime. The bonus is awarded once per pellet, even when fish share it. Birds can eat lucky pellets but earn no bonus. The score includes ordinary feeding points and lucky bonuses; the food-share meter still measures food amounts.

The hand icon beside **throws left** shows the next handful: four small pellets arranged in one of ten randomly shuffled layouts. Each accepted throw selects the next layout, with no repeats until the ten have been shown. Lucky handfuls alternate between two special layouts containing a golden pellet. Normal HUD refreshes, pauses, rejected throws, and refills keep the current picture. An empty hand appears when no throws remain. The icon is visible on desktop and phones.

Click or tap the **red machine beside the dock** for another ten throws. The **Pellet machine** button provides the same interaction for keyboard users. Sound is optional. There is no player pause button or pause shortcut; the simulation suspends automatically while the optional field guide is open or the page is hidden, then resumes when returning. **Begin a new visit** clears the current food, spending, and score and returns to the pond; the best saved score remains.

**Debug**, beside the throw controls, reveals boost meters for fish and birds, keeps the turtle visible underwater, and opens live metrics below the pond. The panel shows hunger, boosts, airborne birds, queued/airborne/floating/underwater pellets, food eaten by animal kind, wind, and machine stock. Its scrollable table lists each animal's action, hunger, boost charge, last meal, total eaten, and base chase pace. Debug starts off, works independently of Assist mode, and remembers its setting in this browser. A new visit keeps debug enabled while resetting the visit's metrics. Switching it off hides the meters and panel and returns the turtle to its usual feeding peeks. Boost behavior continues during normal play.

The machine holds **25 servings**, each worth ten throws. Its visible pellet level drops once per purchase, when the dispenser opens, in both the garden and the close-up dialog. The artwork shows the remaining food without a stock counter. When stock falls below five, a garden employee walks in from the left with a feed sack. Purchases can continue during the walk; the employee waits for any paid serving to finish, opens the lid, pours fresh pellets into the globe, closes it, and leaves. The level rises throughout the pour and stock returns to 25 after closing. New purchases wait while the machine is open, and an empty machine never takes a coin. Food already in your hand remains available to throw. Restocking costs no extra coins, pauses with the pond, and can repeat throughout a long visit. A new visit resets stock to 25 and sends the employee offstage.

## Animal movement

The pond has 46 fish and 15 birds across six field-guide profiles, plus one secret musk turtle. Every animal inherits a common baseline and overrides movement speed, vision, bite size, chewing time, and turn rate.

- Golden carp make slow, smooth glides.
- Common carp meander in soft curves.
- Young carp move together in small, darting shoals.
- Mallards prefer paddling, with short flights for food farther away.
- Gulls swim in wide loops and readily take wing for distant pellets.
- Little coots alternate quiet paddles and drifts near the edge, occasionally making a low flight for food.

Birds use distance from their position to the pellet's expected water landing point to choose a travel mode. Inside the inner radius they paddle; inside the flight band an eligible bird has a **50% chance of taking off**. A declined flight falls back to paddling within normal vision, otherwise the bird ignores the food. Beyond the outer radius they ignore the pellet. The bands are invisible and use game coordinates:

| Bird | Takeoff distance | Farthest flight |
| --- | ---: | ---: |
| Gull | 100 | 520 |
| Mallard | 180 | 360 |
| Coot | 150 | 260 |

A remaining-food-time check prevents a flight that would finish after the pellet sinks. Each bird rolls once per handful, shared across its four pellets, so a declined flight cannot retry every frame. Separate behavior randomness preserves pellet scatter and lucky-throw rolls. Each trip includes takeoff, directional wingbeats, a shadow on the water, and a gliding landing with ripples. Birds finish landing before eating and keep their chosen landing point if food disappears. Flying birds pass above collision bodies; ordinary body separation resumes on landing. Species flight bands, pace, height, wingbeat rate, and `BIRD_FLIGHT_CHANCE` live in `src/simulation.ts`.

Flight follows one continuous parabola: steady progress toward the landing point, a smooth rise to the species' peak height halfway through, and a smooth descent to the water. Takeoff and landing animation states do not divide the movement into separate segments. Wingbeat timing stays continuous when the faster takeoff strokes settle into cruise.

Every animal stores `lastAteAt` and `totalEaten` independently of its current eating animation, so other behavior can reuse feeding history. A meal counts as recent for **20 seconds after the latest bite**. Fish and paddling birds automatically use a full boost reserve while chasing food: **40% extra speed for up to two seconds**. Meters appear only in Debug mode, including while animals recharge. Gold means boosting, green means hungry, and muted blue means recently fed. Flight and the turtle keep their existing pace.

Boosts recharge while waiting, roaming, chewing, or flying. The base recharge takes 30 seconds with a recently-fed modifier of 1; hungry animals use a modifier of 2 for a **15-second full recharge**. When the 20-second meal window expires, recharge immediately returns to the hungry rate (an empty reserve after one meal therefore fills in 25 seconds if the animal does not eat again). Interrupted bursts retain their remaining charge and must refill before restarting. Waiting at an airborne pellet's landing point conserves the reserve. These settings and reusable energy helpers live in `src/animal-energy.ts`; the pond clock freezes them on pause, and a new visit resets history and energy.

Every species has eight directional views and four swimming poses per view. Intermediate tail and paddle poses smooth each cycle while preserving its original duration. Each animal keeps its profile size and appearance through every turn: birds share one crown-to-waterline height across headings, while fish and the turtle share one body length with consistent pond-depth foreshortening. Bird cycles retain a steady waterline and contain no painted water. Birds float low in the water, bob gently, and leave little wakes; they watch airborne food but can only catch it near the surface. Fish turn toward their swimming direction beneath a translucent layer of the pond's reflections and moving glints, so their shapes remain visible through the water.

Eating has its own drawings in every direction. Carp repeatedly open their round, puckered mouths and close them while working a bite; young carp nibble faster. Birds dip their bills, work the food, and lift their heads to swallow. The turtle slowly opens and closes its mouth above the reflections. Full bites take 2.6 seconds for golden carp, 1.5 for common carp, 0.65 for young carp, 2.2 for mallards, 0.9 for gulls, 1.8 for coots, and 5.4 for the turtle. Smaller scraps shorten that meal in proportion to the amount eaten, down to 55% of the full duration. Animals finish before seeking another pellet. Food and points are counted once when the bite is taken; repeated mouth movements do not consume more. The simulation's meal clock controls every pose, including the final swallow and return to rest, so suspending the pond freezes the animation and a new visit clears it. Reduced motion retains these feeding cues.

Feeding carp pitch their heads upward and let their tails hang deeper. Their lips break through the reflections while the bodies stay submerged, with a small ring at each mouth. The raised poses keep opening and closing their mouths. The same meal clock eases the tilt in and lowers the fish underwater before they swim on; even small scraps have a visible rise and dip. Above and below the surface, the renderer uses the same drawing and transform, revealing only the lip area above the water.

Animals steer around nearby bodies and gently separate when they touch. Collision circles are smaller than the artwork: their diameters are 28% of the fish's sprite size, 36% of the turtle's, and 40% of a bird's. Fins, tails, and feathers can overlap, while body centers keep some space, including around food. Smaller animals yield more to larger ones. Fish and the turtle avoid one another underwater; birds avoid other birds above them. Collision bodies stay inside the shoreline, and pause freezes collision handling along with movement.

The musk turtle is a quiet homage to a pet: a domed olive-brown shell, short webbed feet, and pale stripes along its head. It ambles at about 5.4 pixels per second and approaches nearby food at 18 pixels per second. Like fish, it ignores airborne pellets and can eat food after it sinks. Each bite brings its head above the reflections for at least five seconds, extending through a longer meal and a 0.75-second dip afterward. It holds still through this peek, with a gentle rise and a little ripple. Its shell stays submerged. Turtle meals earn ordinary kindness points without increasing the different-fish count; lucky bonuses still belong to the first fish to eat a lucky pellet.

The turtle stays hidden underwater between meals. During the feeding peek, its body becomes visible beneath the reflections while its raised head and a small ripple appear above them. Its body and head fade away together as it dips back underwater. Feeding and collisions continue while it is hidden. It stays out of the field guide, and pause and a new visit freeze/reset its peek along with the rest of the pond.

## Garden visitors

Kids and adults walk across the near garden path in either direction. Many turn toward the pond for a brief look, while a few linger. Baseline stopping chances are 70% for adults and 90% for kids; of those who stop, 16% of adults and 52% of kids choose a long watch. Brief stops last 4–11 seconds for adults and 6–15 seconds for kids; longer watches last 25–60 seconds and 40–90 seconds respectively.

There are twelve visitor designs: six adults and six kids. The newer Danish autumn set adds a sand coat with a blue scarf, a navy quilted jacket with a sage beanie, a moss raincoat with a burgundy scarf, two children in rain jackets and wellies, and an older child in a brick puffer and corduroys. New arrivals choose an outfit that is not already present in their age group whenever one is available. Each design keeps its own height, clothing, and complete walking frames, with a matching rear-facing pose when watching the pond.

Actual pellet releases and food eaten by fish or birds gently increase interest, making a stop a little more likely and slowing the remaining watching time. Interest starts decreasing after each visitor's own 5–10 second threshold without a throw. Nibbles increase interest in proportion to food eaten, and boosts are capped so regular feeding cannot keep anyone indefinitely. Queued clicks, unsuccessful throws, and refills do not count as visible throws. Kids remain more likely to watch for longer in both active and quiet periods.

Uneven arrivals keep about three visitors visible on average, usually two to four. Busy periods reduce the chance of another arrival, making more than eight unusual; ten is the absolute limit. Visitors reserve separate watching places on dry paving and resume their original route afterward. Pause and the field guide freeze their movement and watching time, and a new visit starts with a fresh small crowd. Foot traffic has its own random stream so it does not affect fish behavior or lucky throws.

The path has open cobblestone entrances at both image edges. Six shaded visitor designs (three adults and three kids) match the warm garden artwork, with back views for watching and grounded shadows. Adult heights are based on the existing benches, with individual size and path-depth variation.

Visitors and the employee use complete illustrated walking frames, including both legs, shoes, arms, and hands. The blue-jacket adult and yellow-jumper child have a four-key gait trial with 13 and 14 full poses respectively; the remaining designs retain their eight poses. The trial has distinct contact and passing drawings for each leg, with playback timed from the supporting shoes and actual travel. Shorter steps give a quicker cadence at the existing path speeds. The adult still has a visible gap after passing and needs more painted in-betweens. The runtime changes whole PNG frames.

Animation follows actual distance covered, including approaches to the rail. Visitors brake before watching, stop while watching, and accelerate as they leave. Their route bends gently toward and away from the railing. The employee uses the same acceleration and braking, waits with both feet planted, and retains the existing reaching, lifting, pouring, and closing animations.

## Wind and water

A gentle breeze changes direction and strength over time. Surface particles drift with it, fade in and out, and recycle within the pond mask. Paired light and shade keep the small ripples visible over the detailed reflections, including on phone screens. Stronger moments make the glints longer and brighter. The particles freeze on pause, restart for a new visit, and are hidden when reduced motion is preferred, including changes to that preference during play. Wind itself continues to update and record when decorative motion is reduced.

Airborne pellets use the same wind as the water. Their landing target drifts from hand release until splashdown, bending the arc smoothly; stronger gusts and longer flights cause more drift. Queued food waits for its own release, birds follow the updated landing target, and the shoreline keeps pellets inside the pond. Partial release and landing frames are included so replayed weather produces consistent landings across frame rates. Reduced motion hides decorative shimmer while preserving this gameplay behavior.

Wind is shared simulation state for both effects and future uses, independent of animal and throw randomness:

```ts
scene.world.wind.current;       // { time, direction, strength, x, y }
scene.world.wind.history;       // Timestamped snapshots at 0, 1, 2, ... seconds
scene.world.wind.sampleAt(12.5); // Reproduce any instant without changing state
scene.world.wind.seed;          // Seed for replaying this visit's weather
```

`time` counts unpaused simulation seconds. `direction` is radians clockwise from screen-right, and `strength` is normalized from 0 to 1. `x` and `y` are the direction vector multiplied by strength; each effect can apply its own movement scale. The `pond:state` event also carries the current snapshot as `detail.wind`. History lasts for the current visit and resets with **Begin a new visit**; it is not saved across reloads. Weather is evaluated from the seed and absolute simulation time, so the same seed and time reproduce the same wind at different frame rates.

## Music

**Sound on** plays *Lanterns on the Pond*, an original 90-second 8-bit melody inspired by Nordic folk phrasing and the fairy-tale mood of Hans Christian Andersen. A soft square-wave lead, a triangle bass, and plucked arpeggios move through a lilting 6/8 tune in D Dorian, with a quieter middle passage and a returning theme. The existing feeding and machine sounds play alongside it.

The visit starts silent. The first sound-button gesture renders the tune locally into one reusable looping buffer; no audio download is needed. Muting, opening the field guide, or hiding the page fades the music out, and returning resumes from its previous position. Repeated toggles keep one loop, with no stacking or timer-driven scheduling. Short attack/release envelopes, a soft filter, and a quiet loop boundary avoid harsh clicks. `src/music.ts` contains the composition and synth.

## Validate

```bash
npm test
npm run build
npm run test:browser
FEED_FISH_TEST_MODE=production npm run test:browser
```

Browser tests use system Chromium in the cloud. Elsewhere, set `CHROMIUM_EXECUTABLE_PATH` to your Chromium installation. They start and stop their own server on port 5173, so stop a manually started dev server first. With a server already running, `npm run check:running` verifies the machine purchase, refill, spending, and throwing in a separate browser session.

## Art and simulation

- `public/art/pond.png`: original Tivoli-inspired garden scenery, with corrected benches, paving, ironwork, architecture and broadleaf-tree reflections, and an open foreground walking path.
- `public/art/animals.png` and `animals.json`: transparent animal sprite sheet and explicit frame rectangles.
- `public/art/fish-swimmers.png` and `fish-swimmers.json`: golden, common, and young carp swimming atlas, with eight headings and two tail strokes each. Natural carp snouts, scales, low dorsal fins, and one attached forked tail replace the ornate goldfish shapes. Internal frame IDs remain `koi`, `carp`, and `minnow`.
- `public/art/bird-flyers.png` and `bird-flyers.json`: 48 directional flight poses in isolated, torso-anchored 320px slots, with a common scale through takeoff, wingbeats, and landing. `node scripts/build-art-atlas.mjs bird` rebuilds the flight sheet and metadata; `npm run review:art` validates every frame.
- `public/art/bird-*-swimming.png` and `bird-swimmers-animation.json`: consistent four-pose cycles in eight directions for mallards, gulls, and coots. Whole-body frames use the species' fixed height across headings and a shared waterline, with no painted water. `node scripts/build-bird-atlas.mjs` rebuilds their registration without changing PNG pixels. The original `bird-swimmers.png`/`.json` remain as archived artwork and field-guide art.
- `public/art/turtle-swimmer.png` and `turtle-swimmer.json`: musk turtle atlas with sixteen swimming cuts and eight separate raised heads. `turtle-swimmer-pins.json` aligns the heads with the swimming artwork.
- `public/art/eating-*.png` and `animal-eating-animation.json`: 192 feeding drawings, including the tilted carp poses and their lip reveal rectangles. `node scripts/build-eating-atlas.mjs` rebuilds their registration without modifying the PNGs. `src/eating.ts` derives every pose and surface transition from the current meal.
- `src/appearance.ts` defines shared physical artwork dimensions. `node scripts/build-animation-atlases.mjs` applies these to all animal frames; `scripts/register-swimmer-dimensions.mjs` measures submerged silhouettes along their body axis, preserving their aspect ratios and aligning the surfaced turtle head. Changing direction never changes an animal's profile, size, or tint.
- `public/art/machine.png`: original round-globe, red-body pellet dispenser, with an animated chrome crank overlaid in the UI.
- `public/art/scene-machine.png` and `scene-machine.json`: separate garden machine on an iron pedestal, grounded on the path and clickable without throwing pellets.
- `public/art/machine-empty.png` and `scene-machine-empty.png`: registered empty-globe counterparts of the original machine artwork; `scene-machine-empty.json` includes the hinged lid cut.
- `public/art/pellet-stock.png` and `pellet-stock.json`: 25 complete pellet-pile illustrations, one per remaining serving, shared by the garden and dialog. Each drawing retains whole pellets and rests on the same baseline. Empty hides the pile; restocking advances through the drawings in reverse. Regenerate atlas metadata with `node scripts/build-pellet-stock-atlas.mjs` without changing the source PNG.
- `public/art/garden-employee.png` and `garden-employee.json`: four walking poses and four restocking poses, with a shared hip/sole alignment. `garden-employee-pins.json` locates the feed sack opening for the falling pellets.
- `public/art/garden-observers.png` and `garden-observers.json`: transparent visitor atlas with 30 trimmed walking and watching cuts, hip/sole anchors, and measured stride ratios.
- `public/art/dock-thrower.png` and `dock-thrower.json`: twelve full-body throw stages aligned at the planted feet.
- `public/art/dock-thrower-pins.json`: source-image hand annotations used to generate atlas hand pins and release offsets.
- `public/art/hand.png`: original hand used for collecting pellets at the machine.
- `public/art/hand-icons.png`: 4×4 HUD sheet; ten regular handfuls, two lucky handfuls, and an empty palm. `src/hand-icon.ts` shuffles each deck independently of gameplay randomness.
- `public/art/right-hand-*.png`, `right-arm-throws.json`, and `throw-hand.png`: retained artwork from the earlier foreground-arm version.
- `src/vending.ts`: coin price, servings of ten throws, and the guarded dispenser cycle.
- `src/restocking.ts`: the 25-serving machine's employee arrival, wait, refill, and departure; `src/employee-art.ts` and `employee-pins.ts` align walking distance, planted work poses, and the pouring sack.
- `src/simulation.ts`: arcing flights, air/water reactions, movement patterns, food competition, and chewing.
- `src/animal-energy.ts`: reusable feeding history, recent-meal checks, and hunger-based boost recharge.
- `src/debug-metrics.ts`: read-only debug snapshots of animal history, energy, flights, and pellet phases.
- `src/game.ts`: rendering, dock-character motion, and landing ripples.
- `src/wind.ts`: shared seeded breeze, current state, per-second visit history, and replay.
- `src/water.ts`: the wind-driven surface shimmer particle pool.
- `src/appearance.ts`: directional frame names and stable heading selection while turning.
- `src/turtle.ts` and `turtle-pins.ts`: underwater visibility, feeding peek timing, and generated head offsets.
- `src/throws.ts`: weighted throw choices, full-body pose timing, per-motion release origins, and lucky-pellet chance and bonus.
- `src/thrower-art.ts` and `thrower-pins.ts`: dock placement, character height, and calibrated release positions.
- `src/observers.ts`: visitor routes, age-dependent watching time, and variable foot traffic.
- `src/observer-art.ts`, `employee-art.ts`, and `walking-gait.ts`: character sizing, whole-frame selection, and measured walking distances. `observer-gait.ts` retains measurements for the archived authored walk cycles.
- `src/walking.ts`: distance-based step timing, acceleration, braking, and path easing shared by visitors and the employee.
- `public/art/observer-*-walking.png`, `employee-walking.png`, and `people-walking.json`: complete walk sheets for all thirteen designs. The blue-jacket adult and yellow-jumper child use `*-walking-smooth.png` trial sheets; all original sheets remain available. The six autumn visitor sheets include a ninth rear-facing watching pose. `art-source/walking` contains the trial's source cycles and supporting-shoe annotations. `node scripts/build-walking-atlas.mjs` uniformly normalizes those full cycles and rebuilds atlas rectangles, alignment, pose phases, and walking distances.

Sprites use nearest-neighbor scaling. The original side-view animal sheet is retained as an art source; the game and field guide use the new swimming atlases. Explicit trimmed rectangles and a shared frame size preserve transparent padding around every pose. The supplied vending-machine reference page was blocked by the cloud network policy, so the machine art uses the described classic round-globe form. Repository wiki notes were unavailable during initial setup.

For the image audit and decisions, see [the art review](docs/art-review.md) and [the throw review](docs/throw-review.md). Generate contact sheets of all actual fish, visitor, and dock-character crops and six full-detail garden regions with:

```bash
npm run review:art
```

The review command rejects missing poses, out-of-bounds cuts, overlapping rectangles, and PNG/atlas size mismatches before saving images under ignored `test-results/art-review`. It also checks body anchors and foot baselines and renders the dock character's hand pins over a separate review sheet. When replacing generated source art, `node scripts/build-art-atlas.mjs fish`, `turtle`, `machine`, `observers`, `thrower`, or `employee` reads alpha to rebuild frame metadata without altering PNG pixels. Observer packaging regenerates `src/observer-gait.ts`; thrower packaging reads the hand annotations and regenerates `src/thrower-pins.ts`; turtle packaging reads the head annotations and regenerates `src/turtle-pins.ts`; employee packaging uses the sack opening and foot contacts to regenerate `src/employee-pins.ts`. Inspect every resulting pose before committing the art; bounds checks cannot judge anatomy or perspective.

`node scripts/review-walking.mjs http://127.0.0.1:5173` reviews the current walking drawings against a running game. It saves all thirteen pose sheets, garden and watching scenes, actual movement samples, and separate adult/child looping GIFs at game size in both directions (FFmpeg required). Browser checks cover frame selection, whole PNG rendering, uniform scale, sole baselines, annotated painted supporting shoes, and watching behavior. Authored-pose checks do not establish continuous foot locking or a natural gait; inspect the motion previews too.

`npm run review:hands` and `node scripts/build-art-atlas.mjs hand` remain available for reviewing and packaging the archived foreground-arm artwork.
