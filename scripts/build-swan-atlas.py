"""Register whole swan poses without modifying source PNG pixels (requires Pillow).
Usage: python scripts/build-swan-atlas.py [swimming.png flight.png eating.png]
With no arguments, rebuild metadata from the committed PNGs.
"""
import json
import shutil
import statistics
import sys
from pathlib import Path
from PIL import Image

ART = Path(__file__).resolve().parents[1] / 'public' / 'art'
DIRECTIONS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne']


def inspect(source):
    image = Image.open(source)
    assert image.size == (1024, 1536), image.size
    width, height = image.size
    alpha = bytearray(image.getchannel('A').tobytes())
    boxes = {}
    # Connected whole silhouettes avoid slicing raised wings at nominal row edges.
    for index in range(width * height):
        if alpha[index] < 64:
            continue
        queue = [index]
        alpha[index] = 0
        left = right = index % width
        top = bottom = index // width
        for pixel in queue:
            x, y = pixel % width, pixel // width
            left, right, top, bottom = min(left, x), max(right, x), min(top, y), max(bottom, y)
            for neighbor in (pixel-1 if x else -1, pixel+1 if x < width-1 else -1, pixel-width, pixel+width):
                if 0 <= neighbor < len(alpha) and alpha[neighbor] >= 64:
                    alpha[neighbor] = 0
                    queue.append(neighbor)
        if len(queue) < 300:
            continue
        cell = (int((top+bottom)/2/192), int((left+right)/2/256))
        assert cell not in boxes, ('Two silhouettes in one cell', cell)
        boxes[cell] = (left, top, right+1, bottom+1)
    assert len(boxes) == 32, ('Expected 32 complete poses', len(boxes))
    return image, boxes


def water_anchor(image, box):
    left, top, right, bottom = box
    pixels = image.load()
    # Pale feathers define the floating body. Excluding orange/black bill pixels
    # prevents a lowered beak from dragging the torso below its waterline.
    body = [(x, y) for y in range(top+(bottom-top)//2, bottom) for x in range(left, right)
            if pixels[x, y][3] >= 128 and pixels[x, y][2] >= 105 and pixels[x, y][0] >= 140]
    water = max(y for _, y in body) + 2
    band = [x for x, y in body if water-(bottom-top)*.25 < y < water-(bottom-top)*.04]
    return statistics.median(band), water


def frame(name, box, anchor, reference, water=False):
    left, top, right, bottom = box
    x, y, w, h = left-1, top-1, right-left+2, bottom-top+2
    assert x >= 0 and y >= 0 and x+w <= 1024 and y+h <= 1536, name
    ax, ay = anchor
    sx = round(256 + x-ax)
    sy = round(256 + (.2*reference if water else 0) + y-ay)
    assert min(sx, sy) >= 0 and max(sx+w, sy+h) <= 512, name
    result = dict(filename=name, frame=dict(x=x, y=y, w=w, h=h), rotated=False, trimmed=True,
                  spriteSourceSize=dict(x=sx, y=sy, w=w, h=h), sourceSize=dict(w=512, h=512),
                  referenceHeight=reference, bodyBounds=dict(x=sx+1, y=sy+1, w=right-left, h=bottom-top))
    result['waterline' if water else 'bodyAnchor'] = dict(x=sx+ax-x, y=sy+ay-y)
    return result


def build(sources):
    pins = json.loads((ART/'swan-flight-pins.json').read_text())
    textures = []
    for kind, source in zip(['swimming', 'flight', 'eating'], sources):
        image, boxes = inspect(source)
        frames = []
        for row, direction in enumerate(DIRECTIONS):
            resting = boxes[row, 0]
            reference = (water_anchor(image, resting)[1] - resting[1]) / .78 if kind != 'flight' else pins['referenceHeight']
            for col in range(4):
                if kind == 'eating' and col == 0:
                    continue  # Use the shipped swimming rest between meals.
                # One generated recovery faced the wrong way. Hold the correct
                # raised-wing drawing instead; the other three keys still flap.
                source_col = 0 if kind == 'flight' and direction == 'nw' and col == 3 else col
                box = boxes[row, source_col]
                anchor = pins['anchors'][row][col] if kind == 'flight' else water_anchor(image, box)
                suffix = ['rest', 'bite', 'chew', 'swallow'][col] if kind == 'eating' else str(col)
                name = f'swan-{"flight-" if kind == "flight" else ""}{direction}-{suffix}'
                entry = frame(name, box, anchor, reference, kind != 'flight')
                if source_col != col:
                    entry['aliasOf'] = 'swan-flight-nw-0'
                frames.append(entry)
        for index, a in enumerate(frames):
            for b in frames[:index]:
                if a.get('aliasOf') == b['filename']:
                    continue
                ra, rb = a['frame'], b['frame']
                assert not (min(ra['x']+ra['w'],rb['x']+rb['w']) > max(ra['x'],rb['x']) and
                            min(ra['y']+ra['h'],rb['y']+rb['h']) > max(ra['y'],rb['y'])), ('Overlapping cuts', a['filename'], b['filename'])
        target = ART/f'swan-{kind}.png'
        if Path(source).resolve() != target.resolve():
            shutil.copyfile(source, target)
        textures.append(dict(image=target.name, size=dict(w=1024, h=1536), frames=frames))
    (ART/'swan.json').write_text(json.dumps(dict(textures=textures), indent=2)+'\n')
    print('Registered 32 swimming, 32 flight and 24 feeding frames with shared body/waterline anchors.')


if __name__ == '__main__':
    sources = sys.argv[1:] or [ART/f'swan-{kind}.png' for kind in ['swimming', 'flight', 'eating']]
    if len(sources) != 3:
        raise SystemExit(__doc__)
    build(sources)
