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
| Tree reflections | Narrow, dark conifer-like reflections did not match the golden broadleaf trees along the far bank. | Reflected branching trunks and broad yellow-green canopies align with the trees above them, broken into horizontal water ripples. The open lake retains its turquoise color and sun glints. The updated foreground walking path remains clear. |
| Pellet machine | The machine existed only in a dialog and felt detached from the garden. | A separate red globe machine on a green iron pedestal stands on the dry path left of the dock, with a contact shadow and a legible 5 kr plaque. Clicking or tapping it opens the existing coin ritual. |

The final fish contact sheet has 48 complete single-tail silhouettes and no neighboring-frame marks. The new garden was reviewed for support connections, ground contact, perspective, shore continuity, lily pads, reflections, and consistent warm lighting. The moving fish still render beneath the translucent water reflections; birds remain above them.

## Visitors and open path, 14 October 2026

The original flat 32×48 visitor drawings were replaced with six detailed shaded designs: three adults and three children. Clothing folds, hair, skin shading, and natural proportions now follow the warm garden artwork. Each character has four side-view walking cuts and a back view for watching the pond. The source PNG has real transparency; the cut review composites every actual frame over pale green to reveal background residue and clipped anatomy.

Adult heights use the existing bench dimensions as the reference, with children shorter and modest individual and path-depth variation. Desktop and phone scenes were reviewed for feet on paving, shadows, separation from the machine, and human scale beside the benches. The foreground cobblestones now extend through both side edges, with the blocking bottom-border plants removed from the walking corridor. The benches retain their established size and position; the pond, rail, dock, and garden composition are preserved.

The visitor atlas contains 30 non-overlapping cuts with a shared foot baseline and a hip axis. Four alternating contact/passing poses replace the repeated passing frame. Walking now advances with actual path distance and a stride measured from the two contact poses, scaled with each character’s height. Adults take longer steps than kids; approaching and leaving the rail also account for depth travel. `node scripts/build-art-atlas.mjs observers` packages the artwork by reading alpha without editing the PNG. `npm run review:art` also produces `observer-frames.png`, `thrower-frames.png`, and `thrower-hand-pins.png` alongside the fish and garden sheets. The dock character uses twelve full-body stages with feet fixed on the platform and per-motion hand positions for food release; see [the throw review](throw-review.md).

Watching interest rises modestly on actual releases and in proportion to food eaten, then decreases after each observer's own 5–10 second quiet threshold. Checks cover delayed and queued releases, fish and bird nibbles, bounded interest, shorter quiet watches, and pause. Across twelve half-hour visits per condition, visible crowds averaged 2.70 during quiet periods and 3.25 with regular feeding; neither condition exceeded eight in that sample.

## Secret musk turtle, 14 October 2026

The turtle matches the warm shaded pond artwork, with a domed olive-brown shell, short webbed feet, and pale head stripes. Its atlas contains two gentle paddle poses in each of eight directions, plus eight separate raised heads. All 24 transparent cuts passed bounds and overlap checks and were reviewed on a pale background. Head annotations align the surface sprites with the swimming body; the builder packages existing pixels without changing them.

The assembled game was reviewed in all eight directions underwater, with the head raised, and with the underwater body hidden. The turtle stays hidden between meals. During a feeding peek, its body appears beneath the reflections while its head and a small ripple appear above the surface. The body and head fade in and out together over the five-second peek using simulation time, so pause freezes both. A new visit removes the old head sprite and resets the single turtle, keeping it hidden until its next meal.

Validation passed: 41 unit tests, the TypeScript/production build, all nine production browser scenarios, and the art audit. Checks include real pellet feeding, slow movement, food accounting, collisions with fish, visibility in both modes, pause, and restart. The turtle remains absent from the six-card field guide.

## Machine stock and employee, 14 October 2026

Both machine views use an empty-globe counterpart registered to their original artwork. A shared atlas supplies 25 individually illustrated pellet piles, one for each remaining serving, with complete pieces along the irregular surface. All piles use a fixed scale and bottom baseline; purchases select the next smaller drawing, empty hides it, and pouring advances toward the full drawing. Atlas packaging preserves the source PNG, keeps cuts outside the pellet silhouettes, and orders the drawings by painted food area. The garden lid hinges at the globe's left edge during service, leaving the opening clear for the falling pellets.

The fill illustrations use many small grains to match the original machine's pellet scale. Full and nearly empty piles were compared at the actual display size, including the collection hand. Both machine views keep the whole piles inside the glass. Atlas packaging identifies the transparent gutters around each drawing, preserving loose individual grains together with their pile.

