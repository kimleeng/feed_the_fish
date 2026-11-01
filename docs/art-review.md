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

## Reproduce the review

```bash
npm run review:art
```

This reads the actual PNG and atlas metadata used by the game. It checks all required frame names, image dimensions, frame/source bounds, and non-overlapping rectangles, then saves `fish-frames.png` and `garden-regions.png` under ignored `test-results/art-review`. The garden sheet covers every source-image pixel in six full-detail tiles.

For a regenerated asset, rebuild metadata with `node scripts/build-art-atlas.mjs fish` or `node scripts/build-art-atlas.mjs machine`. The builder inspects alpha and leaves the PNG pixels unchanged. Review each resulting pose before accepting it; automatic bounds checks cannot establish correct anatomy.

`npm run test:browser` exercises the garden machine on desktop and touch, verifies a refill preserves unused throws and adds 5 kr, and checks that opening the machine does not throw food. Existing browser checks cover every direction, visible submerged fish, throwing, lucky bonuses, the field guide, and reduced motion. The same suite can run against the production build with `FEED_FISH_TEST_MODE=production npm run test:browser`.

Verified on 13 October 2026: the reusable installation script completed, all 48 atlas cuts passed validation, all 19 unit tests passed, the TypeScript/production build passed, and all seven browser scenarios passed in both development and production. Final desktop, phone, and field-guide screenshots were visually reviewed.

## Animal gestures and garden visitors

The idle pass adds 24 bird frames (six gestures × four poses) and 16 visitor frames (four people × four poses). Bird strips retain the mallard, gull, and coot palettes and side-view silhouettes; each action has anticipation, a readable gesture, and recovery. The gull's raised wing extends above its grid row, so atlas cuts explicitly include that space without borrowing pixels from the dabbling duck above it.

`python scripts/package-idle-art.py public/art/bird-idles.png public/art/visitor-idles.png` rebuilds metadata while preserving the source PNGs. Waterlines and feet anchor the poses; each strip uses one scale. Bounds and overlap checks run during packaging. Both full sheets were inspected, followed by desktop and portrait-phone screenshots of the actual renderer. Visitors sit behind a masked slice of the original far railing and have no input targets. They remain small background details, particularly on a portrait phone.

All 18 animal actions were exercised through completion in Chromium, including returning from an idle atlas to directional swimming with the correct flip and scale. The new browser checks also cover visitor reset and reduced-motion presentation; simulation tests cover interruption priority, pause, bounded duration, pond containment, and the spacing of visitor gestures. The complete ten-scenario development browser suite and the three new scenarios against the production build passed.
