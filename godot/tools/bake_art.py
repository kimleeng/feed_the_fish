"""Rebuild the game's 1:1 pixel art from the original pond illustrations.

Optional authoring tool. Run with Python 3, Pillow and NumPy. The Godot
project ships the results and never opens the browser atlases at runtime.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "public" / "art"
ART = ROOT / "art"
DIRECTIONS = ("e", "se", "s", "sw", "w", "nw", "n", "ne")
CELLS = {"koi": 34, "carp": 30, "minnow": 22, "duck": 32, "gull": 30, "coot": 26}
LANCZOS = Image.Resampling.LANCZOS


def pixel_cut(image, size):
    # Filter once in premultiplied alpha, then commit each edge to the pixel grid.
    cut = image.convert("RGBa").resize(size, LANCZOS).convert("RGBA")
    cut.putalpha(cut.getchannel("A").point(lambda a: 255 if a >= 116 else 0))
    return cut


def register(image, frame):
    box, trim, full = (frame[key] for key in ("frame", "spriteSourceSize", "sourceSize"))
    piece = image.crop((box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"]))
    canvas = Image.new("RGBA", (full["w"], full["h"]))
    canvas.paste(piece, (trim["x"], trim["y"]))
    return canvas


def fit_second(first, second):
    # The two painted poses sometimes change size. Register their silhouettes
    # before animating so that the head never jumps when the stroke changes.
    bounds = lambda im: im.getchannel("A").point(lambda a: 255 if a > 100 else 0).getbbox()
    a, b = bounds(first), bounds(second)
    aligned = Image.new("RGBA", first.size)
    aligned.paste(second.crop(b).resize((a[2] - a[0], a[3] - a[1]), LANCZOS), a[:2])
    return aligned


def stroke_cycle(first, second, direction, cell, bird):
    w, h = first.size
    y, x = np.mgrid[0:h, 0:w]
    dx, dy = math.cos(direction * math.tau / 8), math.sin(direction * math.tau / 8)
    longitudinal = (x - w / 2) * dx + (y - h / 2) * dy
    tail = np.clip((18.0 - longitudinal) / 84.0, 0, 1)
    second = fit_second(first, second)
    for step in range(8):
        phase = step * math.tau / 8
        weight = (1 - math.cos(phase)) / 2
        # Matched paintings supply fin/feather detail. The larger motion comes
        # from a travelling tail wave or a bird rocking about its waterline.
        pose = Image.blend(first.convert("RGBa"), second.convert("RGBa"), weight).convert("RGBA")
        if bird:
            pitch = math.sin(phase) * 0.038 * dx
            u = x + (y - h * 0.60) * pitch
            v = y - (x - w / 2) * pitch - 3.8 * math.sin(phase)
        else:
            bend = 18.0 * tail ** 1.55 * np.sin(phase - 2.0 * tail)
            u = x + dy * bend
            v = y - dx * bend
        pixels = np.asarray(pose)[np.clip(np.rint(v).astype(int), 0, h - 1),
                                  np.clip(np.rint(u).astype(int), 0, w - 1)]
        yield pixel_cut(Image.fromarray(pixels), (cell, cell))


def write_frames(name, cell, plate_row):
    lines = ['[gd_resource type="SpriteFrames" format=3]', '',
             f'[ext_resource type="Texture2D" path="res://art/swimmers/{name}.png" id="atlas"]',
             '[ext_resource type="Texture2D" path="res://art/field-guide.png" id="plates"]', '']
    animations = []
    views = [(direction, "atlas", cell, row) for row, direction in enumerate(DIRECTIONS)]
    views.append(("plate", "plates", 104, plate_row))
    for direction, texture, size, row in views:
        frames = []
        for frame in range(8):
            key = f'{direction}_{frame}'
            lines += [f'[sub_resource type="AtlasTexture" id="{key}"]',
                      f'atlas = ExtResource("{texture}")',
                      f'region = Rect2({frame * size}, {row * size}, {size}, {size})',
                      'filter_clip = true', '']
            frames.append(f'{{"duration": 1.0, "texture": SubResource("{key}")}}')
        animations.append('{\n"frames": [' + ', '.join(frames) + '],\n"loop": true,\n'
                          f'"name": &"{direction}",\n"speed": 8.0\n}}')
    lines += ['[resource]', 'animations = [' + ', '.join(animations) + ']', '']
    (ART / "swimmers" / f"{name}.tres").write_text('\n'.join(lines))


def bake_swimmers():
    plates = Image.new("RGBA", (104 * 8, 104 * len(CELLS)))
    for plate_row, (name, cell) in enumerate(CELLS.items()):
        bird = name in ("duck", "gull", "coot")
        atlas = "bird-swimmers" if bird else "fish-swimmers"
        source = Image.open(SOURCE / f"{atlas}.png").convert("RGBA")
        frames = json.loads((SOURCE / f"{atlas}.json").read_text())["frames"]
        sheet = Image.new("RGBA", (cell * 8, cell * 8))
        for row, direction in enumerate(DIRECTIONS):
            first, second = [register(source, frames[f"{name}-{direction}-{i}"]) for i in range(2)]
            if direction == "e":
                for i, cut in enumerate(stroke_cycle(first, second, row, 104, bird)):
                    plates.paste(cut, (i * 104, plate_row * 104))
            for i, cut in enumerate(stroke_cycle(first, second, row, cell, bird)):
                sheet.paste(cut, (cell * i, cell * row))
        sheet.save(ART / "swimmers" / f"{name}.png", optimize=True)
        write_frames(name, cell, plate_row)
    plates.save(ART / "field-guide.png", optimize=True)


def cutout(filename):
    raw = Image.open(SOURCE / f"{filename}.png").convert("RGBA")
    bounds = raw.getchannel("A").point(lambda a: 255 if a > 75 else 0).getbbox()
    return raw.crop(bounds)


def ripple_art():
    # Broken elliptical rings advance by whole pixels and share one neutral
    # mask; Godot tints the same ink for landings, nibbles and lucky bites.
    sheet = Image.new("RGBA", (40 * 12, 40))
    for row, end_radius in enumerate((11, 18)):
        for frame in range(12):
            tile = Image.new("RGBA", (40, 20))
            draw = ImageDraw.Draw(tile)
            radius = round(2 + (end_radius - 2) * math.sqrt(frame / 11))
            for side in (-1, 1):
                points = [(round(20 + side * radius * math.cos(-1.08 + j * 0.24)),
                           round(10 + radius * 0.38 * math.sin(-1.08 + j * 0.24))) for j in range(10)]
                draw.line(points, fill="white")
            sheet.paste(tile, (frame * 40, row * 20))
    sheet.save(ART / "ripples.png")


def dock_art():
    for name, height, output in (("scene-machine", 68, "dispenser-post"),
                                 ("machine", 125, "dispenser"), ("hand", 67, "collect-hand")):
        raw = cutout(name)
        pixel_cut(raw, (round(height * raw.width / raw.height), height)).save(ART / f"{output}.png")
    # All seven cutout views share the palm at (46, 32). AnimationPlayer can
    # swing the sleeve without rotating already-rasterized pixels in the game.
    source = cutout("throw-hand").convert("RGBa")
    source = source.resize((48 * 4, 110 * 4), LANCZOS).convert("RGBA")
    large = Image.new("RGBA", (96 * 4, 140 * 4))
    large.paste(source, (24 * 4, 9 * 4))
    sheet = Image.new("RGBA", (96 * 7, 140))
    for i, angle in enumerate((-15, -10, -5, 0, 5, 10, 15)):
        frame = large.rotate(-angle, Image.Resampling.BICUBIC, center=(46 * 4, 32 * 4))
        sheet.paste(pixel_cut(frame, (96, 140)), (96 * i, 0))
    sheet.save(ART / "throw-arm.png", optimize=True)

    crank = Image.new("RGBA", (21 * 12, 21))
    for i in range(12):
        tile = Image.new("RGBA", (21, 21))
        draw = ImageDraw.Draw(tile)
        draw.ellipse((5, 5, 15, 15), fill="#58655e", outline="#303d39")
        draw.ellipse((7, 7, 13, 13), fill="#c1cabe")
        angle = i * math.tau / 12
        vx, vy = math.cos(angle), math.sin(angle)
        a = (round(10 - 6 * vx), round(10 - 6 * vy))
        b = (round(10 + 8 * vx), round(10 + 8 * vy))
        draw.line([a, b], fill="#34423f", width=5)
        draw.line([a, b], fill="#c6cfc4", width=3)
        draw.ellipse((b[0]-2,b[1]-2,b[0]+2,b[1]+2), fill="#85978e", outline="#394640")
        draw.point((b[0],b[1]-1), fill="#fcf5d6")
        crank.paste(tile, (i * 21, 0))
    crank.save(ART / "crank.png")


if __name__ == "__main__":
    Image.open(SOURCE / "pond.png").convert("RGB").resize((480, 320), LANCZOS).save(ART / "garden.png")
    bake_swimmers()
    ripple_art()
    dock_art()
