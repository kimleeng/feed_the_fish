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
| Tree reflections | Narrow, dark conifer-like reflections did not match the golden broadleaf trees along the far bank. | Reflected branching trunks and broad yellow-green canopies align with the trees above them, broken into horizontal water ripples. The open lake retains its turquoise color and sun glints. |
| Pellet machine | The machine existed only in a dialog and felt detached from the garden. | A separate red globe machine on a green iron pedestal stands on the dry path left of the dock, with a contact shadow and a legible 5 kr plaque. Clicking or tapping it opens the existing coin ritual. |

The final fish contact sheet has 48 complete single-tail silhouettes and no neighboring-frame marks. The new garden was reviewed for support connections, ground contact, perspective, shore continuity, lily pads, reflections, and consistent warm lighting. The moving fish still render beneath the translucent water reflections; birds remain above them.

## Reproduce the review

```bash
npm run review:art
```

This reads the actual PNG and atlas metadata used by the game. It checks all required frame names, image dimensions, frame/source bounds, and non-overlapping rectangles, then saves `fish-frames.png` and `garden-regions.png` under ignored `test-results/art-review`. The garden sheet covers every source-image pixel in six full-detail tiles.

For a regenerated asset, rebuild metadata with `node scripts/build-art-atlas.mjs fish` or `node scripts/build-art-atlas.mjs machine`. The builder inspects alpha and leaves the PNG pixels unchanged. Review each resulting pose before accepting it; automatic bounds checks cannot establish correct anatomy.

`npm run test:browser` exercises the garden machine on desktop and touch, verifies a refill preserves unused throws and adds 5 kr, and checks that opening the machine does not throw food. Existing browser checks cover every direction, visible submerged fish, throwing, lucky bonuses, the field guide, and reduced motion. The same suite can run against the production build with `FEED_FISH_TEST_MODE=production npm run test:browser`.

Verified on 13 October 2026: the reusable installation script completed, all 48 atlas cuts passed validation, all 19 unit tests passed, the TypeScript/production build passed, and all seven browser scenarios passed in both development and production. Final desktop, phone, and field-guide screenshots were visually reviewed.

Verified on 14 October 2026 for the tree-reflection and wind update: all 24 unit checks, the TypeScript/production build, the art validation, and all eight development browser scenarios passed. The garden regions and desktop and phone screenshots were visually reviewed. The new browser scenario checks visible surface particles, clipping to the pond, shared wind snapshots, pause, visit reset, and live reduced-motion changes.