The employee matches the existing adult visitors in height and shaded pixel-art style, with a green cap, work shirt, and paper feed sack. Four walking poses advance by measured distance; opening, lifting, pouring, and closing poses share a planted foot baseline. The annotated sack opening sets the work position and the falling-pellet origin. All eight atlas cuts passed bounds, overlap, and hip/sole checks and were visually reviewed. The assembled arrival, refill, and departure were checked alongside the existing visitors and machine.

All 25 populated states and the empty globe were visually reviewed in both machine views. Browser checks verify 26 distinct canvas results, matching garden frames, and no stock-dependent cropping. Validation also covers 25 purchases without overselling, dispatch at four remaining, purchases during arrival, waiting for a paid serving, gradual refill to 25, continued use of food already purchased, repeated service, pause, and new visits. The build, 47 unit tests, and 11 production browser scenarios passed. The throw-animation test now holds animals in their chewing state until its intended fish is positioned, preventing another animal from eating its lucky pellet during frame inspection.

## Denser animation cycles and throw direction, 14 October 2026

The runtime now loads 330 distinct animation drawings across six multi-image atlases, including 160 new intermediate poses. Every visitor and the employee has an eight-pose walking cycle. All fish, birds, and the turtle have four swimming poses in each of eight directions. The dock character has 24 drawings across its three throws, and the employee has additional reaching, lifting, and closing transitions. The original PNGs are retained alongside the new sheets.

Cycle duration, movement speed, and measured walking distances are preserved. Frame metadata calibrates the new drawings to the established character sizes and foot baselines. Swimmer sizes are matched to the original silhouette in each direction, keeping their water layers and collision cores unchanged. The turtle's body and head still appear only during its feeding peek.

Throw direction is stored with each queued action. The character faces the selected side when the action starts and keeps that direction afterward. Hand food, lucky indicators, and actual pellet origins use the matching mirrored hand coordinates. Center throws retain the preceding direction; rejected input and pointer motion do not turn the character.

`node scripts/build-animation-atlases.mjs` packages the original and supplementary images without repainting or resampling their pixels. Its output includes per-frame scale, sole, hand, and sack-opening metadata. `npm run review:art` checks the expanded atlases for missing frames, bounds, overlaps, and ground contacts, and produces six `*-cycles.png` sheets in animation order. The supplementary young-carp sheet and visitor sheet have clear gutters so neighboring pixels stay outside the atlas cuts.

Validation passed: all 330 animation cuts, 48 unit tests, the TypeScript/production build, and all 12 production browser scenarios. Visitor and swimmer scenarios passed again after the final spacing corrections. The cycle sheets and assembled desktop and phone scenes were visually inspected, including the character continuing to look right with an empty hand.

## Walking mechanics, 14 October 2026

The adult and employee cycles now use corrected weight-transfer, passing, and toe-off drawings. The raised leg passes forward while the support foot moves from ahead of the hip to behind it. Original heel-contact poses preserve the existing measured strides, and each source row is calibrated to the established height and sole baseline. Children retain their existing proportions and drawings. The animation count remains 330; 24 walking cuts are replaced rather than adding longer cycles.

All seven walking designs use distance-based phase timing with a short heel-contact stage and longer weight transfer. Visitors brake before watching, stop with their soles on the path, and accelerate from a close-legged pose when leaving. Smooth path interpolation removes the abrupt bend at the start and end of the approach. The employee uses the same acceleration and braking, restarts its stride when departing, and has a planted waiting pose.

Regression checks cover braking and departure in both directions, stationary stride clocks, the employee's waiting and departure poses, and the existing population and feeding behavior. A browser check inspects all eight poses of each design for grounded soles, stable scale, mirroring, and the adults' support foot moving behind the hip at toe-off. The atlas audit and cycle sheets check the actual packaged drawings.

Validation passed: the production build, all 50 unit tests, all 13 production browser scenarios (including phone controls), and all 330 animation cuts. The assembled walkers and cycle sheets were visually inspected.

## Hand HUD and segmented walking attempt, 14 October 2026 (walking superseded)

The HUD uses a new 4×4 hand sheet: ten regular arrangements of four small pellets, two lucky arrangements with a golden pellet, and an empty palm. The regular images shuffle without repeating within a group of ten; lucky images use a separate two-image deck. The next handful changes on an accepted throw and stays unchanged through ordinary state updates, pauses, invalid input, and refills. Gameplay randomness is independent of the presentation shuffle. Desktop and phone screenshots were reviewed at their actual display sizes.

