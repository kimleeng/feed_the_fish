# Feed the Fish

An untimed Godot 4.6 game set beside a garden pond in Copenhagen. One 5 kr game coin buys twenty throws. Fish wait for the splash. Birds watch the arc and can catch a pellet just before it lands. Unused throws carry over when you refill.

## Play

Open this folder's `project.godot` in Godot 4.6 and press **F5**. All runtime art and audio are included. To launch from a terminal, run these commands in this folder.

```sh
godot --headless --editor --import
godot --path .
```

| Action | Control |
| --- | --- |
| Aim and throw | Click or tap open water, or aim with the arrows and press Space |
| Buy food | Click the red post beside the dock or press M, then insert a coin |
| Read the field guide | G opens the guide. Left and Right turn the pages |
| Pause or start a new visit | P or Escape opens the pause menu |
| Toggle sound | S |
| Navigate buttons | Tab and Shift+Tab move focus. Enter activates a button |

The journal counts the amount fish eat, the individual fish fed, and the fish share of all eaten food. A lucky handful carries a golden pellet. The first fish to nibble it earns 50 extra points. The best score and sound preference are saved in `user://garden.cfg`.

## Art and motion

The pond is painted onto a 480 × 320 pixel grid. Godot renders the game into a low-resolution viewport with nearest filtering, lossless textures and integer enlargement. The journal moves below the pond in portrait windows. Windows smaller than the native grid use a fit-to-window scale.

The six species each have eight directional views and eight stroke frames per view. The atlas build registers the paired paintings before bending a carp's tail or rocking a bird about its waterline. Each swimmer draws at its native size. Changing direction preserves its stroke phase, and its speed sets its cadence. The field guide uses a larger illustrated cycle prepared at the size of the plate.

Movement and food use a 60 Hz physics tick. Swimmers accelerate and turn gradually, keep space around their neighbors, and look for food on staggered intervals. Four shoals share moving destinations. A water shader lays the garden's own reflections over the fish. Birds and their wakes sit above that layer.

Open `dock/throw_hand.tscn` in the animation editor to adjust the toss, sweep or high lob. Each clip moves a registered sleeve cutout and has one method key at release. Clicking ahead reserves throws in order. Pausing freezes the current clip, its queue, and the pond.

## Working on the game

| Location | Contents |
| --- | --- |
| `garden.tscn` | Main scene, journal, input, pause and saved record |
| `pond/species/` | Editable resident profiles, including gait, speed, vision, bite and chew duration |
| `pond/pond.tscn` | Pond layers, swimmers, food, water and dock |
| `dock/machine.tscn` | Coin, crank, falling food and hand collection timeline |
| `art/swimmers/` | Ready-to-use PNG atlases and Godot SpriteFrames |

To rebuild the art after editing the original paintings in the parent project's `public/art`, run `python3 tools/bake_art.py` with Pillow and NumPy installed. The bundled title font is Liberation Serif Bold. Its license is in [art/type/LICENSE.txt](art/type/LICENSE.txt).

## Verify

After importing, run the native visit checks. They exercise the actual game scene, UI input and animation events using a temporary save. Running with a graphical display also exercises window resizing and portrait input.

```sh
godot --headless --fixed-fps 60 --script res://tests/visit.gd
```
