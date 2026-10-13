# Feed the fish

An untimed, cozy browser game inspired by feeding fish at Tivoli. Start at the round-globe pellet machine: click a 5 kr game coin, watch the chrome handle spin, and hold out a hand for twenty throws. The money counter records pretend spending during this visit; the game has no payment service.

There is no countdown or game-over screen. Throw a little food, watch the pond, and refill whenever you like. Unused throws carry over when you buy another serving. Points credit the amount fish actually eat, and the food-share meter shows how much went to fish versus birds. Your best kindness score is saved in this browser.

## Develop

Requires Node.js 22.12+ (Node 24 is prepared in the cloud environment) and npm. No backend or API keys are required.

```bash
npm ci
npm run dev
```

Click or tap the water, press **Space**, or use **Throw pellets**. Every throw travels in an arc from the same dock position toward your chosen point. Birds see the pellets while airborne and may intercept them; fish only react after they land on the water. Floating food is available to birds for a short time, while fish can still eat it after it sinks.

Use **Pellet machine** for another twenty throws. **P** and the pause button pause the pond. The field guide pauses while open. Sound is optional. **Begin a new visit** clears the current food, spending, and score and returns to the machine; the best saved score remains.

## Animal movement

The pond has 46 fish and 15 birds across six profiles. Every animal inherits a common baseline and overrides movement speed, vision, bite size, chewing time, and turn rate.

- Golden koi make slow, smooth glides.
- Silver carp meander in soft curves.
- Minnows move together in small, darting shoals.
- Mallards paddle with a gentle side-to-side rhythm.
- Gulls sweep in wide circles and pursue airborne pellets.
- Garden doves alternate little hops with rests near the edge.

## Validate

```bash
npm test
npm run build
npm run test:browser
FEED_FISH_TEST_MODE=production npm run test:browser
```

Browser tests use system Chromium in the cloud. Elsewhere, set `CHROMIUM_EXECUTABLE_PATH` to your Chromium installation. They start and stop their own server on port 5173, so stop a manually started dev server first. With a server already running, `npm run check:running` verifies the machine purchase, refill, spending, and throwing in a separate browser session.

## Art and simulation

- `public/art/pond.png`: original garden scenery.
- `public/art/animals.png` and `animals.json`: transparent animal sprite sheet and explicit frame rectangles.
- `public/art/machine.png`: original round-globe, red-body pellet dispenser, with an animated chrome crank overlaid in the UI.
- `public/art/hand.png`: original hand used for collecting pellets and throwing from the dock.
- `src/vending.ts`: coin price, twenty-throw servings, and the guarded dispenser cycle.
- `src/simulation.ts`: arcing flights, air/water reactions, movement patterns, food competition, and chewing.
- `src/game.ts`: rendering, throws, hand motion, and landing ripples.

Sprites use nearest-neighbor scaling. Minnows and doves reuse smaller/tinted carp and gull art. The supplied vending-machine reference page was blocked by the cloud network policy, so the machine art uses the described classic round-globe form. Repository wiki notes were unavailable during initial setup.
