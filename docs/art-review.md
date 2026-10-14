# Garden and fish image review

The review covered every rendered fish atlas cut (three profiles × eight headings × two tail strokes), all six regions of the complete pond image at full detail, and the assembled desktop and phone scene.

| Area | Finding | Revision |
| --- | --- | --- |
| Fish silhouette | The old fish had oversized goldfish fins. Several poses made a dorsal fin or a broad caudal lobe look like an additional tail. | Natural carp bodies, smaller eyes, blunt snouts with short barbels, diamond scales, low dorsal fins, small pectoral fins, and one modest forked caudal fin attached at one tail stalk. |
| Fish atlas | Eight pairs of old frame rectangles overlapped. Stray marks from neighboring poses were visible in the contact sheet, particularly among the small fish. | More transparent space between sprites, rebuilt explicit cuts, and bounds/overlap validation. All 48 final crops were inspected for anatomy, complete fins, direction, and neighboring pixels. |
| Fish identity | Ornate goldfish shapes and a blue “silver carp” palette did not suit the requested carp pond. | Golden carp, olive-bronze common carp, and pale olive-gray young carp. Field-guide portraits, names, descriptions, and the header fish use the revised art. Internal atlas IDs remain compatible with existing simulation data. |
| Benches | The benches faced away from the pond. Seat/arm joins, leg angles, and ground contact were inconsistent. | Matching green slat-and-iron benches facing the pond, with clearer connected supports and feet planted on the paving. |
| Garden identity | The old pavilion and buildings suggested a generic European garden. | An ivory, onion-domed Moorish facade inspired by Nimb, a Chinese-style lakeside pavilion, garden bulbs, green ironwork, and floral beds evoke Tivoli Gardens in Copenhagen. This is a stylized garden composition, not a reconstruction of the park's geography. |
| Garden construction | Rail/planter joins, lamp bases, and foreground paving had uneven geometry. | Clearer rail endpoints and posts, grounded lamps and planters, a continuous cobblestone path, and a level feeding platform. |
| Water and planting | Bright reflection columns were not clearly related to the distant architecture; some flowers/pads had ambiguous connections. | Facade and pavilion reflections aligned beneath the buildings; clearer lily-pad flowers and shore planting. The central lake remains open for moving animals. |
| Pellet machine | The machine existed only in a dialog and felt detached from the garden. | A separate red globe machine on a green iron pedestal stands on the dry path left of the dock, with a contact shadow and a legible 5 kr plaque. Clicking or tapping it opens the existing coin ritual. |

The final fish contact sheet has 48 complete single-tail silhouettes and no neighboring-frame marks. The new garden was reviewed for support connections, ground contact, perspective, shore continuity, lily pads, reflections, and consistent warm lighting. The moving fish still render beneath the translucent water reflections; birds remain above them.

## Visitors and open path, 14 October 2026

The original flat 32×48 visitor drawings were replaced with six detailed shaded designs: three adults and three children. Clothing folds, hair, skin shading, and natural proportions now follow the warm garden artwork. Each character has four side-view walking cuts and a back view for watching the pond. The source PNG has real transparency; the cut review composites every actual frame over pale green to reveal background residue and clipped anatomy.

Adult heights use the existing bench dimensions as the reference, with children shorter and modest individual and path-depth variation. Desktop and phone scenes were reviewed for feet on paving, shadows, separation from the machine, and human scale beside the benches. The foreground cobblestones now extend through both side edges, with the blocking bottom-border plants removed from the walking corridor. The benches retain their established size and position; the pond, rail, dock, and garden composition are preserved.

The visitor atlas contains 30 non-overlapping cuts with a shared foot baseline and a hip axis. Four alternating contact/passing poses replace the repeated passing frame. Walking now advances with actual path distance and a stride measured from the two contact poses, scaled with each character’s height. Adults take longer steps than kids; approaching and leaving the rail also account for depth travel. `node scripts/build-art-atlas.mjs observers` packages the artwork by reading alpha without editing the PNG. `npm run review:art` also produces `observer-frames.png`, `thrower-frames.png`, and `thrower-hand-pins.png` alongside the fish and garden sheets. The dock character uses twelve full-body stages with feet fixed on the platform and per-motion hand positions for food release; see [the throw review](throw-review.md).