This attempt used 48 cached poses for each of the six visitors and the employee. A continuous lower-leg rig uses the existing artwork and intact shoes, replaces the exaggerated raised-knee poses, and maintains a longer planted phase. Child stride lengths are shorter, producing more footfalls over the same distance. Between pose samples, a positional correction prevents the supporting shoe from drifting as the body moves forward. No cycle has both feet airborne, and foot clearance is limited to a few game pixels. The prior authored walk sheets remain available for reference; the runtime uses the new cache.

`node scripts/review-walking.mjs` produces a sheet of all seven designs, an assembled scene, and motion sequences sampled every quarter second at the game's movement speeds. The initial review covered knee and hip joins, shoe shape, scale, mirroring, and actual travel. Browser checks cover all 48 poses, painted soles at the ground contacts, horizontal foot locking during movement in both directions, and the unchanged stopping, refilling, and watching behavior.

The user subsequently rejected this gait: the segmented legs looked much worse. Passing geometric checks did not establish acceptable animation quality. The rig and its procedural shoe-locking code have now been removed.

Validation passed: 55 unit tests, the TypeScript/production build, and all 14 browser scenarios in both development and production. The walking scenario checks 392 painted supporting-foot contacts across the 336 cached frames and stationary support positions while the seven characters move. Desktop and phone HUDs and the walking motion sheets were visually reviewed.


## Complete illustrated walks, 14 October 2026

The segmented walking attempt was rejected for visibly poor legs. It is replaced by eight complete illustrations for each of the six visitors and the employee. Every cel contains the entire person. The runtime loads those original PNGs directly and changes frames according to distance traveled. The leg rig, generated canvas texture, and procedural shoe-position correction are removed.

The new atlas builder writes only whole-person frame rectangles, hip/sole registration, one reference height per design, and a cycle distance measured from the two contact drawings. It does not alter PNG pixels or assemble anatomy. Earlier generated sheets that repeated one lead-leg pose were rejected during review. The accepted sheets use an explicit walking-pose reference for the contact, passing, and opposite-step sequence.

Regression checks now verify that the renderer uses the original complete PNG drawings, visits every pose in both travel directions, maintains uniform scale and sole alignment, and preserves watching, stopping, refilling, and the random handful HUD. Pose sheets and samples of actual movement provide the visual review; numerical contact checks alone cannot establish a convincing walk.

Validation: all 56 complete walk drawings passed atlas bounds and overlap checks; 55 unit tests and the TypeScript/production build passed. All 14 production browser scenarios passed, with the new walking scenario rerun after correcting its image-source check for Phaser’s blob URLs. All seven pose sheets, quarter-second movement samples, and the assembled garden were visually inspected. The source PNGs are unchanged copies of the generated full-body drawings.

## Stable bird cycles, 14 October 2026

The prior four-frame bird cycle alternated drawings from two sheets with different body proportions and painted ripple rings. Per-frame scaling based on the full silhouette, including those ripples, made the difference more visible. The repeated change read as a pulse instead of paddling.

Mallards, gulls, and coots now each have one consistent sheet: four complete poses in each of eight directions, with clean transparency around the bird and no painted water. The existing scene draws the water rings and wakes. The atlas registers the lower body and waterline, uses one fixed scale for all four poses of a heading, and retains the original bird sizes using body-only reference measurements. Initial spawning uses the same scale as subsequent updates.

All 96 drawings were reviewed in cycle order. Width and height variation within a cycle stays below 2.5%; painted-area variation stays below 3%. Browser regression checks measure actual PNG pixels through both paddling and chewing cycles in all directions, including the waterline, body center, dimensions, painted area, and unchanged rendering scale. These checks accompany visual review of the birds on the pond.

Validation passed: all 96 bird atlas cuts, 55 unit tests, the TypeScript/production build, and all 15 production browser scenarios. Desktop and phone pond screenshots were reviewed. Rebuilding all animation atlases reproduces the bird update without changing the other species or character atlases.

## Consistent dimensions through turns, 14 October 2026

The preceding bird-cycle fix stabilized four poses within each heading but retained different size references between headings. Diagonal views could therefore shrink substantially during a turn. The old fish packaging also treated each directional crop as its own size reference; some young-carp strokes were noticeably smaller.

Each species now has a fixed physical dimension relative to its profile size in `src/appearance.ts`. Bird registration uses crown-to-waterline height across all eight headings, retaining a fixed scale within each paddle cycle. Fish and turtle registration measures each intact silhouette along its long axis after accounting for the common pond-depth projection. All changes are uniform scaling and atlas registration; the source drawings and their aspect ratios remain intact. The turtle's surfaced head has its own fixed length and is registered against the calibrated underwater head position, including its ripple anchor.

