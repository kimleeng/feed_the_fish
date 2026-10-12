# Feed the fish

A cozy browser game inspired by a family afternoon feeding fish at Tivoli. Scatter food into the pond and try to feed the fish before the birds steal the floating crumbs. Original pixel-art scenery and a four-frame animal sprite atlas are included.

The pond has 46 fish and 15 birds across six profiles. Each inherits a common animal baseline and overrides movement speed, sight range, bite size, and chewing time. Fish can eat sinking food; birds can only reach food while it floats. The fish-food percentage counts the amount actually eaten by each group, and “happy fish” counts distinct fish fed.

## Develop

Requires Node.js 22.12+ (Node 24 is prepared in the cloud environment) and npm. No backend, API keys, or external services are required.

```bash
npm ci
npm run dev
```

Click or tap the water to throw four little crumbs, or use **Space** and the **Scatter food** button. **P** pauses. The 90-second round begins with the first handful. The field guide pauses the game while open. Sound is optional, and your best completed round is saved in this browser.

## Validate

```bash
npm test
npm run build
npm run test:browser
FEED_FISH_TEST_MODE=production npm run test:browser
```

Browser tests use `/usr/bin/chromium` in the cloud environment. Elsewhere, set `CHROMIUM_EXECUTABLE_PATH` to your Chromium installation. Tests start and stop a server on port 5173. Stop a manually started dev server first to ensure the production check uses the production output.

With a development server already running, `npm run check:running` verifies artwork loading, rendering, and feeding input in a separate browser session without starting another server.

## Art and simulation

- `public/art/pond.png`: original garden-pond scenery.
- `public/art/animals.png`: original transparent 4 × 4 pixel-art sprite sheet; koi, carp, mallard, and gull rows, with swimming/walking and eating frames.
- `public/art/animals.json`: explicit frame rectangles, including the sheet’s uneven pixel dimensions.
- `src/simulation.ts`: rendering-independent animal profiles, food competition, bites, and chewing.
- `src/game.ts`: Phaser sprites, input, ripples, and feeding feedback.

Sprites use nearest-neighbor scaling. Minnows and garden doves reuse tinted, smaller versions of the carp and gull art. The initial version has one pond and one timed game mode. The repository wiki could not be accessed during setup; its notes have not been incorporated.