Watching interest rises modestly on actual releases and in proportion to food eaten, then decreases after each observer's own 5–10 second quiet threshold. Checks cover delayed and queued releases, fish and bird nibbles, bounded interest, shorter quiet watches, and pause. Across twelve half-hour visits per condition, visible crowds averaged 2.70 during quiet periods and 3.25 with regular feeding; neither condition exceeded eight in that sample.

## Secret musk turtle, 14 October 2026

The turtle matches the warm shaded pond artwork, with a domed olive-brown shell, short webbed feet, and pale head stripes. Its atlas contains two gentle paddle poses in each of eight directions, plus eight separate raised heads. All 24 transparent cuts passed bounds and overlap checks and were reviewed on a pale background. Head annotations align the surface sprites with the swimming body; the builder packages existing pixels without changing them.

The assembled game was reviewed in all eight directions underwater, with the head raised, and with the future hidden-underwater option enabled. The body sits beneath the same reflections as the fish; only the feeding head and a small ripple sit above the surface. The current default keeps the whole swimming turtle visible. A feeding peek lasts five seconds and eases in and out using simulation time, so pause freezes it. A new visit removes the old head sprite and resets the single turtle.

Validation passed: 41 unit tests, the TypeScript/production build, all nine production browser scenarios, and the art audit. Checks include real pellet feeding, slow movement, food accounting, collisions with fish, visibility in both modes, pause, and restart. The turtle remains absent from the six-card field guide.

## Machine stock and employee, 14 October 2026

Both machine views now use an empty-globe counterpart registered to their original artwork, with the original pellet pile clipped above it according to remaining stock. The full, half-full, four-serving, and empty states were reviewed in the dialog and garden. The garden lid hinges at the globe's left edge during service, leaving the opening clear for the falling pellets.

The employee matches the existing adult visitors in height and shaded pixel-art style, with a green cap, work shirt, and paper feed sack. Four walking poses advance by measured distance; opening, lifting, pouring, and closing poses share a planted foot baseline. The annotated sack opening sets the work position and the falling-pellet origin. All eight atlas cuts passed bounds, overlap, and hip/sole checks and were visually reviewed. The assembled arrival, refill, and departure were checked alongside the existing visitors and machine.

Validation covers 25 purchases without overselling, dispatch at four remaining, purchases during arrival, waiting for a paid serving, gradual refill to 25, continued use of food already purchased, repeated service, pause, and new visits. The build, 47 unit tests, and 11 production browser scenarios passed.

## Reproduce the review

```bash
npm run review:art
```

This reads the actual PNG and atlas metadata used by the game. It checks all required frame names, image dimensions, frame/source bounds, and non-overlapping rectangles, then saves the fish, turtle, visitor, employee, dock-character, and garden review sheets under ignored `test-results/art-review`. The garden sheet covers every source-image pixel in six full-detail tiles.

For a regenerated asset, run `node scripts/build-art-atlas.mjs` with `fish`, `turtle`, `machine`, `observers`, `thrower`, or `employee`. The builder inspects alpha and leaves the PNG pixels unchanged. Review each resulting pose before accepting it; automatic bounds checks cannot establish correct anatomy.

`npm run test:browser` exercises the garden machine on desktop and touch, verifies a refill preserves unused throws and adds 5 kr, and checks that opening the machine does not throw food. Existing browser checks cover every direction, visible submerged fish, throwing, lucky bonuses, the field guide, and reduced motion. The same suite can run against the production build with `FEED_FISH_TEST_MODE=production npm run test:browser`.

Verified on 13 October 2026: the reusable installation script completed, all 48 atlas cuts passed validation, all 19 unit tests passed, the TypeScript/production build passed, and all seven browser scenarios passed in both development and production. Final desktop, phone, and field-guide screenshots were visually reviewed.

Verified on 14 October 2026: all 48 fish, 30 visitor, and 12 dock-character cuts passed bounds and overlap checks. Every new pose, the hand pins, and assembled desktop and phone scenes were visually reviewed. All 29 simulation/observer tests, the production build, and all eight browser scenarios passed in development and production.