The new browser regression turns every species through all eight directions and all four strokes. It measures actual painted bird height and independently measures the maximum distance between submerged silhouette pixels in pond coordinates, checks unchanged profiles and tints, and verifies the turtle's surfaced head size and annotated anchor. The collision check now reads the actual runtime animation atlases, including intermediate frames. Full cycle sheets and an eight-direction comparison from the running renderer accompany these measurements.

Validation passed: all 232 animal atlas cuts, 55 unit tests, the TypeScript/production build, and all 16 production browser scenarios. The complete animal cycle sheets, all eight rendered directions, the pond, and the turtle's feeding peek were visually reviewed. Fixed physical dimensions vary by less than 5% across complete turns and strokes, allowing small differences in the hand-drawn silhouettes while preserving natural foreshortening.

## Danish autumn visitors, 14 October 2026

Six new visitor designs double the cast to twelve: three adults in a sand coat, navy quilted jacket, and moss raincoat, plus three children in mustard and teal rainwear and a brick-red puffer. Scarves, knit hats, full-length trousers, wellies, and practical shoes give the new set a contemporary Danish autumn wardrobe. The new designs cover different ages, builds, hair, and skin tones while retaining the game's illustrated style.

Each new transparent sheet contains eight complete walking drawings and a ninth rear-facing watching pose. All nine use one physical height and sole baseline; the renderer changes the whole frame and mirrors it for the return direction. The walking reference includes both close passing poses, and candidates with a repeated wide stride in the second passing position were corrected during review. Original visitor and employee artwork remains in use.

`src/observer-looks.ts` is the shared catalogue for arrival selection, heights, atlas packaging, and review coverage. New arrivals prefer unused outfits in their age group. Population targets and the age-based watching behavior are preserved. Browser coverage now exercises all twelve visitors and the employee, both walking directions, complete PNG frames, ground contact, and consistent outfits and scale when the autumn visitors stop to watch. The review script produces separate walking, watching, and movement sheets for the original and autumn groups.

Validation passed: all 110 walking/watching atlas cuts, 56 unit tests, the TypeScript/production build, and all 16 production browser scenarios. After the final pose corrections, the atlas checks were rerun and all six new nine-pose sheets, movement samples, garden walking/watching views, and phone scene were visually reviewed. The seven original walking sheets and their atlas entries remain unchanged.

## Tree reflections and wind, 14 October 2026

Broad, yellow-green reflected canopies and branching trunks now follow the actual deciduous trees on the far bank. The garden retains the open cobblestone walking corridor, benches, lamps, dock, and clear central lake used by the visitor update.

Gentle surface particles drift with a shared, seeded breeze. Direction and strength change smoothly, with a timestamped snapshot recorded each simulation second for the current visit. Pause freezes the wind and particles; a new visit resets them. Reduced motion hides the particles while wind continues to update and record. Existing visitors, dock throws, turtle feeding, stock, and employee behavior remain in place.

Validation passed: all 61 unit tests, the TypeScript/production build, the art audit, and all 17 production browser scenarios. The garden regions and assembled desktop and phone scenes were visually reviewed, including the corrected reflections and the clear walking path.

## Reproduce the review

```bash
npm run review:art
```

This reads the actual PNG and atlas metadata used by the game. It checks all required frame names, image dimensions, frame/source bounds, and non-overlapping rectangles, then saves the fish, turtle, visitor, employee, dock-character, and garden review sheets under ignored `test-results/art-review`. The garden sheet covers every source-image pixel in six full-detail tiles.

For a regenerated asset, run `node scripts/build-art-atlas.mjs` with `fish`, `turtle`, `machine`, `observers`, `thrower`, or `employee`. The builder inspects alpha and leaves the PNG pixels unchanged. Review each resulting pose before accepting it; automatic bounds checks cannot establish correct anatomy.

`npm run test:browser` exercises the garden machine on desktop and touch, verifies a refill preserves unused throws and adds 5 kr, and checks that opening the machine does not throw food. Existing browser checks cover every direction, visible submerged fish, throwing, lucky bonuses, the field guide, and reduced motion. The same suite can run against the production build with `FEED_FISH_TEST_MODE=production npm run test:browser`.

Verified on 13 October 2026: the reusable installation script completed, all 48 atlas cuts passed validation, all 19 unit tests passed, the TypeScript/production build passed, and all seven browser scenarios passed in both development and production. Final desktop, phone, and field-guide screenshots were visually reviewed.

Verified on 14 October 2026: all 48 fish, 30 visitor, and 12 dock-character cuts passed bounds and overlap checks. Every new pose, the hand pins, and assembled desktop and phone scenes were visually reviewed. All 29 simulation/observer tests, the production build, and all eight browser scenarios passed in development and production.
