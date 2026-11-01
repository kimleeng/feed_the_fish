"""Package generated sheets with shared anchors, without changing PNG pixels.

Usage: python scripts/package-idle-art.py birds.png visitors.png
Raw images remain intact; atlas trim metadata normalizes scale and placement.
"""
import json
import shutil
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public' / 'art'
BIRD_ACTIONS = ['preen', 'dabble', 'wing-stretch', 'scratch', 'double-nod', 'foot-paddle']


def entry(box, offset, size):
    x, y, right, bottom = box
    w, h = right-x, bottom-y
    sx, sy = offset
    assert 0 <= sx and 0 <= sy and sx+w <= size and sy+h <= size, (box, offset, size)
    return dict(frame=dict(x=x, y=y, w=w, h=h), rotated=False, trimmed=True,
                spriteSourceSize=dict(x=sx, y=sy, w=w, h=h), sourceSize=dict(w=size, h=size))


def bounds(alpha, region):
    local = alpha.crop(region).getbbox()
    assert local, ('Empty frame', region)
    # Retain a small transparent gutter around the visible silhouette.
    l, t, r, b = local
    return (max(region[0], region[0]+l-2), max(region[1], region[1]+t-2),
            min(region[2], region[0]+r+2), min(region[3], region[1]+b+2))


def save(name, source, frames, extra):
    image = Image.open(source)
    # Different source rectangles must never borrow pixels from another pose.
    rects = [e['frame'] for e in frames.values()]
    for i, a in enumerate(rects):
        for b in rects[i+1:]:
            assert not (min(a['x']+a['w'], b['x']+b['w']) > max(a['x'], b['x']) and
                        min(a['y']+a['h'], b['y']+b['h']) > max(a['y'], b['y'])), 'Overlapping frames'
    target = ART / (name+'.png')
    if Path(source).resolve() != target.resolve():
        shutil.copyfile(source, target)
    meta = dict(image=name+'.png', format='RGBA8888', size=dict(w=image.width, h=image.height), scale='1', **extra)
    (ART / (name+'.json')).write_text(json.dumps(dict(frames=frames, meta=meta), indent=2)+'\n')
    print(f'{name}: {len(frames)} anchored frames; original pixels preserved')


def birds(source):
    image = Image.open(source)
    assert image.size == (1024, 1536), 'Expected 4x6 slots at 256px'
    alpha = image.getchannel('A').point(lambda v: 255 if v >= 32 else 0)
    frames = {}; scales = {}
    for row, name in enumerate(BIRD_ACTIONS):
        species = ['duck', 'gull', 'coot'][row//2]
        old_width = dict(duck=184, gull=180, coot=166)[species]
        baseline = 193 if species != 'coot' else 190
        base = bounds(alpha, (0, max(0,row*256-32),256,(row+1)*256-24))
        # Same scale for all poses of each species, based on its resting body.
        raw_width = base[2]-base[0]-4
        factor = raw_width / old_width
        scales[species] = 320 / 224 / factor
        contact_offset = dict(duck=65,gull=64,coot=63)[species] * factor
        for col in range(4):
            region = (col*256, max(0,row*256-32), (col+1)*256, (row+1)*256-24)
            box = bounds(alpha, region)
            offset = (160+box[0]-col*256-128, round(160+box[1]-row*256-baseline+contact_offset))
            frames[f'{name}-{col}'] = entry(box, offset, 320)
    save('bird-idles', source, frames, dict(renderScale=scales))


def visitors(source):
    image = Image.open(source)
    alpha = image.getchannel('A').point(lambda v: 255 if v >= 32 else 0)
    frames = {}
    for row in range(4):
        for col in range(4):
            region = (round(col*image.width/4),round(row*image.height/4),round((col+1)*image.width/4),round((row+1)*image.height/4))
            box = bounds(alpha, region)
            x,y,r,b = box
            # Feet, rather than the changing arm/wing extents, set the anchor.
            feet = alpha.crop((x,b-24,r,b)).getbbox()
            assert feet
            anchor_x = x+(feet[0]+feet[2])/2
            offset = (round(192+x-anchor_x), round(384*208/224)-(b-y))
            frames[f'visitor-{row}-{col}'] = entry(box, offset, 384)
    save('visitor-idles', source, frames, {})


if __name__ == '__main__':
    birds(sys.argv[1]); visitors(sys.argv[2])
